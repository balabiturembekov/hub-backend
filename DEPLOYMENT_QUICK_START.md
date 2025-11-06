# ⚡ Быстрый старт деплоя

## 🎯 Рекомендуемый подход: Отдельный деплой

### Frontend → Vercel
### Backend → Railway/Render

---

## 📦 Frontend (Next.js) на Vercel

### Шаг 1: Подготовка

```bash
# В репозитории frontend
cd /path/to/frontend-repo

# Убедиться что build работает
npm run build
```

### Шаг 2: Деплой через Vercel CLI

```bash
# Установить Vercel CLI
npm i -g vercel

# Первый деплой (выбрать опции)
vercel

# Деплой в продакшен
vercel --prod
```

### Шаг 3: Настроить переменные окружения в Vercel Dashboard

Зайти в проект → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
NEXT_PUBLIC_BASE_URL=https://your-frontend.vercel.app
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=automatonsoft
SENTRY_PROJECT=javascript-nextjs
```

### Шаг 4: Настроить домен (опционально)

Settings → Domains → Add Domain

---

## 🖥️ Backend (NestJS) на Railway

### Шаг 1: Подготовка

```bash
# В репозитории backend (папка server)
cd /path/to/backend-repo

# Убедиться что build работает
npm run build
```

### Шаг 2: Деплой через Railway CLI

```bash
# Установить Railway CLI
npm i -g @railway/cli

# Логин
railway login

# Инициализация проекта
railway init

# Создать новый проект или выбрать существующий
railway link
```

### Шаг 3: Настроить переменные окружения в Railway Dashboard

Зайти в проект → Variables:

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-strong-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=redis-password
FRONTEND_URL=https://your-frontend.vercel.app
SENTRY_DSN=your-sentry-dsn
```

### Шаг 4: Добавить PostgreSQL и Redis

В Railway Dashboard:
- Add Service → PostgreSQL
- Add Service → Redis

Railway автоматически создаст переменные `DATABASE_URL` и `REDIS_URL`.

### Шаг 5: Запустить миграции

```bash
# В Railway Dashboard → Service → Deployments → View Logs
# Или через CLI:
railway run npx prisma migrate deploy
```

### Шаг 6: Настроить домен (опционально)

Settings → Networking → Generate Domain

---

## 🔄 Альтернатива: Render.com

### Backend на Render:

1. Создать новый Web Service
2. Подключить GitHub репозиторий (backend)
3. Настроить:
   - Build Command: `cd server && npm install && npm run build`
   - Start Command: `cd server && npm run start:prod`
   - Root Directory: `server`
4. Добавить PostgreSQL и Redis из Render Marketplace
5. Настроить переменные окружения

### Frontend на Render:

1. Создать новый Static Site
2. Подключить GitHub репозиторий (frontend)
3. Настроить:
   - Build Command: `npm run build`
   - Publish Directory: `.next`
4. Настроить переменные окружения

---

## 🐳 Альтернатива: Docker на своем сервере

### Если хотите деплоить все вместе:

```bash
# 1. На сервере создать структуру
mkdir -p /opt/hub
cd /opt/hub

# 2. Клонировать репозитории
git clone <frontend-repo> .
git clone <backend-repo> server

# 3. Создать .env файл
nano .env
# Скопировать переменные из PRODUCTION_CHECKLIST.md

# 4. Запустить
docker-compose -f docker-compose.yml up -d --build

# 5. Запустить миграции
docker exec -it hubstaff-backend npx prisma migrate deploy
```

---

## ✅ Проверка после деплоя

### Frontend:
```bash
# Проверить что сайт открывается
curl https://your-frontend.vercel.app

# Проверить что API запросы работают
# Открыть DevTools → Network → проверить запросы к API
```

### Backend:
```bash
# Проверить health check
curl https://your-backend.railway.app/api

# Проверить что WebSocket работает
# Использовать WebSocket клиент или проверить в браузере
```

---

## 🔧 Обновление после изменений

### Frontend:
```bash
# Просто сделать push в main ветку
git push origin main
# Vercel автоматически задеплоит
```

### Backend:
```bash
# Просто сделать push в main ветку
git push origin main
# Railway автоматически задеплоит
```

---

## 📞 Поддержка

Если что-то не работает:
1. Проверить логи в Vercel/Railway Dashboard
2. Проверить переменные окружения
3. Проверить что URLs правильные
4. Проверить CORS настройки

