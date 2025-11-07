# 🔧 Исправление 404 для скриншотов

## 📋 Проблема

Скриншоты возвращают 404, потому что Nginx не проксирует `/uploads` к backend.

## ✅ Решение

Добавить в конфигурацию Nginx проксирование `/uploads` к backend.

### Обновите `/etc/nginx/sites-available/hubnity.automatonsoft.de.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name hubnity.automatonsoft.de;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/hubnity.automatonsoft.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hubnity.automatonsoft.de/privkey.pem;

    # Подключаем общие SSL настройки
    include /etc/nginx/snippets/ssl-common.conf;

    # Подключаем security headers
    include /etc/nginx/snippets/security-headers.conf;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3002;
        include /etc/nginx/snippets/proxy-common.conf;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        include /etc/nginx/snippets/proxy-common.conf;
        
        client_max_body_size 50M;
    }

    # ⭐ ДОБАВИТЬ: Статические файлы (скриншоты)
    location /uploads {
        proxy_pass http://localhost:3001;
        include /etc/nginx/snippets/proxy-common.conf;
        
        # Кэширование статических файлов
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        include /etc/nginx/snippets/proxy-common.conf;

        # WebSocket таймауты
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

## 🚀 Применить изменения

```bash
# 1. Проверить конфигурацию
sudo nginx -t

# 2. Перезагрузить Nginx
sudo systemctl reload nginx

# 3. Проверить доступность
curl -I https://hubnity.automatonsoft.de/uploads/screenshots/test.jpg
```

## 📝 Проверка

После применения:
1. Скриншоты должны открываться по URL: `https://hubnity.automatonsoft.de/uploads/screenshots/...`
2. В логах Nginx не должно быть 404 для `/uploads`
3. В браузере скриншоты должны загружаться

## 🔍 Альтернативное решение (если не работает)

Если проксирование не работает, можно настроить Nginx для прямой отдачи файлов:

```nginx
# Прямая отдача файлов (если volume смонтирован на хосте)
location /uploads {
    alias /path/to/hub-backend/server/uploads;
    expires 30d;
    add_header Cache-Control "public, immutable";
    
    # Безопасность
    location ~ \.(php|jsp|cgi)$ {
        deny all;
    }
}
```

Но лучше использовать проксирование к backend, так как файлы находятся в Docker volume.

