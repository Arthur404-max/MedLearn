import express from 'express';
import { pool } from '../src/config/db';
import { authenticateToken } from '../middleware/auth';
import { validateUser } from '../middleware/validateUser';

const router = express.Router();

const RESOURCE_TYPE_MAP: Record<string, string> = {
    article: 'articles',
    articles: 'articles',
    video: 'videos',
    videos: 'videos',
    book: 'books',
    books: 'books',
    reference: 'tools',
    tool: 'tools',
    tools: 'tools'
};

let hasIsPublishedColumn: boolean | null = null;

const ensureIsPublishedColumn = async (): Promise<boolean> => {
    if (hasIsPublishedColumn !== null) {
        return hasIsPublishedColumn;
    }

    const result = await pool.query(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'resources'
              AND column_name = 'is_published'
        ) AS column_exists`
    );

    hasIsPublishedColumn = Boolean(result.rows[0]?.column_exists);
    return hasIsPublishedColumn;
};

const normalizeResourceType = (type?: string | null) => {
    if (!type) {
        return 'articles';
    }
    const normalized = type.toLowerCase();
    return RESOURCE_TYPE_MAP[normalized] || normalized;
};

const mapResourceForClient = (resource: any) => {
    const type = normalizeResourceType(resource.type || resource.resource_type);
    const date = resource.date || resource.created_at || new Date();

    return {
        ...resource,
        type,
        date,
        image: resource.image || resource.thumbnail_url || '',
        author: resource.author || 'MedLearn Team',
        url: resource.url || resource.link || '#'
    };
};

// Получение всех ресурсов
router.get('/', async (req, res) => {
    try {
        console.log('📚 Запрос всех ресурсов...');
        const hasColumn = await ensureIsPublishedColumn();
        const queryText = hasColumn
            ? `SELECT * FROM resources WHERE COALESCE(is_published, true) = true ORDER BY created_at DESC`
            : `SELECT * FROM resources ORDER BY created_at DESC`;

        const result = await pool.query(queryText);
        const normalized = result.rows.map(mapResourceForClient);

        console.log('✅ Найдено ресурсов:', normalized.length);
        res.json(normalized);
    } catch (error) {
        console.error('Error fetching resources:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение ресурсов по типу
router.get('/type/:resourceType', authenticateToken, validateUser, async (req, res) => {
    try {
        const { resourceType } = req.params;
        const result = await pool.query(
            'SELECT * FROM resources WHERE resource_type = $1 ORDER BY created_at DESC',
            [resourceType]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching resources by type:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Поиск ресурсов
router.get('/search', authenticateToken, validateUser, async (req, res) => {
    try {
        const { query } = req.query;
        const result = await pool.query(
            `SELECT * FROM resources 
             WHERE title ILIKE $1 OR description ILIKE $1
             ORDER BY created_at DESC`,
            [`%${query}%`]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching resources:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Добавление ресурса в избранное
router.post('/favorite/:id', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await pool.query(
            'INSERT INTO user_favorites (user_id, resource_id) VALUES ($1, $2)',
            [userId, id]
        );
        res.json({ message: 'Resource added to favorites' });
    } catch (error) {
        console.error('Error adding resource to favorites:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Удаление ресурса из избранного
router.delete('/favorite/:id', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await pool.query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND resource_id = $2',
            [userId, id]
        );
        res.json({ message: 'Resource removed from favorites' });
    } catch (error) {
        console.error('Error removing resource from favorites:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение избранных ресурсов пользователя
router.get('/favorites', authenticateToken, validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT r.*, true as is_favorite
             FROM resources r
             JOIN user_favorites uf ON r.id = uf.resource_id
             WHERE uf.user_id = $1
             ORDER BY r.created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching favorite resources:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Увеличение счетчика просмотров
router.post('/view/:id', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            'UPDATE resources SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1',
            [id]
        );
        res.json({ message: 'View count updated' });
    } catch (error) {
        console.error('Error updating view count:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение ресурсов по предмету
router.get('/subject/:subjectId', authenticateToken, validateUser, async (req, res) => {
    try {
        const { subjectId } = req.params;
        const result = await pool.query(
            'SELECT * FROM resources WHERE subject_id = $1 ORDER BY created_at DESC',
            [subjectId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching resources by subject:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Получение статистики ресурсов
router.get('/stats', authenticateToken, validateUser, async (req, res) => {
    try {
        const totalResult = await pool.query('SELECT COUNT(*) as total FROM resources');
        const typeStats = await pool.query(`
            SELECT resource_type, COUNT(*) as count 
            FROM resources 
            GROUP BY resource_type 
            ORDER BY count DESC
        `);
        const popularResult = await pool.query(`
            SELECT * FROM resources 
            ORDER BY views_count DESC NULLS LAST 
            LIMIT 5
        `);
        
        res.json({
            total: parseInt(totalResult.rows[0].total),
            byType: typeStats.rows,
            popular: popularResult.rows
        });
    } catch (error) {
        console.error('Error fetching resource stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Проверка, добавлен ли ресурс в избранное
router.get('/favorite/check/:id', authenticateToken, validateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await pool.query(
            'SELECT 1 FROM user_favorites WHERE user_id = $1 AND resource_id = $2',
            [userId, id]
        );
        
        res.json({ isFavorite: result.rows.length > 0 });
    } catch (error) {
        console.error('Error checking favorite status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;