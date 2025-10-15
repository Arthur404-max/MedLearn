# Настройка Nginx Load Balancer# Настройка Nginx Load Balancer#  Nginx Load Balancer Setup Guide



## Установка Nginx



### Вариант 1: Портативная установка



1. Скачайте nginx с https://nginx.org/download/nginx-1.24.0.zip

2. Распакуйте в папку `E:\ClioTest2\nginx\`

3. Структура должна быть:### Вариант 1: Портативная установка### Вариант 1: Портативная установка

   ```

   E:\ClioTest2\nginx\1. Скачайте nginx с https://nginx.org/download/nginx-1.24.0.zip

    nginx.exe

    conf\1. Скачайте nginx с https://nginx.org/download/nginx-1.24.0.zip2. Распакуйте в папку `E:\ClioTest2\nginx\`

       nginx.conf (уже настроен)

       proxy_params.conf (уже настроен)2. Распакуйте архив в папку E:\ClioTest2\nginx\3. Структура должна быть:

    logs\

   ```3. Проверьте структуру:   ```



### Вариант 2: Через winget   ```   E:\ClioTest2\nginx\



```powershell   E:\ClioTest2\nginx\    nginx.exe

winget install nginxinc.nginx

```   ├── nginx.exe    conf\



## Управление Nginx   ├── conf\       nginx.conf (уже настроен)



После установки используйте наш скрипт управления:   │   ├── nginx.conf (уже настроен)       proxy_params.conf (уже настроен)



```powershell   │   └── proxy_params.conf (уже настроен)    logs\

# Проверка конфигурации

.\scripts\nginx-control.ps1 test   └── logs\   ```



# Запуск Nginx   ```

.\scripts\nginx-control.ps1 start

### Вариант 2: Через winget (если не сработал)

# Статус

.\scripts\nginx-control.ps1 status### Вариант 2: Через winget```powershell



# Перезагрузка конфигурацииwinget install nginxinc.nginx

.\scripts\nginx-control.ps1 reload

```powershell```

# Просмотр логов

.\scripts\nginx-control.ps1 logswinget install nginxinc.nginx



# Остановка```##  Управление Nginx

.\scripts\nginx-control.ps1 stop

```



## Архитектура после установки## Управление NginxПосле установки используйте наш скрипт управления:



```

Клиент (браузер)

        ↓Используйте скрипт управления:```powershell

Nginx Load Balancer (порт 80)

        ↓# Проверка конфигурации

PM2 Cluster (16 процессов на порту 3000)

        ↓```powershell.\scripts\nginx-control.ps1 test

PostgreSQL + Redis Cache

```# Проверка конфигурации



## Мониторинг.\scripts\nginx-control.ps1 test# Запуск Nginx



- **Nginx Status**: http://localhost/nginx_status.\scripts\nginx-control.ps1 start

- **API Health**: http://localhost/api/health

- **PM2 Monitor**: `pm2 monit`# Запуск Nginx

- **Redis Control**: `.\scripts\redis-control.ps1 status`

.\scripts\nginx-control.ps1 start# Статус

## Преимущества Load Balancer

.\scripts\nginx-control.ps1 status

1. **Повышенная производительность**: Nginx как reverse proxy

2. **SSL терминация**: Готов для HTTPS# Проверка статуса

3. **Статические файлы**: Прямая отдача без Node.js

4. **Rate limiting**: Защита от DDoS.\scripts\nginx-control.ps1 status# Перезагрузка конфигурации

5. **Gzip сжатие**: Уменьшение трафика

6. **Health checks**: Автоматическая проверка backend.\scripts\nginx-control.ps1 reload



## Настройки производительности# Перезагрузка конфигурации



Текущая конфигурация оптимизирована для:.\scripts\nginx-control.ps1 reload# Просмотр логов

- **100,000+ запросов в час**

- **Автоматическое кэширование** статики.\scripts\nginx-control.ps1 logs

- **Rate limiting**: 10 req/s для API, 5 req/s для auth

- **Gzip сжатие** для всех текстовых ресурсов# Просмотр логов



## Готовность к production.\scripts\nginx-control.ps1 logs# Остановка



- SSL/HTTPS готов (нужны только сертификаты).\scripts\nginx-control.ps1 stop

- Security headers настроены

- Логирование настроено# Остановка Nginx```

- Health checks готовы

- Rate limiting активен.\scripts\nginx-control.ps1 stop



## Конфигурация```##  Архитектура после установки



### Основной конфиг (nginx.conf)



Уже настроен для работы с MedLearn платформой. Включает:## Архитектура системы```

- Upstream для PM2 кластера

- Балансировка нагрузкиКлиент (браузер)

- Кэширование статики

- Gzip сжатиеПосле установки Nginx система работает по следующей схеме:        ↓

- Rate limiting

Nginx Load Balancer (порт 80)

