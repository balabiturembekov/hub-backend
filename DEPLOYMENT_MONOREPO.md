# 🚀 Деплой Monorepo (Frontend + Backend в одном репозитории)

## 📋 Текущая структура

```
hub/ (основной репозиторий)
├── app/              # Frontend (Next.js)
├── components/        # Frontend компоненты
├── server/           # Backend (NestJS) - часть основного репозитория
├── docker-compose.yml
├── Dockerfile        # Frontend
└── .gitignore       # Игнорирует server/.git если он есть
```

## ✅ Решение проблемы с вложенным репозиторием

### Шаг 1: Убедиться что server/.git удален

```bash
# Проверить
ls -la server/.git

# Если существует, удалить
rm -rf server/.git
```

### Шаг 2: Добавить server/ в основной репозиторий

```bash
# Добавить все файлы server/ в git
git add server/

# Проверить что добавлено
git status
```

### Шаг 3: Обновить .gitignore

Уже обновлен - добавлено:
- `**/.git/` - предотвращает вложенные репозитории
- `server/dist` - игнорирует build артефакты
- `server/node_modules` - игнорирует зависимости

## 🎯 Варианты деплоя

### Вариант 1: Docker Compose (рекомендуется для VPS/сервера)

**Преимущества:**
- Простой деплой одной командой
- Все сервисы вместе
- Легко управлять

**Процесс:**

1. На сервере:
```bash
# Клонировать репозиторий
git clone <your-repo-url> hub
cd hub

# Настроить .env файлы
cp .env.example .env
cp server/.env.example server/.env

# Запустить
docker-compose up -d --build
```

2. Обновить переменные окружения в `docker-compose.yml`:
```yaml
environment:
  DATABASE_URL: postgresql://user:pass@postgres:5432/db
  JWT_SECRET: your-strong-secret
  FRONTEND_URL: https://yourdomain.com
  NEXT_PUBLIC_API_URL: https://api.yourdomain.com/api
```

### Вариант 2: Отдельный деплой сервисов (рекомендуется для продакшена)

#### Frontend на Vercel

1. **Подключить репозиторий к Vercel:**
   - Settings → Git → Connect Repository
   - Выбрать ваш репозиторий

2. **Настроить Root Directory:**
   - Settings → General → Root Directory: `/` (корень репозитория)

3. **Настроить Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **Переменные окружения:**
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
NEXT_PUBLIC_BASE_URL=https://your-frontend.vercel.app
```

#### Backend на Railway/Render

1. **Подключить репозиторий:**
   - Создать новый проект
   - Connect GitHub Repository
   - Выбрать ваш репозиторий

2. **Настроить Root Directory:**
   - Settings → Root Directory: `server`

3. **Настроить Build:**
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/main`

4. **Переменные окружения:**
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
FRONTEND_URL=https://your-frontend.vercel.app
```

### Вариант 3: GitHub Actions для автоматического деплоя

Создать `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      # Деплой на Vercel/Railway через их CLI

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd server && npm install
      - run: cd server && npm run build
      # Деплой на Railway/Render через их CLI
```

## 🔧 Исправление текущей проблемы

### Если server/ был отдельным репозиторием:

```bash
# 1. Удалить .git из server/ (если еще существует)
cd server
rm -rf .git
cd ..

# 2. Добавить server/ в основной репозиторий
git add server/
git commit -m "Add server as part of monorepo"

# 3. Проверить что все правильно
git status
```

### Если нужно сохранить историю server/:

```bash
# 1. Создать backup
cp -r server server-backup

# 2. Удалить .git из server/
rm -rf server/.git

# 3. Добавить в основной репозиторий
git add server/
git commit -m "Merge server into monorepo"
```

## 📝 Чеклист перед деплоем

### Общее:
- [ ] Убедиться что `server/.git` удален
- [ ] Обновлен `.gitignore` (добавлено `**/.git/`)
- [ ] Все файлы добавлены в git: `git add .`
- [ ] Проверен `git status` - нет неожиданных файлов

### Frontend:
- [ ] `npm run build` проходит успешно
- [ ] Переменные окружения настроены
- [ ] `NEXT_PUBLIC_API_URL` указывает на продакшен

### Backend:
- [ ] `cd server && npm run build` проходит успешно
- [ ] Переменные окружения настроены
- [ ] `DATABASE_URL` указывает на продакшен БД
- [ ] `JWT_SECRET` изменен на сильный ключ

## 🚀 Быстрый деплой на VPS

```bash
# На сервере
git clone <your-repo-url> hub
cd hub

# Настроить .env
nano .env
nano server/.env

# Запустить
docker-compose up -d --build

# Проверить логи
docker-compose logs -f
```

## ⚠️ Важные моменты

1. **Не создавать .git в server/** - это сломает структуру
2. **Использовать .gitignore** - чтобы игнорировать build артефакты
3. **Разделить переменные окружения** - .env для frontend, server/.env для backend
4. **Использовать docker-compose для локальной разработки**
5. **Для продакшена - отдельный деплой сервисов** (Vercel + Railway)

