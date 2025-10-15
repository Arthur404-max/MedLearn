# Сводка по валидации регистрации

## Решенная проблема

PostgreSQL может некорректно обрабатывать кириллицу в зависимости от настроек кодировки. Реализовал многоуровневую валидацию, разрешающую только английские буквы в имени и фамилии.

---

## Выполненные изменения

### 1. Backend валидация (routes/auth.ts)

Добавлена проверка:
- Имя: только A-Z, a-z
- Фамилия: только A-Z, a-z
- Пароль: A-Z, a-z, 0-9, спецсимволы, минимум 6 символов

```typescript
const nameRegex = /^[A-Za-z]+$/;
const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
```

### 2. Frontend HTML валидация (register.html)

Добавлено:
- HTML5 pattern атрибуты
- Подсказки под полями
- Placeholder с примерами

```html
<input pattern="[A-Za-z]+" title="Только английские буквы" placeholder="John">
```

### 3. JavaScript валидация в реальном времени (register-validation.js)

Реализовано:
- Проверка при вводе символов
- Визуальная индикация (зеленая/красная граница)
- Проверка совпадения паролей

### 4. Улучшенная валидация при submit (client.js)

Добавлено:
- Trim введенных значений
- Детальные сообщения об ошибках
- Блокировка отправки некорректной формы

---

## Правила валидации

| Поле | Разрешено | Запрещено | Минимум |
|------|-----------|-----------|---------|
| Имя | A-Z, a-z | Кириллица, цифры, спецсимволы | 1 символ |
| Фамилия | A-Z, a-z | Кириллица, цифры, спецсимволы | 1 символ |
| Пароль | A-Z, a-z, 0-9, !@#$%^&*()... | Кириллица | 6 символов |
| Email | Стандартный формат | - | - |

---

## Визуальная индикация

### Цвета границ полей

- Зеленый - корректное значение
- Красный - ошибка валидации
- Оранжевый - предупреждение
- Серый - поле не заполнено

### Примеры сообщений об ошибках

```
Имя должно содержать только английские буквы (A-Z)
Фамилия должна содержать только английские буквы (A-Z)
Пароль должен содержать минимум 6 символов
Пароль должен содержать только английские буквы, цифры и спецсимволы
Пароли не совпадают
```

---

## Обновленные тестовые данные

### Тестовый пользователь

```
Email:    test@medlearn.ru
Пароль:   Test123!
Имя:      Test
Фамилия:  User
```

### Создание тестового пользователя

```powershell
.\create-test-user.bat
```

### Вход в систему

Через браузер:
```
http://localhost:3000/auth.html
```

Через API:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
      email = "test@medlearn.ru"
      password = "Test123!"
  } | ConvertTo-Json)
```

---

## Примеры корректных данных

### Регистрация нового пользователя

```json
{
  "email": "john.smith@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Smith"
}
```

### Допустимые вариации паролей

- Test123! (буквы + цифры + спецсимвол)
- MyPassword2025 (буквы + цифры)
- simple (минимум - 6 букв)
- Pass@Word! (все типы символов)

---

## Примеры некорректных данных

### Кириллица в имени

```json
{
  "firstName": "Иван",
  "lastName": "Петров"
}
```

Ошибка: "Имя должно содержать только английские буквы (A-Z)"

### Короткий пароль

```json
{
  "password": "test"
}
```

Ошибка: "Пароль должен содержать минимум 6 символов"

### Спецсимволы в имени

```json
{
  "firstName": "Mary-Ann",
  "lastName": "O'Connor"
}
```

Ошибка: "Имя должно содержать только английские буквы (A-Z)"

---

## Тестирование валидации

### Тест 1: Корректные данные

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
      email = "test1@example.com"
      password = "Test123!"
      firstName = "John"
      lastName = "Doe"
  } | ConvertTo-Json)
```

Ожидаемый результат: успешная регистрация

### Тест 2: Кириллица

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
      email = "test2@example.com"
      password = "Test123!"
      firstName = "Иван"
      lastName = "Петров"
  } | ConvertTo-Json)
```

Ожидаемый результат: ошибка 400, "Имя должно содержать только английские буквы"

### Тест 3: Короткий пароль

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
      email = "test3@example.com"
      password = "test"
      firstName = "John"
      lastName = "Doe"
  } | ConvertTo-Json)
```

Ожидаемый результат: ошибка 400, "Пароль должен содержать минимум 6 символов"

---

## Файлы с валидацией

Frontend:
- public/register.html
- public/client.js
- public/register-validation.js

Backend:
- routes/auth.ts

---

Обновлено: октябрь 2025  
Версия: 1.3.0
