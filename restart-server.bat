@echo off
chcp 65001 >nul
echo ========================================
echo 🔄 Перезапуск сервера MedLearn
echo ========================================
echo.

echo [1/3] Остановка текущих процессов...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Процессы остановлены

echo [2/3] Очистка портов...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
echo ✅ Порты очищены

echo [3/3] Запуск серверов...
echo.
start "MedLearn Server" cmd /k "npm run dev"
timeout /t 8 /nobreak >nul

start "MedLearn Admin Panel" cmd /k "cd admin-panel && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo ✅ Серверы перезапущены!
echo ========================================
echo.
echo 📌 Сервисы:
echo    🌐 Основной сайт:    http://localhost:3000
echo    ⚙️  Админ панель:     http://localhost:3002
echo.
pause
