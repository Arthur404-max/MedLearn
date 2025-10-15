import express from 'express';
import { pool } from '../src/config/db';
import { authenticateToken } from '../middleware/auth';
import { validateUser } from '../middleware/validateUser';

const router = express.Router();

// === УПРАВЛЕНИЕ ПРЕДМЕТАМИ ===

// Создание предмета
router.post('/subjects', authenticateToken, validateUser, async (req, res) => {
    try {
        const { name, description, icon } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Название предмета обязательно' });
        }
        
        // Проверяем, что предмет не существует
        const existingSubject = await pool.query('SELECT id FROM subjects WHERE LOWER(name) = LOWER($1)', [name.trim()]);
        if (existingSubject.rows.length > 0) {
            return res.status(400).json({ message: 'Предмет с таким названием уже существует' });
        }
        
        const result = await pool.query(
            'INSERT INTO subjects (name, description, icon) VALUES ($1, $2, $3) RETURNING id, name, description, icon',
            [name.trim(), description?.trim() || '', icon?.trim() || '📚']
        );
        
        res.json({ 
            message: 'Предмет успешно создан', 
            subject: result.rows[0] 
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({ message: 'Ошибка при создании предмета' });
    }
});

// === УПРАВЛЕНИЕ КАТЕГОРИЯМИ ===

// Создание категории
router.post('/categories', authenticateToken, validateUser, async (req, res) => {
    try {
        const { subject_id, name, description } = req.body;
        
        if (!subject_id || !name || !name.trim()) {
            return res.status(400).json({ message: 'Предмет и название категории обязательны' });
        }
        
        // Проверяем, что предмет существует
        const subjectCheck = await pool.query('SELECT id FROM subjects WHERE id = $1', [subject_id]);
        if (subjectCheck.rows.length === 0) {
            return res.status(400).json({ message: 'Предмет не найден' });
        }
        
        // Проверяем, что категория не существует в этом предмете
        const existingCategory = await pool.query(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND subject_id = $2', 
            [name.trim(), subject_id]
        );
        if (existingCategory.rows.length > 0) {
            return res.status(400).json({ message: 'Категория с таким названием уже существует в этом предмете' });
        }
        
        const result = await pool.query(
            'INSERT INTO categories (subject_id, name, description) VALUES ($1, $2, $3) RETURNING id, name',
            [subject_id, name.trim(), description?.trim() || '']
        );
        
        res.json({ 
            message: 'Категория успешно создана', 
            category: result.rows[0] 
        });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Ошибка при создании категории' });
    }
});

// Получение всех категорий с информацией о предметах
router.get('/categories', authenticateToken, validateUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.name, c.description, c.created_at,
                   s.name as subject_name, s.id as subject_id
            FROM categories c
            JOIN subjects s ON c.subject_id = s.id
            ORDER BY s.name, c.name
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Ошибка при загрузке категорий' });
    }
});

// === УПРАВЛЕНИЕ ПОДКАТЕГОРИЯМИ ===

// Создание подкатегории
router.post('/subcategories', authenticateToken, validateUser, async (req, res) => {
    try {
        const { category_id, name, description } = req.body;
        
        if (!category_id || !name || !name.trim()) {
            return res.status(400).json({ message: 'Категория и название подкатегории обязательны' });
        }
        
        // Проверяем, что категория существует
        const categoryCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [category_id]);
        if (categoryCheck.rows.length === 0) {
            return res.status(400).json({ message: 'Категория не найдена' });
        }
        
        // Проверяем, что подкатегория не существует в этой категории
        const existingSubcategory = await pool.query(
            'SELECT id FROM subcategories WHERE LOWER(name) = LOWER($1) AND category_id = $2', 
            [name.trim(), category_id]
        );
        if (existingSubcategory.rows.length > 0) {
            return res.status(400).json({ message: 'Подкатегория с таким названием уже существует в этой категории' });
        }
        
        const result = await pool.query(
            'INSERT INTO subcategories (category_id, name, description) VALUES ($1, $2, $3) RETURNING id, name',
            [category_id, name.trim(), description?.trim() || '']
        );
        
        res.json({ 
            message: 'Подкатегория успешно создана', 
            subcategory: result.rows[0] 
        });
    } catch (error) {
        console.error('Error creating subcategory:', error);
        res.status(500).json({ message: 'Ошибка при создании подкатегории' });
    }
});

// === УПРАВЛЕНИЕ РЕСУРСАМИ ===

// Создание ресурса
router.post('/resources', authenticateToken, validateUser, async (req, res) => {
    try {
        const { title, description, content, resource_type, url, subject_id, category_id, is_premium } = req.body;
        
        const result = await pool.query(
            'INSERT INTO resources (title, description, content, resource_type, url, subject_id, category_id, is_premium) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [title, description, content, resource_type, url, subject_id, category_id, is_premium]
        );
        
        res.json({ message: 'Ресурс создан', resource: result.rows[0] });
    } catch (error) {
        console.error('Error creating resource:', error);
        res.status(500).json({ message: 'Ошибка создания ресурса' });
    }
});

// === УПРАВЛЕНИЕ ТЕСТАМИ ===

// Тестовый эндпоинт для проверки доступности
router.get('/tests/ping', (req, res) => {
    console.log('Tests ping endpoint hit');
    res.json({ message: 'Tests API is working', timestamp: new Date().toISOString() });
});

// Создание теста
router.post('/tests', authenticateToken, validateUser, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('Creating test with data:', req.body);
        const { title, description, subject, category_id, subcategory_id, difficulty, time_limit, questions } = req.body;
        
        if (!title || !subject || !questions || questions.length === 0) {
            console.log('Validation failed:', { title, subject, questionsLength: questions?.length });
            return res.status(400).json({ message: 'Название, предмет и вопросы обязательны' });
        }
        
        // Находим subject_id по названию предмета
        let subject_id;
        if (typeof subject === 'string') {
            const subjectResult = await client.query('SELECT id FROM subjects WHERE name = $1', [subject]);
            if (subjectResult.rows.length === 0) {
                return res.status(400).json({ message: 'Предмет не найден: ' + subject });
            }
            subject_id = subjectResult.rows[0].id;
        } else {
            subject_id = subject;
        }
        
        console.log('✅ Найден subject_id:', subject_id, 'для предмета:', subject);
        
        // Создаем тест
        const testResult = await client.query(
            'INSERT INTO tests (title, description, subject_id, category_id, subcategory_id, difficulty_level, time_limit, is_published) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [title, description, subject_id, category_id, subcategory_id, difficulty || 'medium', time_limit || 30, true]
        );
        
        const testId = testResult.rows[0].id;
        console.log('✅ Тест создан с ID:', testId);
        
        // Добавляем вопросы
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            const questionResult = await client.query(
                'INSERT INTO questions (test_id, question_text, question_type, explanation, points) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [testId, question.text, question.type || 'multiple_choice', question.explanation || '', question.points || 1]
            );
            
            const questionId = questionResult.rows[0].id;
            console.log('✅ Вопрос создан с ID:', questionId);
            
            // Добавляем варианты ответов
            if (question.options && question.options.length > 0) {
                for (let j = 0; j < question.options.length; j++) {
                    const option = question.options[j];
                    await client.query(
                        'INSERT INTO answers (question_id, answer_text, is_correct) VALUES ($1, $2, $3)',
                        [questionId, option.text, option.is_correct || false]
                    );
                }
                console.log('✅ Добавлено ответов:', question.options.length);
            }
        }
        
        await client.query('COMMIT');
        console.log('🎉 Тест полностью создан:', testId);
        
        res.json({ 
            message: 'Тест успешно создан', 
            test: { id: testId, title, questionsCount: questions.length } 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating test:', error);
        res.status(500).json({ message: 'Ошибка при создании теста' });
    } finally {
        client.release();
    }
});

// Получение списка тестов
router.get('/tests', async (req, res) => {
    try {
        console.log('GET /tests endpoint hit');
        // Упрощенный запрос для диагностики
        const result = await pool.query('SELECT * FROM tests ORDER BY created_at DESC');
        
        console.log('Found tests:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ message: 'Ошибка получения тестов' });
    }
});

// === УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ===

// Получение всех пользователей
router.get('/users', authenticateToken, validateUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.role, 
                u.is_verified, u.is_premium, u.is_banned, u.banned_reason,
                u.banned_at, u.last_login, u.created_at,
                banned_by_user.email as banned_by_email
            FROM users u
            LEFT JOIN users banned_by_user ON u.banned_by = banned_by_user.id
            ORDER BY u.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Ошибка получения пользователей' });
    }
});

