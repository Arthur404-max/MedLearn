@echo off
chcp 65001 >nul
echo ========================================
echo 👤 Создание тестового пользователя
echo ========================================
echo.

set PGPASSWORD=1

echo [1/3] Удаление старого тестового пользователя...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d medlearndb -c "DELETE FROM users WHERE email='test@medlearn.ru';" >nul 2>&1
echo ✅ Готово

echo [2/3] Создание нового пользователя через API...
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"firstName\":\"Test\",\"lastName\":\"User\",\"email\":\"test@medlearn.ru\",\"password\":\"Test123!\"}" >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Пользователь создан

echo [3/3] Подтверждение email...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d medlearndb -c "UPDATE users SET is_verified = true WHERE email='test@medlearn.ru';" >nul 2>&1
echo ✅ Email подтверждён

echo.
echo ========================================
echo ✅ Тестовый пользователь готов!
echo ========================================
echo.
echo 📧 Email:    test@medlearn.ru
echo 🔑 Пароль:   Test123!
echo 👤 Имя:      Test User
echo 🌐 Войти:    http://localhost:3000/auth.html
echo.
pause
