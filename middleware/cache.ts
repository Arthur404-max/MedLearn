import { Request, Response, NextFunction } from 'express';
import { cache, shortCache, longCache } from '../src/config/cache';
import { logger } from '../src/config/logger';

// Расширяем типы Request для кеширования
declare global {
    namespace Express {
        interface Request {
            cacheKey?: string;
            skipCache?: boolean;
        }
    }
}

// Интерфейс для опций кеширования
interface CacheOptions {
    ttl?: number;           // Время жизни в секундах
    keyGenerator?: (req: Request) => string;  // Функция генерации ключа
    condition?: (req: Request, res: Response) => boolean; // Условие кеширования
    varyBy?: string[];      // Параметры для различения кеша
}

// Middleware для кеширования ответов API
export const cacheMiddleware = (options: CacheOptions = {}) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Пропускаем кеширование для POST, PUT, DELETE
        if (!['GET', 'HEAD'].includes(req.method)) {
            return next();
        }

        // Проверяем условие кеширования
        if (options.condition && !options.condition(req, res)) {
            return next();
        }

        // Генерируем ключ кеша
        const cacheKey = options.keyGenerator 
            ? options.keyGenerator(req)
            : generateCacheKey(req, options.varyBy);
            
        req.cacheKey = cacheKey;

        try {
            // Пытаемся получить из кеша (только если cache доступен)
            let cachedResponse = null;
            try {
                cachedResponse = await cache.get(cacheKey);
            } catch (cacheError) {
                // Redis недоступен, продолжаем без кеша
                logger.debug('Cache unavailable, skipping', {
                    error: (cacheError as Error).message,
                    type: 'cache_unavailable'
                });
            }
            
            if (cachedResponse && !req.skipCache) {
                logger.debug('Cache hit for API response', {
                    key: cacheKey,
                    method: req.method,
                    url: req.url,
                    type: 'api_cache_hit'
                });

                // Устанавливаем заголовки из кеша
                if (cachedResponse.headers) {
                    Object.keys(cachedResponse.headers).forEach(header => {
                        res.set(header, cachedResponse.headers[header]);
                    });
                }

                // Добавляем заголовок кеша
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Key', cacheKey);
                
                return res.status(cachedResponse.status || 200).json(cachedResponse.body);
            }

            // Перехватываем оригинальный res.json
            const originalJson = res.json;
            const originalStatus = res.status;
            let statusCode = 200;

            // Перехватываем установку статуса
            res.status = function(code: number) {
                statusCode = code;
                return originalStatus.call(this, code);
            };

            // Перехватываем ответ
            res.json = function(body: any) {
                // Кешируем только успешные ответы
                if (statusCode >= 200 && statusCode < 300) {
                    const responseToCache = {
                        body,
                        status: statusCode,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Cache': 'MISS',
                            'X-Cache-Key': cacheKey
                        }
                    };

                    // Сохраняем в кеш асинхронно (только если cache доступен)
                    cache.set(cacheKey, responseToCache, options.ttl)
                        .then(() => {
                            logger.debug('Response cached', {
                                key: cacheKey,
                                status: statusCode,
                                ttl: options.ttl || 3600,
                                type: 'api_cache_set'
                            });
                        })
                        .catch((error) => {
                            logger.debug('Cache write failed (Redis unavailable)', {
                                key: cacheKey,
                                error: error.message,
                                type: 'cache_write_skip'
                            });
                        });
                }

                // Добавляем заголовки кеша
                this.set('X-Cache', 'MISS');
                this.set('X-Cache-Key', cacheKey);
                
                return originalJson.call(this, body);
            };

            next();

        } catch (error) {
            logger.error('Cache middleware error', {
                error: (error as Error).message,
                url: req.url,
                type: 'cache_middleware_error'
            });
            next();
        }
    };
};

// Генерация ключа кеша
function generateCacheKey(req: Request, varyBy?: string[]): string {
    const baseKey = `api:${req.method}:${req.path}`;
    
    const parts = [baseKey];
    
    // Добавляем query параметры
    const queryKeys = Object.keys(req.query).sort();
    if (queryKeys.length > 0) {
        const queryString = queryKeys
            .map(key => `${key}=${req.query[key]}`)
            .join('&');
        parts.push(`query:${queryString}`);
    }
    
    // Добавляем пользовательские параметры
    if (varyBy) {
        varyBy.forEach(param => {
            if (req.user && (req.user as any)[param]) {
                parts.push(`${param}:${(req.user as any)[param]}`);
            } else if (req.headers[param.toLowerCase()]) {
                parts.push(`${param}:${req.headers[param.toLowerCase()]}`);
            }
        });
    }
    
    return parts.join(':');
}

// Middleware для инвалидации кеша
export const invalidateCacheMiddleware = (patterns: string[] | ((req: Request) => string[])) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Выполняем оригинальный запрос
        const originalJson = res.json;
        
        res.json = function(body: any) {
            // После успешного ответа инвалидируем кеш
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const patternsToInvalidate = Array.isArray(patterns) 
                    ? patterns 
                    : patterns(req);
                
                patternsToInvalidate.forEach(async (pattern) => {
                    try {
                        const deletedCount = await cache.delPattern(pattern);
                        logger.info('Cache invalidated', {
                            pattern,
                            deletedKeys: deletedCount,
                            trigger: req.url,
                            type: 'cache_invalidation'
                        });
                    } catch (error) {
                        logger.error('Cache invalidation failed', {
                            pattern,
                            error: (error as Error).message,
                            type: 'cache_invalidation_error'
                        });
                    }
                });
            }
            
            return originalJson.call(this, body);
        };
        
        next();
    };
};

// Готовые middleware для разных типов кеширования

// Кеширование списков (5 минут)
export const cacheList = cacheMiddleware({
    ttl: 300,
    condition: (req, res) => req.method === 'GET'
});

// Кеширование деталей (1 час)  
export const cacheDetails = cacheMiddleware({
    ttl: 3600,
    condition: (req, res) => req.method === 'GET'
});

// Кеширование пользовательских данных (30 минут)
export const cacheUserData = cacheMiddleware({
    ttl: 1800,
    varyBy: ['userId'],
    condition: (req, res) => req.method === 'GET' && !!req.user
});

// Кеширование статичных данных (24 часа)
export const cacheStatic = cacheMiddleware({
    ttl: 86400,
    condition: (req, res) => req.method === 'GET'
});

// Инвалидация кеша тестов
export const invalidateTestsCache = invalidateCacheMiddleware([
    'medlearn:api:GET:/api/tests*',
    'medlearn:api:GET:/api/admin/tests*'
]);

// Инвалидация кеша пользователей  
export const invalidateUsersCache = invalidateCacheMiddleware([
    'medlearn:api:GET:/api/user*',
    'medlearn:api:GET:/api/stats*'
]);

// Функция для ручной инвалидации кеша
export async function invalidateCache(patterns: string[]): Promise<number> {
    let totalDeleted = 0;
    
    for (const pattern of patterns) {
        try {
            const deleted = await cache.delPattern(pattern);
            totalDeleted += deleted;
            
            logger.info('Manual cache invalidation', {
                pattern,
                deletedKeys: deleted,
                type: 'manual_cache_invalidation'
            });
        } catch (error) {
            logger.error('Manual cache invalidation failed', {
                pattern,
                error: (error as Error).message,
                type: 'manual_cache_invalidation_error'
            });
        }
    }
    
    return totalDeleted;
}