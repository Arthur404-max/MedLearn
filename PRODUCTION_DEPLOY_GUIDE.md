# Production Deploy - Управление компонентами# Production Deploy - Управление компонентами#  PRODUCTION DEPLOY - НЕЗАВИСИМОЕ УПРАВЛЕНИЕ



## Доступные возможности



Реализовал возможность запуска production-deploy отдельно для управления каждым компонентом системы.## Доступные возможности##  НОВЫЕ ВОЗМОЖНОСТИ



---



## Доступные командыРеализовал возможность запуска production-deploy отдельно для управления каждым компонентом системы.Теперь production-deploy можно запускать отдельно для управления каждым компонентом!



### Системная проверка



```bash---###  ДОСТУПНЫЕ КОМАНДЫ

npm run deploy:check

```



Показывает статус всех компонентов системы.## Доступные команды####  Системная проверка:



### Управление компонентами```bash



```bash### Системная проверкаnpm run deploy:check

# Redis

npm run deploy:redis```



# PM2 кластер```bashПоказывает статус всех компонентов системы.

npm run deploy:pm2

npm run deploy:check

# Nginx Load Balancer

npm run deploy:nginx```####  Управление компонентами:



# CDN сервер```bash

npm run deploy:cdn

Показывает статус всех компонентов системы.# Redis

# Админ панель

npm run deploy:adminnpm run deploy:redis

```

### Управление компонентами

---

# PM2 кластер  

## Расширенное управление

```bashnpm run deploy:pm2

### Прямые команды PowerShell

# Redis

Системная проверка:

```powershellnpm run deploy:redis# Nginx Load Balancer

.\scripts\deploy-simple.ps1 -Component check

```npm run deploy:nginx



Запуск компонентов:# PM2 кластер

```powershell

.\scripts\deploy-simple.ps1 -Component redis -Action startnpm run deploy:pm2# CDN сервер

.\scripts\deploy-simple.ps1 -Component pm2 -Action start

.\scripts\deploy-simple.ps1 -Component nginx -Action startnpm run deploy:cdn

.\scripts\deploy-simple.ps1 -Component cdn -Action start

.\scripts\deploy-simple.ps1 -Component admin -Action start# Nginx Load Balancer

```

npm run deploy:nginx# Админ панель

Остановка компонентов:

```powershellnpm run deploy:admin

.\scripts\deploy-simple.ps1 -Component redis -Action stop

.\scripts\deploy-simple.ps1 -Component pm2 -Action stop# CDN сервер```

.\scripts\deploy-simple.ps1 -Component nginx -Action stop

.\scripts\deploy-simple.ps1 -Component cdn -Action stopnpm run deploy:cdn

.\scripts\deploy-simple.ps1 -Component admin -Action stop

```---



Проверка статуса:# Админ-панель

```powershell

.\scripts\deploy-simple.ps1 -Component redis -Action statusnpm run deploy:admin##  РАСШИРЕННОЕ УПРАВЛЕНИЕ

.\scripts\deploy-simple.ps1 -Component pm2 -Action status

.\scripts\deploy-simple.ps1 -Component nginx -Action status```

.\scripts\deploy-simple.ps1 -Component cdn -Action status

.\scripts\deploy-simple.ps1 -Component admin -Action status### Прямые команды PowerShell:

```

---```powershell

---

# Системная проверка

## Сценарии использования

## Расширенное управление.\scripts\deploy-simple.ps1 -Component check

### Быстрая проверка системы



```bash

npm run deploy:check### Прямые команды PowerShell# Запуск компонентов

```

.\scripts\deploy-simple.ps1 -Component redis -Action start

### Запуск только нужного компонента

Системная проверка:.\scripts\deploy-simple.ps1 -Component pm2 -Action start

```bash

# Только админ панель для управления```powershell.\scripts\deploy-simple.ps1 -Component nginx -Action start

npm run deploy:admin

.\scripts\deploy-simple.ps1 -Component check.\scripts\deploy-simple.ps1 -Component cdn -Action start

# Только CDN для статических файлов

npm run deploy:cdn```.\scripts\deploy-simple.ps1 -Component admin -Action start



# Только Nginx для балансировки

npm run deploy:nginx

```Запуск компонентов:# Остановка компонентов



### Отладка отдельного сервиса```powershell.\scripts\deploy-simple.ps1 -Component redis -Action stop



