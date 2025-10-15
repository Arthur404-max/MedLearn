@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 Запуск системы MedLearn
echo ========================================
echo.

REM Проверка Node.js
echo [1/6] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js не установлен!
    pause
    exit /b 1
)
echo ✅ Node.js установлен

REM Проверка PostgreSQL
echo [2/6] Проверка PostgreSQL...
set PGPASSWORD=1
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d medlearndb -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo ❌ База данных medlearndb не доступна!
    echo Создаём базу данных...
    "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE medlearndb;" >nul 2>&1
    if errorlevel 1 (
        echo ❌ Не удалось создать базу данных!
        pause
        exit /b 1
    )
)
echo ✅ База данных доступна

REM Остановка старых процессов
echo [3/6] Остановка старых процессов Node.js...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Старые процессы остановлены

REM Проверка портов
echo [4/6] Проверка портов...
netstat -ano | findstr ":3000" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Порт 3000 занят, освобождаем...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)
netstat -ano | findstr ":3002" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Порт 3002 занят, освобождаем...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)
echo ✅ Порты свободны

REM Запуск основного сервера
echo [5/6] Запуск основного сервера (порт 3000)...
echo    Подождите, идёт инициализация базы данных...
start "MedLearn Server" cmd /k "npm run dev"
timeout /t 10 /nobreak >nul
netstat -ano | findstr ":3000" >nul 2>&1
if errorlevel 1 (
    echo ❌ Основной сервер не запустился!
    echo    Проверьте окно "MedLearn Server" для просмотра ошибок
    echo    Возможно, нужно больше времени для запуска
    timeout /t 5 /nobreak >nul
    netstat -ano | findstr ":3000" >nul 2>&1
    if errorlevel 1 (
        echo ❌ Сервер всё ещё не запущен
        pause
        exit /b 1
    )
)
echo ✅ Основной сервер запущен

REM Запуск админ панели
echo [6/6] Запуск админ панели (порт 3002)...
echo    Подождите, запускается админ панель...
start "MedLearn Admin Panel" cmd /k "cd admin-panel && npm run dev"
timeout /t 8 /nobreak >nul
netstat -ano | findstr ":3002" >nul 2>&1
if errorlevel 1 (
    echo ❌ Админ панель не запустилась!
    echo    Проверьте окно "MedLearn Admin Panel" для просмотра ошибок
    timeout /t 5 /nobreak >nul
    netstat -ano | findstr ":3002" >nul 2>&1
    if errorlevel 1 (
        echo ❌ Админ панель всё ещё не запущена
        pause
        exit /b 1
    )
)
echo ✅ Админ панель запущена

echo.
echo ========================================
echo 🎉 Система успешно запущена!
echo ========================================
echo.
echo 📌 Доступные сервисы:
echo    🌐 Основной сайт:    http://localhost:3000
echo    📝 Регистрация:      http://localhost:3000/register.html
echo    🔐 Вход:             http://localhost:3000/auth.html
echo    📊 Dashboard:        http://localhost:3000/dashboard.html
echo    ⚙️  Админ панель:     http://localhost:3002
echo.
echo 💡 Для остановки используйте: stop-all.bat
echo.
pause
