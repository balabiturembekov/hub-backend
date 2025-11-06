import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration - simpler version for quick testing
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
    http_req_failed: ['rate<0.1'],     // Error rate should be less than 10%
  },
};

// Base URL
const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

// User tokens storage (per VU)
const userTokens = new Map();

export default function () {
  const vu = __VU; // Virtual User ID
  
  // Step 1: Login or Register
  // Note: Auth endpoints have throttling (3 reg/min, 5 login/min), so we reuse tokens
  let token = null;
  let userId = null;
  
  // Check if we already have a token for this VU
  if (!userTokens.has(vu)) {
    // Try login first (users should be pre-created with k6-prepare-users.js)
    // Use consistent email per VU
    const loginEmail = `testuser_${vu}@loadtest.com`;
    const loginPassword = 'TestPassword123!';
    
    // Try login with exponential backoff for throttling
    let loginRes = null;
    let retries = 3;
    let waitTime = 1;
    
    while (retries > 0 && !token) {
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
        
        check(loginRes, {
          'login: status 200': (r) => r.status === 200,
          'login: has token': () => !!token,
        });
        break; // Success, exit retry loop
      } else if (loginRes.status === 429) {
        // Throttled - wait with exponential backoff
        retries--;
        if (retries > 0) {
          sleep(waitTime);
          waitTime *= 2; // Exponential backoff: 1s, 2s, 4s
        }
      } else if (loginRes.status === 401) {
        // User doesn't exist - skip this VU (user should be pre-created)
        console.log(`VU ${vu}: User ${loginEmail} not found. Run k6-prepare-users.js first.`);
        return;
      } else {
        // Other error - stop retrying
        break;
      }
    }
    
    if (token) {
      userTokens.set(vu, { token, userId });
    } else {
      // If auth fails after retries, skip this iteration
      // This VU will try again in next iteration
      return;
    }
  } else {
    const stored = userTokens.get(vu);
    token = stored.token;
    userId = stored.userId;
  }
  
  if (!token) {
    return; // Skip this iteration if no token
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Step 2: Get profile
  const meRes = http.get(`${BASE_URL}/auth/me`, { headers, tags: { name: 'GetProfile' } });
  check(meRes, { 'profile status 200': (r) => r.status === 200 });
  sleep(0.5);
  
  // Step 3: Get projects
  const projectsRes = http.get(`${BASE_URL}/projects`, { headers, tags: { name: 'GetProjects' } });
  check(projectsRes, { 'projects status 200': (r) => r.status === 200 });
  sleep(0.5);
  
  // Step 4: Get time entries
  const timeEntriesRes = http.get(`${BASE_URL}/time-entries`, { headers, tags: { name: 'GetTimeEntries' } });
  check(timeEntriesRes, { 'time entries status 200': (r) => r.status === 200 });
  sleep(0.5);
  
  // Step 5: Get active time entry
  const activeRes = http.get(`${BASE_URL}/time-entries/active`, { headers, tags: { name: 'GetActive' } });
  check(activeRes, { 'active status 200': (r) => r.status === 200 });
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
    
    check(createRes, { 'create status 201': (r) => r.status === 201 });
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
        check(stopRes, { 'stop status 200': (r) => r.status === 200 });
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
    check(settingsRes, { 'settings status 200': (r) => r.status === 200 });
    sleep(0.3);
  }
  
  // Step 8: Get team activity (5% chance)
  if (Math.random() < 0.05) {
    const teamRes = http.get(
      `${BASE_URL}/team-activity`,
      { headers, tags: { name: 'GetTeamActivity' } }
    );
    check(teamRes, { 'team activity status 200': (r) => r.status === 200 });
    sleep(0.3);
  }
}

