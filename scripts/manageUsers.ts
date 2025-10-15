import dotenv from 'dotenv';
import { pool } from '../src/config/db';

dotenv.config();

interface BanOptions {
    userId: number;
    adminId: number;
    reason: string;
    duration?: number; // в часах, если не указано - permanent
    isPermanent?: boolean;
}

interface UserInfo {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_banned: boolean;
    is_deleted: boolean;
    created_at: string;
    ban_reason?: string;
    banned_at?: string;
    banned_until?: string;
    last_login?: string;
}

// Функция для поиска пользователя по email или ID
async function findUser(identifier: string | number): Promise<UserInfo | null> {
    const client = await pool.connect();
    
    try {
        let query: string;
        let params: any[];
        
        if (typeof identifier === 'number' || !isNaN(Number(identifier))) {
            query = 'SELECT * FROM users WHERE id = $1';
            params = [Number(identifier)];
        } else {
            query = 'SELECT * FROM users WHERE email = $1';
            params = [identifier];
        }
        
        const result = await client.query(query, params);
        return result.rows[0] || null;
    } finally {
        client.release();
    }
}

// Бан пользователя
async function banUser(options: BanOptions): Promise<void> {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Проверяем существование пользователя
        const user = await findUser(options.userId);
        if (!user) {
            throw new Error(`Пользователь с ID ${options.userId} не найден`);
        }
        
        if (user.is_banned) {
            throw new Error(`Пользователь ${user.email} уже заблокирован`);
        }
        
        if (user.is_deleted) {
            throw new Error(`Пользователь ${user.email} удален`);
        }
        
        // Рассчитываем дату окончания бана
        const bannedUntil = options.isPermanent ? null : 
            options.duration ? new Date(Date.now() + options.duration * 60 * 60 * 1000) : null;
        
        // Обновляем пользователя
        await client.query(`
            UPDATE users 
            SET is_banned = true,
                ban_reason = $2,
                banned_at = CURRENT_TIMESTAMP,
                banned_until = $3,
                banned_by = $4
            WHERE id = $1
        `, [options.userId, options.reason, bannedUntil, options.adminId]);
        
        // Записываем в историю банов
        await client.query(`
            INSERT INTO user_bans (
                user_id, banned_by, ban_reason, banned_until, is_permanent, is_active
            ) VALUES ($1, $2, $3, $4, $5, true)
        `, [
            options.userId, 
            options.adminId, 
            options.reason, 
            bannedUntil, 
            options.isPermanent || false
        ]);
        
        // Деактивируем активные подписки
        await client.query(`
            UPDATE subscriptions 
            SET is_active = false 
            WHERE user_id = $1 AND is_active = true
        `, [options.userId]);
        
        await client.query('COMMIT');
        
        const banType = options.isPermanent ? 'ПОСТОЯННО' : 
            options.duration ? `на ${options.duration} часов` : 'ПОСТОЯННО';
            
        console.log('✅ Пользователь заблокирован:');
        console.log(`   👤 Пользователь: ${user.first_name} ${user.last_name} (${user.email})`);
        console.log(`   ⚠️  Причина: ${options.reason}`);
        console.log(`   ⏰ Длительность: ${banType}`);
        if (bannedUntil) {
            console.log(`   📅 До: ${bannedUntil.toLocaleString('ru-RU')}`);
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Разбан пользователя
async function unbanUser(userId: number, adminId: number, reason?: string): Promise<void> {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const user = await findUser(userId);
        if (!user) {
            throw new Error(`Пользователь с ID ${userId} не найден`);
        }
        
        if (!user.is_banned) {
            throw new Error(`Пользователь ${user.email} не заблокирован`);
        }
        
        // Разблокируем пользователя
        await client.query(`
            UPDATE users 
            SET is_banned = false,
                ban_reason = null,
                banned_at = null,
                banned_until = null,
                banned_by = null
            WHERE id = $1
        `, [userId]);
        
        // Обновляем историю банов
        await client.query(`
            UPDATE user_bans 
            SET is_active = false,
                unbanned_at = CURRENT_TIMESTAMP,
                unbanned_by = $2,
                unban_reason = $3
            WHERE user_id = $1 AND is_active = true
        `, [userId, adminId, reason || 'Разблокировка администратором']);
        
        // Реактивируем подписки если не истекли
        await client.query(`
            UPDATE subscriptions 
            SET is_active = true 
            WHERE user_id = $1 AND end_date > CURRENT_TIMESTAMP
        `, [userId]);
        
        await client.query('COMMIT');
        
        console.log('✅ Пользователь разблокирован:');
        console.log(`   👤 Пользователь: ${user.first_name} ${user.last_name} (${user.email})`);
        if (reason) {
            console.log(`   ℹ️  Причина: ${reason}`);
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Мягкое удаление пользователя (помечает как удаленный)
async function softDeleteUser(userId: number, adminId: number, reason?: string): Promise<void> {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const user = await findUser(userId);
        if (!user) {
            throw new Error(`Пользователь с ID ${userId} не найден`);
        }
        
        if (user.is_deleted) {
            throw new Error(`Пользователь ${user.email} уже удален`);
        }
        
        // Помечаем как удаленный
        await client.query(`
            UPDATE users 
            SET is_deleted = true,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = $2,
                is_banned = false,
                email = email || '_deleted_' || EXTRACT(epoch FROM CURRENT_TIMESTAMP)::text
            WHERE id = $1
        `, [userId, adminId]);
        
        // Деактивируем все подписки
        await client.query(`
            UPDATE subscriptions 
            SET is_active = false 
            WHERE user_id = $1
        `, [userId]);
        
        // Закрываем активные баны
        await client.query(`
            UPDATE user_bans 
            SET is_active = false,
                unbanned_at = CURRENT_TIMESTAMP,
                unbanned_by = $2,
                unban_reason = 'Пользователь удален'
            WHERE user_id = $1 AND is_active = true
        `, [userId, adminId]);
        
        await client.query('COMMIT');
        
        console.log('✅ Пользователь удален (мягкое удаление):');
        console.log(`   👤 Пользователь: ${user.first_name} ${user.last_name} (${user.email})`);
        if (reason) {
            console.log(`   ℹ️  Причина: ${reason}`);
        }
        console.log(`   📝 Данные сохранены для аудита`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Жесткое удаление пользователя (полностью из БД)
async function hardDeleteUser(userId: number, adminId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const user = await findUser(userId);
        if (!user) {
            throw new Error(`Пользователь с ID ${userId} не найден`);
        }
        
        console.log('⚠️  ВНИМАНИЕ: Выполняется жесткое удаление пользователя!');
        console.log(`   👤 Пользователь: ${user.first_name} ${user.last_name} (${user.email})`);
        
        // Удаляем связанные данные (CASCADE должен сработать, но лучше явно)
        await client.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_favorites WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM test_attempts WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_stats WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM payments WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_bans WHERE user_id = $1', [userId]);
        
        // Удаляем самого пользователя
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        
        await client.query('COMMIT');
        
        console.log('✅ Пользователь полностью удален из базы данных');
        console.log('⚠️  Данные не подлежат восстановлению!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Получить статус пользователя
async function getUserStatus(identifier: string | number): Promise<void> {
    const user = await findUser(identifier);
    
    if (!user) {
        console.log('❌ Пользователь не найден');
        return;
    }
    
    console.log('📋 СТАТУС ПОЛЬЗОВАТЕЛЯ:');
    console.log(`   🆔 ID: ${user.id}`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   👤 Имя: ${user.first_name} ${user.last_name}`);
    console.log(`   🔰 Роль: ${user.role}`);
    console.log(`   📅 Создан: ${new Date(user.created_at).toLocaleString('ru-RU')}`);
    
    if (user.is_deleted) {
        console.log('   ❌ СТАТУС: УДАЛЕН');
        return;
    }
    
    if (user.is_banned) {
        console.log('   🚫 СТАТУС: ЗАБЛОКИРОВАН');
        console.log(`   ⚠️  Причина: ${user.ban_reason}`);
        
        const client = await pool.connect();
        try {
            const banInfo = await client.query(`
                SELECT banned_until, is_permanent, banned_at 
                FROM user_bans 
                WHERE user_id = $1 AND is_active = true
                ORDER BY banned_at DESC 
                LIMIT 1
            `, [user.id]);
            
            if (banInfo.rows.length > 0) {
                const ban = banInfo.rows[0];
                console.log(`   📅 Заблокирован: ${new Date(ban.banned_at).toLocaleString('ru-RU')}`);
                
                if (ban.is_permanent) {
                    console.log('   ⏰ Тип: ПОСТОЯННАЯ БЛОКИРОВКА');
                } else if (ban.banned_until) {
                    const until = new Date(ban.banned_until);
                    const now = new Date();
                    
                    if (until > now) {
                        console.log(`   ⏰ До: ${until.toLocaleString('ru-RU')}`);
                        const hoursLeft = Math.ceil((until.getTime() - now.getTime()) / (1000 * 60 * 60));
                        console.log(`   ⌛ Осталось: ${hoursLeft} часов`);
                    } else {
                        console.log('   ⏰ Время блокировки истекло (требуется разблокировка)');
                    }
                }
            }
        } finally {
            client.release();
        }
    } else {
        console.log('   ✅ СТАТУС: АКТИВЕН');
    }
    
    // Показываем подписки
    const client = await pool.connect();
    try {
        const subs = await client.query(`
            SELECT plan_name, is_active, end_date 
            FROM subscriptions 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [user.id]);
        
        if (subs.rows.length > 0) {
            const sub = subs.rows[0];
            console.log(`   📦 Подписка: ${sub.plan_name} (${sub.is_active ? 'Активна' : 'Неактивна'})`);
            if (sub.end_date) {
                console.log(`   📅 До: ${new Date(sub.end_date).toLocaleString('ru-RU')}`);
            }
        }
    } finally {
        client.release();
    }
}

// Список всех пользователей
async function listAllUsers(showPasswords: boolean = false): Promise<void> {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, 
                   u.is_banned, u.is_deleted, u.created_at, u.last_login,
                   s.plan_name, s.is_active as subscription_active, s.end_date
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id 
                AND s.is_active = true 
                AND (s.end_date IS NULL OR s.end_date > CURRENT_TIMESTAMP)
            ORDER BY u.created_at DESC
        `);
        
        if (result.rows.length === 0) {
            console.log('❌ Пользователи не найдены');
            return;
        }
        
        console.log('👥 СПИСОК ВСЕХ ПОЛЬЗОВАТЕЛЕЙ:');
        console.log('=' .repeat(100));
        console.log(`Найдено пользователей: ${result.rows.length}\n`);
        
        result.rows.forEach((user, index) => {
            const statusEmoji = user.is_deleted ? '🗑️' : user.is_banned ? '🚫' : '✅';
            const statusText = user.is_deleted ? 'УДАЛЕН' : user.is_banned ? 'ЗАБЛОКИРОВАН' : 'АКТИВЕН';
            
            console.log(`${index + 1}. ${statusEmoji} ${user.first_name} ${user.last_name} (ID: ${user.id})`);
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   🔰 Роль: ${user.role}`);
            console.log(`   📊 Статус: ${statusText}`);
            console.log(`   📅 Создан: ${new Date(user.created_at).toLocaleString('ru-RU')}`);
            
            if (user.last_login) {
                console.log(`   🔓 Последний вход: ${new Date(user.last_login).toLocaleString('ru-RU')}`);
            } else {
                console.log(`   🔓 Последний вход: Никогда`);
            }
            
            if (user.plan_name) {
                const planStatus = user.subscription_active ? '🟢 Активна' : '🔴 Неактивна';
                console.log(`   📦 Подписка: ${user.plan_name} (${planStatus})`);
                if (user.end_date) {
                    console.log(`   ⏰ Действует до: ${new Date(user.end_date).toLocaleString('ru-RU')}`);
                }
            } else {
                console.log(`   📦 Подписка: Отсутствует`);
            }
            
            console.log('');
        });
        
        // Показываем пароли только если requested и это безопасная среда
        if (showPasswords) {
            console.log('\n🔐 ВАЖНО: Пароли показаны в открытом виде!');
            console.log('⚠️  Это только для тестовых пользователей, созданных нашими скриптами');
            console.log('🛡️  В реальной системе пароли хешированы и не восстанавливаются\n');
            
            console.log('📝 ИЗВЕСТНЫЕ ТЕСТОВЫЕ ПАРОЛИ:');
            console.log('-' .repeat(50));
            console.log('student1@medlearn.ru     → Student123!');
            console.log('student2@medlearn.ru     → Student456!');
            console.log('teacher@medlearn.ru      → Teacher789!');
            console.log('admin@medlearn.ru        → Admin2024!');
            console.log('demo@medlearn.ru         → Demo123!');
            console.log('doctor@medlearn.ru       → DocPass123!');
            console.log('testbanv@example.com     → TestPass123!');
            console.log('testban@example.com      → TestPass123!');
            console.log('student3@medlearn.ru     → Student323!');
        }
        
    } finally {
        client.release();
    }
}

// Список заблокированных пользователей
async function listBannedUsers(): Promise<void> {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT u.id, u.email, u.first_name, u.last_name, 
                   u.ban_reason, u.banned_at, ub.banned_until, ub.is_permanent
            FROM users u
            LEFT JOIN user_bans ub ON u.id = ub.user_id AND ub.is_active = true
            WHERE u.is_banned = true AND u.is_deleted = false
            ORDER BY u.banned_at DESC
        `);
        
        if (result.rows.length === 0) {
            console.log('✅ Заблокированных пользователей нет');
            return;
        }
        
        console.log('🚫 ЗАБЛОКИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ:');
        console.log('=' .repeat(80));
        
        result.rows.forEach((user, index) => {
            console.log(`\n${index + 1}. ${user.first_name} ${user.last_name} (ID: ${user.id})`);
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   ⚠️  Причина: ${user.ban_reason}`);
            console.log(`   📅 Заблокирован: ${new Date(user.banned_at).toLocaleString('ru-RU')}`);
            
            if (user.is_permanent) {
                console.log('   ⏰ Тип: ПОСТОЯННАЯ');
            } else if (user.banned_until) {
                const until = new Date(user.banned_until);
                const now = new Date();
                console.log(`   ⏰ До: ${until.toLocaleString('ru-RU')}`);
                
                if (until <= now) {
                    console.log('   ⚠️  СРОК ИСТЕК - требуется разблокировка');
                } else {
                    const hoursLeft = Math.ceil((until.getTime() - now.getTime()) / (1000 * 60 * 60));
                    console.log(`   ⌛ Осталось: ${hoursLeft} часов`);
                }
            }
        });
        
    } finally {
        client.release();
    }
}

