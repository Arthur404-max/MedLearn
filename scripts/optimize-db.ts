#!/usr/bin/env ts-node

import { 
    createOptimalIndexes, 
    analyzeTableSizes, 
    cleanupOldData,
    monitoredQuery 
} from '../src/database/optimization';
import { pool, getPoolStats } from '../src/config/db';
import { logger } from '../src/config/logger';

async function optimizeDatabase() {
    console.log('🚀 Начинаем оптимизацию базы данных...\n');
    
    try {
        // 1. Проверяем подключение
        console.log('📡 Проверка подключения к базе данных...');
        await pool.query('SELECT 1');
        console.log('✅ Подключение успешно\n');
        
        // 2. Анализируем текущее состояние
        console.log('📊 Анализ размеров таблиц...');
        await analyzeTableSizes();
        console.log('✅ Анализ завершен\n');
        
        // 3. Создаем индексы
        console.log('🔍 Создание оптимальных индексов...');
        await createOptimalIndexes();
        console.log('✅ Индексы созданы\n');
        
        // 4. Обновляем статистику PostgreSQL
        console.log('📈 Обновление статистики PostgreSQL...');
        await monitoredQuery('ANALYZE');
        console.log('✅ Статистика обновлена\n');
        
        // 5. Очищаем старые данные (опционально)
        const cleanup = process.argv.includes('--cleanup');
        if (cleanup) {
            console.log('🧹 Очистка старых данных...');
            await cleanupOldData(90); // Удаляем данные старше 90 дней
            console.log('✅ Очистка завершена\n');
        }
        
        // 6. Показываем статистику пула
        console.log('📊 Статистика пула соединений:');
        const stats = getPoolStats();
        console.log(`   Активных соединений: ${stats.totalCount}`);
        console.log(`   Свободных соединений: ${stats.idleCount}`);
        console.log(`   Ожидающих соединений: ${stats.waitingCount}`);
        console.log(`   Максимум соединений: ${stats.config.max}`);
        console.log(`   Минимум соединений: ${stats.config.min}\n`);
        
        console.log('🎉 Оптимизация базы данных завершена успешно!');
        
        logger.info('Database optimization completed', {
            poolStats: stats,
            type: 'optimization_completed'
        });
        
    } catch (error) {
        console.error('❌ Ошибка при оптимизации:', error);
        logger.error('Database optimization failed', {
            error: (error as Error).message,
            type: 'optimization_error'
        });
        process.exit(1);
    }
}

// Функция для тестирования производительности запросов
async function benchmarkQueries() {
    console.log('⚡ Тестирование производительности запросов...\n');
    
    const testQueries = [
        {
            name: 'Поиск пользователя по email',
            query: 'SELECT * FROM users WHERE email = $1',
            params: ['test@test.com']
        },
        {
            name: 'Получение тестов по предмету',
            query: 'SELECT * FROM tests WHERE subject_id = $1 AND is_active = true',
            params: [1]
        },
        {
            name: 'Получение вопросов теста',
            query: 'SELECT * FROM questions WHERE test_id = $1',
            params: [1]
        },
        {
            name: 'Статистика пользователя',
            query: `
                SELECT 
                    COUNT(*) as total_tests,
                    AVG(percentage) as avg_score
                FROM test_results 
                WHERE user_id = $1
            `,
            params: [1]
        },
        {
            name: 'Популярные тесты',
            query: `
                SELECT 
                    t.title,
                    COUNT(tr.id) as attempts
                FROM tests t
                LEFT JOIN test_results tr ON t.id = tr.test_id
                WHERE t.is_active = true
                GROUP BY t.id, t.title
                ORDER BY attempts DESC
                LIMIT 10
            `,
            params: []
        }
    ];
    
    for (const test of testQueries) {
        const startTime = Date.now();
        
        try {
            const result = await pool.query(test.query, test.params as any[]);
            const duration = Date.now() - startTime;
            
            console.log(`✅ ${test.name}: ${duration}ms (${result.rows.length} строк)`);
            
            if (duration > 100) {
                console.log(`   ⚠️  Медленный запрос! Рассмотрите оптимизацию.`);
            }
            
        } catch (error) {
            console.log(`❌ ${test.name}: Ошибка - ${(error as Error).message}`);
        }
    }
    
    console.log('\n🎯 Рекомендации по оптимизации:');
    console.log('   - Запросы > 100ms требуют оптимизации');
    console.log('   - Используйте EXPLAIN ANALYZE для анализа планов запросов');
    console.log('   - Регулярно обновляйте статистику PostgreSQL');
}

// Основная функция
async function main() {
    const command = process.argv[2];
    
    try {
        switch (command) {
            case 'optimize':
                await optimizeDatabase();
                break;
                
            case 'benchmark':
                await benchmarkQueries();
                break;
                
            case 'analyze':
                await analyzeTableSizes();
                break;
                
            case 'cleanup':
                const days = parseInt(process.argv[3]) || 90;
                await cleanupOldData(days);
                break;
                
            default:
                console.log(`
Использование: npm run db:[команда]

Команды:
  optimize   - Полная оптимизация БД (создание индексов, обновление статистики)
  benchmark  - Тестирование производительности запросов  
  analyze    - Анализ размеров таблиц и статистики
  cleanup    - Очистка старых данных

Примеры:
  npm run db:optimize
  npm run db:benchmark
  npm run db:cleanup

Флаги:
  --cleanup  - Включить очистку старых данных при оптимизации
                `);
        }
        
    } catch (error) {
        console.error('Ошибка выполнения команды:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Запускаем если это основной модуль
if (require.main === module) {
    main().catch(console.error);
}