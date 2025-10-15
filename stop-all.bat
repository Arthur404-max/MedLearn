@echo off
chcp 65001 >nul
echo ========================================
echo 🛑 Остановка системы MedLearn
echo ========================================
echo.

REM Проверка запущенных процессов
echo [1/4] Поиск процессов Node.js...
tasklist | findstr "node.exe" >nul 2>&1
if errorlevel 1 (
    echo ℹ️  Процессы Node.js не найдены
    goto :check_ports
)
echo ✅ Процессы Node.js найдены

REM Остановка процессов Node.js
echo [2/4] Остановка процессов Node.js...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Не удалось остановить некоторые процессы
) else (
    echo ✅ Все процессы Node.js остановлены
)
timeout /t 2 /nobreak >nul

:check_ports
REM Проверка портов
echo [3/4] Проверка портов...
set PORT_FREED=0

netstat -ano | findstr ":3000" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Порт 3000 всё ещё занят, принудительно освобождаем...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
        taskkill /F /PID %%a >nul 2>&1
        set PORT_FREED=1
    )
) else (
    echo ✅ Порт 3000 свободен
)

netstat -ano | findstr ":3002" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Порт 3002 всё ещё занят, принудительно освобождаем...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do (
        taskkill /F /PID %%a >nul 2>&1
        set PORT_FREED=1
    )
) else (
    echo ✅ Порт 3002 свободен
)

netstat -ano | findstr ":3001" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Порт 3001 всё ещё занят, принудительно освобождаем...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
        taskkill /F /PID %%a >nul 2>&1
        set PORT_FREED=1
    )
) else (
    echo ✅ Порт 3001 свободен
)

if %PORT_FREED%==1 (
    timeout /t 2 /nobreak >nul
)

REM Финальная проверка
echo [4/4] Финальная проверка...
tasklist | findstr "node.exe" >nul 2>&1
if errorlevel 1 (
    echo ✅ Все процессы остановлены
) else (
    echo ⚠️  Некоторые процессы Node.js всё ещё работают
    echo.
    echo Активные процессы:
    tasklist | findstr "node.exe"
)

echo.
echo ========================================
echo 🎉 Система остановлена!
echo ========================================
echo.
echo 💡 Для запуска используйте: start-all.bat
echo.
pause
