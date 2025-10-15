import http from 'http';
import { performance } from 'perf_hooks';

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

class LoadTester {
    private host: string = 'localhost';
    private port: number = 3000;
    private path: string = '/api/health';

    async runTest(concurrency: number = 10, totalRequests: number = 100): Promise<TestResult> {
        console.log(`🚀 Запуск нагрузочного теста:`);
        console.log(`   Параллельные запросы: ${concurrency}`);
        console.log(`   Общее количество запросов: ${totalRequests}`);
        console.log(`   Эндпоинт: http://${this.host}:${this.port}${this.path}`);
        console.log('');

        const startTime = performance.now();
        const responseTimes: number[] = [];
        const results: Promise<{ success: boolean; responseTime: number }>[] = [];

        // Генерируем все запросы
        for (let i = 0; i < totalRequests; i++) {
            const requestPromise = this.makeRequest()
                .then(responseTime => ({ success: true, responseTime }))
                .catch(() => ({ success: false, responseTime: 0 }));
            
            results.push(requestPromise);

            // Ограничиваем параллелизм
            if ((i + 1) % concurrency === 0) {
                await Promise.allSettled(results.slice(-concurrency));
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
            averageResponseTime: Math.round(averageResponseTime),
            minResponseTime: Math.round(minResponseTime),
            maxResponseTime: Math.round(maxResponseTime),
            requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
            testDuration: Math.round(testDuration)
        };
    }

    private makeRequest(): Promise<number> {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: this.path,
                method: 'GET',
                timeout: 5000
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

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });

            req.end();
        });
    }

    printResults(result: TestResult) {
        console.log('\n📊 РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТА:');
        console.log('='.repeat(50));
        console.log(`📈 Общие показатели:`);
        console.log(`   Всего запросов: ${result.totalRequests}`);
        console.log(`   Успешных: ${result.successfulRequests} (${Math.round((result.successfulRequests/result.totalRequests)*100)}%)`);
        console.log(`   Неудачных: ${result.failedRequests} (${Math.round((result.failedRequests/result.totalRequests)*100)}%)`);
        console.log('');
        console.log(`⚡ Производительность:`);
        console.log(`   Запросов в секунду: ${result.requestsPerSecond}`);
        console.log(`   Время тестирования: ${result.testDuration}мс`);
        console.log('');
        console.log(`⏱️ Время отклика:`);
        console.log(`   Среднее: ${result.averageResponseTime}мс`);
        console.log(`   Минимальное: ${result.minResponseTime}мс`);
        console.log(`   Максимальное: ${result.maxResponseTime}мс`);
        console.log('='.repeat(50));
        
        // Оценка производительности
        if (result.requestsPerSecond > 1000) {
            console.log('🎉 ОТЛИЧНО! Высокая производительность');
        } else if (result.requestsPerSecond > 500) {
            console.log('✅ ХОРОШО! Нормальная производительность');
        } else if (result.requestsPerSecond > 100) {
            console.log('⚠️ УДОВЛЕТВОРИТЕЛЬНО. Можно улучшить');
        } else {
            console.log('❌ ПЛОХО! Требуется оптимизация');
        }
    }
}

// Запуск тестов
async function main() {
    const tester = new LoadTester();
    
    // Тест 1: Умеренная нагрузка
    console.log('🧪 ТЕСТ 1: Умеренная нагрузка');
    const result1 = await tester.runTest(10, 100);
    tester.printResults(result1);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Тест 2: Высокая нагрузка
    console.log('\n🧪 ТЕСТ 2: Высокая нагрузка');
    const result2 = await tester.runTest(50, 500);
    tester.printResults(result2);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Тест 3: Экстремальная нагрузка
    console.log('\n🧪 ТЕСТ 3: Экстремальная нагрузка');
    const result3 = await tester.runTest(100, 1000);
    tester.printResults(result3);
}

main().catch(console.error);