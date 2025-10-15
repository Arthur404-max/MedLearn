import http from 'http';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
    dns: number;
    tcp: number;
    tls: number;
    ttfb: number; // Time to First Byte
    contentDownload: number;
    totalTime: number;
}

interface EndpointTest {
    url: string;
    name: string;
    expectedStatus: number;
    timeout: number;
}

class PerformanceMonitor {
    private endpoints: EndpointTest[] = [
        {
            url: 'http://localhost/api/health',
            name: 'Health Check (Nginx)',
            expectedStatus: 200,
            timeout: 5000
        },
        {
            url: 'http://localhost:3000/api/health',
            name: 'Health Check (Direct PM2)',
            expectedStatus: 200,
            timeout: 5000
        },
        {
            url: 'http://localhost:8080/cdn/health',
            name: 'CDN Health Check',
            expectedStatus: 200,
            timeout: 5000
        },
        {
            url: 'http://localhost/api/tests/subjects',
            name: 'API Subjects (Cached)',
            expectedStatus: 200,
            timeout: 10000
        },
        {
            url: 'http://localhost/',
            name: 'Main Page',
            expectedStatus: 200,
            timeout: 10000
        }
    ];

    async runPerformanceAudit(): Promise<void> {
        console.log('🔍 АУДИТ ПРОИЗВОДИТЕЛЬНОСТИ СИСТЕМЫ');
        console.log('='.repeat(60));
        console.log(`📅 Время: ${new Date().toLocaleString()}`);
        console.log(`🖥️ Platform: ${process.platform} ${process.arch}`);
        console.log(`📊 Node.js: ${process.version}`);
        console.log('');

        const results: Array<{
            endpoint: EndpointTest;
            metrics: PerformanceMetrics | null;
            error: string | null;
        }> = [];

        // Тестируем все endpoints
        for (const endpoint of this.endpoints) {
            console.log(`🧪 Тестирование: ${endpoint.name}`);
            
            try {
                const metrics = await this.measureEndpoint(endpoint);
                results.push({ endpoint, metrics, error: null });
                
                this.printEndpointResult(endpoint, metrics);
            } catch (error) {
                results.push({ 
                    endpoint, 
                    metrics: null, 
                    error: (error as Error).message 
                });
                
                console.log(`   ❌ Ошибка: ${(error as Error).message}`);
            }
            
            console.log('');
        }

        // Анализ результатов
        this.analyzeResults(results);
        
        // Рекомендации по оптимизации
        this.provideOptimizationRecommendations(results);
    }

