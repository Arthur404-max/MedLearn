import express from 'express';
import { pool } from '../src/config/db';
import { authenticateToken } from '../middleware/auth';
import { validateUser } from '../middleware/validateUser';

const router = express.Router();

// Получение текущей подписки пользователя
router.get('/current', authenticateToken, validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT s.*, p.name as plan_name, p.features
             FROM subscriptions s
             JOIN subscription_plans p ON s.plan_id = p.id
             WHERE s.user_id = $1 AND s.active = true
             ORDER BY s.created_at DESC
             LIMIT 1`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.json({ active: false });
        }
        
        res.json({
            active: true,
            ...result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение всех планов подписки
router.get('/plans', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM subscription_plans ORDER BY price'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Оформление новой подписки
router.post('/purchase', authenticateToken, validateUser, async (req, res) => {
    const client = await pool.connect();
    try {
        const { plan, payment } = req.body;
        const userId = req.user.id;

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Проверяем, есть ли активная подписка
        const activeSubscription = await client.query(
            'SELECT * FROM subscriptions WHERE user_id = $1 AND active = true',
            [userId]
        );

        if (activeSubscription.rows.length > 0) {
            // Деактивируем текущую подписку
            await client.query(
                'UPDATE subscriptions SET active = false WHERE user_id = $1',
                [userId]
            );
        }

        // Получаем информацию о плане
        const planInfo = await client.query(
            'SELECT * FROM subscription_plans WHERE type = $1',
            [plan.type]
        );

        if (planInfo.rows.length === 0) {
            throw new Error('Invalid subscription plan');
        }

        // Рассчитываем дату окончания подписки
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + (plan.period === 'year' ? 12 : 6));

        // Сохраняем информацию о платеже
        const paymentResult = await client.query(
            `INSERT INTO payments (
                user_id, 
                amount, 
                status, 
                payment_method,
                last_four_digits
            ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
                userId,
                planInfo.rows[0].price,
                'completed',
                'card',
                payment.cardNumber.slice(-4)
            ]
        );

        // Создаем новую подписку
        await client.query(
            `INSERT INTO subscriptions (
                user_id,
                plan_id,
                payment_id,
                start_date,
                end_date,
                active
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                userId,
                planInfo.rows[0].id,
                paymentResult.rows[0].id,
                now,
                endDate,
                true
            ]
        );

        // Фиксируем транзакцию
        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: 'Subscription purchased successfully' 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error purchasing subscription:', error);
        if (error instanceof Error) {
            res.status(500).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Internal server error' });
        }
    } finally {
        client.release();
    }
});

// Отмена подписки
router.post('/cancel', authenticateToken, validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        
        await pool.query(
            'UPDATE subscriptions SET active = false WHERE user_id = $1 AND active = true',
            [userId]
        );
        
        res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;