### Proxy параметры (proxy_params.conf)

```        ↓

Настроены заголовки для корректной работы с backend:

- X-Real-IPКлиент (браузер)PM2 Cluster (16 процессов на порту 3000)

- X-Forwarded-For

- X-Forwarded-Proto    ↓        ↓

- Host

Nginx Load Balancer (порт 80)PostgreSQL + Redis Cache

## Логи

    ↓```

Логи находятся в папке nginx/logs/:

- access.log - все запросыPM2 Cluster (16 процессов на порту 3000)

- error.log - ошибки

    ↓##  Мониторинг

Просмотр последних записей:

```powershellPostgreSQL + Redis Cache

Get-Content nginx\logs\access.log -Tail 50

Get-Content nginx\logs\error.log -Tail 50```- **Nginx Status**: http://localhost/nginx_status

```

- **API Health**: http://localhost/api/health  

## Решение проблем

## Мониторинг- **PM2 Monitor**: `pm2 monit`

### Nginx не запускается

- **Redis Control**: `.\scripts\redis-control.ps1 status`

1. Проверьте, не занят ли порт 80:

```powershellДоступные endpoints для мониторинга:

netstat -ano | findstr ":80"

```##  Преимущества Load Balancer



2. Проверьте конфигурацию:- Nginx Status: http://localhost/nginx_status

```powershell

.\scripts\nginx-control.ps1 test- API Health: http://localhost/api/health1. **Повышенная производительность**: Nginx как reverse proxy

```

- PM2 Monitor: выполните команду `pm2 monit`2. **SSL терминация**: Готов для HTTPS

3. Проверьте логи ошибок:

```powershell- Redis Status: `.\scripts\redis-control.ps1 status`3. **Статические файлы**: Прямая отдача без Node.js

Get-Content nginx\logs\error.log -Tail 20

```4. **Rate limiting**: Защита от DDoS



### Ошибка 502 Bad Gateway## Преимущества использования Nginx5. **Gzip сжатие**: Уменьшение трафика



Это означает, что backend (Node.js) недоступен.6. **Health checks**: Автоматическая проверка backend



Проверьте:1. Повышенная производительность благодаря reverse proxy

1. Запущен ли PM2 кластер: `pm2 status`

2. Доступен ли порт 3000: `netstat -ano | findstr ":3000"`2. SSL терминация готова для настройки HTTPS##  Настройки производительности

3. Запустите backend: `npm run deploy:pm2`

3. Прямая отдача статических файлов без Node.js

---

4. Rate limiting для защиты от DDoS атакТекущая конфигурация оптимизирована для:

Версия: 1.3.0  

Обновлено: октябрь 20255. Gzip сжатие для уменьшения трафика- **100,000+ запросов в час**


6. Health checks с автоматической проверкой backend- **Автоматическое кэширование** статики

- **Rate limiting**: 10 req/s для API, 5 req/s для auth

## Настройки производительности- **Gzip сжатие** для всех текстовых ресурсов



Текущая конфигурация оптимизирована для работы с:##  Готовность к production

- Более 100,000 запросов в час

- Автоматическое кэширование статических файлов-  SSL/HTTPS готов (нужны только сертификаты)

- Rate limiting: 10 запросов/сек для API, 5 запросов/сек для auth-  Security headers настроены

-  Логирование настроено

## Конфигурация-  Health checks готовы

-  Rate limiting активен
### Основной конфиг (nginx.conf)

Уже настроен для работы с MedLearn платформой. Включает:
- Upstream для PM2 кластера
- Балансировка нагрузки
- Кэширование статики
- Gzip сжатие
- Rate limiting

### Proxy параметры (proxy_params.conf)

Настроены заголовки для корректной работы с backend:
- X-Real-IP
- X-Forwarded-For
- X-Forwarded-Proto
- Host

## Логи

Логи находятся в папке nginx/logs/:
- access.log - все запросы
- error.log - ошибки

Просмотр последних записей:
```powershell
Get-Content nginx\logs\access.log -Tail 50
Get-Content nginx\logs\error.log -Tail 50
```

## Решение проблем

### Nginx не запускается

1. Проверьте, не занят ли порт 80:
```powershell
netstat -ano | findstr ":80"
```

2. Проверьте конфигурацию:
```powershell
.\scripts\nginx-control.ps1 test
```

3. Проверьте логи ошибок:
```powershell
Get-Content nginx\logs\error.log -Tail 20
```

### Ошибка 502 Bad Gateway

Это означает, что backend (Node.js) недоступен.

Проверьте:
1. Запущен ли PM2 кластер: `pm2 status`
2. Доступен ли порт 3000: `netstat -ano | findstr ":3000"`
3. Запустите backend: `npm run deploy:pm2`

---

Версия: 1.3.0  
Обновлено: октябрь 2025
