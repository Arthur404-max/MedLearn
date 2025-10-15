import http from 'http';
import { performance } from 'perf_hooks';

interface NginxTestResult extends TestResult {
    nginxEnabled: boolean;
    port: number;
}

interface TestResult {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    requestsPerSecond: number;
    testDuration: number;
}

class NginxLoadTester {
    private nginxPort = 80;
    private directPort = 3000;

    async runComparison(): Promise<void> {
        console.log('🏁 СРАВНИТЕЛЬНОЕ ТЕСТИРОВАНИЕ: Nginx vs Direct PM2');
        console.log('='.repeat(60));

        // Тест прямого подключения к PM2
        console.log('\n🎯 ТЕСТ 1: Прямое подключение к PM2 (порт 3000)');
        const directResult = await this.runLoadTest(this.directPort, false);
        this.printResult(directResult);

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Тест через Nginx Load Balancer
        console.log('\n🌐 ТЕСТ 2: Через Nginx Load Balancer (порт 80)');
        const nginxResult = await this.runLoadTest(this.nginxPort, true);
        this.printResult(nginxResult);

        // Сравнение результатов
        this.compareResults(directResult, nginxResult);
    }

    private async runLoadTest(port: number, nginxEnabled: boolean): Promise<NginxTestResult> {
        const concurrency = 50;
        const totalRequests = 500;
        const path = '/api/health';

        console.log(`   Порт: ${port}`);
        console.log(`   Параллельных запросов: ${concurrency}`);
        console.log(`   Всего запросов: ${totalRequests}`);
        console.log(`   Эндпоинт: http://localhost:${port}${path}`);

        const startTime = performance.now();
        const responseTimes: number[] = [];
        const results: Promise<{ success: boolean; responseTime: number }>[] = [];

        // Создаем все запросы
        for (let i = 0; i < totalRequests; i++) {
            const requestPromise = this.makeRequest(port, path)
                .then(responseTime => ({ success: true, responseTime }))
                .catch(() => ({ success: false, responseTime: 0 }));
            
            results.push(requestPromise);

            // Контролируем параллелизм
            if ((i + 1) % concurrency === 0) {
                await Promise.allSettled(results.slice(-concurrency));
                await new Promise(resolve => setTimeout(resolve, 10)); // Небольшая пауза
            }
        }

        // Ждем завершения всех запросов
        const allResults = await Promise.allSettled(results);
        const endTime = performance.now();

        // Обрабатываем результаты
        let successfulRequests = 0;
        let failedRequests = 0;

        allResults.forEach(result => {
            if (result.status === 'fulfilled') {
                const { success, responseTime } = result.value;
                if (success) {
                    successfulRequests++;
                    responseTimes.push(responseTime);
                } else {
                    failedRequests++;
                }
            } else {
                failedRequests++;
            }
        });

        const testDuration = endTime - startTime;
        const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
        const minResponseTime = Math.min(...responseTimes) || 0;
        const maxResponseTime = Math.max(...responseTimes) || 0;
        const requestsPerSecond = (successfulRequests / testDuration) * 1000;

        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
            minResponseTime: Math.round(minResponseTime * 100) / 100,
            maxResponseTime: Math.round(maxResponseTime * 100) / 100,
            requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
            testDuration: Math.round(testDuration),
            nginxEnabled,
            port
        };
    }

    private makeRequest(port: number, path: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: path,
                method: 'GET',
                timeout: 10000,
                headers: {
                    'User-Agent': 'NginxLoadTester/1.0'
                }
            }, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const endTime = performance.now();
                    const responseTime = endTime - startTime;
                    
                    if (res.statusCode === 200) {
                        resolve(responseTime);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    private printResult(result: NginxTestResult) {
        const config = result.nginxEnabled ? '🌐 Nginx Load Balancer' : '🎯 Direct PM2';
        
        console.log(`\n📊 РЕЗУЛЬТАТЫ (${config}):`);
        console.log('-'.repeat(40));
        console.log(`📈 Успешность: ${result.successfulRequests}/${result.totalRequests} (${Math.round((result.successfulRequests/result.totalRequests)*100)}%)`);
        console.log(`⚡ RPS: ${result.requestsPerSecond} запросов/сек`);
        console.log(`⏱️ Время отклика: ${result.averageResponseTime}мс (${result.minResponseTime}-${result.maxResponseTime}мс)`);
        console.log(`🕐 Длительность: ${result.testDuration}мс`);
    }

    private compareResults(direct: NginxTestResult, nginx: NginxTestResult) {
        console.log('\n🏆 СРАВНЕНИЕ ПРОИЗВОДИТЕЛЬНОСТИ:');
        console.log('='.repeat(60));
        
        const rpsImprovement = ((nginx.requestsPerSecond - direct.requestsPerSecond) / direct.requestsPerSecond) * 100;
        const responseTimeImprovement = ((direct.averageResponseTime - nginx.averageResponseTime) / direct.averageResponseTime) * 100;
        const successRateDirect = (direct.successfulRequests / direct.totalRequests) * 100;
        const successRateNginx = (nginx.successfulRequests / nginx.totalRequests) * 100;

        console.log(`📊 Requests per Second:`);
        console.log(`   Direct PM2: ${direct.requestsPerSecond} RPS`);
        console.log(`   Nginx LB:   ${nginx.requestsPerSecond} RPS`);
        console.log(`   Улучшение:  ${rpsImprovement > 0 ? '+' : ''}${rpsImprovement.toFixed(1)}%`);
        
        console.log(`\n⏱️ Среднее время отклика:`);
        console.log(`   Direct PM2: ${direct.averageResponseTime}мс`);
        console.log(`   Nginx LB:   ${nginx.averageResponseTime}мс`);
        console.log(`   Улучшение:  ${responseTimeImprovement > 0 ? '+' : ''}${responseTimeImprovement.toFixed(1)}%`);
        
        console.log(`\n✅ Успешность запросов:`);
        console.log(`   Direct PM2: ${successRateDirect.toFixed(1)}%`);
        console.log(`   Nginx LB:   ${successRateNginx.toFixed(1)}%`);
        
        console.log('\n🎯 ИТОГОВАЯ ОЦЕНКА:');
        if (nginx.requestsPerSecond > direct.requestsPerSecond && successRateNginx >= successRateDirect) {
            console.log('🎉 Nginx Load Balancer показывает ЛУЧШУЮ производительность!');
        } else if (nginx.requestsPerSecond > direct.requestsPerSecond * 0.95) {
            console.log('✅ Nginx Load Balancer показывает сопоставимую производительность');
        } else {
            console.log('⚠️ Требуется настройка Nginx для лучшей производительности');
        }
        
        console.log('\n🔧 Преимущества Nginx Load Balancer:');
        console.log('   ✅ SSL терминация');
        console.log('   ✅ Статические файлы');
        console.log('   ✅ Gzip сжатие');
        console.log('   ✅ Rate limiting');
        console.log('   ✅ Health checks');
        console.log('   ✅ Масштабируемость');
    }
}

// Запуск тестирования
async function main() {
    const tester = new NginxLoadTester();
    
    console.log('⚠️ ВАЖНО: Убедитесь что запущены:');
    console.log('   1. PM2 кластер: npm run pm2:start');
    console.log('   2. Nginx: .\\scripts\\nginx-control.ps1 start');
    console.log('');
    
    await tester.runComparison();
}

main().catch(console.error);