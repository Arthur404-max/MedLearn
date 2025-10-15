import express from 'express';
import { performance } from 'perf_hooks';
import os from 'os';
import { logger } from '../config/logger';
import { pool } from '../config/db';

interface SystemMetrics {
    timestamp: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: number[];
    loadAverage: number[];
    freeMemory: number;
    totalMemory: number;
    platform: string;
    nodeVersion: string;
}

interface DatabaseMetrics {
    connectionCount: number;
    activeConnections: number;
    idleConnections: number;
    waitingCount: number;
}

interface ApplicationMetrics {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    slowQueries: number;
    cacheHitRate: number;
}

class SimpleAPM {
    private app: express.Application;
    private metrics: {
        requests: Array<{ timestamp: number; responseTime: number; success: boolean }>;
        errors: Array<{ timestamp: number; error: string; path: string }>;
        slowQueries: Array<{ timestamp: number; query: string; duration: number }>;
    };

    constructor() {
        this.app = express();
        this.metrics = {
            requests: [],
            errors: [],
            slowQueries: []
        };
        
        this.setupRoutes();
        this.startMetricsCollection();
    }

    private setupRoutes(): void {
        // Главная страница APM дашборда
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });

        // API для получения системных метрик
        this.app.get('/api/metrics/system', (req, res) => {
            res.json(this.getSystemMetrics());
        });

        // API для получения метрик приложения
        this.app.get('/api/metrics/application', (req, res) => {
            res.json(this.getApplicationMetrics());
        });

        // API для получения метрик базы данных
        this.app.get('/api/metrics/database', async (req, res) => {
            try {
                const dbMetrics = await this.getDatabaseMetrics();
                res.json(dbMetrics);
            } catch (error) {
                res.status(500).json({ error: 'Failed to get database metrics' });
            }
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'apm', timestamp: new Date().toISOString() });
        });
    }

    private getSystemMetrics(): SystemMetrics {
        const cpus = os.cpus();
        
        return {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: cpus.map(cpu => {
                const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
                const usage = 100 - (100 * cpu.times.idle) / total;
                return Math.round(usage * 100) / 100;
            }),
            loadAverage: os.loadavg(),
            freeMemory: os.freemem(),
            totalMemory: os.totalmem(),
            platform: `${os.platform()} ${os.arch()}`,
            nodeVersion: process.version
        };
    }

    private getApplicationMetrics(): ApplicationMetrics {
        const now = Date.now();
        const last5Minutes = now - (5 * 60 * 1000);
        
        // Фильтруем метрики за последние 5 минут
        const recentRequests = this.metrics.requests.filter(r => r.timestamp > last5Minutes);
        const recentErrors = this.metrics.errors.filter(e => e.timestamp > last5Minutes);
        
        const successfulRequests = recentRequests.filter(r => r.success);
        const averageResponseTime = successfulRequests.length > 0 
            ? successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length
            : 0;

        return {
            requestCount: recentRequests.length,
            errorCount: recentErrors.length,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
            slowQueries: this.metrics.slowQueries.filter(q => q.timestamp > last5Minutes).length,
            cacheHitRate: 0 // Будет реализовано при интеграции с Redis
        };
    }

    private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
        try {
            // Простые метрики пула соединений
            const poolInfo = (pool as any)._pool || {};
            
            return {
                connectionCount: poolInfo.totalCount || 0,
                activeConnections: (poolInfo.totalCount || 0) - (poolInfo.idleCount || 0),
                idleConnections: poolInfo.idleCount || 0,
                waitingCount: poolInfo.waitingCount || 0
            };
        } catch (error) {
            throw new Error('Failed to get database metrics');
        }
    }

    private generateDashboardHTML(): string {
        return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APM Dashboard - MedLearn</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f8fafc; color: #334155; 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 1rem 2rem; 
        }
        .container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .card { 
            background: white; border-radius: 12px; padding: 1.5rem; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
        }
        .card h3 { color: #1e293b; margin-bottom: 1rem; }
        .metric { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
        .metric-value { font-weight: bold; }
        .status-ok { color: #10b981; }
        .status-warning { color: #f59e0b; }
        .status-error { color: #ef4444; }
        .chart-container { height: 200px; background: #f1f5f9; border-radius: 8px; margin-top: 1rem; display: flex; align-items: center; justify-content: center; color: #64748b; }
        .refresh-btn { 
            background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; 
            border-radius: 6px; cursor: pointer; margin-left: 1rem; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 APM Dashboard - MedLearn Platform</h1>
        <p>Мониторинг производительности приложения</p>
        <button class="refresh-btn" onclick="location.reload()">🔄 Обновить</button>
    </div>
    
    <div class="container">
        <div class="grid">
            <div class="card">
                <h3>🖥️ Система</h3>
                <div id="system-metrics">Загрузка...</div>
                <div class="chart-container">График загрузки CPU</div>
            </div>
            
            <div class="card">
                <h3>⚡ Приложение</h3>
                <div id="app-metrics">Загрузка...</div>
                <div class="chart-container">График времени отклика</div>
            </div>
            
            <div class="card">
                <h3>🗄️ База данных</h3>
                <div id="db-metrics">Загрузка...</div>
                <div class="chart-container">График соединений</div>
            </div>
            
            <div class="card">
                <h3>📈 Статистика</h3>
                <div class="metric">
                    <span>Статус системы:</span>
                    <span class="metric-value status-ok">🟢 Работает</span>
                </div>
                <div class="metric">
                    <span>Время работы:</span>
                    <span class="metric-value" id="uptime">Загрузка...</span>
                </div>
                <div class="metric">
                    <span>Версия Node.js:</span>
                    <span class="metric-value" id="node-version">Загрузка...</span>
                </div>
                <div class="metric">
                    <span>Последнее обновление:</span>
                    <span class="metric-value">${new Date().toLocaleString()}</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function loadMetrics() {
            try {
                // Системные метрики
                const systemResponse = await fetch('/api/metrics/system');
                const systemData = await systemResponse.json();
                
                document.getElementById('system-metrics').innerHTML = \`
                    <div class="metric">
                        <span>CPU Usage:</span>
                        <span class="metric-value">\${systemData.cpu[0]?.toFixed(1) || 0}%</span>
                    </div>
                    <div class="metric">
                        <span>Memory:</span>
                        <span class="metric-value">\${(systemData.memory.heapUsed / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <div class="metric">
                        <span>Free Memory:</span>
                        <span class="metric-value">\${(systemData.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                    </div>
                \`;
                
                document.getElementById('uptime').textContent = \`\${Math.floor(systemData.uptime / 3600)}h \${Math.floor((systemData.uptime % 3600) / 60)}m\`;
                document.getElementById('node-version').textContent = systemData.nodeVersion;

                // Метрики приложения
                const appResponse = await fetch('/api/metrics/application');
                const appData = await appResponse.json();
                
                document.getElementById('app-metrics').innerHTML = \`
                    <div class="metric">
                        <span>Requests (5m):</span>
                        <span class="metric-value">\${appData.requestCount}</span>
                    </div>
                    <div class="metric">
                        <span>Errors (5m):</span>
                        <span class="metric-value \${appData.errorCount > 0 ? 'status-error' : 'status-ok'}">\${appData.errorCount}</span>
                    </div>
                    <div class="metric">
                        <span>Avg Response:</span>
                        <span class="metric-value">\${appData.averageResponseTime.toFixed(2)}ms</span>
                    </div>
                \`;

                // Метрики БД
                const dbResponse = await fetch('/api/metrics/database');
                const dbData = await dbResponse.json();
                
                document.getElementById('db-metrics').innerHTML = \`
                    <div class="metric">
                        <span>Connections:</span>
                        <span class="metric-value">\${dbData.connectionCount}</span>
                    </div>
                    <div class="metric">
                        <span>Active:</span>
                        <span class="metric-value">\${dbData.activeConnections}</span>
                    </div>
                    <div class="metric">
                        <span>Idle:</span>
                        <span class="metric-value">\${dbData.idleConnections}</span>
                    </div>
                \`;
                
            } catch (error) {
                console.error('Failed to load metrics:', error);
            }
        }

        // Загружаем метрики при загрузке страницы
        loadMetrics();
        
        // Обновляем метрики каждые 30 секунд
        setInterval(loadMetrics, 30000);
    </script>
</body>
</html>
        `;
    }

    // Методы для сбора метрик (будут вызываться из middleware)
    public recordRequest(responseTime: number, success: boolean): void {
        this.metrics.requests.push({
            timestamp: Date.now(),
            responseTime,
            success
        });

        // Храним только последние 1000 запросов
        if (this.metrics.requests.length > 1000) {
            this.metrics.requests = this.metrics.requests.slice(-1000);
        }
    }

    public recordError(error: string, path: string): void {
        this.metrics.errors.push({
            timestamp: Date.now(),
            error,
            path
        });

        // Храним только последние 100 ошибок
        if (this.metrics.errors.length > 100) {
            this.metrics.errors = this.metrics.errors.slice(-100);
        }
    }

    public recordSlowQuery(query: string, duration: number): void {
        this.metrics.slowQueries.push({
            timestamp: Date.now(),
            query,
            duration
        });

        // Храним только последние 100 медленных запросов
        if (this.metrics.slowQueries.length > 100) {
            this.metrics.slowQueries = this.metrics.slowQueries.slice(-100);
        }
    }

    private startMetricsCollection(): void {
        // Периодическое логирование системных метрик
        setInterval(() => {
            const metrics = this.getSystemMetrics();
            logger.info('System metrics', {
                type: 'apm_system_metrics',
                cpu_usage: metrics.cpu[0],
                memory_used_mb: Math.round(metrics.memory.heapUsed / 1024 / 1024),
                uptime_hours: Math.round(metrics.uptime / 3600 * 100) / 100
            });
        }, 60000); // Каждую минуту
    }

    public start(port: number = 3001): void {
        this.app.listen(port, () => {
            console.log(`📊 APM Dashboard started on http://localhost:${port}`);
            logger.info('APM Dashboard started', { port, type: 'apm_startup' });
        });
    }
}

// Экспортируем singleton
export const apm = new SimpleAPM();

// Middleware для автоматического сбора метрик
export const apmMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = performance.now();

    // Перехватываем завершение ответа
    res.on('finish', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const success = res.statusCode < 400;

        apm.recordRequest(responseTime, success);

        if (!success) {
            apm.recordError(`HTTP ${res.statusCode}`, req.path);
        }
    });

    next();
};