```powershell.\scripts\deploy-simple.ps1 -Component redis -Action start.\scripts\deploy-simple.ps1 -Component pm2 -Action stop

# Остановить конкретный сервис

.\scripts\deploy-simple.ps1 -Component admin -Action stop.\scripts\deploy-simple.ps1 -Component pm2 -Action start.\scripts\deploy-simple.ps1 -Component nginx -Action stop



# Проверить статус.\scripts\deploy-simple.ps1 -Component nginx -Action start.\scripts\deploy-simple.ps1 -Component cdn -Action stop

.\scripts\deploy-simple.ps1 -Component admin -Action status

.\scripts\deploy-simple.ps1 -Component cdn -Action start.\scripts\deploy-simple.ps1 -Component admin -Action stop

# Запустить заново

.\scripts\deploy-simple.ps1 -Component admin -Action start.\scripts\deploy-simple.ps1 -Component admin -Action start

```

```# Статус отдельных компонентов

### Поэтапный запуск системы

.\scripts\deploy-simple.ps1 -Component redis -Action status

```bash

# 1. Проверка системыОстановка компонентов:.\scripts\deploy-simple.ps1 -Component pm2 -Action status

npm run deploy:check

```powershell.\scripts\deploy-simple.ps1 -Component nginx -Action status

# 2. Запуск базовых сервисов

npm run deploy:redis.\scripts\deploy-simple.ps1 -Component redis -Action stop.\scripts\deploy-simple.ps1 -Component cdn -Action status

npm run deploy:pm2

.\scripts\deploy-simple.ps1 -Component pm2 -Action stop.\scripts\deploy-simple.ps1 -Component admin -Action status

# 3. Запуск дополнительных сервисов

npm run deploy:nginx.\scripts\deploy-simple.ps1 -Component nginx -Action stop```

npm run deploy:cdn

npm run deploy:admin.\scripts\deploy-simple.ps1 -Component cdn -Action stop



# 4. Финальная проверка.\scripts\deploy-simple.ps1 -Component admin -Action stop---

npm run deploy:check

``````



---##  СЦЕНАРИИ ИСПОЛЬЗОВАНИЯ



## Статусы проверкиПроверка статуса:



При выполнении `npm run deploy:check` вы увидите:```powershell### 1⃣ Быстрая проверка системы



```.\scripts\deploy-simple.ps1 -Component redis -Action status```bash

=== SYSTEM CHECK ===

.\scripts\deploy-simple.ps1 -Component pm2 -Action statusnpm run deploy:check

Redis: OK

PM2: OK.\scripts\deploy-simple.ps1 -Component nginx -Action status```

Nginx: OK

CDN: OK.\scripts\deploy-simple.ps1 -Component cdn -Action status

Admin Panel: OK

Main Server: OK.\scripts\deploy-simple.ps1 -Component admin -Action status### 2⃣ Запуск только нужного компонента



PORTS:``````bash

  3000 - Main Server

  3002 - Admin Panel# Только админ панель для управления

  8080 - CDN Server

```---npm run deploy:admin



**Статусы:**

- `OK` - Сервис работает корректно

- `FAIL` - Сервис недоступен## Сценарии использования# Только CDN для статических файлов  

- `STOPPED` - Сервис остановлен

npm run deploy:cdn

---

### Быстрая проверка системы

## Интеграция с существующими командами

# Только Nginx для балансировки

### Полная система vs Отдельные компоненты:

```bashnpm run deploy:nginx

| Действие | Полная система | Отдельные компоненты |

|----------|---------------|---------------------|npm run deploy:check```

| **Запуск всего** | `npm run start-all` | `npm run deploy:redis` + `npm run deploy:pm2` + ... |

| **Остановка всего** | `npm run stop-all` | `.\scripts\deploy-simple.ps1 -Component [name] -Action stop` |```

| **Проверка статуса** | `npm run status` | `npm run deploy:check` |

| **Только админ панель** | `npm run admin:start` | `npm run deploy:admin` |### 3⃣ Отладка отдельного сервиса

| **Только мониторинг** | `npm run monitor:status` | `npm run deploy:pm2` |

### Запуск только нужного компонента```powershell

---

# Остановить конкретный сервис

## Преимущества

```bash.\scripts\deploy-simple.ps1 -Component admin -Action stop

### Гибкость

- Запускайте только нужные компоненты# Только админ-панель для управления

- Независимая отладка каждого сервиса

- Поэтапное развертываниеnpm run deploy:admin# Проверить статус



### Простота.\scripts\deploy-simple.ps1 -Component admin -Action status

- Единообразные npm команды

- Понятные названия компонентов# Только CDN для статических файлов

- Быстрая системная проверка

npm run deploy:cdn# Запустить заново

### Production-готовность

- Все компоненты оптимизированы для нагрузки.\scripts\deploy-simple.ps1 -Component admin -Action start

- Автоматическая проверка доступности

- Корректная остановка процессов# Только Nginx для балансировки```



