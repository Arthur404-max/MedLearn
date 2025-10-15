import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/db';

dotenv.config();

async function initializeDatabase() {
    const client = await pool.connect();

    try {
        console.log('🔄 Инициализация базы данных...');

        const sqlFilePath = path.resolve(__dirname, '../database/init.sql');
        if (!fs.existsSync(sqlFilePath)) {
            throw new Error(`Не найден файл схемы: ${sqlFilePath}`);
        }

        const schemaSql = fs.readFileSync(sqlFilePath, 'utf8');
        if (!schemaSql.trim()) {
            throw new Error('Файл init.sql пустой — нечего выполнять.');
        }

        await client.query(schemaSql);

        console.log('🎉 База данных успешно инициализирована по файлу init.sql');
    } catch (error) {
        console.error('❌ Ошибка при инициализации базы данных:', error);
        throw error;
    } finally {
        client.release();
    }
}

initializeDatabase()
    .then(() => {
        console.log('✅ Инициализация завершена успешно');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });