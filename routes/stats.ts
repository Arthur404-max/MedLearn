import express from 'express';
import { pool } from '../src/config/db';
import { authenticateToken } from '../middleware/auth';
import { validateUser } from '../middleware/validateUser';

const router = express.Router();

// Получение статистики тестирования
router.get('/testing', authenticateToken, validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Получаем общую статистику
        const statsResult = await pool.query(
            `SELECT 
                COUNT(*) as total_tests,
                AVG(score) as average_score
             FROM test_results 
             WHERE user_id = $1`,
            [userId]
        );

        // Получаем лучший предмет
        const bestSubjectResult = await pool.query(
            `SELECT s.name, AVG(tr.score) as avg_score
             FROM test_results tr
             JOIN tests t ON tr.test_id = t.id
             JOIN test_subcategories ts ON t.subcategory_id = ts.id
             JOIN test_categories tc ON ts.category_id = tc.id
             JOIN subjects s ON tc.subject_id = s.id
             WHERE tr.user_id = $1
             GROUP BY s.name
             ORDER BY avg_score DESC
             LIMIT 1`,
            [userId]
        );

        // Получаем последнюю активность
        const recentActivity = await pool.query(
            `SELECT 
                tr.created_at as date,
                t.title as test_name,
                tr.score,
                s.name as subject_name
             FROM test_results tr
             JOIN tests t ON tr.test_id = t.id
             JOIN test_subcategories ts ON t.subcategory_id = ts.id
             JOIN test_categories tc ON ts.category_id = tc.id
             JOIN subjects s ON tc.subject_id = s.id
             WHERE tr.user_id = $1
             ORDER BY tr.created_at DESC
             LIMIT 5`,
            [userId]
        );

        const stats = statsResult.rows[0];
        const bestSubject = bestSubjectResult.rows[0]?.name || null;

        // Форматируем последнюю активность
        const formattedActivity = recentActivity.rows.map(activity => ({
            date: activity.date,
            description: `Тест "${activity.test_name}" по предмету "${activity.subject_name}" пройден с результатом ${activity.score}%`
        }));

        res.json({
            totalTests: parseInt(stats.total_tests),
            averageScore: Math.round(parseFloat(stats.average_score) || 0),
            bestSubject,
            recentActivity: formattedActivity
        });
    } catch (error) {
        console.error('Error fetching testing stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение достижений пользователя
router.get('/achievements', authenticateToken, validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await pool.query(
            `SELECT a.*, ua.unlocked_at
             FROM achievements a
             LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1`,
            [userId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Проверка и выдача достижений
router.post('/check-achievements', authenticateToken, validateUser, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const newAchievements = [];

        await client.query('BEGIN');

        // Проверяем различные условия для достижений
        
        // 1. Первый пройденный тест
        const firstTest = await client.query(
            'SELECT COUNT(*) FROM test_results WHERE user_id = $1',
            [userId]
        );
        
        if (firstTest.rows[0].count === '1') {
            const achievement = await client.query(
                'SELECT * FROM achievements WHERE code = $1',
                ['first_test']
            );
            
            if (achievement.rows.length > 0) {
                await client.query(
                    'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
                    [userId, achievement.rows[0].id]
                );
                newAchievements.push(achievement.rows[0]);
            }
        }

        // 2. Достижение за высокий балл (90%+)
        const highScores = await client.query(
            'SELECT COUNT(*) FROM test_results WHERE user_id = $1 AND score >= 90',
            [userId]
        );
        
        if (highScores.rows[0].count === '1') {
            const achievement = await client.query(
                'SELECT * FROM achievements WHERE code = $1',
                ['high_score']
            );
            
            if (achievement.rows.length > 0) {
                await client.query(
                    'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
                    [userId, achievement.rows[0].id]
                );
                newAchievements.push(achievement.rows[0]);
            }
        }

        await client.query('COMMIT');
        
        res.json({ newAchievements });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error checking achievements:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
});

export default router;