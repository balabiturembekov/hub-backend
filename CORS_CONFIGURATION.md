# 🔒 Конфигурация CORS для деплоя

## 📋 Текущая настройка

CORS настроен в двух местах:
1. **HTTP API** (`server/src/main.ts`) - для REST запросов
2. **WebSocket Gateway** (`server/src/events/events.gateway.ts`) - для WebSocket соединений

## ✅ Что было исправлено

1. **Поддержка нескольких origins:**
   - Домен (с протоколом и без)
   - IP адрес (с портом и без)
   - Несколько origins через переменную окружения

2. **Улучшенная логика:**
   - Автоматическое добавление http/https вариантов
   - Поддержка WebSocket origins (ws://, wss://)
   - Логирование заблокированных origins для отладки

## 🔧 Настройка переменных окружения

### Для Docker Compose

В `docker-compose.yml` добавьте переменные:

```yaml
backend:
  environment:
    # Основной URL фронтенда
    FRONTEND_URL: https://yourdomain.com
    # ИЛИ если используете IP
    FRONTEND_IP: 192.168.1.100
    # ИЛИ несколько origins через запятую
    ALLOWED_ORIGINS: https://yourdomain.com,https://www.yourdomain.com,http://192.168.1.100:3002
```

### Для продакшена (VPS/сервер)

В `.env` файле на сервере:

```env
# Вариант 1: Домен
FRONTEND_URL=https://yourdomain.com

# Вариант 2: IP адрес
FRONTEND_IP=192.168.1.100

# Вариант 3: Несколько origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,http://192.168.1.100:3002
```

## 📝 Примеры конфигурации

### Пример 1: Домен с SSL
```env
FRONTEND_URL=https://hubnity.com
```

Разрешит:
- `https://hubnity.com`
- `http://hubnity.com` (автоматически добавлен)

### Пример 2: IP адрес
```env
FRONTEND_IP=185.123.45.67
```

Разрешит:
- `http://185.123.45.67`
- `http://185.123.45.67:3002`
- `https://185.123.45.67`
- `https://185.123.45.67:3002`

### Пример 3: Несколько origins
```env
ALLOWED_ORIGINS=https://hubnity.com,https://www.hubnity.com,http://185.123.45.67:3002
```

## ⚠️ Важно

1. **В production** обязательно укажите `FRONTEND_URL` или `FRONTEND_IP`
2. **Без указания origins** в production будет разрешено все (небезопасно!)
3. **Для WebSocket** используйте `ws://` или `wss://` в `ALLOWED_ORIGINS` если нужно
4. **Проверьте логи** - заблокированные origins логируются

## 🔍 Проверка CORS

После настройки проверьте:

```bash
# Проверить CORS headers
curl -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-backend.com/api/auth/login \
     -v
```

Должны увидеть:
```
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Credentials: true
```

## 🚀 Быстрая настройка для деплоя

1. **Определите URL фронтенда:**
   - Домен: `https://hubnity.com`
   - Или IP: `http://185.123.45.67:3002`

2. **Добавьте в docker-compose.yml:**
```yaml
backend:
  environment:
    FRONTEND_URL: https://hubnity.com  # или FRONTEND_IP: 185.123.45.67
```

3. **Пересоберите:**
```bash
docker-compose up -d --build backend
```

4. **Проверьте логи:**
```bash
docker-compose logs backend | grep CORS
```

