import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

// Оптимальная конфигурация пула для высокой нагрузки
const poolConfig: PoolConfig = {
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
  
  // Настройки пула соединений
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Максимум соединений
  min: parseInt(process.env.DB_POOL_MIN || '5'),  // Минимум соединений
  
  // Таймауты
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  
  // Настройки для стабильности
  allowExitOnIdle: false,
  
  // Логирование подключений
  log: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Database pool event', { message, type: 'database_pool' });
    }
  }
};

export const pool = new Pool(poolConfig);

// Мониторинг пула соединений
pool.on('connect', (client) => {
  logger.info('New database connection established', { 
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    type: 'database_connection'
  });
});

pool.on('error', (err, client) => {
  logger.error('Database pool error', {
    error: err.message,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    type: 'database_pool_error'
  });
});

pool.on('remove', (client) => {
  logger.info('Database connection removed', { 
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    type: 'database_disconnection'
  });
});

// Функция для получения статистики пула
export const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    config: {
      max: poolConfig.max,
      min: poolConfig.min,
      connectionTimeout: poolConfig.connectionTimeoutMillis,
      idleTimeout: poolConfig.idleTimeoutMillis
    }
  };
};

// Проверка структуры таблиц
const checkTables = async () => {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    if (!result.rows[0].exists) {
      console.error('Tables are not initialized. Please run the SQL setup script.');
    }
  } catch (err) {
    console.error('Database check failed:', err);
  }
};

checkTables();