// Автоматическая разблокировка истекших банов
async function autoUnbanExpired(): Promise<void> {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const result = await client.query(`
            UPDATE users 
            SET is_banned = false, ban_reason = null, banned_at = null, 
                banned_until = null, banned_by = null
            WHERE is_banned = true 
            AND banned_until IS NOT NULL 
            AND banned_until <= CURRENT_TIMESTAMP
            RETURNING id, email, first_name, last_name
        `);
        
        if (result.rows.length > 0) {
            // Обновляем историю банов
            await client.query(`
                UPDATE user_bans 
                SET is_active = false, unbanned_at = CURRENT_TIMESTAMP,
                    unban_reason = 'Автоматическая разблокировка по истечении срока'
                WHERE user_id = ANY($1::int[]) AND is_active = true
            `, [result.rows.map(u => u.id)]);
            
            // Реактивируем подписки
            for (const user of result.rows) {
                await client.query(`
                    UPDATE subscriptions 
                    SET is_active = true 
                    WHERE user_id = $1 AND end_date > CURRENT_TIMESTAMP
                `, [user.id]);
            }
            
            await client.query('COMMIT');
            
            console.log(`✅ Автоматически разблокировано ${result.rows.length} пользователей:`);
            result.rows.forEach(user => {
                console.log(`   • ${user.first_name} ${user.last_name} (${user.email})`);
            });
        } else {
            await client.query('COMMIT');
            console.log('ℹ️  Пользователей для автоматической разблокировки не найдено');
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Парсинг аргументов командной строки
function parseArguments() {
    const args = process.argv.slice(2);
    const action = args[0];
    
    if (!action) {
        console.log(`
🛠️  УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ - MedLearn Platform

Доступные команды:

📊 ИНФОРМАЦИЯ:
  status <email|id>              - Статус пользователя
  list                          - Список всех пользователей
  list-passwords                - Список всех пользователей с паролями (тестовые)
  list-banned                   - Список заблокированных пользователей
  auto-unban                    - Автоматическая разблокировка истекших банов

🚫 БЛОКИРОВКА:
  ban <email|id> <adminId> <reason> [hours]     - Заблокировать пользователя
  ban-permanent <email|id> <adminId> <reason>   - Постоянная блокировка
  unban <email|id> <adminId> [reason]          - Разблокировать пользователя

❌ УДАЛЕНИЕ:
  soft-delete <email|id> <adminId> [reason]    - Мягкое удаление (помечает как удаленный)
  hard-delete <email|id> <adminId>             - Жесткое удаление (полностью из БД)

ПРИМЕРЫ:
  # Заблокировать на 24 часа
  npm run manage-users ban user@example.com 1 "Нарушение правил" 24
  
  # Постоянная блокировка
  npm run manage-users ban-permanent spam@example.com 1 "Спам и реклама"
  
  # Разблокировать
  npm run manage-users unban user@example.com 1 "Исправился"
  
  # Статус пользователя
  npm run manage-users status user@example.com
  
  # Мягкое удаление
  npm run manage-users soft-delete user@example.com 1 "Просьба пользователя"
        `);
        process.exit(0);
    }
    
    return { action, args: args.slice(1) };
}

// Основная функция
async function main() {
    try {
        const { action, args } = parseArguments();
        
        switch (action) {
            case 'status':
                if (args.length < 1) {
                    throw new Error('Укажите email или ID пользователя');
                }
                await getUserStatus(args[0]);
                break;
                
            case 'ban':
                if (args.length < 3) {
                    throw new Error('Формат: ban <email|id> <adminId> <reason> [hours]');
                }
                const duration = args[3] ? parseInt(args[3]) : undefined;
                await banUser({
                    userId: isNaN(Number(args[0])) ? (await findUser(args[0]))?.id || 0 : Number(args[0]),
                    adminId: Number(args[1]),
                    reason: args[2],
                    duration,
                    isPermanent: !duration
                });
                break;
                
            case 'ban-permanent':
                if (args.length < 3) {
                    throw new Error('Формат: ban-permanent <email|id> <adminId> <reason>');
                }
                await banUser({
                    userId: isNaN(Number(args[0])) ? (await findUser(args[0]))?.id || 0 : Number(args[0]),
                    adminId: Number(args[1]),
                    reason: args[2],
                    isPermanent: true
                });
                break;
                
            case 'unban':
                if (args.length < 2) {
                    throw new Error('Формат: unban <email|id> <adminId> [reason]');
                }
                const userId = isNaN(Number(args[0])) ? (await findUser(args[0]))?.id || 0 : Number(args[0]);
                await unbanUser(userId, Number(args[1]), args[2]);
                break;
                
            case 'soft-delete':
                if (args.length < 2) {
                    throw new Error('Формат: soft-delete <email|id> <adminId> [reason]');
                }
                const softUserId = isNaN(Number(args[0])) ? (await findUser(args[0]))?.id || 0 : Number(args[0]);
                await softDeleteUser(softUserId, Number(args[1]), args[2]);
                break;
                
            case 'hard-delete':
                if (args.length < 2) {
                    throw new Error('ВНИМАНИЕ! Формат: hard-delete <email|id> <adminId>');
                }
                const hardUserId = isNaN(Number(args[0])) ? (await findUser(args[0]))?.id || 0 : Number(args[0]);
                
                console.log('⚠️  ВНИМАНИЕ! Вы собираетесь ПОЛНОСТЬЮ удалить пользователя из базы данных!');
                console.log('   Это действие НЕОБРАТИМО!');
                console.log('   Рекомендуется использовать soft-delete вместо этого.');
                console.log('\n   Для подтверждения добавьте --confirm в конце команды');
                
                if (!args[2] || args[2] !== '--confirm') {
                    console.log('\n❌ Операция отменена. Для подтверждения добавьте --confirm');
                    process.exit(1);
                }
                
                await hardDeleteUser(hardUserId, Number(args[1]));
                break;
                
            case 'list':
                await listAllUsers(false);
                break;
                
            case 'list-passwords':
                await listAllUsers(true);
                break;
                
            case 'list-banned':
                await listBannedUsers();
                break;
                
            case 'auto-unban':
                await autoUnbanExpired();
                break;
                
            default:
                throw new Error(`Неизвестная команда: ${action}`);
        }
        
        console.log('\n✅ Операция завершена успешно');
        
    } catch (error) {
        console.error('\n❌ Ошибка:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Запуск скрипта
if (require.main === module) {
    main();
}

export { banUser, unbanUser, softDeleteUser, hardDeleteUser, getUserStatus, listAllUsers, listBannedUsers, autoUnbanExpired };