import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { PoolClient } from 'pg';
import { pool } from '../src/config/db';

dotenv.config();

const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password123';
const TEST_USER_FIRST_NAME = 'Тест';
const TEST_USER_LAST_NAME = 'Пользователь';
const TEST_USER_ROLE = 'admin';
const TEST_USER_IS_PREMIUM = true;

const PREMIUM_PLAN = {
    type: 'premium',
    name: 'Премиум план',
    duration: 'lifetime',
    price: 0,
    endDate: new Date('2099-12-31T23:59:59.999Z'),
    paymentStatus: 'paid' as const,
    features: JSON.stringify({
        tests: 'unlimited',
        resources: 'unlimited',
        ai_assistant: true,
        practice_modes: ['basic', 'advanced', 'exam', 'simulation'],
        analytics: true,
        priority_support: true,
        downloadable_content: true
    })
};

async function upsertTestSubscription(client: PoolClient, userId: number) {
    const existingSubscription = await client.query(
        'SELECT id FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
    );

    if (existingSubscription.rows.length === 0) {
        await client.query(
            `INSERT INTO subscriptions (
                user_id,
                plan_type,
                plan_name,
                duration,
                price,
                features,
                start_date,
                end_date,
                is_active,
                payment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, true, $8)` ,
            [
                userId,
                PREMIUM_PLAN.type,
                PREMIUM_PLAN.name,
                PREMIUM_PLAN.duration,
                PREMIUM_PLAN.price,
                PREMIUM_PLAN.features,
                PREMIUM_PLAN.endDate,
                PREMIUM_PLAN.paymentStatus
            ]
        );
        console.log('✅ Премиум подписка создана');
        return;
    }

    await client.query(
        `UPDATE subscriptions
         SET plan_type = $2,
             plan_name = $3,
             duration = $4,
             price = $5,
             features = $6,
             start_date = CURRENT_TIMESTAMP,
             end_date = $7,
             is_active = true,
             payment_status = $8
         WHERE id = $1`,
        [
            existingSubscription.rows[0].id,
            PREMIUM_PLAN.type,
            PREMIUM_PLAN.name,
            PREMIUM_PLAN.duration,
            PREMIUM_PLAN.price,
            PREMIUM_PLAN.features,
            PREMIUM_PLAN.endDate,
            PREMIUM_PLAN.paymentStatus
        ]
    );
    console.log('🔄 Премиум подписка обновлена');
}

async function createTestUser() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('🔄 Создание тестового пользователя...');

        const hashedPassword = await bcrypt.hash(TEST_USER_PASSWORD, 10);

        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [TEST_USER_EMAIL]
        );

        let userId: number;

        if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
            await client.query(
                `UPDATE users
                 SET password_hash = $1,
                     first_name = $2,
                     last_name = $3,
                     role = $4,
                     is_verified = true,
                     is_premium = $5,
                     verification_token = null,
                     is_banned = false,
                     ban_reason = null,
                     banned_at = null,
                     banned_until = null,
                     is_deleted = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6`,
                [
                    hashedPassword,
                    TEST_USER_FIRST_NAME,
                    TEST_USER_LAST_NAME,
                    TEST_USER_ROLE,
                    TEST_USER_IS_PREMIUM,
                    userId
                ]
            );
            console.log('ℹ️  Пользователь уже существует, данные обновлены и email подтвержден');
            console.log(`   📧 Email: ${TEST_USER_EMAIL}`);
            console.log(`   🔑 Пароль: ${TEST_USER_PASSWORD}`);
            console.log(`   🆔 ID: ${userId}`);
            console.log(`   🛡️ Роль: ${TEST_USER_ROLE}`);
            console.log('   💎 Премиум статус: активен');
        } else {
            const result = await client.query(
                `INSERT INTO users (
                    email,
                    password_hash,
                    first_name,
                    last_name,
                    role,
                    is_verified,
                    verification_token,
                    is_premium,
                    is_banned,
                    is_deleted
                ) VALUES ($1, $2, $3, $4, $5, true, null, $6, false, false)
                RETURNING id, email`,
                [
                    TEST_USER_EMAIL,
                    hashedPassword,
                    TEST_USER_FIRST_NAME,
                    TEST_USER_LAST_NAME,
                    TEST_USER_ROLE,
                    TEST_USER_IS_PREMIUM
                ]
            );

            const user = result.rows[0];
            userId = user.id;
            console.log('✅ Тестовый пользователь создан:');
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   🔑 Пароль: ${TEST_USER_PASSWORD}`);
            console.log(`   🆔 ID: ${user.id}`);
            console.log(`   🛡️ Роль: ${TEST_USER_ROLE}`);
            console.log('   💎 Премиум статус: активен');
        }

        await upsertTestSubscription(client, userId);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка при создании пользователя:', error);
        throw error;
    } finally {
        client.release();
    }
}

createTestUser()
    .then(() => {
        console.log('✅ Тестовый пользователь готов к использованию');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });
