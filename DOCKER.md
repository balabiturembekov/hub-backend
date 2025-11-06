# Docker Setup для HubStaff

Инструкции по запуску проекта в Docker контейнерах.

## 🚀 Быстрый старт

### Production режим (все сервисы)

```bash
# Собрать и запустить все сервисы
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановить все сервисы
docker-compose down

# Остановить и удалить volumes
docker-compose down -v
```

### Development режим (только БД и Redis)

```bash
# Запустить только PostgreSQL и Redis
docker-compose -f docker-compose.dev.yml up -d

# Backend и Frontend запускать локально через npm
cd server && npm run start:dev
cd .. && npm run dev
```

## 📦 Сервисы

### 1. PostgreSQL
- **Контейнер**: `hubstaff-postgres`
- **Порт**: `5432`
- **База данных**: `hubstaff_db`
- **Пользователь**: `hubstaff`
- **Пароль**: `hubstaff_password`

### 2. Redis
- **Контейнер**: `hubstaff-redis`
- **Порт**: `6379`

### 3. Backend (NestJS)
- **Контейнер**: `hubstaff-backend`
- **Порт**: `3001`
- **URL**: `http://localhost:3001/api`

### 4. Frontend (Next.js)
- **Контейнер**: `hubstaff-frontend`
- **Порт**: `3000`
- **URL**: `http://localhost:3000`

## 🛠️ Команды

### Основные команды

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose stop

# Перезапуск
docker-compose restart

# Просмотр статуса
docker-compose ps

# Просмотр логов конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
docker-compose logs -f redis

# Пересобрать образы
docker-compose build --no-cache

# Удалить все контейнеры и volumes
docker-compose down -v
```

### Работа с БД

```bash
# Подключиться к PostgreSQL
docker exec -it hubstaff-postgres psql -U hubstaff -d hubstaff_db

# Выполнить миграции вручную
docker exec -it hubstaff-backend npx prisma migrate deploy

# Prisma Studio
docker exec -it hubstaff-backend npx prisma studio
# Или локально после настройки DATABASE_URL:
# cd server && npx prisma studio
```

### Работа с Redis

```bash
# Подключиться к Redis CLI
docker exec -it hubstaff-redis redis-cli

# Просмотр очередей BullMQ
docker exec -it hubstaff-redis redis-cli KEYS "*"
```

## 🔧 Настройка

### Переменные окружения

Создайте `.env` файлы для настройки:

**server/.env:**
```env
DATABASE_URL="postgresql://hubstaff:hubstaff_password@postgres:5432/hubstaff_db?schema=public"
JWT_SECRET="your-secret-key"
REDIS_HOST="redis"
REDIS_PORT=6379
```

**Frontend переменные (в docker-compose.yml или .env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### Изменение паролей БД

Обновите пароли в `docker-compose.yml`:
```yaml
environment:
  POSTGRES_PASSWORD: your_new_password
  DATABASE_URL: postgresql://hubstaff:your_new_password@postgres:5432/hubstaff_db
```

## 🔍 Отладка

### Проверка работоспособности

```bash
# Проверить health checks
docker-compose ps

# Проверить API
curl http://localhost:3001/api

# Проверить WebSocket
# Используйте любой WebSocket клиент с:
# ws://localhost:3001
```

### Проблемы и решения

**Backend не запускается:**
```bash
# Проверить логи
docker-compose logs backend

# Проверить миграции
docker exec -it hubstaff-backend npx prisma migrate status
```

**Проблемы с подключением к БД:**
```bash
# Проверить что PostgreSQL запущен
docker-compose ps postgres

# Проверить подключение
docker exec -it hubstaff-postgres psql -U hubstaff -d hubstaff_db -c "SELECT 1;"
```

**Пересоздать все с нуля:**
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Мониторинг

### Использование ресурсов

```bash
docker stats
```

### Просмотр логов в реальном времени

```bash
docker-compose logs -f
```

## 🚀 Production Deployment

Для production рекомендуется:

1. Изменить все пароли на безопасные
2. Использовать секреты Docker или переменные окружения
3. Настроить обратный прокси (nginx)
4. Включить SSL/TLS
5. Настроить резервное копирование БД
6. Использовать managed PostgreSQL и Redis в облаке

## 📝 Примечания

- Данные БД сохраняются в Docker volumes
- Для production используйте managed сервисы БД
- WebSocket работает через порт 3001
- Все сервисы находятся в одной Docker сети

