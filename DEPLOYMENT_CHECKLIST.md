# 🚀 Чеклист для деплоя на сервер

## ✅ CORS настроен
- Домен: `https://hubnity.automatonsoft.de`
- IP: `94.126.201.244`
- Все варианты доступа разрешены (http/https, с портом и без)

## 📋 Перед деплоем проверьте:

### 1. Переменные окружения
Убедитесь, что на сервере установлены правильные значения:
```bash
# В docker-compose.yml или .env
FRONTEND_URL=https://hubnity.automatonsoft.de
FRONTEND_IP=94.126.201.244
```

### 2. SSL сертификат
Убедитесь, что SSL настроен для домена:
```bash
# Проверьте доступность
curl -I https://hubnity.automatonsoft.de
```

### 3. Порты
- Backend: 3001
- Frontend: 3002 (внутри контейнера 3000)
- PostgreSQL: 5432
- Redis: 6379

### 4. Nginx/Reverse Proxy (если используется)
Настройте проксирование:
```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name hubnity.automatonsoft.de;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Firewall
Откройте необходимые порты:
```bash
# Если используете ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 3002/tcp
```

### 6. Деплой
```bash
# На сервере
cd /path/to/hub
docker-compose build --no-cache
docker-compose up -d

# Проверьте логи
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 7. Проверка CORS
```bash
# Проверьте CORS headers
curl -H "Origin: https://hubnity.automatonsoft.de" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://hubnity.automatonsoft.de/api/auth/login \
     -v
```

## 🔍 Отладка

### Проверить CORS логи:
```bash
docker-compose logs backend | grep CORS
```

### Проверить WebSocket:
```bash
docker-compose logs backend | grep WebSocket
```

## ⚠️ Важно

1. **JWT_SECRET** - обязательно измените в продакшене!
2. **DATABASE_URL** - используйте безопасные пароли
3. **Sentry DSN** - настройте для мониторинга ошибок
4. **Backup** - настройте регулярные бэкапы базы данных