// Бан пользователя
router.post('/users/:id/ban', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.user.id;
        
        if (!reason) {
            return res.status(400).json({ message: 'Причина бана обязательна' });
        }
        
        const result = await pool.query(`
            UPDATE users 
            SET is_banned = true, banned_reason = $1, banned_at = CURRENT_TIMESTAMP, banned_by = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND id != $2
            RETURNING id, email, first_name, last_name
        `, [reason, adminId, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден или нельзя забанить себя' });
        }
        
        res.json({ 
            message: 'Пользователь забанен', 
            user: result.rows[0] 
        });
    } catch (error) {
        console.error('Error banning user:', error);
        res.status(500).json({ message: 'Ошибка при бане пользователя' });
    }
});

// Разбан пользователя
router.post('/users/:id/unban', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            UPDATE users 
            SET is_banned = false, banned_reason = NULL, banned_at = NULL, banned_by = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, email, first_name, last_name
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        res.json({ 
            message: 'Пользователь разбанен', 
            user: result.rows[0] 
        });
    } catch (error) {
        console.error('Error unbanning user:', error);
        res.status(500).json({ message: 'Ошибка при разбане пользователя' });
    }
});

// Выдача/отзыв премиум доступа
router.post('/users/:id/premium', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_premium } = req.body;
        
        const result = await pool.query(`
            UPDATE users 
            SET is_premium = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, email, first_name, last_name, is_premium
        `, [is_premium, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        res.json({ 
            message: is_premium ? 'Премиум доступ выдан' : 'Премиум доступ отозван', 
            user: result.rows[0] 
        });
    } catch (error) {
        console.error('Error updating premium status:', error);
        res.status(500).json({ message: 'Ошибка при обновлении премиум статуса' });
    }
});

// Смена роли пользователя
router.post('/users/:id/role', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const adminId = req.user.id;
        
        if (!['student', 'teacher', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Неверная роль' });
        }
        
        if (parseInt(id) === adminId && role !== 'admin') {
            return res.status(400).json({ message: 'Нельзя изменить свою роль администратора' });
        }
        
        const result = await pool.query(`
            UPDATE users 
            SET role = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, email, first_name, last_name, role
        `, [role, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        res.json({ 
            message: 'Роль пользователя изменена', 
            user: result.rows[0] 
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ message: 'Ошибка при изменении роли пользователя' });
    }
});

// Удаление пользователя
router.delete('/users/:id', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        
        if (parseInt(id) === adminId) {
            return res.status(400).json({ message: 'Нельзя удалить самого себя' });
        }
        
        const result = await pool.query(`
            DELETE FROM users 
            WHERE id = $1
            RETURNING id, email, first_name, last_name
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        res.json({ 
            message: 'Пользователь удален', 
            user: result.rows[0] 
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Ошибка при удалении пользователя' });
    }
});

// Статистика пользователей
router.get('/users/stats', authenticateToken, validateUser, async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE is_verified = true) as verified_users,
                COUNT(*) FILTER (WHERE is_premium = true) as premium_users,
                COUNT(*) FILTER (WHERE is_banned = true) as banned_users,
                COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
                COUNT(*) FILTER (WHERE role = 'teacher') as teacher_users,
                COUNT(*) FILTER (WHERE role = 'student') as student_users,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_users_week,
                COUNT(*) FILTER (WHERE last_login >= CURRENT_DATE - INTERVAL '7 days') as active_users_week
            FROM users
        `);
        
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ message: 'Ошибка получения статистики пользователей' });
    }
});

// === УПРАВЛЕНИЕ ТЕСТАМИ ===

// Получение всех тестов для админки
router.get('/tests', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.id, t.title, t.description, t.time_limit as duration,
                t.difficulty_level as category,
                s.name as subject,
                t.created_at,
                COUNT(q.id) as questions_count
            FROM tests t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN questions q ON t.id = q.test_id
            GROUP BY t.id, t.title, t.description, t.time_limit, t.difficulty_level, s.name, t.created_at
            ORDER BY t.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ message: 'Ошибка при загрузке тестов' });
    }
});

// Получение конкретного теста с вопросами
router.get('/tests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Получаем данные теста
        const testResult = await pool.query(`
            SELECT 
                t.id, t.title, t.description, t.time_limit as duration,
                t.difficulty_level as category,
                s.name as subject,
                t.created_at
            FROM tests t
            LEFT JOIN subjects s ON t.subject_id = s.id
            WHERE t.id = $1
        `, [id]);
        
        if (testResult.rows.length === 0) {
            return res.status(404).json({ message: 'Тест не найден' });
        }
        
        const test = testResult.rows[0];
        
        // Получаем вопросы теста
        const questionsResult = await pool.query(`
            SELECT 
                q.id, q.question_text as text, q.explanation, q.question_type as type, q.points
            FROM questions q
            WHERE q.test_id = $1
            ORDER BY q.id
        `, [id]);
        
        // Получаем варианты ответов для каждого вопроса
        const questions = [];
        for (const question of questionsResult.rows) {
            const answersResult = await pool.query(`
                SELECT answer_text as text, is_correct
                FROM answers
                WHERE question_id = $1
                ORDER BY id
            `, [question.id]);
            
            questions.push({
                ...question,
                options: answersResult.rows
            });
        }
        
        test.questions = questions;
        res.json(test);
        
    } catch (error) {
        console.error('Error fetching test:', error);
        res.status(500).json({ message: 'Ошибка при загрузке теста' });
    }
});

