import http from 'k6/http';
import { check } from 'k6';

// Скрипт для предварительного создания пользователей перед нагрузочным тестированием
// Запускать один раз перед основным тестом

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';
const NUM_USERS = parseInt(__ENV.NUM_USERS || '200', 10);

export const options = {
  vus: 1, // Один VU для последовательной регистрации
  iterations: NUM_USERS,
  duration: `${Math.ceil(NUM_USERS / 3) * 60}s`, // 3 регистрации в минуту (throttling)
};

export default function () {
  const vu = __VU;
  const iter = __ITER;
  
  // Используем iter вместо vu для уникальности
  const userNum = iter + 1;
  
  const registerData = {
    name: `Load Test User ${userNum}`,
    email: `testuser_${userNum}@loadtest.com`,
    password: 'TestPassword123!',
    companyName: `Test Company ${userNum % 10}`,
    companyDomain: `testcompany${userNum % 10}.com`,
  };
  
  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify(registerData),
    { 
      headers: { 'Content-Type': 'application/json' }, 
      tags: { name: 'Register' },
      timeout: '30s',
    }
  );
  
  const success = check(registerRes, {
    'register: status 201/200': (r) => r.status === 201 || r.status === 200,
  });
  
  if (success) {
    console.log(`✅ User ${userNum} registered: ${registerData.email}`);
  } else {
    if (registerRes.status === 429) {
      console.log(`⚠️  User ${userNum} throttled (429), will retry in next iteration`);
    } else {
      console.log(`❌ User ${userNum} failed: ${registerRes.status} - ${registerRes.body}`);
    }
  }
  
  // Ждем 20 секунд между регистрациями (3 в минуту с запасом)
  // Это нужно из-за throttling (3 reg/min)
}

export function handleSummary(data) {
  const succeeded = data.metrics.checks.values['register: status 201/200']?.passes || 0;
  const failed = data.metrics.checks.values['register: status 201/200']?.fails || 0;
  
  return {
    'stdout': `
✅ Предварительная регистрация завершена:
   Успешно: ${succeeded}
   Ошибок: ${failed}
   Всего: ${succeeded + failed}
   
Теперь можно запускать основной тест:
   k6 run k6-load-test-simple.js
`,
  };
}

