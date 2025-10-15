import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/db';

dotenv.config();

async function checkSystem() {
    console.log('🔍 Проверка состояния системы...\n');

    // Проверка подключения к базе данных
    try {
        const client = await pool.connect();
        console.log('✅ Подключение к PostgreSQL: OK');
        
        // Проверка таблиц
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        
        const expectedTables = [
            'users', 'session', 'subjects', 'categories', 'subcategories',
            'tests', 'questions', 'answers', 'test_attempts', 'subscriptions',
            'resources', 'user_favorites', 'achievements', 'user_achievements'
        ];
        
        const existingTables = tables.rows.map(row => row.table_name);
        const missingTables = expectedTables.filter(table => !existingTables.includes(table));
        
        if (missingTables.length === 0) {
            console.log('✅ Все таблицы базы данных: OK');
        } else {
            console.log('❌ Отсутствуют таблицы:', missingTables.join(', '));
        }

        // Проверка данных
        const dataCheck = await Promise.all([
            client.query('SELECT COUNT(*) FROM subjects'),
            client.query('SELECT COUNT(*) FROM categories'),
            client.query('SELECT COUNT(*) FROM tests'),
            client.query('SELECT COUNT(*) FROM questions'),
            client.query('SELECT COUNT(*) FROM resources'),
            client.query('SELECT COUNT(*) FROM achievements'),
        ]);

        console.log('📊 Статистика данных:');
        console.log(`   Предметы: ${dataCheck[0].rows[0].count}`);
        console.log(`   Категории: ${dataCheck[1].rows[0].count}`);
        console.log(`   Тесты: ${dataCheck[2].rows[0].count}`);
        console.log(`   Вопросы: ${dataCheck[3].rows[0].count}`);
        console.log(`   Ресурсы: ${dataCheck[4].rows[0].count}`);
        console.log(`   Достижения: ${dataCheck[5].rows[0].count}`);

        client.release();
    } catch (error) {
        console.log('❌ Подключение к PostgreSQL: FAILED');
        if (error instanceof Error) {
            console.error('   Ошибка:', error.message);
        } else {
            console.error('   Неизвестная ошибка:', error);
        }
    }

    // Проверка файловой структуры
    console.log('\n📁 Проверка файловой структуры:');
    
    const criticalFiles = [
        'server.ts',
        'package.json',
        '.env',
        'public/index.html',
        'public/client.js',
        'public/styles.css',
        'routes/auth.ts',
        'routes/tests.ts',
        'routes/resources.ts',
        'routes/subscriptions.ts',
        'routes/stats.ts',
        'middleware/auth.ts',
        'middleware/validateUser.ts',
        'src/config/db.ts'
    ];

    criticalFiles.forEach(file => {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ❌ ${file} - отсутствует`);
        }
    });

    // Проверка компилированных файлов
    console.log('\n🔧 Проверка компиляции:');
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
        console.log('   ✅ Папка dist существует');
        
        const serverJsPath = path.join(distPath, 'server.js');
        if (fs.existsSync(serverJsPath)) {
            console.log('   ✅ server.js скомпилирован');
        } else {
            console.log('   ❌ server.js не найден - запустите npm run build');
        }
    } else {
        console.log('   ❌ Папка dist отсутствует - запустите npm run build');
    }

    // Проверка переменных окружения
    console.log('\n🔐 Проверка переменных окружения:');
    const requiredEnvVars = ['PGHOST', 'PGUSER', 'PGDATABASE', 'PGPASSWORD', 'JWT_SECRET'];
    
    requiredEnvVars.forEach(envVar => {
        if (process.env[envVar]) {
            console.log(`   ✅ ${envVar}: установлена`);
        } else {
            console.log(`   ❌ ${envVar}: отсутствует`);
        }
    });

    // Проверка портов
    console.log('\n🚪 Проверка портов:');
    const port = process.env.PORT || 3000;
    console.log(`   🔌 Веб-сервер будет запущен на порту: ${port}`);
    
    const dbPort = process.env.PGPORT || 5432;
    console.log(`   🗄️  База данных на порту: ${dbPort}`);

    console.log('\n🎯 Рекомендации:');
    console.log('   1. Убедитесь, что PostgreSQL запущен');
    console.log('   2. Проверьте настройки в .env файле');
    console.log('   3. Запустите npm run build для компиляции');
    console.log('   4. Используйте npm start для запуска сервера');
    
    console.log('\n✨ Проверка завершена!');
}

// Запуск проверки
checkSystem()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Критическая ошибка при проверке:', error);
        process.exit(1);
    });