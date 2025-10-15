import { Request, Response, NextFunction } from 'express';
import { pool } from '../src/config/db';

interface BanInfo {
    is_banned: boolean;
    ban_reason?: string;
    banned_until?: Date;
    is_permanent?: boolean;
    banned_at?: Date;
}

// Проверка бана пользователя
export const checkUserBan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Проверяем только если пользователь аутентифицирован
        if (!req.user || !req.user.id) {
            return next();
        }
        
        const userId = req.user.id;
        
        // Получаем информацию о бане
        const result = await pool.query(`
            SELECT u.is_banned, u.ban_reason, u.banned_at, u.banned_until,
                   ub.is_permanent
            FROM users u
            LEFT JOIN user_bans ub ON u.id = ub.user_id AND ub.is_active = true
            WHERE u.id = $1 AND u.is_deleted = false
        `, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'USER_NOT_FOUND',
                message: 'Пользователь не найден' 
            });
        }
        
        const user = result.rows[0];
        
        // Если пользователь не заблокирован, продолжаем
        if (!user.is_banned) {
            return next();
        }
        
        // Проверяем не истек ли бан
        if (user.banned_until && new Date(user.banned_until) <= new Date()) {
            // Бан истек - автоматически разблокируем
            await pool.query(`
                UPDATE users 
                SET is_banned = false, ban_reason = null, banned_at = null,
                    banned_until = null, banned_by = null
                WHERE id = $1
            `, [userId]);
            
            await pool.query(`
                UPDATE user_bans 
                SET is_active = false, unbanned_at = CURRENT_TIMESTAMP,
                    unban_reason = 'Автоматическая разблокировка по истечении срока'
                WHERE user_id = $1 AND is_active = true
            `, [userId]);
            
            // Реактивируем подписки
            await pool.query(`
                UPDATE subscriptions 
                SET is_active = true 
                WHERE user_id = $1 AND end_date > CURRENT_TIMESTAMP
            `, [userId]);
            
            return next();
        }
        
        // Пользователь заблокирован - возвращаем информацию о бане
        const banInfo: any = {
            error: 'USER_BANNED',
            message: 'Пользователь заблокирован',
            ban_reason: user.ban_reason,
            banned_at: user.banned_at,
            is_permanent: user.is_permanent || false
        };
        
        if (user.banned_until && !user.is_permanent) {
            banInfo.banned_until = user.banned_until;
            banInfo.time_left = Math.max(0, new Date(user.banned_until).getTime() - new Date().getTime());
        }
        
        return res.status(403).json(banInfo);
        
    } catch (error) {
        console.error('Error checking user ban:', error);
        return res.status(500).json({ 
            error: 'INTERNAL_ERROR',
            message: 'Ошибка проверки статуса пользователя' 
        });
    }
};

// Middleware для проверки при входе в систему
export const checkBanOnLogin = async (email: string): Promise<BanInfo | null> => {
    try {
        const result = await pool.query(`
            SELECT u.is_banned, u.ban_reason, u.banned_at, u.banned_until, u.is_deleted,
                   ub.is_permanent
            FROM users u
            LEFT JOIN user_bans ub ON u.id = ub.user_id AND ub.is_active = true
            WHERE u.email = $1
        `, [email]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const user = result.rows[0];
        
        // Пользователь удален
        if (user.is_deleted) {
            return {
                is_banned: true,
                ban_reason: 'Аккаунт удален',
                is_permanent: true
            };
        }
        
        // Пользователь не заблокирован
        if (!user.is_banned) {
            return null;
        }
        
        // Проверяем не истек ли временный бан
        if (user.banned_until && new Date(user.banned_until) <= new Date()) {
            // Бан истек - разблокируем автоматически
            await pool.query('BEGIN');
            
            await pool.query(`
                UPDATE users 
                SET is_banned = false, ban_reason = null, banned_at = null,
                    banned_until = null, banned_by = null
                WHERE email = $1
            `, [email]);
            
            const userIdResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (userIdResult.rows.length > 0) {
                const userId = userIdResult.rows[0].id;
                
                await pool.query(`
                    UPDATE user_bans 
                    SET is_active = false, unbanned_at = CURRENT_TIMESTAMP,
                        unban_reason = 'Автоматическая разблокировка по истечении срока'
                    WHERE user_id = $1 AND is_active = true
                `, [userId]);
                
                await pool.query(`
                    UPDATE subscriptions 
                    SET is_active = true 
                    WHERE user_id = $1 AND end_date > CURRENT_TIMESTAMP
                `, [userId]);
            }
            
            await pool.query('COMMIT');
            return null;
        }
        
        // Пользователь заблокирован
        return {
            is_banned: true,
            ban_reason: user.ban_reason,
            banned_at: user.banned_at ? new Date(user.banned_at) : undefined,
            banned_until: user.banned_until ? new Date(user.banned_until) : undefined,
            is_permanent: user.is_permanent || false
        };
        
    } catch (error) {
        console.error('Error checking ban on login:', error);
        throw error;
    }
};

// Обновление времени последнего входа
export const updateLastLogin = async (userId: number): Promise<void> => {
    try {
        await pool.query(`
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [userId]);
    } catch (error) {
        console.error('Error updating last login:', error);
        // Не прерываем процесс авторизации из-за ошибки обновления времени
    }
};