// Получение только вопросов теста
router.get('/tests/:id/questions', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Получаем вопросы теста
        const questionsResult = await pool.query(`
            SELECT 
                q.id, q.question_text as text, q.explanation, q.question_type as type, q.points
            FROM questions q
            WHERE q.test_id = $1
            ORDER BY q.id
        `, [id]);
        
        // Получаем варианты ответов для каждого вопроса
        const questions = [];
        for (const question of questionsResult.rows) {
            const answersResult = await pool.query(`
                SELECT answer_text as text, is_correct
                FROM answers
                WHERE question_id = $1
                ORDER BY id
            `, [question.id]);
            
            questions.push({
                ...question,
                options: answersResult.rows
            });
        }
        
        res.json(questions);
        
    } catch (error) {
        console.error('Error fetching test questions:', error);
        res.status(500).json({ message: 'Ошибка при загрузке вопросов теста' });
    }
});



// Обновление теста
router.put('/tests/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const { title, subject, category, duration, description, questions } = req.body;
        
        if (!title || !questions || questions.length === 0) {
            return res.status(400).json({ message: 'Название теста и вопросы обязательны' });
        }
        
        // Находим subject_id по названию предмета
        let subjectId = null;
        if (subject) {
            const subjectResult = await client.query('SELECT id FROM subjects WHERE name = $1', [subject]);
            if (subjectResult.rows.length > 0) {
                subjectId = subjectResult.rows[0].id;
            }
        }
        
        // Обновляем тест
        await client.query(`
            UPDATE tests 
            SET title = $1, description = $2, subject_id = $3, time_limit = $4, difficulty_level = $5
            WHERE id = $6
        `, [title, description || '', subjectId, duration || 30, category || 'medium', id]);
        
        // Удаляем старые вопросы и ответы
        await client.query('DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE test_id = $1)', [id]);
        await client.query('DELETE FROM questions WHERE test_id = $1', [id]);
        
        // Добавляем новые вопросы
        for (const question of questions) {
            const questionResult = await client.query(`
                INSERT INTO questions (test_id, question_text, explanation, question_type, points)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [id, question.text, question.explanation || '', question.type || 'multiple_choice', question.points || 1]);
            
            const questionId = questionResult.rows[0].id;
            
            // Добавляем варианты ответов
            for (const option of question.options) {
                await client.query(`
                    INSERT INTO answers (question_id, answer_text, is_correct)
                    VALUES ($1, $2, $3)
                `, [questionId, option.text, option.is_correct]);
            }
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Тест успешно обновлен' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating test:', error);
        res.status(500).json({ message: 'Ошибка при обновлении теста' });
    } finally {
        client.release();
    }
});

// Удаление теста
router.delete('/tests/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        
        // Проверяем существование теста
        const testCheck = await client.query('SELECT title FROM tests WHERE id = $1', [id]);
        if (testCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Тест не найден' });
        }
        
        // Удаляем ответы
        await client.query('DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE test_id = $1)', [id]);
        
        // Удаляем вопросы
        await client.query('DELETE FROM questions WHERE test_id = $1', [id]);
        
        // Удаляем результаты тестов
        await client.query('DELETE FROM test_results WHERE test_id = $1', [id]);
        
        // Удаляем тест
        await client.query('DELETE FROM tests WHERE id = $1', [id]);
        
        await client.query('COMMIT');
        res.json({ message: 'Тест успешно удален' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting test:', error);
        res.status(500).json({ message: 'Ошибка при удалении теста' });
    } finally {
        client.release();
    }
});

// =============================================================================
// ИНТЕГРАЦИЯ С ОСНОВНЫМ САЙТОМ - НОВЫЕ АДМИНСКИЕ ФУНКЦИИ
// =============================================================================

// Middleware для проверки административных прав
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const userRole = result.rows[0].role;
    if (userRole !== 'admin' && userRole !== 'teacher') {
      return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    next();
  } catch (error) {
    console.error('Ошибка проверки прав:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получение системной статистики
router.get('/stats', authenticateToken, validateUser, requireAdmin, async (req, res) => {
  try {
    // Общая статистика пользователей
    const usersStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teacher_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month
      FROM users
    `);

    // Статистика тестов
    const testsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_tests,
        COUNT(CASE WHEN is_published = true THEN 1 END) as published_tests,
        COUNT(DISTINCT subject_id) as subjects_count
      FROM tests
    `);

    // Статистика результатов тестов
    const resultsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        AVG(score) as average_score,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as attempts_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as attempts_month
      FROM test_results
    `);

    // Статистика ресурсов
    const resourcesStats = await pool.query(`
      SELECT 
        COUNT(*) as total_resources,
        COUNT(CASE WHEN is_published = true THEN 1 END) as published_resources,
        SUM(views_count) as total_views
      FROM resources
    `);

    // Активность по дням (последние 7 дней)
    const dailyActivity = await pool.query(`
      SELECT 
        DATE(created_at) as activity_date,
        COUNT(*) as tests_taken,
        COUNT(DISTINCT user_id) as active_users
      FROM test_results 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY activity_date
    `);

    const stats = {
      users: usersStats.rows[0],
      tests: testsStats.rows[0],
      results: resultsStats.rows[0],
      resources: resourcesStats.rows[0],
      daily_activity: dailyActivity.rows,
      generated_at: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения системной статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получение списка пользователей для управления
router.get('/users-management', authenticateToken, validateUser, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '20'));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '');

    let whereClause = '';
    let queryParams: any[] = [limit, offset];

    if (search) {
      whereClause = 'WHERE email ILIKE $3 OR first_name ILIKE $3 OR last_name ILIKE $3';
      queryParams.push(`%${search}%`);
    }

    const usersResult = await pool.query(`
      SELECT 
        id, email, first_name, last_name, role, is_verified, is_banned, 
        created_at, last_login, university, course, ban_reason, banned_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, queryParams);

    const totalResult = await pool.query(`
      SELECT COUNT(*) as total FROM users ${whereClause}
    `, search ? [`%${search}%`] : []);

    res.json({
      users: usersResult.rows,
      total: parseInt(totalResult.rows[0].total),
      page,
      pages: Math.ceil(parseInt(totalResult.rows[0].total) / limit)
    });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Блокировка пользователя
router.post('/users/:id/ban', authenticateToken, validateUser, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason = 'Нарушение правил' } = req.body;
    const adminId = req.user.id;

    // Проверяем, что пользователь не пытается заблокировать самого себя
    if (userId === adminId.toString()) {
      return res.status(400).json({ message: 'Нельзя заблокировать самого себя' });
    }

    await pool.query(`
      UPDATE users 
      SET is_banned = true, ban_reason = $1, banned_at = NOW(), banned_by = $2 
      WHERE id = $3
    `, [reason, adminId, userId]);

    res.json({ message: 'Пользователь заблокирован', userId, reason });
  } catch (error) {
    console.error('Ошибка блокировки пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Разблокировка пользователя
router.post('/users/:id/unban', authenticateToken, validateUser, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    await pool.query(`
      UPDATE users 
      SET is_banned = false, ban_reason = NULL, banned_at = NULL, banned_by = NULL 
      WHERE id = $1
    `, [userId]);

    res.json({ message: 'Пользователь разблокирован', userId });
  } catch (error) {
    console.error('Ошибка разблокировки пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получение активности системы
router.get('/activity', authenticateToken, validateUser, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'));
    const offset = parseInt(String(req.query.offset || '0'));

    const activityResult = await pool.query(`
      SELECT 
        tr.id, tr.score, tr.created_at, tr.time_spent,
        u.email, u.first_name, u.last_name,
        t.title as test_title,
        s.name as subject_name
      FROM test_results tr
      JOIN users u ON tr.user_id = u.id
      JOIN tests t ON tr.test_id = t.id
      LEFT JOIN subjects s ON t.subject_id = s.id
      ORDER BY tr.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const totalResult = await pool.query('SELECT COUNT(*) as total FROM test_results');

    res.json({
      activities: activityResult.rows,
      total: parseInt(totalResult.rows[0].total),
      hasMore: parseInt(totalResult.rows[0].total) > offset + limit
    });
  } catch (error) {
    console.error('Ошибка получения активности:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;