# Load Testing with k6

Этот проект включает скрипты для нагрузочного тестирования API с помощью k6.

## Установка k6

```bash
brew install k6
```

## Подготовка

### Если проект запущен в Docker:

1. **Проверьте, что контейнеры запущены:**
   ```bash
   docker-compose ps
   ```

2. **Проверьте, что backend доступен:**
   ```bash
   curl http://localhost:3001/api
   # Должен вернуть: "Hello World!"
   ```

3. **URL API по умолчанию:** `http://localhost:3001/api`

### Если проект запущен локально (без Docker):

1. **Убедитесь, что бэкенд запущен:**
   ```bash
   cd server
   npm run start:dev
   ```

2. **Проверьте URL API:**
   По умолчанию используется `http://localhost:3001/api`
   Можно изменить через переменную окружения:
   ```bash
   export API_URL=http://localhost:3001/api
   ```

## Скрипты для тестирования

### Быстрая проверка готовности (для Docker)
```bash
./k6-check-docker.sh
```

### Шаг 1: Предварительная регистрация пользователей (ОБЯЗАТЕЛЬНО!)

Из-за throttling (3 регистрации/мин, 5 логинов/мин) нужно предварительно создать пользователей.

**Рекомендуемый способ (быстро, через SQL):**
```bash
# Создает 200 пользователей мгновенно (обходит throttling)
./k6-create-users.sh
```

**Альтернативный способ (через API, медленно):**
```bash
# Создать 200 пользователей (займет ~67 минут из-за throttling)
NUM_USERS=200 k6 run k6-prepare-users.js

# Или создать меньше пользователей для быстрого теста
NUM_USERS=50 k6 run k6-prepare-users.js
```

### Шаг 2: Запуск нагрузочного теста

После создания пользователей запустите основной тест:

```bash
# Оптимизированный скрипт (рекомендуется)
k6 run k6-load-test-optimized.js

# Или простой скрипт
k6 run k6-load-test-simple.js

# Или полный скрипт с расширенными метриками
k6 run k6-load-test.js
```

## Конфигурация нагрузки

### Простой скрипт:
- 10s: 50 пользователей
- 20s: 100 пользователей  
- 30s: 200 пользователей
- 1m: удержание на 200 пользователях
- 10s: снижение до 0

### Полный скрипт:
- 30s: 50 пользователей
- 1m: 100 пользователей
- 1m: 200 пользователей
- 2m: удержание на 200 пользователях
- 30s: снижение до 0

## Что тестируется

1. **Аутентификация:**
   - POST /api/auth/login
   - POST /api/auth/register
   - GET /api/auth/me

2. **Проекты:**
   - GET /api/projects

3. **Time Entries:**
   - GET /api/time-entries
   - GET /api/time-entries/active
   - POST /api/time-entries (30% вероятность)
   - PUT /api/time-entries/:id/stop (20% вероятность после создания)

4. **Настройки:**
   - GET /api/companies/screenshot-settings (10% вероятность)

5. **Активность команды:**
   - GET /api/team-activity (5% вероятность)

6. **Скриншоты:**
   - POST /api/screenshots (5% вероятность, только если есть активный time entry)

## Важные замечания

⚠️ **Throttling - КРИТИЧНО!** 
- Endpoints `/api/auth/register` и `/api/auth/login` имеют **строгий throttling**:
  - Регистрация: **3 запроса в минуту**
  - Логин: **5 запросов в минуту**
- **Проблема:** При 200 одновременных пользователях все получат 429 ошибки
- **Решение:** Предварительно создайте пользователей через `k6-prepare-users.js`
- Токены переиспользуются между итерациями для одного VU

⚠️ **База данных:**
- Убедитесь, что база данных может выдержать нагрузку
- Рассмотрите возможность использования отдельной тестовой базы

⚠️ **Временное отключение throttling для тестов:**