---npm run deploy:nginx



## Компоненты системы```### 4⃣ Поэтапный запуск системы



### Redis```bash



Кэширование данных для повышения производительности.### Отладка отдельного сервиса# 1. Проверка системы



Команды:npm run deploy:check

```bash

npm run deploy:redis         # Полное управление```powershell

.\scripts\redis-control.ps1 start   # Запуск

.\scripts\redis-control.ps1 stop    # Остановка# Остановить конкретный сервис# 2. Запуск базовых сервисов

.\scripts\redis-control.ps1 status  # Статус

```.\scripts\deploy-simple.ps1 -Component admin -Action stopnpm run deploy:redis



### PM2npm run deploy:pm2



Менеджер процессов Node.js для production.# Проверить статус



Команды:.\scripts\deploy-simple.ps1 -Component admin -Action status# 3. Запуск дополнительных сервисов

```bash

npm run deploy:pm2           # Полное управлениеnpm run deploy:nginx

.\scripts\pm2-control.ps1 start     # Запуск кластера

.\scripts\pm2-control.ps1 stop      # Остановка# Запустить зановоnpm run deploy:cdn

.\scripts\pm2-control.ps1 status    # Статус процессов

.\scripts\pm2-control.ps1 logs      # Просмотр логов.\scripts\deploy-simple.ps1 -Component admin -Action startnpm run deploy:admin

```

```

### Nginx

# 4. Финальная проверка

Load balancer и reverse proxy.

### Поэтапный запуск системыnpm run deploy:check

Команды:

```bash```

npm run deploy:nginx         # Полное управление

.\scripts\nginx-control.ps1 start   # Запуск```bash

.\scripts\nginx-control.ps1 stop    # Остановка

.\scripts\nginx-control.ps1 reload  # Перезагрузка конфигурации# 1. Проверка системы---

.\scripts\nginx-control.ps1 test    # Тест конфигурации

```npm run deploy:check



### CDN##  СТАТУСЫ ПРОВЕРКИ



Content Delivery Network для статических файлов.# 2. Запуск базовых сервисов



Команды:npm run deploy:redisПри выполнении `npm run deploy:check` вы увидите:

```bash

npm run deploy:cdn           # Полное управлениеnpm run deploy:pm2

.\scripts\cdn-control.ps1 start     # Запуск CDN сервера

.\scripts\cdn-control.ps1 stop      # Остановка```

.\scripts\cdn-control.ps1 sync      # Синхронизация файлов

```# 3. Запуск веб-сервисов=== SYSTEM CHECK ===



### Админ-панельnpm run deploy:nginx



Standalone версия админ-панели.npm run deploy:cdnRedis: OK



Команды:PM2: OK  

```bash

npm run deploy:admin         # Полное управление# 4. Запуск админ-панелиNginx: OK

.\scripts\admin-control.ps1 start   # Запуск

.\scripts\admin-control.ps1 stop    # Остановкаnpm run deploy:adminCDN: OK

.\scripts\admin-control.ps1 status  # Статус

``````Admin Panel: OK



---Main Server: OK



## Мониторинг---



### Проверка всех компонентовPORTS:



```powershell## Компоненты системы  3000 - Main Server

.\check-status.ps1

```  3002 - Admin Panel



Показывает:### Redis  8080 - CDN Server

- Статус портов

- Запущенные процессы```

- Использование ресурсов

- Ошибки в логахКэширование данных для повышения производительности.



### Логи компонентов**Статусы:**



PM2 логи:Команды:- `OK` - Сервис работает корректно

```powershell

pm2 logs```bash- `FAIL` - Сервис недоступен

```

npm run deploy:redis         # Полное управление- `STOPPED` - Сервис остановлен

Nginx логи:

```powershell.\scripts\redis-control.ps1 start   # Запуск

Get-Content "nginx/logs/error.log" -Tail 50

```.\scripts\redis-control.ps1 stop    # Остановка---



Системные логи:.\scripts\redis-control.ps1 status  # Статус

```powershell

Get-Content "logs/system.log" -Tail 50```##  ИНТЕГРАЦИЯ С СУЩЕСТВУЮЩИМИ КОМАНДАМИ

```



---

### PM2### Полная система vs Отдельные компоненты:

## Производительность



### Нагрузочное тестирование

Менеджер процессов Node.js для production.| Действие | Полная система | Отдельные компоненты |

```bash

npm run test:load|----------|---------------|---------------------|

# или

npx ts-node scripts/load-test.tsКоманды:| **Запуск всего** | `npm run start-all` | `npm run deploy:redis` + `npm run deploy:pm2` + ... |

