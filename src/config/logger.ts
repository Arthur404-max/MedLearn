import winston from 'winston';
import path from 'path';

// Создаем директорию для логов если её нет
const logsDir = path.join(process.cwd(), 'logs');

// Форматирование для логов
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Форматирование для консоли (более читаемое)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
);

// Создаем логгер
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Все логи
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        
        // Только ошибки
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        
        // Производительность
        new winston.transports.File({ 
            filename: path.join(logsDir, 'performance.log'),
            level: 'warn',
            maxsize: 10485760, // 10MB
            maxFiles: 3
        })
    ],
});

// В режиме разработки добавляем консольный вывод
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Функция для логирования медленных запросов
export const logSlowQuery = (query: string, duration: number, params?: any[]) => {
    if (duration > 1000) { // Если запрос выполнялся больше секунды
        logger.warn('Slow database query', {
            query,
            duration,
            params,
            type: 'database_performance'
        });
    }
};

// Функция для логирования API запросов
export const logApiRequest = (req: any, res: any, duration: number) => {
    const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        type: 'api_request'
    };

    if (duration > 2000) {
        logger.warn('Slow API request', logData);
    } else if (res.statusCode >= 400) {
        logger.error('API request error', logData);
    } else {
        logger.info('API request', logData);
    }
};

// Функция для логирования ошибок базы данных
export const logDatabaseError = (error: any, query?: string, params?: any[]) => {
    logger.error('Database error', {
        error: error.message,
        stack: error.stack,
        query,
        params,
        type: 'database_error'
    });
};

// Функция для логирования аутентификации
export const logAuthEvent = (event: string, userId?: number, email?: string, ip?: string, success: boolean = true) => {
    const level = success ? 'info' : 'warn';
    logger.log(level, 'Authentication event', {
        event,
        userId,
        email,
        ip,
        success,
        type: 'authentication'
    });
};

export default logger;