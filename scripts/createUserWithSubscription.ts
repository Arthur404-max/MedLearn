import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { pool } from '../src/config/db';

dotenv.config();

// Типы подписок
const SUBSCRIPTION_PLANS = {
    basic: {
        plan_type: 'basic',
        plan_name: 'Базовый план',
        duration: 'semester',
        price: 299.00,
        features: {
            tests: true,
            resources: 'limited',
            ai_assistant: false,
            practice_modes: ['basic'],
            test_attempts: 50,
            resource_downloads: 10
        },
        duration_months: 6
    },
    premium: {
        plan_type: 'premium',
        plan_name: 'Премиум план',
        duration: 'year',
        price: 999.00,
        features: {
            tests: true,
            resources: 'unlimited',
            ai_assistant: true,
            practice_modes: ['basic', 'advanced', 'simulation'],
            test_attempts: 'unlimited',
            resource_downloads: 'unlimited',
            priority_support: true
        },
        duration_months: 12
    },
    ai_assistant: {
        plan_type: 'ai_assistant',
        plan_name: 'ИИ Ассистент',
        duration: 'year',
        price: 1499.00,
        features: {
            tests: true,
            resources: 'unlimited',
            ai_assistant: true,
            ai_tutoring: true,
            personalized_learning: true,
            practice_modes: ['basic', 'advanced', 'simulation', 'ai_guided'],
            test_attempts: 'unlimited',
            resource_downloads: 'unlimited',
            priority_support: true,
            individual_consultation: true
        },
        duration_months: 12
    }
};

interface UserData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    subscriptionPlan?: keyof typeof SUBSCRIPTION_PLANS;
    isEmailVerified?: boolean;
}

