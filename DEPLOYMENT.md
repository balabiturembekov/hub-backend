# 🚀 Руководство по деплою

## 📋 Ситуация

- **Frontend** и **Backend** находятся в одной папке `hub`
- У каждого свой отдельный репозиторий
- Нужно деплоить их независимо друг от друга

## 🎯 Стратегии деплоя

### Вариант 1: Отдельный деплой каждого сервиса (Рекомендуется) ⭐

Каждый сервис деплоится независимо из своего репозитория.

#### Frontend (Next.js)

**Платформы:**

- Vercel (рекомендуется для Next.js)
- Netlify
- AWS Amplify
- Свой сервер (Docker)

**Процесс:**

1. Подключить репозиторий frontend к платформе
2. Настроить переменные окружения:
   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
   NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
   NEXT_PUBLIC_BASE_URL=https://yourdomain.com
   NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
   SENTRY_ORG=automatonsoft
   SENTRY_PROJECT=javascript-nextjs
   ```
3. Настроить build команду: `npm run build`
4. Настроить output directory: `.next` (или standalone)

**Vercel пример:**

```bash
# Установить Vercel CLI
npm i -g vercel

# Деплой
vercel --prod
```

#### Backend (NestJS)

**Платформы:**

- Railway
- Render
- AWS ECS/Fargate
- DigitalOcean App Platform
- Свой сервер (Docker)

**Процесс:**

1. Подключить репозиторий backend к платформе
2. Настроить переменные окружения:
   ```env
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=postgresql://user:pass@host:5432/db
   JWT_SECRET=your-strong-secret-key
   JWT_EXPIRES_IN=7d
   REDIS_HOST=redis-host
   REDIS_PORT=6379
   REDIS_PASSWORD=redis-password
   FRONTEND_URL=https://yourdomain.com
   SENTRY_DSN=your-sentry-dsn
   ```
3. Настроить build команду: `cd server && npm run build`
4. Настроить start команду: `cd server && npm run start:prod`
5. Настроить health check: `GET /api`

**Railway пример:**

```bash
# Установить Railway CLI
npm i -g @railway/cli

# Логин
railway login

# Инициализация проекта
railway init

# Деплой
railway up
```

### Вариант 2: Docker Compose на одном сервере

Если хотите деплоить все вместе на одном сервере.

**Требования:**

- Сервер с Docker и Docker Compose
- Доступ к серверу (SSH)

**Процесс:**

1. **Создать монорепозиторий или использовать git submodules:**

```bash
# Вариант A: Git Submodules
git clone <frontend-repo> frontend
git clone <backend-repo> server
# Или использовать git submodule add

# Вариант B: Отдельные клоны в одной папке
mkdir hub-deploy
cd hub-deploy
git clone <frontend-repo> .
git clone <backend-repo> server
```

2. **Создать `.env` файл на сервере:**

```env
# Database
POSTGRES_USER=hubstaff
POSTGRES_PASSWORD=strong-password-here
POSTGRES_DB=hubstaff_db

# Backend
JWT_SECRET=your-strong-jwt-secret-here
FRONTEND_URL=https://yourdomain.com
SENTRY_DSN=your-sentry-dsn

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

3. **Обновить `docker-compose.yml` для продакшена:**

```yaml
services:
  backend:
    build:
      context: ./server # Путь к backend репозиторию
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
      # ... остальные переменные

  frontend:
    build:
      context: . # Корень (frontend репозиторий)
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      # ... остальные переменные
```

4. **Деплой на сервер:**

```bash
# На сервере
git pull origin main  # Для каждого репозитория
docker-compose -f docker-compose.yml up -d --build
```

### Вариант 3: CI/CD с GitHub Actions

Автоматический деплой при push в репозиторий.

#### Frontend CI/CD

Создать `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - "app/**"
      - "components/**"
      - "lib/**"
      - "package.json"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_WS_URL: ${{ secrets.NEXT_PUBLIC_WS_URL }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

#### Backend CI/CD

Создать `server/.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - "server/src/**"
      - "server/package.json"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        working-directory: ./server
        run: npm ci

      - name: Build
        working-directory: ./server
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v0.2.4
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
```

## 🔧 Рекомендуемая структура для деплоя

### Если используете отдельные репозитории:

```
frontend-repo/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── app/
├── components/
├── Dockerfile
├── docker-compose.yml  # Только для локальной разработки
└── package.json

backend-repo/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── src/
├── prisma/
├── Dockerfile
├── docker-compose.yml  # Только для локальной разработки
└── package.json
```

### Если используете монорепозиторий:

```
hub-repo/
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml
│       └── deploy-backend.yml
├── app/              # Frontend
├── components/       # Frontend
├── server/           # Backend
├── docker-compose.yml
└── package.json      # Frontend
```

## 📝 Чеклист перед деплоем

### Frontend:

- [ ] Настроить переменные окружения
- [ ] Проверить `NEXT_PUBLIC_API_URL` указывает на продакшен API
- [ ] Проверить `NEXT_PUBLIC_WS_URL` указывает на продакшен WebSocket
- [ ] Настроить Sentry DSN
- [ ] Проверить build проходит успешно: `npm run build`
- [ ] Настроить домен и SSL

### Backend:

- [ ] Настроить переменные окружения
- [ ] Изменить `JWT_SECRET` на сильный ключ
- [ ] Настроить `DATABASE_URL` для продакшен БД
- [ ] Настроить `FRONTEND_URL` для CORS
- [ ] Настроить Redis для продакшена
- [ ] Запустить миграции: `npx prisma migrate deploy`
- [ ] Проверить health check работает
- [ ] Настроить домен и SSL

## 🚀 Быстрый старт деплоя

### Frontend на Vercel:

```bash
# 1. Установить Vercel CLI
npm i -g vercel

# 2. В папке frontend репозитория
vercel

# 3. Настроить переменные окружения в Vercel Dashboard
# 4. Деплой в продакшен
vercel --prod
```

### Backend на Railway:

```bash
# 1. Установить Railway CLI
npm i -g @railway/cli

# 2. В папке server репозитория
railway login
railway init
railway link

# 3. Настроить переменные окружения в Railway Dashboard
# 4. Деплой
railway up
```

## 🔗 Связь между сервисами

После деплоя нужно убедиться:

1. **Frontend** может обращаться к **Backend API**

   - Проверить `NEXT_PUBLIC_API_URL`
   - Проверить CORS на backend разрешает запросы с frontend домена

2. **Frontend** может подключаться к **WebSocket**

   - Проверить `NEXT_PUBLIC_WS_URL`
   - Проверить WebSocket работает на backend

3. **Backend** знает адрес **Frontend**
   - Проверить `FRONTEND_URL` для CORS

## 📚 Дополнительные ресурсы

- [Vercel Deployment](https://vercel.com/docs)
- [Railway Deployment](https://docs.railway.app)
- [Docker Production Best Practices](https://docs.docker.com/develop/dev-best-practices/)
