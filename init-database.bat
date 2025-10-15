@echo off
chcp 65001 >nul
echo ========================================
echo 🗄️ Полная инициализация базы данных
echo ========================================
echo.

set PGPASSWORD=1

echo [1/5] Проверка базы данных medlearndb...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -lqt | findstr /C:"medlearndb" >nul 2>&1
if errorlevel 1 (
    echo ❌ База данных не найдена, создаём...
    "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE medlearndb;" >nul 2>&1
    echo ✅ База данных создана
) else (
    echo ✅ База данных существует
)

echo.
echo [2/5] Добавление недостающих столбцов в таблицу users...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d medlearndb -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by INTEGER REFERENCES users(id);
" >nul 2>&1
echo ✅ Столбцы users проверены

echo.
echo [3/5] Создание таблицы user_bans...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d medlearndb -c "
CREATE TABLE IF NOT EXISTS user_bans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by INTEGER REFERENCES users(id),
    ban_reason TEXT,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    banned_until TIMESTAMP WITH TIME ZONE,
    is_permanent BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_is_active ON user_bans(is_active);
" >nul 2>&1
echo ✅ Таблица user_bans создана

echo.
echo [4/5] Добавление столбца icon в таблицу subjects...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d medlearndb -c "
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '📚';
" >nul 2>&1
echo ✅ Столбец icon добавлен

echo.
echo [5/5] Проверка структуры базы данных...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d medlearndb -c "
SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users') as users_table,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_bans') as user_bans_table,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'subjects') as subjects_table,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'tests') as tests_table;
" 2>nul | findstr /C:"1" >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Некоторые таблицы могут отсутствовать
) else (
    echo ✅ Все основные таблицы на месте
)

echo.
echo ========================================
echo ✅ Инициализация завершена!
echo ========================================
echo.
echo 💡 Теперь можно:
echo    1. Запустить серверы: .\start-all.bat
echo    2. Создать тестового пользователя: .\create-test-user.bat
echo    3. Войти на сайт: http://localhost:3000/auth.html
echo.
pause
