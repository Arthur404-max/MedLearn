const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.ADMIN_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Основные маршруты
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// API маршруты для работы с основным сервером
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    
    // Простая проверка пароля
    if (password === 'admin2024') {
        res.json({ 
            success: true, 
            token: 'admin-access-granted',
            message: 'Успешный вход в админ-панель'
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Неверный пароль администратора' 
        });
    }
});

// Прокси для API запросов к основному серверу
app.use('/api/proxy', async (req, res) => {
    try {
        const baseURL = process.env.MAIN_SERVER_URL || 'http://localhost:3000';
        
        // Для админ-панели создаем временный токен или используем специальный ключ
        const adminToken = 'admin-panel-access-key';
        const targetUrl = `${baseURL}${req.originalUrl.replace('/api/proxy', '/api')}`;
        
        console.log(`Admin Panel Proxy: ${req.method} ${targetUrl}`);
        console.log('Request body:', req.body);
        
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization || `Bearer ${adminToken}`,
                'X-Admin-Panel': 'true'
            }
        });
        
        console.log('Response status:', response.status);
        res.json(response.data);
    } catch (error) {
        console.error('Proxy error details:');
        console.error('Status:', error.response?.status);
        console.error('Data:', error.response?.data);
        console.error('Message:', error.message);
        
        res.status(error.response?.status || 500).json({
            error: 'Ошибка соединения с основным сервером',
            details: error.response?.data?.message || error.message,
            status: error.response?.status,
            fullError: error.response?.data
        });
    }
});

// Специальный эндпоинт для проверки соединения без авторизации
app.get('/api/health', async (req, res) => {
    try {
        const baseURL = process.env.MAIN_SERVER_URL || 'http://localhost:3000';
        console.log('Trying to connect to:', `${baseURL}/api/health`);
        
        const response = await axios.get(`${baseURL}/api/health`);
        console.log('Health check successful:', response.data);
        
        res.json({ 
            status: 'connected', 
            mainServer: 'available',
            database: 'connected'
        });
    } catch (error) {
        console.error('Health check failed:', error.message);
        console.error('Error details:', error.code);
        
        res.status(503).json({ 
            status: 'disconnected', 
            mainServer: 'unavailable',
            database: 'unknown',
            error: error.message,
            code: error.code
        });
    }
});

app.listen(PORT, () => {
    console.log(`🛠️  Админ-панель MedLearn запущена на порту ${PORT}`);
    console.log(`📱 Локальный доступ: http://localhost:${PORT}`);
    console.log(`🌐 Сетевой доступ: http://192.168.2.29:${PORT}`);
    console.log(`🔐 Пароль: admin2024`);
});