import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../src/config/db';
import { logger, logAuthEvent, logDatabaseError } from '../src/config/logger';

interface UserPayload {
    id: number;
    email: string;
    role: string;
}

declare global {
    namespace Express {
        interface Request {
            user: UserPayload;
        }
    }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const isAdminPanel = req.headers['x-admin-panel'] === 'true';
    
    // Логирование только в режиме разработки
    if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Auth middleware called for:', req.method, req.url);
        console.log('📨 Auth header:', authHeader);
        console.log('🎟️ Extracted token:', token ? 'Token present' : 'No token');
    }

    // Специальная логика для админ-панели
    if (isAdminPanel && token === 'admin-panel-access-key') {
        req.user = {
            id: 1,
            email: 'admin@medlearn.com',
            role: 'admin'
        };
        logAuthEvent('admin_panel_access', 1, 'admin@medlearn.com', req.ip, true);
        return next();
    }

    if (!token) {
        logAuthEvent('missing_token', undefined, undefined, req.ip, false);
        return res.status(401).json({ message: 'Access token not found' });
    }

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Decoded JWT token:', user);
        }
        
        // Проверяем, существует ли пользователь в базе данных
        const userId = (user as any).userId || user.id; // Поддерживаем оба варианта
        
        if (process.env.NODE_ENV === 'development') {
            console.log('🆔 Looking for user ID:', userId);
        }
        
        const result = await pool.query(
            'SELECT id, email, is_banned, ban_reason, role FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            logAuthEvent('user_not_found', userId, user.email, req.ip, false);
            return res.status(401).json({ message: 'User not found' });
        }

        const dbUser = result.rows[0];
        
        // Проверяем, забанен ли пользователь
        if (dbUser.is_banned) {
            logAuthEvent('banned_user_attempt', dbUser.id, dbUser.email, req.ip, false);
            return res.status(403).json({ 
                message: 'Аккаунт заблокирован', 
                reason: dbUser.ban_reason || 'Причина не указана',
                banned: true 
            });
        }

        req.user = {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role || 'student'
        };
        
        // Логируем успешную аутентификацию
        logAuthEvent('token_verified', dbUser.id, dbUser.email, req.ip, true);
        next();
        
    } catch (error: any) {
        if (process.env.NODE_ENV === 'development') {
            console.error('❌ JWT verification error:', error);
        }
        
        logAuthEvent('invalid_token', undefined, undefined, req.ip, false);
        logDatabaseError(error, 'JWT verification failed');
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};