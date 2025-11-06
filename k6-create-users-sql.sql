-- SQL скрипт для быстрого создания тестовых пользователей для нагрузочного тестирования
-- Использование: это намного быстрее, чем через API (обходит throttling)
-- Использует ON CONFLICT для обработки дубликатов

DO $$
DECLARE
  company_id UUID;
  user_id UUID;
  i INTEGER;
  company_num INTEGER;
  user_num INTEGER;
BEGIN
  -- Создаем или получаем 10 компаний для тестов
  FOR company_num IN 0..9 LOOP
    -- Используем INSERT ... ON CONFLICT для получения существующей компании или создания новой
    INSERT INTO companies (id, name, domain, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'Test Company ' || company_num,
      'testcompany' || company_num || '.com',
      NOW(),
      NOW()
    )
    ON CONFLICT (domain) DO UPDATE SET
      name = EXCLUDED.name,
      "updatedAt" = NOW()
    RETURNING id INTO company_id;
    
    -- Если конфликт, получаем ID существующей компании
    IF company_id IS NULL THEN
      SELECT id INTO company_id 
      FROM companies 
      WHERE domain = 'testcompany' || company_num || '.com';
    END IF;
    
    -- Создаем 20 пользователей на каждую компанию (всего 200)
    FOR i IN 1..20 LOOP
      user_num := (company_num * 20) + i;
      user_id := gen_random_uuid();
      
      -- Используем ON CONFLICT для пропуска существующих пользователей
      INSERT INTO users (
        id, email, name, password, role, status, "companyId", "createdAt", "updatedAt"
      )
      VALUES (
        user_id,
        'testuser_' || user_num || '@loadtest.com',
        'Load Test User ' || user_num,
        '$2b$10$hMTlLmvrfBZlNLOTOQZESe4Lz/vp5qlgyoOGcTcpyUDsTiLsI3JB2', -- bcrypt hash for 'TestPassword123!'
        'EMPLOYEE',
        'ACTIVE',
        company_id,
        NOW(),
        NOW()
      )
      ON CONFLICT (email, "companyId") DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Проверка: сколько пользователей создано
SELECT COUNT(*) as total_users FROM users WHERE email LIKE '%@loadtest.com';
SELECT COUNT(*) as total_companies FROM companies WHERE name LIKE 'Test Company%';

