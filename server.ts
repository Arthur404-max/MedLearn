import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
// Database: PostgreSQL in Podman container
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import testRoutes from './routes/tests';
import resourceRoutes from './routes/resources';
import subscriptionRoutes from './routes/subscriptions';
import statsRoutes from './routes/stats';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import { pool } from './src/config/db';
import { initializeDatabase, seedDatabase } from './src/database/init-db';
import { logger } from './src/config/logger';
import { 
    performanceMiddleware, 
    errorTrackingMiddleware,
    apiRateLimiter,
    authRateLimiter 
} from './middleware/monitoring';
import { CacheManager } from './src/config/cache';
import { apm, apmMiddleware } from './src/monitoring/apm';

dotenv.config();

const app = express();

// Безопасность
app.use(helmet());

// Логирование HTTP запросов
app.use(morgan('combined', {
    stream: {
        write: (message: string) => {
            logger.info(message.trim(), { type: 'http_access' });
        }
    }
}));

// Мониторинг производительности
app.use(performanceMiddleware);

// APM мониторинг
app.use(apmMiddleware);

// Ограничение частоты запросов
app.use('/api/', apiRateLimiter);
app.use('/api/auth/', authRateLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Глобальный экземпляр кэш-менеджера
let cacheManager: CacheManager | null = null;

// Инициализация базы данных и кэша
async function setupDatabase() {
  try {
    console.log('🔄 Подключение к PostgreSQL...');
    const client = await pool.connect();
    client.release();
    console.log('✅ Подключение к PostgreSQL установлено');
    
    // Инициализируем Redis кэш (опционально)
    try {
      console.log('🔄 Попытка подключения к Redis...');
      const { redis } = await import('./src/config/cache');
      cacheManager = new CacheManager(redis, 3600); // TTL по умолчанию 1 час
      
      // Проверяем подключение
      await cacheManager.set('startup:test', 'ok', 10);
      console.log('✅ Redis кэш инициализирован и подключен');
    } catch (error: any) {
      console.log('⚠️ Redis недоступен, продолжаем без кэша:', error.message);
      cacheManager = null;
    }
    
    // Инициализируем структуру базы данных
    const initSuccess = await initializeDatabase();
    if (initSuccess) {
      // Заполняем тестовыми данными если нужно
      await seedDatabase();
    }
  } catch (err) {
    console.error('❌ Ошибка подключения к базе данных:', err);
    process.exit(1);
  }
}

// Запускаем инициализацию базы данных
setupDatabase();

// Тестовый роут для проверки JWT
app.get('/api/test-auth', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('🧪 Test auth route called');
  console.log('📨 Auth header:', authHeader);
  console.log('🎟️ Token:', token);
  
  if (!token) {
    return res.json({ status: 'No token provided' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    console.log('✅ Token decoded successfully:', decoded);
    res.json({ status: 'Valid token', decoded });
  } catch (error: any) {
    console.log('❌ Token verification failed:', error);
    res.json({ status: 'Invalid token', error: error?.message || 'Unknown error' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Перенаправление старых админ-страниц на информационную страницу
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-redirect.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-redirect.html'));
});

app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-redirect.html'));
});

app.get('/admin-simple.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-redirect.html'));
});

// Тестовый маршрут для проверки кэша
app.get('/api/cache-test', async (req, res) => {
  try {
    if (!cacheManager) {
      return res.status(503).json({ error: 'Cache not initialized' });
    }

    const testKey = 'test:cache:demo';
    const testValue = { 
      message: 'Hello from cache!', 
      timestamp: new Date().toISOString(),
      random: Math.random()
    };

    // Пробуем получить из кэша
    let cached = await cacheManager.get(testKey);
    
    if (cached) {
      res.json({ 
        source: 'cache',
        data: cached,
        hit: true
      });
    } else {
      // Сохраняем в кэш на 60 секунд
      await cacheManager.set(testKey, testValue, 60);
      res.json({ 
        source: 'fresh',
        data: testValue,
        hit: false
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint для мониторинга
app.get('/api/health', async (req, res) => {
  try {
    // Проверяем подключение к базе данных
    await pool.query('SELECT 1');
    
    // Проверяем Redis если доступен
    let redisStatus = 'not_configured';
    if (cacheManager) {
      try {
        await cacheManager.set('health:check', 'ok', 10);
        await cacheManager.get('health:check');
        redisStatus = 'connected';
      } catch {
        redisStatus = 'error';
      }
    }
    
    res.json({
      status: 'ok',
      database: 'connected',
      redis: redisStatus,
      cluster: {
        pid: process.pid,
        instanceId: process.env.INSTANCE_ID || 'single',
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    logger.error('Health check failed', { error, type: 'health_check' });
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// Эндпоинт для метрик (для мониторинга)
app.get('/api/metrics', async (req, res) => {
  try {
    const { getPoolStats } = await import('./src/config/db');
    const poolStats = getPoolStats();
    
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      database: {
        pool: poolStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Обработчик ошибок (должен быть последним)
app.use(errorTrackingMiddleware);

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    type: 'server_startup'
  });
  
  console.log(`Server is running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.2.29:${PORT}`);
  console.log(`Mobile access: Open http://192.168.2.29:${PORT} on your phone`);
  
  // Запуск APM Dashboard на отдельном порту
  setTimeout(() => {
    apm.start(3001);
  }, 1000);
});
