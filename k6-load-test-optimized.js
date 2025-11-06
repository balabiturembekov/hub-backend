import http from 'k6/http';
import { check, sleep } from 'k6';

// Оптимизированный скрипт для нагрузочного тестирования
// Предполагает, что пользователи уже созданы через k6-prepare-users.js

export const options = {
  stages: [
    { duration: '10s', target: 50 },   // Quick ramp up to 50 users
    { duration: '20s', target: 100 },  // Ramp up to 100 users
    { duration: '30s', target: 200 },  // Ramp up to 200 users
    { duration: '1m', target: 200 },    // Stay at 200 users
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests should be below 3s
    http_req_failed: ['rate<0.05'],     // Error rate should be less than 5%
  },
};

// Base URL
const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

// User tokens storage (per VU) - persistent across iterations
const userTokens = new Map();

export default function () {
  const vu = __VU; // Virtual User ID
  
  // Step 1: Login (reuse token if available, otherwise login)
  let token = null;
  let userId = null;
  
  if (!userTokens.has(vu)) {
    // First time for this VU - need to login
    const loginEmail = `testuser_${vu}@loadtest.com`;
    const loginPassword = 'TestPassword123!';
    
    // Try login with retry for throttling
    let loginRes = null;
    let attempts = 0;
    const maxAttempts = 5;
    
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
        // Throttled - wait and retry
        attempts++;
        if (attempts < maxAttempts) {
          sleep(Math.min(attempts * 2, 10)); // Wait 2s, 4s, 6s, 8s, 10s max
        }
      } else {
        // Other error (401, 500, etc.) - stop retrying
        break;
      }
    }
    
    if (token) {
      userTokens.set(vu, { token, userId });
    } else {
      // Can't login - skip this iteration
      return;
    }
  } else {
    // Reuse existing token
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
  
  // Step 2: Get profile
  const meRes = http.get(`${BASE_URL}/auth/me`, { headers, tags: { name: 'GetProfile' } });
  if (meRes.status === 401) {
    // Token expired - clear and retry login next iteration
    userTokens.delete(vu);
    return;
  }
  check(meRes, { 'profile status 200': (r) => r.status === 200 });
  sleep(0.5);
  
  // Step 3: Get projects
  const projectsRes = http.get(`${BASE_URL}/projects`, { headers, tags: { name: 'GetProjects' } });
  if (projectsRes.status === 401) {
    userTokens.delete(vu);
    return;
  }
  check(projectsRes, { 'projects status 200': (r) => projectsRes.status === 200 });
  sleep(0.5);
  
  // Step 4: Get time entries
  const timeEntriesRes = http.get(`${BASE_URL}/time-entries`, { headers, tags: { name: 'GetTimeEntries' } });
  if (timeEntriesRes.status === 401) {
    userTokens.delete(vu);
    return;
  }
  check(timeEntriesRes, { 'time entries status 200': (r) => timeEntriesRes.status === 200 });
  sleep(0.5);
  
  // Step 5: Get active time entry
  const activeRes = http.get(`${BASE_URL}/time-entries/active`, { headers, tags: { name: 'GetActive' } });
  if (activeRes.status === 401) {
    userTokens.delete(vu);
    return;
  }
  check(activeRes, { 'active status 200': (r) => activeRes.status === 200 });
  sleep(0.5);
  
  // Step 6: Create time entry (30% chance)
  if (Math.random() < 0.3) {
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
    sleep(1);
    
    // Stop it after 2 seconds (20% chance)
    if (createRes.status === 201 && Math.random() < 0.2) {
      try {
        const entry = JSON.parse(createRes.body);
        const stopRes = http.put(
          `${BASE_URL}/time-entries/${entry.id}/stop`,
          null,
          { headers, tags: { name: 'StopTimeEntry' } }
        );
        if (stopRes.status === 401) {
          userTokens.delete(vu);
          return;
        }
        check(stopRes, { 'stop status 200': (r) => stopRes.status === 200 });
        sleep(0.5);
      } catch (e) {
        // Ignore
      }
    }
  }
  
  // Step 7: Get screenshot settings (10% chance)
  if (Math.random() < 0.1) {
    const settingsRes = http.get(
      `${BASE_URL}/companies/screenshot-settings`,
      { headers, tags: { name: 'GetScreenshotSettings' } }
    );
    if (settingsRes.status === 401) {
      userTokens.delete(vu);
      return;
    }
    check(settingsRes, { 'settings status 200': (r) => settingsRes.status === 200 });
    sleep(0.3);
  }
  
  // Step 8: Get team activity (5% chance)
  if (Math.random() < 0.05) {
    const teamRes = http.get(
      `${BASE_URL}/team-activity`,
      { headers, tags: { name: 'GetTeamActivity' } }
    );
    if (teamRes.status === 401) {
      userTokens.delete(vu);
      return;
    }
    check(teamRes, { 'team activity status 200': (r) => teamRes.status === 200 });
    sleep(0.3);
  }
}

