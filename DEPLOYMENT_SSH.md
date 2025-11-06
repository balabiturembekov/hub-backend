# 🖥️ Деплой на свой сервер через SSH

## 📋 Предварительные требования

- Сервер с Ubuntu/Debian (или другой Linux)
- Docker и Docker Compose установлены
- SSH доступ к серверу
- Доменное имя (опционально, но рекомендуется)
- SSL сертификат (Let's Encrypt через Certbot)

---

## 🚀 Шаг 1: Подготовка сервера

### Установка Docker и Docker Compose

```bash
# Подключиться к серверу
ssh user@your-server.com

# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER

# Установить Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезайти в систему (или выполнить newgrp docker)
exit
ssh user@your-server.com

# Проверить установку
docker --version
docker-compose --version
```

---

## 📦 Шаг 2: Подготовка репозиториев на сервере

### Вариант A: Клонировать оба репозитория в одну папку

```bash
# На сервере создать рабочую директорию
mkdir -p /opt/hubstaff
cd /opt/hubstaff

# Клонировать frontend репозиторий (в корень)
git clone <frontend-repo-url> .

# Клонировать backend репозиторий (в папку server)
git clone <backend-repo-url> server

# Структура будет:
# /opt/hubstaff/
#   ├── app/              # Frontend
#   ├── components/       # Frontend
#   ├── server/           # Backend
#   │   ├── src/
#   │   └── prisma/
#   └── docker-compose.yml
```

### Вариант B: Отдельные папки (рекомендуется для разных репозиториев)

```bash
# Создать структуру
mkdir -p /opt/hubstaff/{frontend,backend}
cd /opt/hubstaff

# Клонировать репозитории
git clone <frontend-repo-url> frontend
git clone <backend-repo-url> backend
```

---

## 🔧 Шаг 3: Создать docker-compose.yml для продакшена

### Если репозитории в одной папке (Вариант A):

Создать `docker-compose.prod.yml` в корне:

```yaml
services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: hubstaff-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - hubstaff-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis for BullMQ
  redis:
    image: redis:7-alpine
    container_name: hubstaff-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - hubstaff-network
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API (NestJS)
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: hubstaff-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      FRONTEND_URL: ${FRONTEND_URL}
      SENTRY_DSN: ${SENTRY_DSN}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./server/uploads:/app/uploads
      - ./server/prisma:/app/prisma
    networks:
      - hubstaff-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend (Next.js)
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hubstaff-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL}
      NEXT_PUBLIC_BASE_URL: ${FRONTEND_URL}
      NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN}
      SENTRY_ORG: ${SENTRY_ORG:-automatonsoft}
      SENTRY_PROJECT: ${SENTRY_PROJECT:-javascript-nextjs}
    depends_on:
      - backend
    networks:
      - hubstaff-network
    ports:
      - "3000:3000"  # Измените на нужный порт или используйте reverse proxy

volumes:
  postgres_data:
  redis_data:

networks:
  hubstaff-network:
    driver: bridge
```

---

## 🔐 Шаг 4: Создать .env файл

Создать `.env` файл на сервере:

```bash
cd /opt/hubstaff
nano .env
```

Содержимое `.env`:

```env
# Database
POSTGRES_USER=hubstaff
POSTGRES_PASSWORD=your-strong-password-here
POSTGRES_DB=hubstaff_db

# Redis
REDIS_PASSWORD=your-redis-password-here

# Backend
JWT_SECRET=your-very-strong-jwt-secret-minimum-32-characters-long
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://yourdomain.com
SENTRY_DSN=your-sentry-dsn

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=automatonsoft
SENTRY_PROJECT=javascript-nextjs
```

**ВАЖНО:** Заменить все значения на реальные!

```bash
# Защитить .env файл
chmod 600 .env
```

---

## 🚀 Шаг 5: Первый деплой

```bash
cd /opt/hubstaff

# Собрать и запустить все сервисы
docker-compose -f docker-compose.prod.yml up -d --build

# Проверить статус
docker-compose -f docker-compose.prod.yml ps

# Посмотреть логи
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 📊 Шаг 6: Запустить миграции БД

```bash
# Запустить миграции
docker exec -it hubstaff-backend npx prisma migrate deploy

# Проверить статус миграций
docker exec -it hubstaff-backend npx prisma migrate status
```

---

## 🔄 Шаг 7: Настройка Nginx Reverse Proxy (рекомендуется)

### Установка Nginx

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Конфигурация Nginx для Frontend

Создать `/etc/nginx/sites-available/hubstaff-frontend`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Конфигурация Nginx для Backend API

Создать `/etc/nginx/sites-available/hubstaff-api`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket support
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### Активировать конфигурации

```bash
# Создать симлинки
sudo ln -s /etc/nginx/sites-available/hubstaff-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/hubstaff-api /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

### Настроить SSL сертификаты

```bash
# Получить SSL сертификаты
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com

# Автоматическое обновление (уже настроено в certbot)
```

---

## 🔄 Шаг 8: Обновление приложения

### Создать скрипт для обновления

Создать `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Начало деплоя..."

# Перейти в директорию проекта
cd /opt/hubstaff

# Обновить frontend
echo "📦 Обновление frontend..."
cd /opt/hubstaff
git pull origin main

# Обновить backend
echo "📦 Обновление backend..."
cd /opt/hubstaff/server
git pull origin main

# Вернуться в корень
cd /opt/hubstaff

# Пересобрать и перезапустить
echo "🔨 Пересборка контейнеров..."
docker-compose -f docker-compose.prod.yml build

echo "🔄 Перезапуск сервисов..."
docker-compose -f docker-compose.prod.yml up -d

# Запустить миграции если есть новые
echo "📊 Проверка миграций..."
docker exec -it hubstaff-backend npx prisma migrate deploy || true

echo "✅ Деплой завершен!"
echo "📋 Проверка статуса:"
docker-compose -f docker-compose.prod.yml ps
```

Сделать исполняемым:

```bash
chmod +x deploy.sh
```

Использование:

```bash
./deploy.sh
```

---

## 📝 Шаг 9: Автоматизация через CI/CD (опционально)

### GitHub Actions для автоматического деплоя

Создать `.github/workflows/deploy.yml` в frontend репозитории:

```yaml
name: Deploy to Server

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/hubstaff
            git pull origin main
            docker-compose -f docker-compose.prod.yml build frontend
            docker-compose -f docker-compose.prod.yml up -d frontend
```

Создать `.github/workflows/deploy.yml` в backend репозитории:

```yaml
name: Deploy to Server

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/hubstaff/server
            git pull origin main
            cd /opt/hubstaff
            docker-compose -f docker-compose.prod.yml build backend
            docker-compose -f docker-compose.prod.yml up -d backend
            docker exec -it hubstaff-backend npx prisma migrate deploy
```

---

## 🔍 Мониторинг и обслуживание

### Просмотр логов

```bash
# Все сервисы
docker-compose -f docker-compose.prod.yml logs -f

# Только backend
docker-compose -f docker-compose.prod.yml logs -f backend

# Только frontend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Последние 100 строк
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Проверка статуса

```bash
# Статус контейнеров
docker-compose -f docker-compose.prod.yml ps

# Использование ресурсов
docker stats

# Проверить health checks
docker inspect hubstaff-backend | grep -A 10 Health
```

### Бэкапы БД

```bash
# Создать скрипт бэкапа
nano /opt/hubstaff/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/hubstaff"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker exec hubstaff-postgres pg_dump -U hubstaff hubstaff_db > $BACKUP_DIR/backup_$DATE.sql

# Удалить бэкапы старше 7 дней
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

Сделать исполняемым и добавить в cron:

```bash
chmod +x /opt/hubstaff/backup-db.sh

# Добавить в crontab (ежедневно в 2:00)
crontab -e
# Добавить строку:
0 2 * * * /opt/hubstaff/backup-db.sh
```

---

## 🛠️ Полезные команды

```bash
# Остановить все сервисы
docker-compose -f docker-compose.prod.yml down

# Остановить и удалить volumes (ОСТОРОЖНО!)
docker-compose -f docker-compose.prod.yml down -v

# Перезапустить конкретный сервис
docker-compose -f docker-compose.prod.yml restart backend

# Пересобрать конкретный сервис
docker-compose -f docker-compose.prod.yml build --no-cache frontend
docker-compose -f docker-compose.prod.yml up -d frontend

# Очистить неиспользуемые образы
docker system prune -a

# Подключиться к контейнеру
docker exec -it hubstaff-backend sh
docker exec -it hubstaff-frontend sh

# Просмотр использования диска
docker system df
```

---

## 🔒 Безопасность

### Firewall (UFW)

```bash
# Установить UFW
sudo apt install ufw

# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включить firewall
sudo ufw enable
sudo ufw status
```

### Обновить .env файл

```bash
# Убедиться что .env не доступен для чтения всем
chmod 600 .env

# Проверить что .env не в git
echo ".env" >> .gitignore
```

---

## ✅ Чеклист после деплоя

- [ ] Все контейнеры запущены (`docker-compose ps`)
- [ ] Frontend доступен по домену
- [ ] Backend API доступен по домену
- [ ] WebSocket подключение работает
- [ ] Миграции БД выполнены
- [ ] SSL сертификаты настроены
- [ ] Firewall настроен
- [ ] Бэкапы настроены
- [ ] Мониторинг работает (Sentry)
- [ ] Логи проверены на ошибки

---

## 🆘 Решение проблем

### Проблема: Контейнеры не запускаются

```bash
# Проверить логи
docker-compose -f docker-compose.prod.yml logs

# Проверить что порты не заняты
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001
```

### Проблема: БД не подключается

```bash
# Проверить что PostgreSQL запущен
docker exec -it hubstaff-postgres psql -U hubstaff -d hubstaff_db

# Проверить DATABASE_URL в .env
```

### Проблема: Frontend не может подключиться к API

```bash
# Проверить CORS настройки в backend
# Проверить NEXT_PUBLIC_API_URL в .env
# Проверить что backend доступен
curl http://localhost:3001/api
```

---

## 📚 Дополнительные ресурсы

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)