```

```bash| **Остановка всего** | `npm run stop-all` | `.\scripts\deploy-simple.ps1 -Component [name] -Action stop` |

### Аудит производительности

npm run deploy:pm2           # Полное управление| **Проверка статуса** | `npm run status` | `npm run deploy:check` |

```bash

npm run test:performance.\scripts\pm2-control.ps1 start     # Запуск кластера| **Только админ панель** | `npm run admin:start` | `npm run deploy:admin` |

# или

npx ts-node scripts/performance-audit.ts.\scripts\pm2-control.ps1 stop      # Остановка| **Только мониторинг** | `npm run monitor:status` | `npm run deploy:pm2` |

```

.\scripts\pm2-control.ps1 status    # Статус процессов

### Оптимизация статики

.\scripts\pm2-control.ps1 logs      # Просмотр логов---

```bash

npm run optimize:static```

# или

npx ts-node scripts/optimize-static.ts##  ПРЕИМУЩЕСТВА

```

### Nginx

---

###  Гибкость

## SSL/TLS

Load balancer и reverse proxy.- Запускайте только нужные компоненты

### Создание самоподписанного сертификата

- Независимая отладка каждого сервиса

Простой вариант:

```powershellКоманды:- Поэтапное развертывание

.\scripts\create-ssl-simple.ps1

``````bash



Расширенный вариант:npm run deploy:nginx         # Полное управление###  Простота

```powershell

.\scripts\create-ssl.ps1.\scripts\nginx-control.ps1 start   # Запуск- Единообразные npm команды

```

.\scripts\nginx-control.ps1 stop    # Остановка- Понятные названия компонентов

### Конфигурация Nginx с SSL

.\scripts\nginx-control.ps1 reload  # Перезагрузка конфигурации- Быстрая системная проверка

```nginx

server {.\scripts\nginx-control.ps1 test    # Тест конфигурации

    listen 443 ssl http2;

    server_name medlearn.local;```###  Production-готовность



    ssl_certificate /path/to/cert.pem;- Все компоненты оптимизированы для нагрузки

    ssl_certificate_key /path/to/key.pem;

### CDN- Автоматическая проверка доступности

    location / {

        proxy_pass http://localhost:3000;- Корректная остановка процессов

    }

}Content Delivery Network для статических файлов.

```

---

---

Команды:

## Развертывание

```bash##  ИТОГ

### Шаги для production

npm run deploy:cdn           # Полное управление

1. Подготовка:

```bash.\scripts\cdn-control.ps1 start     # Запуск CDN сервера**Теперь у вас есть полный контроль над production развертыванием!**

npm install --production

npm run build.\scripts\cdn-control.ps1 stop      # Остановка

```

.\scripts\cdn-control.ps1 sync      # Синхронизация файлов-  `npm run deploy:check` - Быстрая проверка всей системы

2. Конфигурация:

```bash```-  `npm run deploy:[component]` - Запуск отдельных компонентов  

# Настройте .env для production

NODE_ENV=production-  PowerShell скрипт с параметрами для детального управления

PORT=3000

```### Админ-панель-  Интеграция с существующими командами мониторинга и админ панели



3. Запуск базовых сервисов:

```bash

npm run deploy:redisStandalone версия админ-панели.**Система готова к production с максимальной гибкостью управления!**

npm run deploy:pm2

```



4. Настройка Nginx:Команды:---

```bash

npm run deploy:nginx```bash

```

npm run deploy:admin         # Полное управление*Обновлено: $(Get-Date) - Production deploy компоненты готовы*

5. Запуск CDN (опционально):.\scripts\admin-control.ps1 start   # Запуск

```bash.\scripts\admin-control.ps1 stop    # Остановка

npm run deploy:cdn.\scripts\admin-control.ps1 status  # Статус

``````



6. Проверка:---

```bash

npm run deploy:check## Мониторинг

```

### Проверка всех компонентов

---

```powershell

## Автоматизация.\check-status.ps1

```

### Полный деплой одной командой

Показывает:

```powershell- Статус портов

.\scripts\production-deploy.ps1- Запущенные процессы

```- Использование ресурсов

- Ошибки в логах

Выполняет:

1. Проверку системы### Логи компонентов

2. Сборку проекта

3. Запуск всех компонентовPM2 логи:

4. Проверку работоспособности```powershell

pm2 logs

### Обновление без простоя```



```powershellNginx логи:

# Сборка новой версии```powershell

npm run buildGet-Content "nginx/logs/error.log" -Tail 50

