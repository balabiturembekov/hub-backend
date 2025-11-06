#!/bin/bash

# Скрипт для быстрого создания тестовых пользователей через SQL
# Это обходит throttling и создает пользователей мгновенно

echo "🚀 Создание тестовых пользователей для нагрузочного тестирования..."
echo ""

# Проверка наличия Docker
if ! docker ps | grep -q hubstaff-postgres; then
    echo "❌ PostgreSQL контейнер не запущен"
    echo "   Запустите: docker-compose up -d"
    exit 1
fi

# Копируем SQL скрипт в контейнер
echo "📝 Копирование SQL скрипта в контейнер..."
docker cp k6-create-users-sql.sql hubstaff-postgres:/tmp/create-users.sql

# Выполняем SQL скрипт
echo "⚡ Выполнение SQL скрипта..."
echo "   (Это может занять несколько секунд для 200 пользователей)"
docker exec -i hubstaff-postgres psql -U hubstaff -d hubstaff_db < k6-create-users-sql.sql

if [ $? -eq 0 ]; then
    echo "✅ SQL скрипт выполнен успешно"
else
    echo "❌ Ошибка при выполнении SQL скрипта"
    exit 1
fi

# Проверка результата
echo ""
echo "✅ Проверка созданных пользователей:"
docker exec -i hubstaff-postgres psql -U hubstaff -d hubstaff_db -c "SELECT COUNT(*) as total_users FROM users WHERE email LIKE '%@loadtest.com';"
docker exec -i hubstaff-postgres psql -U hubstaff -d hubstaff_db -c "SELECT COUNT(*) as total_companies FROM companies WHERE name LIKE 'Test Company%';"

echo ""
echo "✅ Готово! Теперь можно запускать нагрузочный тест:"
echo "   k6 run k6-load-test-optimized.js"

