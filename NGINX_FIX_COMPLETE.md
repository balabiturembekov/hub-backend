# 🔧 Полное исправление Nginx для скриншотов

## ❌ Проблема

Ошибка: `open() "/etc/nginx/snippets/proxy-common.conf" failed (2: No such file or directory)`

## ✅ Решение 1: Создать файл proxy-common.conf

```bash
# Создать директорию snippets (если не существует)
sudo mkdir -p /etc/nginx/snippets

# Создать файл proxy-common.conf
sudo nano /etc/nginx/snippets/proxy-common.conf
```

Содержимое файла:

```nginx
# /etc/nginx/snippets/proxy-common.conf

proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_cache_bypass $http_upgrade;

# Таймауты
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

## ✅ Решение 2: Заменить include на прямые настройки (быстрее)

Вместо `include /etc/nginx/snippets/proxy-common.conf;` используйте прямые настройки:

```nginx
# Статические файлы (скриншоты)
location /uploads {
    proxy_pass http://localhost:3001;

    # Proxy настройки
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Таймауты
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Кэширование
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## 🚀 Применить изменения

```bash
# 1. Проверить конфигурацию
sudo nginx -t

# 2. Если OK, перезагрузить Nginx
sudo systemctl reload nginx

# 3. Проверить доступность скриншотов
curl -I https://hubnity.automatonsoft.de/uploads/screenshots/test.jpg
```

## 📝 Полная конфигурация location /uploads

Добавьте в `/etc/nginx/sites-available/default` (или hubnity.automatonsoft.de.conf):

```nginx
# Статические файлы (скриншоты)
location /uploads {
    proxy_pass http://localhost:3001;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## ⚠️ Важно: Порядок location блоков

В Nginx порядок важен! Более специфичные пути должны быть ПЕРЕД общими:

```nginx
server {
    # ... SSL настройки ...

    # 1. Сначала специфичные пути
    location /api {
        # ...
    }

    location /uploads {
        # ...
    }

    location /socket.io {
        # ...
    }

    # 2. Потом общий путь (в конце!)
    location / {
        # Frontend
    }
}
```
