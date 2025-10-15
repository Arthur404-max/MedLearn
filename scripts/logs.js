#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

// Функция для чтения и парсинга логов
function readLogs(logFile, lines = 50) {
    const filePath = path.join(logsDir, logFile);
    
    if (!fs.existsSync(filePath)) {
        console.log(`Log file ${logFile} not found`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const logLines = content.split('\n').filter(line => line.trim());
    
    // Берем последние N строк
    const recentLines = logLines.slice(-lines);
    
    console.log(`\n=== ${logFile} (последние ${lines} записей) ===`);
    
    recentLines.forEach(line => {
        if (line.trim()) {
            try {
                const log = JSON.parse(line);
                const timestamp = new Date(log.timestamp).toLocaleString();
                const level = log.level.toUpperCase().padEnd(5);
                const message = log.message;
                const meta = Object.keys(log).filter(key => 
                    !['timestamp', 'level', 'message'].includes(key)
                );
                
                console.log(`${timestamp} [${level}] ${message}`);
                
                if (meta.length > 0) {
                    meta.forEach(key => {
                        console.log(`  ${key}: ${JSON.stringify(log[key])}`);
                    });
                }
                console.log('');
                
            } catch (e) {
                // Если не JSON, просто выводим как есть
                console.log(line);
            }
        }
    });
}

// Функция для отслеживания логов в реальном времени
function tailLogs(logFile) {
    const filePath = path.join(logsDir, logFile);
    
    if (!fs.existsSync(filePath)) {
        console.log(`Log file ${logFile} not found`);
        return;
    }
    
    console.log(`Отслеживание ${logFile}... (Ctrl+C для выхода)`);
    
    let lastSize = 0;
    
    const checkForUpdates = () => {
        const stats = fs.statSync(filePath);
        
        if (stats.size > lastSize) {
            const stream = fs.createReadStream(filePath, {
                start: lastSize,
                encoding: 'utf8'
            });
            
            let buffer = '';
            
            stream.on('data', (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                lines.forEach(line => {
                    if (line.trim()) {
                        try {
                            const log = JSON.parse(line);
                            const timestamp = new Date(log.timestamp).toLocaleString();
                            const level = log.level.toUpperCase();
                            console.log(`[${timestamp}] ${level}: ${log.message}`);
                        } catch (e) {
                            console.log(line);
                        }
                    }
                });
            });
            
            lastSize = stats.size;
        }
    };
    
    // Проверяем каждую секунду
    setInterval(checkForUpdates, 1000);
}

// Анализ производительности
function analyzePerformance(hours = 1) {
    const filePath = path.join(logsDir, 'combined.log');
    
    if (!fs.existsSync(filePath)) {
        console.log('Log file not found');
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const logLines = content.split('\n').filter(line => line.trim());
    
    const now = new Date();
    const cutoff = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    const stats = {
        totalRequests: 0,
        slowRequests: 0,
        errors: 0,
        authEvents: 0,
        averageResponseTime: 0,
        endpointStats: {},
        errorStats: {}
    };
    
    let totalDuration = 0;
    
    logLines.forEach(line => {
        try {
            const log = JSON.parse(line);
            const logTime = new Date(log.timestamp);
            
            if (logTime < cutoff) return;
            
            if (log.type === 'api_request') {
                stats.totalRequests++;
                totalDuration += log.duration;
                
                if (log.duration > 2000) {
                    stats.slowRequests++;
                }
                
                if (log.status >= 400) {
                    stats.errors++;
                    stats.errorStats[log.status] = (stats.errorStats[log.status] || 0) + 1;
                }
                
                // Статистика по эндпоинтам
                const endpoint = log.url.split('?')[0];
                if (!stats.endpointStats[endpoint]) {
                    stats.endpointStats[endpoint] = {
                        count: 0,
                        totalDuration: 0,
                        errors: 0
                    };
                }
                
                stats.endpointStats[endpoint].count++;
                stats.endpointStats[endpoint].totalDuration += log.duration;
                
                if (log.status >= 400) {
                    stats.endpointStats[endpoint].errors++;
                }
            }
            
            if (log.type === 'authentication') {
                stats.authEvents++;
            }
            
        } catch (e) {
            // Игнорируем неправильно отформатированные строки
        }
    });
    
    if (stats.totalRequests > 0) {
        stats.averageResponseTime = totalDuration / stats.totalRequests;
    }
    
    console.log(`\n=== Анализ производительности за последние ${hours} часов ===`);
    console.log(`Всего запросов: ${stats.totalRequests}`);
    console.log(`Медленных запросов (>2s): ${stats.slowRequests} (${((stats.slowRequests/stats.totalRequests)*100).toFixed(1)}%)`);
    console.log(`Ошибок: ${stats.errors} (${((stats.errors/stats.totalRequests)*100).toFixed(1)}%)`);
    console.log(`Среднее время ответа: ${stats.averageResponseTime.toFixed(0)}ms`);
    console.log(`События аутентификации: ${stats.authEvents}`);
    
    console.log('\n=== Топ эндпоинтов по количеству запросов ===');
    const topEndpoints = Object.entries(stats.endpointStats)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 10);
    
    topEndpoints.forEach(([endpoint, data]) => {
        const avgTime = data.totalDuration / data.count;
        console.log(`${endpoint}: ${data.count} запросов, ${avgTime.toFixed(0)}ms среднее, ${data.errors} ошибок`);
    });
    
    if (Object.keys(stats.errorStats).length > 0) {
        console.log('\n=== Статистика ошибок ===');
        Object.entries(stats.errorStats).forEach(([status, count]) => {
            console.log(`HTTP ${status}: ${count} раз`);
        });
    }
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'tail':
        const logFile = args[1] || 'combined.log';
        tailLogs(logFile);
        break;
        
    case 'show':
        const showFile = args[1] || 'combined.log';
        const lines = parseInt(args[2]) || 50;
        readLogs(showFile, lines);
        break;
        
    case 'errors':
        readLogs('error.log', parseInt(args[1]) || 50);
        break;
        
    case 'performance':
        readLogs('performance.log', parseInt(args[1]) || 50);
        break;
        
    case 'analyze':
        const hours = parseInt(args[1]) || 1;
        analyzePerformance(hours);
        break;
        
    default:
        console.log(`
Использование:
  node scripts/logs.js show [файл] [количество_строк]  - Показать последние логи
  node scripts/logs.js tail [файл]                     - Отслеживать логи в реальном времени
  node scripts/logs.js errors [количество_строк]       - Показать ошибки
  node scripts/logs.js performance [количество_строк]  - Показать логи производительности
  node scripts/logs.js analyze [часы]                  - Анализ производительности

Примеры:
  node scripts/logs.js show combined.log 100
  node scripts/logs.js tail error.log
  node scripts/logs.js errors 20
  node scripts/logs.js analyze 24
        `);
}