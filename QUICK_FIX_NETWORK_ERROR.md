# ⚡ Быстрое решение Network Error при регистрации

## 🔍 Проверьте следующее:

### 1. Backend запущен?
```bash
# Проверьте статус
docker-compose ps

# Если не запущен, запустите:
docker-compose up -d backend

# Проверьте логи
docker-compose logs backend | tail -20
```

### 2. Правильный API URL?
Откройте консоль браузера (F12) и выполните:
```javascript
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

**Ожидаемые значения:**
- Локально: `http://localhost:3001/api`
- В Docker: `https://hubnity.automatonsoft.de/api` или `http://localhost:3001/api`

### 3. Проверьте доступность backend:
```bash
# Health check
curl http://localhost:3001/api

# Проверка регистрации endpoint
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123","companyName":"Test Co"}' \
  -v
```

### 4. Проверьте CORS:
```bash
# Проверка CORS headers
curl -H "Origin: http://localhost:3002" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:3001/api/auth/register \
     -v
```

## ✅ Решения:

### Если backend не запущен:
```bash
docker-compose up -d backend postgres redis
```

### Если неправильный API URL:
Создайте `.env.local` (уже создан):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_BASE_URL=http://localhost:3002
```

Затем перезапустите frontend:
```bash
# Если запущен через npm
npm run dev

# Если в Docker
docker-compose restart frontend
```

### Если CORS блокирует:
Проверьте `FRONTEND_URL` в `docker-compose.yml`:
```yaml
FRONTEND_URL: http://localhost:3002  # для локальной разработки
```

## 🐛 Отладка:

1. **Откройте DevTools (F12) > Network**
2. **Попробуйте зарегистрироваться**
3. **Посмотрите на запрос `/api/auth/register`:**
   - Статус: должен быть 200 или 400 (не Network Error)
   - URL: должен быть правильный
   - Headers: проверьте CORS headers

4. **Проверьте консоль браузера:**
   - Должны быть логи с API URL
   - Проверьте ошибки

## 📞 Если проблема не решена:

1. Проверьте логи backend: `docker-compose logs backend`
2. Проверьте логи frontend: `docker-compose logs frontend`
3. Проверьте файл `NETWORK_ERROR_DEBUG.md` для подробной отладки