async function createUserWithSubscription(userData: UserData) {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Создание пользователя с подпиской...');

        const {
            email,
            password,
            firstName,
            lastName,
            role = 'student',
            subscriptionPlan = 'basic',
            isEmailVerified = true
        } = userData;

        // Валидация email
        if (!email || !email.includes('@')) {
            throw new Error('Неверный формат email');
        }

        // Валидация пароля
        if (!password || password.length < 8) {
            throw new Error('Пароль должен содержать минимум 8 символов');
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 12);

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Проверяем, существует ли пользователь
        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            throw new Error(`Пользователь с email ${email} уже существует`);
        }

        // Создаем нового пользователя
        const userResult = await client.query(`
            INSERT INTO users (
                email, 
                password_hash, 
                first_name, 
                last_name, 
                role,
                email_verified,
                is_verified,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id, email, first_name, last_name, role, created_at
        `, [
            email, 
            hashedPassword, 
            firstName, 
            lastName, 
            role,
            isEmailVerified,
            isEmailVerified  // устанавливаем оба поля
        ]);

        const user = userResult.rows[0];
        console.log('✅ Пользователь создан:');
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   👤 Имя: ${user.first_name} ${user.last_name}`);
        console.log(`   🔑 Пароль: ${password}`);
        console.log(`   🆔 ID: ${user.id}`);
        console.log(`   📅 Дата создания: ${user.created_at}`);
        console.log(`   ✉️  Email подтвержден: ${isEmailVerified ? 'Да' : 'Нет'}`);

        // Получаем план подписки
        const plan = SUBSCRIPTION_PLANS[subscriptionPlan];
        if (!plan) {
            throw new Error(`Неизвестный план подписки: ${subscriptionPlan}`);
        }

        // Рассчитываем даты подписки
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + plan.duration_months);

        // Создаем подписку
        const subscriptionResult = await client.query(`
            INSERT INTO subscriptions (
                user_id,
                plan_type,
                plan_name,
                duration,
                price,
                features,
                start_date,
                end_date,
                is_active,
                payment_status,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING id, plan_name, end_date
        `, [
            user.id,
            plan.plan_type,
            plan.plan_name,
            plan.duration,
            plan.price,
            JSON.stringify(plan.features),
            startDate,
            endDate,
            true,
            'completed'
        ]);

        const subscription = subscriptionResult.rows[0];

        console.log('✅ Подписка создана:');
        console.log(`   📦 План: ${subscription.plan_name}`);
        console.log(`   💰 Стоимость: ${plan.price} руб.`);
        console.log(`   📅 Действует до: ${subscription.end_date}`);
        console.log(`   🎯 Возможности:`);
        
        // Выводим возможности подписки
        Object.entries(plan.features).forEach(([key, value]) => {
            console.log(`      • ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        });

        // Если план премиум или ИИ, создаем дополнительные записи
        if (subscriptionPlan === 'premium' || subscriptionPlan === 'ai_assistant') {
            // Добавляем премиум статус
            await client.query(`
                UPDATE users 
                SET premium_user = true, premium_expires_at = $2 
                WHERE id = $1
            `, [user.id, endDate]);
            
            console.log('✅ Премиум статус активирован');
        }

        // Создаем начальную статистику пользователя
        await client.query(`
            INSERT INTO user_stats (
                user_id,
                tests_completed,
                total_score,
                average_score,
                study_streak,
                total_study_time,
                created_at
            )
            VALUES ($1, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO NOTHING
        `, [user.id]);

        // Добавляем достижение "Добро пожаловать"
        await client.query(`
            INSERT INTO user_achievements (user_id, achievement_id, earned_at)
            SELECT $1, id, CURRENT_TIMESTAMP
            FROM achievements 
            WHERE name = 'Первые шаги'
            ON CONFLICT (user_id, achievement_id) DO NOTHING
        `, [user.id]);

        // Фиксируем транзакцию
        await client.query('COMMIT');

        console.log('\n🎉 Пользователь с подпиской успешно создан!');
        console.log('\n📋 Данные для входа:');
        console.log(`   🌐 URL: http://localhost:3000`);
        console.log(`   📧 Email: ${email}`);
        console.log(`   🔑 Пароль: ${password}`);
        
        return {
            user,
            subscription,
            plan,
            loginCredentials: {
                email,
                password,
                url: 'http://localhost:3000'
            }
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка при создании пользователя:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Парсинг аргументов командной строки
function parseArguments(): UserData {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🚀 Использование скрипта создания пользователя:

Формат:
node createUserWithSubscription.js <email> <password> <firstName> <lastName> [plan] [role]

Параметры:
  email      - Email адрес пользователя
  password   - Пароль (минимум 8 символов)
  firstName  - Имя пользователя
  lastName   - Фамилия пользователя
  plan       - План подписки: basic, premium, ai_assistant (по умолчанию: basic)
  role       - Роль: student, teacher, admin (по умолчанию: student)

Примеры:
  # Базовый план
  npm run create-user-sub doctor@example.com SecurePass123 Иван Петров
  
  # Премиум план
  npm run create-user-sub doctor@example.com SecurePass123 Анна Сидорова premium
  
  # ИИ Ассистент для преподавателя
  npm run create-user-sub teacher@example.com TeacherPass123 Сергей Иванов ai_assistant teacher

Доступные планы подписки:
  basic        - Базовый план (299 руб, 6 месяцев)
  premium      - Премиум план (999 руб, 12 месяцев) 
  ai_assistant - ИИ Ассистент (1499 руб, 12 месяцев)
        `);
        process.exit(0);
    }

    const [email, password, firstName, lastName, plan = 'basic', role = 'student'] = args;
    
    if (!email || !password || !firstName || !lastName) {
        throw new Error('Обязательные параметры: email, password, firstName, lastName');
    }

    if (!['basic', 'premium', 'ai_assistant'].includes(plan)) {
        throw new Error('План должен быть: basic, premium или ai_assistant');
    }

    if (!['student', 'teacher', 'admin'].includes(role)) {
        throw new Error('Роль должна быть: student, teacher или admin');
    }

    return {
        email,
        password,
        firstName,
        lastName,
        subscriptionPlan: plan as keyof typeof SUBSCRIPTION_PLANS,
        role,
        isEmailVerified: true
    };
}

// Функция для создания пакета пользователей
async function createUserBatch(users: UserData[]) {
    console.log(`🔄 Создание пакета из ${users.length} пользователей...`);
    
    const results = [];
    
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`\n📝 Создание пользователя ${i + 1}/${users.length}:`);
        
        try {
            const result = await createUserWithSubscription(user);
            results.push({ success: true, result });
        } catch (error) {
            console.error(`❌ Ошибка создания пользователя ${user.email}:`, error);
            results.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    
    // Статистика
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\n📊 Статистика создания пакета:`);
    console.log(`   ✅ Успешно: ${successful}`);
    console.log(`   ❌ Ошибки: ${failed}`);
    console.log(`   📋 Всего: ${users.length}`);
    
    return results;
}

// Запуск скрипта
if (require.main === module) {
    const userData = parseArguments();
    
    createUserWithSubscription(userData)
        .then((result) => {
            console.log('\n🎯 Процесс завершен успешно!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Критическая ошибка:', error.message);
            process.exit(1);
        });
}

export { createUserWithSubscription, createUserBatch, SUBSCRIPTION_PLANS };