```

# Перезагрузка PM2 без простоя

pm2 reload allСистемные логи:

```powershell

# Перезагрузка NginxGet-Content "logs/system.log" -Tail 50

.\scripts\nginx-control.ps1 reload```

```

---

---

## Производительность

## Резервное копирование

### Нагрузочное тестирование

### База данных

```bash

```powershellnpm run test:load

# Создание backup# или

pg_dump -U postgres -d medlearndb > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sqlnpx ts-node scripts/load-test.ts

```

# Восстановление

psql -U postgres -d medlearndb < backup_20251015_120000.sql### Аудит производительности

```

```bash

### Файлы приложенияnpm run test:performance

# или

```powershellnpx ts-node scripts/performance-audit.ts

# Архивация```

Compress-Archive -Path "E:\ClioTest2" -DestinationPath "backup_app.zip"

```### Оптимизация статики



---```bash

npm run optimize:static

## Решение проблем# или

npx ts-node scripts/optimize-static.ts

### Компонент не запускается```



1. Проверьте логи:---

```powershell

.\check-status.ps1## SSL/TLS

```

### Создание самоподписанного сертификата

2. Проверьте порты:

```powershellПростой вариант:

netstat -ano | findstr ":3000"```powershell

```.\scripts\create-ssl-simple.ps1

```

3. Перезапустите компонент:

```powershellРасширенный вариант:

.\scripts\deploy-simple.ps1 -Component pm2 -Action restart```powershell

```.\scripts\create-ssl.ps1

```

### Высокая нагрузка

### Конфигурация Nginx с SSL

1. Проверьте использование ресурсов:

```powershell```nginx

pm2 monitserver {

```    listen 443 ssl http2;

    server_name medlearn.local;

2. Оптимизируйте базу данных:

```bash    ssl_certificate /path/to/cert.pem;

npm run optimize:db    ssl_certificate_key /path/to/key.pem;

```

    location / {

3. Увеличьте количество PM2 инстансов:        proxy_pass http://localhost:3000;

```javascript    }

// ecosystem.config.json}

{```

  "instances": "max"  // Используйте все CPU ядра

}---

```

## Развертывание

---

### Шаги для production

## Итог

1. Подготовка:

**Теперь у вас есть полный контроль над production развертыванием!**```bash

npm install --production

- `npm run deploy:check` - Быстрая проверка всей системыnpm run build

- `npm run deploy:[component]` - Запуск отдельных компонентов```

- PowerShell скрипт с параметрами для детального управления

- Интеграция с существующими командами мониторинга и админ панели2. Конфигурация:

```bash

**Система готова к production с максимальной гибкостью управления!**# Настройте .env для production

NODE_ENV=production

---PORT=3000

```

Обновлено: октябрь 2025  

Версия: 1.3.03. Запуск базовых сервисов:

```bash
npm run deploy:redis
npm run deploy:pm2
```

4. Настройка Nginx:
```bash
npm run deploy:nginx
```

5. Запуск CDN (опционально):
```bash
npm run deploy:cdn
```

6. Проверка:
```bash
npm run deploy:check
```

---

## Автоматизация

### Полный деплой одной командой

```powershell
.\scripts\production-deploy.ps1
```

Выполняет:
1. Проверку системы
2. Сборку проекта
3. Запуск всех компонентов
4. Проверку работоспособности

### Обновление без простоя

```powershell
# Сборка новой версии
npm run build

# Перезагрузка PM2 без простоя
pm2 reload all

# Перезагрузка Nginx
.\scripts\nginx-control.ps1 reload
```

---

## Резервное копирование

### База данных

```powershell
# Создание backup
pg_dump -U postgres -d medlearndb > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# Восстановление
psql -U postgres -d medlearndb < backup_20251015_120000.sql
```

### Файлы приложения

```powershell
# Архивация
Compress-Archive -Path "E:\ClioTest2" -DestinationPath "backup_app.zip"
```

---

## Решение проблем

### Компонент не запускается

1. Проверьте логи:
```powershell
.\check-status.ps1
```

2. Проверьте порты:
```powershell
netstat -ano | findstr ":3000"
```

3. Перезапустите компонент:
```powershell
.\scripts\deploy-simple.ps1 -Component pm2 -Action restart
```

### Высокая нагрузка

1. Проверьте использование ресурсов:
```powershell
pm2 monit
```

2. Оптимизируйте базу данных:
```bash
npm run optimize:db
```

3. Увеличьте количество PM2 инстансов:
```javascript
// ecosystem.config.json
{
  "instances": "max"  // Используйте все CPU ядра
}
```

---

Обновлено: октябрь 2025  
Версия: 1.3.0
