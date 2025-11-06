# HubStaff - Time Tracking & Team Management

Полнофункциональная система учета рабочего времени для команд с современным стеком технологий.

## 🚀 Быстрый старт

### Требования

- Node.js 20+
- Docker и Docker Compose
- PostgreSQL 16+
- Redis 7+

### Установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd hub
```

2. Запустите с Docker Compose:
```bash
docker-compose up -d
```

Приложение будет доступно:
- Frontend: http://localhost:3002
- Backend API: http://localhost:3001/api

### Локальная разработка

#### Frontend
```bash
npm install
npm run dev
```

#### Backend
```bash
cd server
npm install
npm run start:dev
```

## 📚 Документация

- [PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md) - Полный анализ проекта
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Руководство по деплою
- [DOCKER.md](./DOCKER.md) - Docker конфигурация
- [SENTRY.md](./SENTRY.md) - Настройка Sentry
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Чеклист для продакшена

## 🛠️ Технологический стек

### Frontend
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Zustand
- Socket.io Client
- Recharts

### Backend
- NestJS
- PostgreSQL
- Prisma ORM
- BullMQ (Redis)
- JWT Auth
- Socket.io Gateway

## ✨ Основные функции

- ✅ Трекер времени (Start/Pause/Resume/Stop)
- ✅ Управление пользователями и проектами
- ✅ Автоматические скриншоты
- ✅ Real-time обновления (WebSocket, SSE)
- ✅ Аналитика и отчеты
- ✅ Экспорт данных (CSV)
- ✅ Мультитенантность (компании)
- ✅ Роли и права доступа

## 📝 Лицензия

Private project

## 👥 Авторы

AutomatonSoft
