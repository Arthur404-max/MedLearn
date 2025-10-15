import { pool } from '../config/db';
import { logger } from '../config/logger';

interface QueryAnalysis {
    query: string;
    duration: number;
    rows: number;
    explain?: any;
}

// Функция для анализа медленных запросов
export const analyzeQuery = async (query: string, params: any[] = []): Promise<QueryAnalysis> => {
    const startTime = Date.now();
    
    try {
        // Выполняем EXPLAIN ANALYZE для понимания плана запроса
        const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
        const explainResult = await pool.query(explainQuery, params);
        
        // Выполняем сам запрос
        const result = await pool.query(query, params);
        const duration = Date.now() - startTime;
        
        const analysis: QueryAnalysis = {
            query,
            duration,
            rows: result.rows.length,
            explain: explainResult.rows[0]['QUERY PLAN']
        };
        
        // Логируем медленные запросы
        if (duration > 100) {
            logger.warn('Slow database query detected', {
                query: query.substring(0, 200),
                duration,
                rows: result.rows.length,
                type: 'slow_query'
            });
        }
        
        return analysis;
        
    } catch (error) {
        logger.error('Query analysis failed', {
            query: query.substring(0, 200),
            error: (error as Error).message,
            type: 'query_error'
        });
        throw error;
    }
};

// Обертка для pool.query с мониторингом
export const monitoredQuery = async (query: string, params: any[] = []) => {
    const startTime = Date.now();
    
    try {
        const result = await pool.query(query, params);
        const duration = Date.now() - startTime;
        
        // Логируем только медленные запросы в продакшене
        if (duration > 100 || process.env.NODE_ENV === 'development') {
            logger.info('Database query executed', {
                query: query.substring(0, 150),
                duration,
                rows: result.rows.length,
                type: 'database_query'
            });
        }
        
        return result;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Database query failed', {
            query: query.substring(0, 150),
            duration,
            error: (error as Error).message,
            type: 'database_error'
        });
        throw error;
    }
};

// Функция для создания оптимальных индексов
export const createOptimalIndexes = async (): Promise<void> => {
    const indexes = [
        // Пользователи - поиск по email (самый частый запрос)
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
        
        // Пользователи - проверка активности
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_banned ON users(is_banned) WHERE is_banned = false',
        
        // Тесты - поиск по предмету
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_subject_id ON tests(subject_id) WHERE is_active = true',
        
        // Тесты - сложный индекс для фильтрации
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_active_difficulty ON tests(is_active, difficulty_level, subject_id)',
        
        // Вопросы - связь с тестами
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_test_id ON questions(test_id)',
        
        // Ответы - связь с вопросами
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_answers_question_id ON answers(question_id)',
        
        // Результаты тестов - поиск по пользователю
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_results_user_id ON test_results(user_id, completed_at DESC)',
        
        // Результаты тестов - поиск по тесту для статистики
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_results_test_id ON test_results(test_id, completed_at DESC)',
        
        // Ресурсы - поиск по типу и предмету
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_subject_type ON resources(subject_id, resource_type) WHERE is_premium IS NOT NULL',
        
        // Подписки - активные подписки пользователя
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(user_id, is_active, expires_at DESC) WHERE is_active = true',
        
        // Категории - связь с предметами
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_subject ON categories(subject_id) WHERE is_active = true',
        
        // Подкатегории - связь с категориями
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subcategories_category ON subcategories(category_id) WHERE is_active = true',
        
        // Временные индексы для логов и статистики
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at DESC)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_results_completed_at ON test_results(completed_at DESC)'
    ];
    
    logger.info('Starting index creation', { count: indexes.length, type: 'database_optimization' });
    
    for (const indexQuery of indexes) {
        try {
            console.log(`Creating index: ${indexQuery.split(' ')[5]}`);
            await pool.query(indexQuery);
            logger.info('Index created successfully', { 
                index: indexQuery.split(' ')[5],
                type: 'index_created' 
            });
        } catch (error: any) {
            // Игнорируем ошибку если индекс уже существует
            if (error.code !== '42P07') {
                logger.error('Failed to create index', {
                    index: indexQuery.split(' ')[5],
                    error: error.message,
                    type: 'index_error'
                });
            }
        }
    }
    
    logger.info('Index creation completed', { type: 'database_optimization' });
};

// Функция для анализа размера таблиц
export const analyzeTableSizes = async (): Promise<void> => {
    const sizeQuery = `
        SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation,
            most_common_vals,
            most_common_freqs
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname;
    `;
    
    const tablesQuery = `
        SELECT 
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;
    
    try {
        const tablesResult = await pool.query(tablesQuery);
        const statsResult = await pool.query(sizeQuery);
        
        console.log('\n=== Размеры таблиц ===');
        tablesResult.rows.forEach((row: any) => {
            console.log(`${row.tablename}: ${row.size}`);
        });
        
        console.log('\n=== Статистика колонок (топ-10 по размеру) ===');
        statsResult.rows.slice(0, 10).forEach((row: any) => {
            console.log(`${row.tablename}.${row.attname}: distinct=${row.n_distinct}, correlation=${row.correlation}`);
        });
        
        logger.info('Database size analysis completed', {
            tables: tablesResult.rows.length,
            totalSize: tablesResult.rows.reduce((sum: number, row: any) => sum + parseInt(row.size_bytes), 0),
            type: 'database_analysis'
        });
        
    } catch (error) {
        logger.error('Failed to analyze table sizes', {
            error: (error as Error).message,
            type: 'database_error'
        });
    }
};

// Функция для очистки старых данных
export const cleanupOldData = async (daysOld: number = 90): Promise<void> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const cleanupQueries = [
        // Удаляем старые результаты тестов (оставляем только последние)
        `
        DELETE FROM test_results 
        WHERE completed_at < $1 
        AND id NOT IN (
            SELECT DISTINCT ON (user_id, test_id) id 
            FROM test_results 
            ORDER BY user_id, test_id, completed_at DESC
        )
        `,
        
        // Удаляем неактивированных пользователей старше 30 дней
        `
        DELETE FROM users 
        WHERE is_verified = false 
        AND created_at < $2
        `
    ];
    
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        for (const query of cleanupQueries) {
            const result = await pool.query(query, [cutoffDate.toISOString(), thirtyDaysAgo.toISOString()]);
            logger.info('Old data cleaned up', {
                query: query.substring(0, 50),
                rowsAffected: result.rowCount || 0,
                type: 'data_cleanup'
            });
        }
        
    } catch (error) {
        logger.error('Data cleanup failed', {
            error: (error as Error).message,
            type: 'cleanup_error'
        });
    }
};