import { logger } from '../src/config/logger';
import { CacheManager } from '../src/config/cache';
import { redis } from '../src/config/cache';

class BackgroundWorker {
    private cacheManager: CacheManager;
    private isRunning: boolean = false;

    constructor() {
        this.cacheManager = new CacheManager(redis, 3600);
    }

    async start() {
        logger.info('Background worker started', {
            worker: 'background-tasks',
            pid: process.pid,
            type: 'worker_startup'
        });

        this.isRunning = true;

        // Запускаем периодические задачи
        this.scheduleCleanupTasks();
        this.scheduleCacheWarming();
        this.scheduleHealthCheck();

        // Graceful shutdown
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    }

    private scheduleCleanupTasks() {
        setInterval(async () => {
            if (!this.isRunning) return;

            try {
                logger.info('Running periodic cleanup tasks', {
                    type: 'background_task',
                    task: 'cleanup'
                });

                // Очистка старых логов (пример)
                // await this.cleanupOldLogs();

                // Очистка устаревших сессий
                // await this.cleanupExpiredSessions();

            } catch (error) {
                logger.error('Cleanup task failed', {
                    error: (error as Error).message,
                    type: 'background_task_error'
                });
            }
        }, 1000 * 60 * 30); // Каждые 30 минут
    }

    private scheduleCacheWarming() {
        setInterval(async () => {
            if (!this.isRunning) return;

            try {
                logger.info('Warming up cache', {
                    type: 'background_task',
                    task: 'cache_warming'
                });

                // Прогреваем часто используемые данные
                // await this.warmUpFrequentData();

            } catch (error) {
                logger.error('Cache warming failed', {
                    error: (error as Error).message,
                    type: 'background_task_error'
                });
            }
        }, 1000 * 60 * 60); // Каждый час
    }

    private scheduleHealthCheck() {
        setInterval(async () => {
            if (!this.isRunning) return;

            try {
                // Проверяем здоровье системы
                const healthStatus = await this.checkSystemHealth();
                
                logger.info('System health check', {
                    status: healthStatus.status,
                    memory: healthStatus.memory,
                    uptime: healthStatus.uptime,
                    type: 'health_check'
                });

            } catch (error) {
                logger.error('Health check failed', {
                    error: (error as Error).message,
                    type: 'health_check_error'
                });
            }
        }, 1000 * 60 * 5); // Каждые 5 минут
    }

    private async checkSystemHealth() {
        const memoryUsage = process.memoryUsage();
        
        return {
            status: 'ok',
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
            },
            uptime: Math.round(process.uptime()) + 's',
            pid: process.pid
        };
    }

    private async shutdown(signal: string) {
        logger.info(`Background worker shutting down on ${signal}`, {
            worker: 'background-tasks',
            signal,
            type: 'worker_shutdown'
        });

        this.isRunning = false;

        // Завершаем все активные задачи
        setTimeout(() => {
            process.exit(0);
        }, 5000);
    }
}

// Запускаем worker
const worker = new BackgroundWorker();
worker.start().catch((error) => {
    console.error('Failed to start background worker:', error);
    process.exit(1);
});