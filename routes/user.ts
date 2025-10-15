import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Получение профиля пользователя
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, university, course, is_verified, email_notifications, study_reminders, created_at, role, is_premium FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Обновление профиля пользователя
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, university, course } = req.body;

    await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2, university = $3, course = $4, updated_at = NOW() WHERE id = $5',
      [firstName, lastName, university, course, userId]
    );

    res.json({ message: 'Профиль успешно обновлен' });
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получение статистики пользователя
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Статистика тестов
    const testsResult = await pool.query(
      'SELECT COUNT(*) as tests_taken, AVG(score) as average_score, MAX(score) as best_score FROM test_results WHERE user_id = $1',
      [userId]
    );

    // Количество дней обучения
    const studyDaysResult = await pool.query(
      'SELECT COUNT(DISTINCT DATE(created_at)) as study_days FROM test_results WHERE user_id = $1',
      [userId]
    );

    // Статистика по предметам
    const subjectsResult = await pool.query(
      `SELECT s.name as subject_name, COUNT(*) as tests_count, AVG(tr.score) as avg_score
       FROM test_results tr 
       JOIN tests t ON tr.test_id = t.id 
       JOIN subjects s ON t.subject_id = s.id 
       WHERE tr.user_id = $1 
       GROUP BY s.id, s.name 
       ORDER BY avg_score DESC`,
      [userId]
    );

    // Последняя активность
    const lastActivityResult = await pool.query(
      'SELECT MAX(created_at) as last_activity FROM test_results WHERE user_id = $1',
      [userId]
    );

    // Статистика по времени (последние 7 дней)
    const weeklyResult = await pool.query(
      `SELECT DATE(created_at) as test_date, COUNT(*) as tests_count, AVG(score) as avg_score
       FROM test_results 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY test_date`,
      [userId]
    );

    // Стрик (дни подряд с активностью)
    const streakResult = await pool.query(
      `WITH daily_activity AS (
         SELECT DATE(created_at) as activity_date
         FROM test_results 
         WHERE user_id = $1
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) DESC
       ), 
       streak_calc AS (
         SELECT activity_date,
                activity_date - ROW_NUMBER() OVER (ORDER BY activity_date DESC) * INTERVAL '1 day' as streak_group
         FROM daily_activity
       )
       SELECT COUNT(*) as current_streak
       FROM streak_calc
       WHERE streak_group = (SELECT MIN(streak_group) FROM streak_calc)`,
      [userId]
    );

    const testsCount = parseInt(testsResult.rows[0].tests_taken) || 0;
    const averageScore = parseFloat(testsResult.rows[0].average_score) || 0;
    const bestScore = parseFloat(testsResult.rows[0].best_score) || 0;
    const studyDays = parseInt(studyDaysResult.rows[0].study_days) || 0;
    const currentStreak = parseInt(streakResult.rows[0]?.current_streak) || 0;

    // Расширенная система достижений
    const achievements = [];
    
    // Достижения за количество тестов
    if (testsCount >= 1) achievements.push({ icon: '🎯', name: 'Первый тест', description: 'Прошел первый тест', category: 'tests' });
    if (testsCount >= 5) achievements.push({ icon: '📚', name: 'Ученик', description: 'Прошел 5 тестов', category: 'tests' });
    if (testsCount >= 10) achievements.push({ icon: '🔥', name: 'Активист', description: 'Прошел 10 тестов', category: 'tests' });
    if (testsCount >= 25) achievements.push({ icon: '⭐', name: 'Звезда', description: 'Прошел 25 тестов', category: 'tests' });
    if (testsCount >= 50) achievements.push({ icon: '💎', name: 'Эксперт', description: 'Прошел 50 тестов', category: 'tests' });
    if (testsCount >= 100) achievements.push({ icon: '👑', name: 'Мастер', description: 'Прошел 100 тестов', category: 'tests' });

    // Достижения за качество
    if (averageScore >= 60) achievements.push({ icon: '✅', name: 'Базовый уровень', description: 'Средний балл 60%+', category: 'quality' });
    if (averageScore >= 70) achievements.push({ icon: '📈', name: 'Хорошист', description: 'Средний балл 70%+', category: 'quality' });
    if (averageScore >= 80) achievements.push({ icon: '🏆', name: 'Отличник', description: 'Средний балл 80%+', category: 'quality' });
    if (averageScore >= 90) achievements.push({ icon: '🎓', name: 'Профессионал', description: 'Средний балл 90%+', category: 'quality' });
    if (bestScore === 100) achievements.push({ icon: '💯', name: 'Перфекционист', description: 'Идеальный результат', category: 'quality' });

    // Достижения за постоянство
    if (studyDays >= 3) achievements.push({ icon: '📅', name: 'Постоянство', description: 'Учился 3 дня', category: 'consistency' });
    if (studyDays >= 7) achievements.push({ icon: '🗓️', name: 'Неделька', description: 'Учился 7 дней', category: 'consistency' });
    if (studyDays >= 30) achievements.push({ icon: '📆', name: 'Месяц учебы', description: 'Учился 30 дней', category: 'consistency' });
    if (currentStreak >= 3) achievements.push({ icon: '🔥', name: 'Стрик 3', description: '3 дня подряд', category: 'consistency' });
    if (currentStreak >= 7) achievements.push({ icon: '💪', name: 'Стрик 7', description: '7 дней подряд', category: 'consistency' });
    if (currentStreak >= 30) achievements.push({ icon: '🚀', name: 'Стрик 30', description: '30 дней подряд', category: 'consistency' });

    const stats = {
      tests_taken: testsCount,
      average_score: averageScore,
      best_score: bestScore,
      study_days: studyDays,
      current_streak: currentStreak,
      achievements: achievements,
      subjects_stats: subjectsResult.rows,
      weekly_activity: weeklyResult.rows,
      last_activity: lastActivityResult.rows[0]?.last_activity,
      total_achievements: achievements.length
    };

    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Смена пароля
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Получаем текущий хеш пароля
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Проверяем текущий пароль
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Неверный текущий пароль' });
    }

    // Хешируем новый пароль и сохраняем
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedNewPassword, userId]
    );

    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    console.error('Ошибка смены пароля:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Обновление настроек пользователя
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { emailNotifications, studyReminders } = req.body;

    await pool.query(
      'UPDATE users SET email_notifications = $1, study_reminders = $2, updated_at = NOW() WHERE id = $3',
      [emailNotifications, studyReminders, userId]
    );

    res.json({ message: 'Настройки сохранены' });
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получение истории активности пользователя
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(String(req.query.limit || '10'));
    const offset = parseInt(String(req.query.offset || '0'));

    const activityResult = await pool.query(
      `SELECT 
         tr.id,
         tr.score,
         tr.created_at,
         t.title as test_title,
         s.name as subject_name,
         s.icon as subject_icon,
         tr.time_spent
       FROM test_results tr
       JOIN tests t ON tr.test_id = t.id
       JOIN subjects s ON t.subject_id = s.id
       WHERE tr.user_id = $1
       ORDER BY tr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM test_results WHERE user_id = $1',
      [userId]
    );

    res.json({
      activities: activityResult.rows,
      total: parseInt(totalResult.rows[0].total),
      hasMore: parseInt(totalResult.rows[0].total) > offset + limit
    });
  } catch (error) {
    console.error('Ошибка получения истории активности:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получение прогресса по предметам
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const progressResult = await pool.query(
      `SELECT 
         s.id as subject_id,
         s.name as subject_name,
         s.icon as subject_icon,
         COUNT(tr.id) as tests_completed,
         AVG(tr.score) as average_score,
         MAX(tr.score) as best_score,
         MAX(tr.created_at) as last_test_date,
         COUNT(DISTINCT DATE(tr.created_at)) as active_days
       FROM subjects s
       LEFT JOIN tests t ON s.id = t.subject_id
       LEFT JOIN test_results tr ON t.id = tr.test_id AND tr.user_id = $1
       GROUP BY s.id, s.name, s.icon
       ORDER BY tests_completed DESC, average_score DESC`,
      [userId]
    );

    const progress = progressResult.rows.map(row => ({
      ...row,
      tests_completed: parseInt(row.tests_completed) || 0,
      average_score: parseFloat(row.average_score) || 0,
      best_score: parseFloat(row.best_score) || 0,
      active_days: parseInt(row.active_days) || 0,
      progress_level: getProgressLevel(parseInt(row.tests_completed) || 0, parseFloat(row.average_score) || 0)
    }));

    res.json(progress);
  } catch (error) {
    console.error('Ошибка получения прогресса:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Функция определения уровня прогресса
function getProgressLevel(testsCount: number, avgScore: number): string {
  if (testsCount === 0) return 'Не начат';
  if (testsCount < 3) return 'Новичок';
  if (testsCount < 10 || avgScore < 60) return 'Изучающий';
  if (testsCount < 20 || avgScore < 75) return 'Практикующий';
  if (testsCount < 50 || avgScore < 85) return 'Продвинутый';
  return 'Мастер';
}

// Удаление аккаунта
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // В реальном приложении здесь бы была более сложная логика
    // например, анонимизация данных вместо полного удаления
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: 'Аккаунт удален' });
  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;