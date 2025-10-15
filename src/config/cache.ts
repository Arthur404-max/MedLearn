import Redis from 'ioredis';
import { logger } from './logger';

interface CacheConfig {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    retryDelayOnFailover: number;
    maxRetriesPerRequest: number;
    lazyConnect: boolean;
}

// Конфигурация Redis
const redisConfig: CacheConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'medlearn:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
};

// Создаем основное подключение к Redis
export const redis = new Redis(redisConfig);

// Создаем отдельное подключение для pub/sub
export const redisPubSub = new Redis({
    ...redisConfig,
    keyPrefix: '' // Для pub/sub не нужен префикс
});

// Обработчики событий Redis
redis.on('connect', () => {
    logger.info('Redis connected successfully', {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        type: 'redis_connection'
    });
});

redis.on('error', (error) => {
    logger.error('Redis connection error', {
        error: error.message,
        host: redisConfig.host,
        port: redisConfig.port,
        type: 'redis_error'
    });
});

redis.on('close', () => {
    logger.warn('Redis connection closed', {
        host: redisConfig.host,
        port: redisConfig.port,
        type: 'redis_disconnection'
    });
});

redis.on('reconnecting', () => {
    logger.info('Redis reconnecting', {
        host: redisConfig.host,
        port: redisConfig.port,
        type: 'redis_reconnection'
    });
});

// Класс для удобной работы с кешем
export class CacheManager {
    private redis: Redis;
    private defaultTTL: number;

    constructor(redisInstance: Redis, defaultTTL: number = 3600) {
        this.redis = redisInstance;
        this.defaultTTL = defaultTTL;
    }

    // Получение значения из кеша
    async get<T = any>(key: string): Promise<T | null> {
        try {
            const value = await this.redis.get(key);
            if (value === null) {
                return null;
            }
            
            const parsed = JSON.parse(value);
            
            logger.debug('Cache hit', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                type: 'cache_hit'
            });
            
            return parsed;
            
        } catch (error) {
            logger.error('Cache get error', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                error: (error as Error).message,
                type: 'cache_error'
            });
            return null;
        }
    }

    // Сохранение значения в кеш
    async set(key: string, value: any, ttl?: number): Promise<boolean> {
        try {
            const serialized = JSON.stringify(value);
            const expiration = ttl || this.defaultTTL;
            
            await this.redis.setex(key, expiration, serialized);
            
            logger.debug('Cache set', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                ttl: expiration,
                type: 'cache_set'
            });
            
            return true;
            
        } catch (error) {
            logger.error('Cache set error', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                error: (error as Error).message,
                type: 'cache_error'
            });
            return false;
        }
    }

    // Удаление из кеша
    async del(key: string): Promise<boolean> {
        try {
            const result = await this.redis.del(key);
            
            logger.debug('Cache delete', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                deleted: result > 0,
                type: 'cache_delete'
            });
            
            return result > 0;
            
        } catch (error) {
            logger.error('Cache delete error', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                error: (error as Error).message,
                type: 'cache_error'
            });
            return false;
        }
    }

    // Удаление по паттерну
    async delPattern(pattern: string): Promise<number> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length === 0) {
                return 0;
            }
            
            const result = await this.redis.del(...keys);
            
            logger.info('Cache pattern delete', {
                pattern,
                keysDeleted: result,
                type: 'cache_pattern_delete'
            });
            
            return result;
            
        } catch (error) {
            logger.error('Cache pattern delete error', {
                pattern,
                error: (error as Error).message,
                type: 'cache_error'
            });
            return 0;
        }
    }

    // Проверка существования ключа
    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('Cache exists check error', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                error: (error as Error).message,
                type: 'cache_error'
            });
            return false;
        }
    }

    // Установка TTL для существующего ключа
    async expire(key: string, ttl: number): Promise<boolean> {
        try {
            const result = await this.redis.expire(key, ttl);
            return result === 1;
        } catch (error) {
            logger.error('Cache expire error', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                error: (error as Error).message,
                type: 'cache_error'
            });
            return false;
        }
    }

    // Получение TTL ключа
    async ttl(key: string): Promise<number> {
        try {
            return await this.redis.ttl(key);
        } catch (error) {
            logger.error('Cache TTL check error', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                error: (error as Error).message,
                type: 'cache_error'
            });
            return -1;
        }
    }

    // Атомарное увеличение значения
    async incr(key: string, by: number = 1): Promise<number> {
        try {
            return await this.redis.incrby(key, by);
        } catch (error) {
            logger.error('Cache increment error', {
                key: key.replace(redisConfig.keyPrefix || '', ''),
                error: (error as Error).message,
                type: 'cache_error'
            });
            return 0;
        }
    }

    // Получение статистики Redis
    async getStats() {
        try {
            const info = await this.redis.info('memory');
            const keyspace = await this.redis.info('keyspace');
            const stats = await this.redis.info('stats');
            
            return {
                memory: this.parseInfo(info),
                keyspace: this.parseInfo(keyspace),
                stats: this.parseInfo(stats)
            };
        } catch (error) {
            logger.error('Redis stats error', {
                error: (error as Error).message,
                type: 'redis_error'
            });
            return null;
        }
    }

    private parseInfo(info: string): Record<string, string> {
        const result: Record<string, string> = {};
        const lines = info.split('\r\n');
        
        for (const line of lines) {
            if (line && !line.startsWith('#') && line.includes(':')) {
                const [key, value] = line.split(':');
                result[key] = value;
            }
        }
        
        return result;
    }
}

// Создаем экземпляр менеджера кеша
export const cache = new CacheManager(redis, 3600); // TTL по умолчанию 1 час

// Специальные кеши с разными TTL
export const shortCache = new CacheManager(redis, 300);   // 5 минут
export const longCache = new CacheManager(redis, 86400);  // 24 часа
export const sessionCache = new CacheManager(redis, 1800); // 30 минут

// Функция для проверки подключения к Redis
export async function testRedisConnection(): Promise<boolean> {
    try {
        await redis.ping();
        return true;
    } catch (error) {
        logger.error('Redis connection test failed', {
            error: (error as Error).message,
            type: 'redis_connection_test'
        });
        return false;
    }
}

// Функция для graceful shutdown
export async function closeRedisConnection(): Promise<void> {
    try {
        await redis.quit();
        await redisPubSub.quit();
        logger.info('Redis connections closed gracefully', {
            type: 'redis_shutdown'
        });
    } catch (error) {
        logger.error('Error closing Redis connections', {
            error: (error as Error).message,
            type: 'redis_shutdown_error'
        });
    }
}

export default cache;