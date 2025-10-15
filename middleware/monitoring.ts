import { Request, Response, NextFunction } from 'express';
import { logger, logApiRequest } from '../src/config/logger';

// Расширяем типы Request
declare global {
    namespace Express {
        interface Request {
            startTime?: number;
        }
    }
}

// Middleware для измерения времени ответа
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
    req.startTime = Date.now();
    
    // Перехватываем окончание запроса
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - (req.startTime || Date.now());
        
        // Логируем запрос
        logApiRequest(req, res, duration);
        
        // Добавляем заголовок с временем ответа
        res.set('X-Response-Time', `${duration}ms`);
        
        return originalSend.call(this, data);
    };
    
    next();
};

// Middleware для отслеживания активных пользователей
export const activeUsersMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
        // Здесь можно добавить логику для отслеживания активных пользователей
        // Например, обновление времени последней активности в Redis
        logger.info('User activity', {
            userId: req.user.id,
            endpoint: req.path,
            type: 'user_activity'
        });
    }
    next();
};

// Middleware для отслеживания ошибок
export const errorTrackingMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        type: 'unhandled_error'
    });
    
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
};

// Middleware для ограничения частоты запросов
import rateLimit from 'express-rate-limit';

export const createRateLimiter = (windowMs: number = 15 * 60 * 1000, max: number = 100, message?: string) => {
    return rateLimit({
        windowMs,
        max,
        message: message || 'Too many requests from this IP',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                url: req.url,
                userAgent: req.get('User-Agent'),
                type: 'rate_limit_exceeded'
            });
            
            res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.round(windowMs / 1000)
            });
        }
    });
};

// Специальные лимиты для разных эндпоинтов
// Для разработки: более мягкие ограничения
// Для продакшена: authRateLimiter = createRateLimiter(15 * 60 * 1000, 5, ...)
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 50, 'Too many authentication attempts');
export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 500, 'Too many API requests');
export const testRateLimiter = createRateLimiter(5 * 60 * 1000, 50, 'Too many test attempts');