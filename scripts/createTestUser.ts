import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { pool } from '../src/config/db';

dotenv.config();

async function createTestUser() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Создание тестового пользователя...');

        const email = 'test@example.com';
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Проверяем, существует ли пользователь
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        
        if (existingUser.rows.length > 0) {
            console.log('ℹ️  Пользователь уже существует');
            return;
        }

        // Создаем нового пользователя
        const result = await client.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email
        `, [email, hashedPassword, 'Тест', 'Пользователь', 'student']);

        const user = result.rows[0];
        console.log('✅ Тестовый пользователь создан:');
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🔑 Пароль: ${password}`);
        console.log(`   🆔 ID: ${user.id}`);

        // Добавляем базовую подписку
        await client.query(`
            INSERT INTO subscriptions (user_id, plan_type, plan_name, duration, price, features, end_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            user.id,
            'basic',
            'Базовый план',
            'semester',
            299.00,
            JSON.stringify({
                tests: true,
                resources: 'limited',
                ai_assistant: false,
                practice_modes: ['basic']
            }),
            new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 месяцев
        ]);

        console.log('✅ Базовая подписка добавлена');

    } catch (error) {
        console.error('❌ Ошибка при создании пользователя:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Запуск создания пользователя
createTestUser()
    .then(() => {
        console.log('✅ Тестовый пользователь готов к использованию');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });