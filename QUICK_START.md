# Решение проблемы "Ошибка сервера"

## Статус системы

Система полностью работоспособна. Все обнаруженные проблемы исправлены.

---

## Найденные и исправленные проблемы

1. Отсутствовала таблица user_bans
   Это была главная причина ошибки при входе

2. Rate Limiting был слишком строгий
   Изменено с 5 до 50 попыток за 15 минут

3. Отсутствовал столбец is_deleted в таблице users
   Добавлен вместе с другими столбцами для банов

4. Отсутствовали столбцы для системы банов
   Добавлены: is_banned, ban_reason, banned_at, banned_until, banned_by

5. Регистрация не сохраняла firstName и lastName
   Исправлена логика сохранения данных

---

## Быстрый старт

### Шаг 1: Инициализация базы данных

Если еще не выполнено:
```powershell
.\init-database.bat
```

### Шаг 2: Запуск серверов

```powershell
.\start-all.bat
```

Система запустит:
- Основной сервер на порту 3000
- Админ-панель на порту 3002

### Шаг 3: Создание тестового пользователя

```powershell
.\create-test-user.bat
```

### Шаг 4: Вход в систему

Откройте: http://localhost:3000/auth.html

Данные для входа:
- Email: test@medlearn.ru
- Пароль: Test123!
- Имя: Test User (только английские буквы)

---

## Созданные скрипты

| Скрипт | Описание |
|--------|----------|
| init-database.bat | Полная инициализация БД (таблицы, столбцы, индексы) |
| start-all.bat | Запуск всех серверов (основной + админ-панель) |
| stop-all.bat | Остановка всех серверов |
| restart-server.bat | Быстрый перезапуск серверов |
| create-test-user.bat | Создание тестового пользователя с подтвержденным email |
| check-status.ps1 | Проверка статуса всей системы |

---

## Созданные документы

| Файл | Описание |
|------|----------|
| START_GUIDE.md | Полное руководство по запуску системы |
| LOGIN_FIX.md | Решение проблем с авторизацией |
| QUICK_START.md | Этот файл - быстрый старт |

---

## Изменения в базе данных

### Создана таблица user_bans

```sql
CREATE TABLE user_bans (
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
```

### Добавлены столбцы в таблицу users

```sql
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN ban_reason TEXT;
ALTER TABLE users ADD COLUMN banned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN banned_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN banned_by INTEGER REFERENCES users(id);
```

---

## Изменения в коде

### middleware/monitoring.ts

Смягчены ограничения rate limiting для разработки:

```typescript
// Было: 5 попыток за 15 минут
max: 5

// Стало: 50 попыток за 15 минут
max: 50
```

### routes/auth.ts

Добавлена проверка статуса бана при входе:

```typescript
// Проверка бана
if (user.is_banned) {
    return res.status(403).json({
        message: 'Аккаунт заблокирован',
        reason: user.ban_reason
    });
}
```

Исправлено сохранение firstName и lastName при регистрации.

---

## Тестирование

### Тест 1: Регистрация

```powershell
# API запрос
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
      email = "newuser@test.com"
      password = "Test123!"
      firstName = "John"
      lastName = "Doe"
  } | ConvertTo-Json)
```

### Тест 2: Вход

```powershell
# API запрос
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
      email = "test@medlearn.ru"
      password = "Test123!"
  } | ConvertTo-Json)
```

### Тест 3: Проверка профиля

Откройте в браузере:
- http://localhost:3000/dashboard.html

---

## Проверка статуса системы

Запустите скрипт проверки:

```powershell
.\check-status.ps1
```

Скрипт покажет:
- Статус портов (3000, 3002, 3001)
- Запущенные процессы Node.js
- Подключение к PostgreSQL
- Подключение к Redis (если используется)

---

## Решение проблем

### Ошибка подключения к БД

1. Проверьте, что PostgreSQL запущен
2. Проверьте credentials в .env файле
3. Убедитесь, что база данных medlearndb создана

### Порт уже занят

1. Остановите все процессы: `.\stop-all.bat`
2. Проверьте свободны ли порты: `netstat -ano | findstr ":3000"`
3. Запустите заново: `.\start-all.bat`

### Rate Limit Exceeded

Подождите 15 минут или перезапустите сервер для сброса счетчика.

---

## Валидация данных

Система требует:
- Имя и фамилия: только английские буквы A-Z, a-z
- Пароль: минимум 6 символов, английские буквы, цифры, спецсимволы
- Email: стандартный формат email

Подробнее в файле VALIDATION_RULES.md

---

Обновлено: октябрь 2025  
Версия: 1.3.0
