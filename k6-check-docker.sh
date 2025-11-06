#!/bin/bash

# Скрипт для проверки готовности Docker окружения перед нагрузочным тестированием

echo "🔍 Проверка Docker окружения для нагрузочного тестирования..."
echo ""

# Проверка наличия docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose не установлен"
    exit 1
fi

# Проверка статуса контейнеров
echo "📊 Статус контейнеров:"
docker-compose ps
echo ""

# Проверка backend
echo "🔌 Проверка Backend API..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ Backend доступен на http://localhost:3001/api"
else
    echo "❌ Backend недоступен (HTTP $BACKEND_STATUS)"
    echo "   Попробуйте: docker-compose restart backend"
    exit 1
fi

# Проверка PostgreSQL
echo "🗄️  Проверка PostgreSQL..."
if docker exec -it hubstaff-postgres psql -U hubstaff -d hubstaff_db -c "SELECT 1;" &> /dev/null; then
    echo "✅ PostgreSQL доступен"
else
    echo "❌ PostgreSQL недоступен"
    echo "   Попробуйте: docker-compose restart postgres"
    exit 1
fi

# Проверка Redis
echo "🔴 Проверка Redis..."
if docker exec -it hubstaff-redis redis-cli ping &> /dev/null; then
    echo "✅ Redis доступен"
else
    echo "❌ Redis недоступен"
    echo "   Попробуйте: docker-compose restart redis"
    exit 1
fi

# Проверка k6
echo "⚡ Проверка k6..."
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 не установлен"
    echo "   Установите: brew install k6"
    exit 1
else
    K6_VERSION=$(k6 version | head -n 1)
    echo "✅ k6 установлен: $K6_VERSION"
fi

echo ""
echo "✅ Все проверки пройдены! Можно запускать нагрузочное тестирование:"
echo "   k6 run k6-load-test-simple.js"