    private async measureEndpoint(endpoint: EndpointTest): Promise<PerformanceMetrics> {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            let connectTime = 0;
            let firstByteTime = 0;
            
            const url = new URL(endpoint.url);
            
            const req = http.request({
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname + url.search,
                method: 'GET',
                timeout: endpoint.timeout,
                headers: {
                    'User-Agent': 'MedLearn-Performance-Monitor/1.0',
                    'Accept': 'text/html,application/json,*/*',
                    'Connection': 'close'
                }
            }, (res) => {
                firstByteTime = performance.now();
                
                let data = '';
                let contentStartTime = performance.now();
                
                res.on('data', (chunk) => {
                    if (contentStartTime === firstByteTime) {
                        contentStartTime = performance.now();
                    }
                    data += chunk;
                });
                
                res.on('end', () => {
                    const endTime = performance.now();
                    
                    if (res.statusCode !== endpoint.expectedStatus) {
                        reject(new Error(`Expected status ${endpoint.expectedStatus}, got ${res.statusCode}`));
                        return;
                    }
                    
                    const metrics: PerformanceMetrics = {
                        dns: 0, // В локальной среде DNS резолв практически мгновенный
                        tcp: connectTime - startTime,
                        tls: 0, // HTTP подключения
                        ttfb: firstByteTime - startTime,
                        contentDownload: endTime - contentStartTime,
                        totalTime: endTime - startTime
                    };
                    
                    resolve(metrics);
                });
            });

            req.on('connect', () => {
                connectTime = performance.now();
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout (${endpoint.timeout}ms)`));
            });

            req.end();
        });
    }

    private printEndpointResult(endpoint: EndpointTest, metrics: PerformanceMetrics): void {
        const getPerformanceColor = (time: number, thresholds: [number, number]): 'Green' | 'Yellow' | 'Red' => {
            if (time <= thresholds[0]) return 'Green';
            if (time <= thresholds[1]) return 'Yellow';
            return 'Red';
        };

        console.log(`   ✅ Статус: ${endpoint.expectedStatus} OK`);
        console.log(`   ⚡ TTFB: ${metrics.ttfb.toFixed(2)}ms`);
        console.log(`   📦 Загрузка: ${metrics.contentDownload.toFixed(2)}ms`);
        console.log(`   🕐 Общее время: ${metrics.totalTime.toFixed(2)}ms`);
        
        // Оценка производительности
        const ttfbColor = getPerformanceColor(metrics.ttfb, [100, 500]);
        const totalColor = getPerformanceColor(metrics.totalTime, [200, 1000]);
        
        console.log(`   📊 Оценка TTFB: ${this.getPerformanceEmoji(ttfbColor)} ${ttfbColor}`);
        console.log(`   📊 Общая оценка: ${this.getPerformanceEmoji(totalColor)} ${totalColor}`);
    }

    private getPerformanceEmoji(color: string): string {
        switch (color) {
            case 'Green': return '🟢';
            case 'Yellow': return '🟡';
            case 'Red': return '🔴';
            default: return '⚪';
        }
    }

    private analyzeResults(results: Array<{ endpoint: EndpointTest; metrics: PerformanceMetrics | null; error: string | null }>): void {
        console.log('📈 АНАЛИЗ ПРОИЗВОДИТЕЛЬНОСТИ:');
        console.log('='.repeat(40));

        const successfulResults = results.filter(r => r.metrics !== null);
        const failedResults = results.filter(r => r.error !== null);

        if (failedResults.length > 0) {
            console.log(`❌ Недоступные endpoints: ${failedResults.length}/${results.length}`);
            failedResults.forEach(result => {
                console.log(`   • ${result.endpoint.name}: ${result.error}`);
            });
            console.log('');
        }

        if (successfulResults.length === 0) {
            console.log('❌ Все endpoints недоступны!');
            return;
        }

        // Средние показатели
        const avgTtfb = successfulResults.reduce((sum, r) => sum + r.metrics!.ttfb, 0) / successfulResults.length;
        const avgTotal = successfulResults.reduce((sum, r) => sum + r.metrics!.totalTime, 0) / successfulResults.length;

        console.log(`📊 Средний TTFB: ${avgTtfb.toFixed(2)}ms`);
        console.log(`📊 Среднее общее время: ${avgTotal.toFixed(2)}ms`);

        // Сравнение Nginx vs Direct
        const nginxResult = successfulResults.find(r => r.endpoint.name.includes('Nginx'));
        const directResult = successfulResults.find(r => r.endpoint.name.includes('Direct'));

        if (nginxResult && directResult) {
            const improvement = ((directResult.metrics!.ttfb - nginxResult.metrics!.ttfb) / directResult.metrics!.ttfb) * 100;
            console.log(`🔄 Nginx vs Direct: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% улучшение TTFB`);
        }

        console.log('');
    }

    private provideOptimizationRecommendations(results: Array<{ endpoint: EndpointTest; metrics: PerformanceMetrics | null; error: string | null }>): void {
        console.log('💡 РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ:');
        console.log('='.repeat(40));

        const recommendations: string[] = [];

        // Анализируем время отклика
        const successfulResults = results.filter(r => r.metrics !== null);
        const slowEndpoints = successfulResults.filter(r => r.metrics!.ttfb > 200);

        if (slowEndpoints.length > 0) {
            recommendations.push('🐌 Есть медленные endpoints (TTFB > 200ms):');
            slowEndpoints.forEach(result => {
                recommendations.push(`   • ${result.endpoint.name}: ${result.metrics!.ttfb.toFixed(2)}ms`);
            });
            recommendations.push('   💡 Рекомендация: Увеличить кэширование или оптимизировать код');
        }

        // Проверяем доступность CDN
        const cdnResult = results.find(r => r.endpoint.name.includes('CDN'));
        if (cdnResult?.error) {
            recommendations.push('🔗 CDN недоступен');
            recommendations.push('   💡 Рекомендация: Запустить CDN сервер на порту 8080');
        }

        // Проверяем кэширование
        const cacheableEndpoint = results.find(r => r.endpoint.name.includes('Cached'));
        if (cacheableEndpoint?.metrics && cacheableEndpoint.metrics.ttfb > 50) {
            recommendations.push('💾 Кэш работает неэффективно');
            recommendations.push('   💡 Рекомендация: Проверить Redis и настройки кэша');
        }

        // Общие рекомендации
        recommendations.push('');
        recommendations.push('🚀 Общие рекомендации для production:');
        recommendations.push('   📦 Включить Gzip сжатие');
        recommendations.push('   🗜️ Минифицировать статические ресурсы');
        recommendations.push('   📱 Настроить HTTP/2');
        recommendations.push('   🔒 Добавить SSL/TLS');
        recommendations.push('   🌐 Подключить реальный CDN');
        recommendations.push('   📊 Настроить мониторинг APM');

        recommendations.forEach(rec => console.log(rec));
    }
}

// Запуск мониторинга
async function main() {
    const monitor = new PerformanceMonitor();
    
    console.log('⚠️ ВАЖНО: Убедитесь что запущены все сервисы:');
    console.log('   1. Redis: .\\scripts\\redis-control.ps1 status');
    console.log('   2. PM2: npm run pm2:status');
    console.log('   3. Nginx: PowerShell -File .\\scripts\\nginx-control.ps1 -Action status');
    console.log('   4. CDN (опционально): порт 8080');
    console.log('');

    await monitor.runPerformanceAudit();
}

main().catch(console.error);