# Sentry Integration Guide

## Настройка

### 1. Переменные окружения

#### Frontend (.env.local или в docker-compose.yml):
```env
NEXT_PUBLIC_SENTRY_DSN=https://70dca710f304ae557f050c47cb4b69b7@o4510310717784064.ingest.de.sentry.io/4510310720077904
SENTRY_ORG=automatonsoft
SENTRY_PROJECT=javascript-nextjs
SENTRY_AUTH_TOKEN=your-auth-token  # Для загрузки source maps (опционально)
```

#### Backend (server/.env):
```env
SENTRY_DSN=https://70dca710f304ae557f050c47cb4b69b7@o4510310717784064.ingest.de.sentry.io/4510310720077904
SENTRY_ENABLE_DEV=false  # Установить true для отправки ошибок в dev режиме
```

### 2. Получение DSN

**Проект уже настроен:**
- **Organization:** `automatonsoft`
- **Frontend Project:** `javascript-nextjs`

**DSN уже настроен:**
```env
# Frontend
NEXT_PUBLIC_SENTRY_DSN=https://70dca710f304ae557f050c47cb4b69b7@o4510310717784064.ingest.de.sentry.io/4510310720077904

# Backend
SENTRY_DSN=https://70dca710f304ae557f050c47cb4b69b7@o4510310717784064.ingest.de.sentry.io/4510310720077904
```

**Для проверки настроек:**
1. Перейдите на [sentry.io](https://sentry.io) и войдите в организацию `automatonsoft`
2. Откройте проект `javascript-nextjs`
3. Убедитесь, что DSN совпадает с указанным выше

### 3. Настройка Source Maps (опционально)

Для загрузки source maps в Sentry:

1. Получите Auth Token в Sentry: Settings → Auth Tokens
2. Добавьте в `.env.local`:
```env
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

## Что отслеживается

### Frontend:
- ✅ Ошибки React компонентов (ErrorBoundary)
- ✅ Ошибки страниц (Next.js error.tsx)
- ✅ Необработанные promise rejections
- ✅ Ошибки сети (API calls)
- ✅ Session Replay (запись сессий пользователей)
- ✅ Performance monitoring (10% трафика в production)

### Backend:
- ✅ Ошибки сервера (NestJS)
- ✅ Необработанные promise rejections
- ✅ HTTP запросы и ответы
- ✅ Performance tracing (10% трафика в production)

## Фильтрация ошибок

### Frontend:
- Браузерные расширения автоматически фильтруются
- Ошибки в development режиме не отправляются (если не установлен `SENTRY_ENABLE_DEV`)

### Backend:
- Ошибки в development режиме не отправляются (если не установлен `SENTRY_ENABLE_DEV`)

## Отключение Sentry

Чтобы временно отключить Sentry, просто не устанавливайте `SENTRY_DSN` или `NEXT_PUBLIC_SENTRY_DSN`. Приложение продолжит работать без мониторинга ошибок.

## Работа с интерфейсом Sentry

Подробное руководство по работе с веб-интерфейсом Sentry см. в файле **[SENTRY_GUIDE.md](./SENTRY_GUIDE.md)**

Краткая справка:
- **Issues** - список всех ошибок
- **Issue Details** - детали конкретной ошибки (stack trace, breadcrumbs, session replay)
- **Performance** - мониторинг производительности
- **Releases** - управление версиями и source maps
- **Alerts** - настройка уведомлений
- **Settings** - настройки проекта

