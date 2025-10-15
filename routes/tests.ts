import express from 'express';
import { pool } from '../src/config/db';
import { authenticateToken } from '../middleware/auth';
import { validateUser } from '../middleware/validateUser';
import { 
    cacheList, 
    cacheDetails,
    cacheUserData, 
    invalidateTestsCache 
} from '../middleware/cache';

const router = express.Router();

// Получение всех категорий для предмета (общедоступно)
router.get('/categories/:id', cacheList, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM categories WHERE subject_id = $1 ORDER BY name',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение всех предметов (общедоступно)
router.get('/subjects', cacheList, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subjects ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение подкатегорий (общедоступно)
router.get('/subcategories/:id', cacheList, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение тестов по предмету (для админских тестов, общедоступно)
router.get('/subject/:subjectId', async (req, res) => {
    try {
        const { subjectId } = req.params; 
        console.log('🔍 Ищем тесты для предмета ID:', subjectId);
        
        const result = await pool.query(
            'SELECT * FROM tests WHERE subject_id = $1 AND is_published = true ORDER BY created_at DESC',
            [subjectId]
        );
        
        console.log('📊 Найдено тестов:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tests by subject:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Начало теста по ID (для админских тестов)
router.get('/start-by-id/:testId', authenticateToken, validateUser, async (req, res) => {
    try {
        const { testId } = req.params;
        // Получаем тест из базы данных по ID
        const test = await pool.query(
            'SELECT * FROM tests WHERE id = $1',
            [testId]
        );

        if (test.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found' });
        }

        // Получаем вопросы для теста
        const questions = await pool.query(
            'SELECT * FROM questions WHERE test_id = $1',
            [test.rows[0].id]
        );

        // Получаем варианты ответов для каждого вопроса
        const questionsWithOptions = await Promise.all(
            questions.rows.map(async (question) => {
                const options = await pool.query(
                    'SELECT * FROM answers WHERE question_id = $1',
                    [question.id]
                );
                return {
                    ...question,
                    options: options.rows.map(opt => opt.answer_text)
                };
            })
        );

        res.json({
            id: test.rows[0].id,
            title: test.rows[0].title,
            questions: questionsWithOptions
        });
    } catch (error) {
        console.error('Error starting test by ID:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Начало теста по предмету (для админских тестов)
router.get('/start-by-subject/:subjectId', authenticateToken, validateUser, async (req, res) => {
    try {
        const { subjectId } = req.params;
        // Получаем тест из базы данных по subject_id
        const test = await pool.query(
            'SELECT * FROM tests WHERE subject_id = $1 ORDER BY RANDOM() LIMIT 1',
            [subjectId]
        );

        if (test.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found' });
        }

        // Получаем вопросы для теста
        const questions = await pool.query(
            'SELECT * FROM questions WHERE test_id = $1',
            [test.rows[0].id]
        );

        // Получаем варианты ответов для каждого вопроса
        const questionsWithOptions = await Promise.all(
            questions.rows.map(async (question) => {
                const options = await pool.query(
                    'SELECT * FROM answers WHERE question_id = $1',
                    [question.id]
                );
                return {
                    ...question,
                    options: options.rows.map(opt => opt.answer_text)
                };
            })
        );

        res.json({
            id: test.rows[0].id,
            title: test.rows[0].title,
            questions: questionsWithOptions
        });
    } catch (error) {
        console.error('Error starting test by subject:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Начало теста
router.get('/start/:subcategoryId', authenticateToken, validateUser, async (req, res) => {
    try {
        const { subcategoryId } = req.params;
        // Получаем тест из базы данных
        const test = await pool.query(
            'SELECT * FROM tests WHERE subcategory_id = $1 ORDER BY RANDOM() LIMIT 1',
            [subcategoryId]
        );

        if (test.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found' });
        }

        // Получаем вопросы для теста
        const questions = await pool.query(
            'SELECT * FROM questions WHERE test_id = $1',
            [test.rows[0].id]
        );

        // Получаем варианты ответов для каждого вопроса
        const questionsWithOptions = await Promise.all(
            questions.rows.map(async (question) => {
                const options = await pool.query(
                    'SELECT * FROM answers WHERE question_id = $1',
                    [question.id]
                );
                return {
                    ...question,
                    options: options.rows.map(opt => opt.answer_text)
                };
            })
        );

        res.json({
            id: test.rows[0].id,
            title: test.rows[0].title,
            questions: questionsWithOptions
        });
    } catch (error) {
        console.error('Error starting test:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Завершение теста
router.post('/finish', authenticateToken, validateUser, async (req, res) => {
    try {
        const { testId, answers } = req.body;
        const userId = req.user.id;

        // Получаем правильные ответы
        const correctAnswersQuery = await pool.query(
            'SELECT q.id, a.is_correct, a.answer_text FROM questions q ' +
            'JOIN answers a ON q.id = a.question_id ' +
            'WHERE q.test_id = $1 AND a.is_correct = true',
            [testId]
        );

        // Проверяем ответы
        const results = answers.map((answer: number, index: number) => {
            // Для простоты считаем, что правильный ответ - это индекс 0 (первый вариант)
            // В реальном приложении нужно сравнивать с правильными ответами из БД
            const isCorrect = answer === 0; // Временная логика
            return {
                correct: isCorrect,
                correctIndex: 0
            };
        });

        // Подсчитываем результаты
        const correctAnswers = results.filter((r: { correct: boolean }) => r.correct).length;
        const percentage = (correctAnswers / answers.length) * 100;

        // Сохраняем результаты в базу данных
        await pool.query(
            'INSERT INTO test_attempts (user_id, test_id, score, total_questions, correct_answers, percentage) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, testId, correctAnswers, answers.length, correctAnswers, percentage]
        );

        res.json({
            correctAnswers,
            percentage,
            answers: results
        });
    } catch (error) {
        console.error('Error finishing test:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Создание нового теста (админ-функция)
router.post('/create', authenticateToken, validateUser, invalidateTestsCache, async (req, res) => {
    try {
        const { subcategory_id, title, description, time_limit, questions } = req.body;
        
        // Валидация входных данных
        if (!subcategory_id || !title || !questions || questions.length === 0) {
            return res.status(400).json({ message: 'Заполните все обязательные поля' });
        }
        
        // Проверяем, что подкатегория существует
        const subcategoryCheck = await pool.query('SELECT id FROM subcategories WHERE id = $1', [subcategory_id]);
        if (subcategoryCheck.rows.length === 0) {
            return res.status(400).json({ message: 'Подкатегория не найдена' });
        }
        
        // Создаем тест
        const testResult = await pool.query(
            'INSERT INTO tests (subcategory_id, title, description, time_limit, difficulty_level, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [subcategory_id, title, description || '', time_limit || 15, 'medium', true]
        );
        
        const testId = testResult.rows[0].id;
        
        // Добавляем вопросы и ответы
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            if (!question.text || !question.answers || question.answers.length < 2) {
                await pool.query('DELETE FROM tests WHERE id = $1', [testId]);
                return res.status(400).json({ 
                    message: `Вопрос ${i + 1}: добавьте текст вопроса и минимум 2 варианта ответа` 
                });
            }
            
            // Проверяем, что есть хотя бы один правильный ответ
            const hasCorrectAnswer = question.answers.some((answer: any) => answer.is_correct);
            if (!hasCorrectAnswer) {
                await pool.query('DELETE FROM tests WHERE id = $1', [testId]);
                return res.status(400).json({ 
                    message: `Вопрос ${i + 1}: отметьте хотя бы один правильный ответ` 
                });
            }
            
            // Создаем вопрос
            const questionResult = await pool.query(
                'INSERT INTO questions (test_id, question_text, question_type, points, explanation) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [testId, question.text, 'multiple_choice', question.points || 1, question.explanation || '']
            );
            
            const questionId = questionResult.rows[0].id;
            
            // Добавляем варианты ответов
            for (const answer of question.answers) {
                if (answer.text && answer.text.trim()) {
                    await pool.query(
                        'INSERT INTO answers (question_id, answer_text, is_correct) VALUES ($1, $2, $3)',
                        [questionId, answer.text.trim(), answer.is_correct || false]
                    );
                }
            }
        }
        
        res.json({ 
            message: 'Тест успешно создан', 
            testId,
            questionsCount: questions.length
        });
    } catch (error) {
        console.error('Error creating test:', error);
        res.status(500).json({ message: 'Ошибка при создании теста' });
    }
});

// Получение всех тестов с подробной информацией (админ-функция)
router.get('/all', authenticateToken, validateUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.id,
                t.title,
                t.description,
                t.time_limit,
                t.difficulty_level,
                t.is_active,
                t.created_at,
                s.name as subject_name,
                c.name as category_name,
                sc.name as subcategory_name,
                (SELECT COUNT(*) FROM questions WHERE test_id = t.id) as questions_count,
                (SELECT COUNT(*) FROM test_attempts WHERE test_id = t.id) as attempts_count
            FROM tests t
            JOIN subcategories sc ON t.subcategory_id = sc.id
            JOIN categories c ON sc.category_id = c.id
            JOIN subjects s ON c.subject_id = s.id
            ORDER BY t.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all tests:', error);
        res.status(500).json({ message: 'Ошибка при загрузке тестов' });
    }
});

// Удаление теста (админ-функция)
router.delete('/:id', authenticateToken, validateUser, invalidateTestsCache, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем, что тест существует
        const testCheck = await pool.query('SELECT id FROM tests WHERE id = $1', [id]);
        if (testCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Тест не найден' });
        }
        
        // Удаляем в правильном порядке (из-за foreign key constraints)
        await pool.query('DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE test_id = $1)', [id]);
        await pool.query('DELETE FROM questions WHERE test_id = $1', [id]);
        await pool.query('DELETE FROM test_attempts WHERE test_id = $1', [id]);
        await pool.query('DELETE FROM tests WHERE id = $1', [id]);
        
        res.json({ message: 'Тест успешно удален' });
    } catch (error) {
        console.error('Error deleting test:', error);
        res.status(500).json({ message: 'Ошибка при удалении теста' });
    }
});

// Получение детальной информации о тесте (админ-функция)
router.get('/details/:id', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Получаем информацию о тесте
        const testResult = await pool.query(`
            SELECT 
                t.*,
                s.name as subject_name,
                c.name as category_name,
                sc.name as subcategory_name
            FROM tests t
            JOIN subcategories sc ON t.subcategory_id = sc.id
            JOIN categories c ON sc.category_id = c.id
            JOIN subjects s ON c.subject_id = s.id
            WHERE t.id = $1
        `, [id]);
        
        if (testResult.rows.length === 0) {
            return res.status(404).json({ message: 'Тест не найден' });
        }
        
        const test = testResult.rows[0];
        
        // Получаем вопросы с ответами
        const questionsResult = await pool.query(`
            SELECT 
                q.*,
                json_agg(
                    json_build_object(
                        'id', a.id,
                        'text', a.answer_text,
                        'is_correct', a.is_correct
                    ) ORDER BY a.id
                ) as answers
            FROM questions q
            LEFT JOIN answers a ON q.id = a.question_id
            WHERE q.test_id = $1
            GROUP BY q.id
            ORDER BY q.id
        `, [id]);
        
        test.questions = questionsResult.rows;
        
        res.json(test);
    } catch (error) {
        console.error('Error fetching test details:', error);
        res.status(500).json({ message: 'Ошибка при загрузке деталей теста' });
    }
});

export default router;