Если нужно быстрое тестирование без throttling, можно временно изменить в `server/src/auth/auth.controller.ts`:
```typescript
// Временно закомментируйте для нагрузочного тестирования
// @Throttle({ default: { limit: 3, ttl: 60000 } })
@Post('register')
async register(@Body() dto: RegisterDto) { ... }
```
**Не забудьте вернуть throttling после тестов!**

## Примеры запуска

### Базовый запуск (для Docker)
```bash
# Убедитесь, что Docker контейнеры запущены
docker-compose ps

# Запустите тест
k6 run k6-load-test-simple.js
```

### Проверка перед запуском
```bash
# Проверить доступность API
curl http://localhost:3001/api

# Проверить логи backend
docker-compose logs -f backend
```

### С кастомным URL
```bash
API_URL=http://localhost:3001/api k6 run k6-load-test-simple.js
```

### С выводом результатов в файл
```bash
k6 run k6-load-test-simple.js --out json=results.json

# Или в формате CSV
k6 run k6-load-test-simple.js --out csv=results.csv
```

### Мониторинг во время теста
```bash
# В отдельном терминале - мониторинг ресурсов Docker
docker stats

# Просмотр логов в реальном времени
docker-compose logs -f backend
```

### С увеличенной нагрузкой
Отредактируйте `options` в скрипте:
```javascript
stages: [
  { duration: '30s', target: 100 },
  { duration: '1m', target: 300 },
  { duration: '2m', target: 500 },  // 500 пользователей!
  { duration: '1m', target: 0 },
],
```

## Метрики

k6 автоматически собирает:
- **http_req_duration**: Время ответа
- **http_req_failed**: Процент ошибок
- **http_reqs**: Количество запросов
- **vus**: Количество виртуальных пользователей
- **iterations**: Количество итераций

## Интерпретация результатов

- ✅ **http_req_failed < 5%**: Хорошо
- ✅ **p(95) < 2000ms**: 95% запросов обрабатываются менее чем за 2 секунды
- ⚠️ **http_req_failed > 10%**: Возможны проблемы с производительностью
- ⚠️ **p(95) > 3000ms**: Медленные ответы

## Troubleshooting

1. **Ошибки подключения (Connection refused):**
   ```bash
   # Проверить статус контейнеров
   docker-compose ps
   
   # Проверить, что backend запущен
   docker-compose logs backend
   
   # Перезапустить backend
   docker-compose restart backend
   
   # Проверить доступность API
   curl http://localhost:3001/api
   ```

2. **Ошибки 429 (Too Many Requests):**
   - Throttling срабатывает - это нормально для auth endpoints
   - **Решение:** Предварительно создайте пользователей через `./k6-create-users.sh`
   - Скрипт автоматически переиспользует токены после первого успешного логина
   - Для более агрессивного тестирования можно временно отключить throttling в backend

3. **Ошибки подключения к базе данных:**
   ```bash
   # Проверить статус PostgreSQL
   docker-compose ps postgres
   
   # Проверить логи PostgreSQL
   docker-compose logs postgres
   
   # Проверить подключение к БД
   docker exec -it hubstaff-postgres psql -U hubstaff -d hubstaff_db -c "SELECT 1;"
   ```

4. **Медленные ответы:**
   ```bash
   # Мониторинг ресурсов
   docker stats
   
   # Проверить логи бэкенда на ошибки
   docker-compose logs -f backend
   
   # Проверить использование CPU/Memory
   docker stats hubstaff-backend hubstaff-postgres
   ```

5. **Проблемы с памятью:**
   ```bash
   # Увеличить лимиты в docker-compose.yml:
   # backend:
   #   deploy:
   #     resources:
   #       limits:
   #         memory: 2G
   #       reservations:
   #         memory: 1G
   ```

6. **Очистка и перезапуск:**
   ```bash
   # Остановить все контейнеры
   docker-compose down
   
   # Пересоздать с нуля
   docker-compose up -d --build
   ```

