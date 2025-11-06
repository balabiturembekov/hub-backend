# 🔍 Отладка Network Error при регистрации

## Возможные причины:

1. **Backend не запущен**
   - Проверьте: `docker-compose ps` или `curl http://localhost:3001/api`
   
2. **Неправильный API URL**
   - Проверьте переменную `NEXT_PUBLIC_API_URL`
   - Должна быть: `http://localhost:3001/api` (dev) или `https://hubnity.automatonsoft.de/api` (prod)

3. **CORS блокирует запрос**
   - Проверьте логи backend: `docker-compose logs backend | grep CORS`
   
4. **Проблемы с сетью**
   - Проверьте доступность backend: `curl http://localhost:3001/api/auth/register -X POST`

## Как проверить:

### 1. Проверить API URL в браузере:
```javascript
// Откройте консоль браузера (F12) и выполните:
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

### 2. Проверить доступность backend:
```bash
# Проверка health check
curl http://localhost:3001/api

# Проверка CORS
curl -H "Origin: http://localhost:3002" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:3001/api/auth/register \
     -v
```

### 3. Проверить логи:
```bash
# Backend логи
docker-compose logs backend | tail -50

# Frontend логи (в браузере)
# Откройте DevTools > Network > посмотрите на запрос register
```

## Решение:

### Если backend не запущен:
```bash
docker-compose up -d backend
```

### Если неправильный API URL:
Создайте `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_BASE_URL=http://localhost:3002
```

### Если CORS блокирует:
Проверьте `FRONTEND_URL` в `docker-compose.yml`:
```yaml
FRONTEND_URL: http://localhost:3002
```

