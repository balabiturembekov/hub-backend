import http from 'k6/http';
import { check, sleep } from 'k6';

// Нагрузка для тестирования 300 пользователей
export const options = {
  stages: [
    { duration: '15s', target: 50 },   // Ramp up to 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '30s', target: 200 },  // Ramp up to 200 users
    { duration: '1m', target: 300 },   // Stay at 300 users
    { duration: '15s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests should be below 3s
    http_req_failed: ['rate<0.05'],     // Error rate should be less than 5%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';
const userTokens = new Map();

export default function () {
  const vu = __VU;
  
  let token = null;
  let userId = null;
  
  if (!userTokens.has(vu)) {
    const loginEmail = `testuser_${vu}@loadtest.com`;
    const loginPassword = 'TestPassword123!';
    
    let loginRes = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts && !token) {
      loginRes = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email: loginEmail, password: loginPassword }),
        { 
          headers: { 'Content-Type': 'application/json' }, 
          tags: { name: 'Login' },
          timeout: '10s',
        }
      );
      
      if (loginRes.status === 200) {
        const body = JSON.parse(loginRes.body);
        token = body.access_token;
        userId = body.user?.id;
        break;
      } else if (loginRes.status === 429) {
        attempts++;
        if (attempts < maxAttempts) {
          sleep(attempts * 2); // Exponential backoff
        }
      } else {
        break;
      }
    }
    
    if (token) {
      userTokens.set(vu, { token, userId });
    } else {
      return; // Skip this iteration
    }
  } else {
    const stored = userTokens.get(vu);
    token = stored.token;
    userId = stored.userId;
  }
  
  if (!token) {
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Get profile
  const meRes = http.get(`${BASE_URL}/auth/me`, { headers, tags: { name: 'GetProfile' } });
  if (meRes.status === 401) {
    userTokens.delete(vu);
    return;
  }
  check(meRes, { 'profile status 200': (r) => r.status === 200 });
  sleep(0.5 + Math.random() * 0.5); // Random delay 0.5-1s
  
  // Get projects
  const projectsRes = http.get(`${BASE_URL}/projects`, { headers, tags: { name: 'GetProjects' } });
  if (projectsRes.status === 401) {
    userTokens.delete(vu);
    return;
  }
  check(projectsRes, { 'projects status 200': (r) => projectsRes.status === 200 });
  sleep(0.5 + Math.random() * 0.5);
  
  // Get time entries
  const timeEntriesRes = http.get(`${BASE_URL}/time-entries`, { headers, tags: { name: 'GetTimeEntries' } });
  if (timeEntriesRes.status === 401) {
    userTokens.delete(vu);
    return;
  }
  check(timeEntriesRes, { 'time entries status 200': (r) => timeEntriesRes.status === 200 });
  sleep(0.5 + Math.random() * 0.5);
  
  // Get active time entry
  const activeRes = http.get(`${BASE_URL}/time-entries/active`, { headers, tags: { name: 'GetActive' } });
  if (activeRes.status === 401) {
    userTokens.delete(vu);
    return;
  }
  check(activeRes, { 'active status 200': (r) => activeRes.status === 200 });
  sleep(0.5 + Math.random() * 0.5);
  
  // Create time entry (20% chance)
  if (Math.random() < 0.2) {
    const timeEntryData = {
      userId: userId,
      startTime: new Date().toISOString(),
      status: 'RUNNING',
    };
    
    const createRes = http.post(
      `${BASE_URL}/time-entries`,
      JSON.stringify(timeEntryData),
      { headers, tags: { name: 'CreateTimeEntry' } }
    );
    
    if (createRes.status === 401) {
      userTokens.delete(vu);
      return;
    }
    
    check(createRes, { 'create status 201': (r) => createRes.status === 201 });
    sleep(1 + Math.random() * 1);
  }
}

