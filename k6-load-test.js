import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestsCount = new Counter('requests');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 200 },   // Ramp up to 200 users
    { duration: '2m', target: 200 },   // Stay at 200 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.05'],    // Error rate should be less than 5%
    errors: ['rate<0.05'],
  },
};

// Base URL
const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

// Generate test user data
function generateUserData(vu) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    name: `Test User ${vu}_${random}`,
    email: `testuser_${vu}_${timestamp}@test.com`,
    password: 'TestPassword123!',
    companyName: `Test Company ${vu % 10}`, // 10 companies
    companyDomain: `testcompany${vu % 10}.com`,
  };
}

// Generate screenshot image data (small base64 JPEG)
function generateScreenshotData() {
  // Minimal valid JPEG base64 (1x1 pixel red image)
  return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
}

// Main test function
export default function () {
  const vu = __VU; // Virtual User ID
  const iter = __ITER; // Iteration number
  
  // User context per VU
  if (!__ENV.userTokens) {
    __ENV.userTokens = {};
  }
  
  // Step 1: Register or Login (only once per VU)
  let token = null;
  let userId = null;
  let companyId = null;
  
  if (!__ENV.userTokens[vu]) {
    // Try to login first (user might already exist)
    const loginData = {
      email: `testuser_${vu}_${Date.now()}@test.com`,
      password: 'TestPassword123!',
    };
    
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify(loginData), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Auth_Login' },
    });
    
    if (loginRes.status === 200) {
      const loginBody = JSON.parse(loginRes.body);
      token = loginBody.access_token;
      userId = loginBody.user?.id;
      companyId = loginBody.user?.companyId;
      
      check(loginRes, {
        'login: status is 200': (r) => r.status === 200,
        'login: has token': () => !!token,
        'login: has user': () => !!userId,
      }) || errorRate.add(1);
      
      __ENV.userTokens[vu] = { token, userId, companyId };
    } else {
      // User doesn't exist, register
      const userData = generateUserData(vu);
      const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify(userData), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Auth_Register' },
      });
      
      if (registerRes.status === 201 || registerRes.status === 200) {
        const registerBody = JSON.parse(registerRes.body);
        token = registerBody.access_token;
        userId = registerBody.user?.id;
        companyId = registerBody.user?.companyId;
        
        check(registerRes, {
          'register: status is 201/200': (r) => r.status === 201 || r.status === 200,
          'register: has token': () => !!token,
          'register: has user': () => !!userId,
        }) || errorRate.add(1);
        
        __ENV.userTokens[vu] = { token, userId, companyId };
      } else {
        errorRate.add(1);
        console.error(`Failed to register/login user ${vu}:`, registerRes.status, registerRes.body);
        return;
      }
    }
  } else {
    token = __ENV.userTokens[vu].token;
    userId = __ENV.userTokens[vu].userId;
    companyId = __ENV.userTokens[vu].companyId;
  }
  
  if (!token) {
    errorRate.add(1);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Step 2: Get current user profile
  const meRes = http.get(`${BASE_URL}/auth/me`, { headers, tags: { name: 'Auth_Me' } });
  check(meRes, {
    'get profile: status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  requestsCount.add(1);
  responseTime.add(meRes.timings.duration);
  sleep(0.5);
  
  // Step 3: Get projects
  const projectsRes = http.get(`${BASE_URL}/projects`, { headers, tags: { name: 'Projects_GetAll' } });
  check(projectsRes, {
    'get projects: status is 200': (r) => r.status === 200,
    'get projects: has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);
  requestsCount.add(1);
  responseTime.add(projectsRes.timings.duration);
  sleep(0.5);
  
  // Parse projects to get project IDs
  let projects = [];
  try {
    projects = JSON.parse(projectsRes.body);
  } catch {
    projects = [];
  }
  const projectId = projects.length > 0 ? projects[Math.floor(Math.random() * projects.length)].id : null;
  
  // Step 4: Get time entries
  const timeEntriesRes = http.get(`${BASE_URL}/time-entries`, { 
    headers, 
    tags: { name: 'TimeEntries_GetAll' },
  });
  check(timeEntriesRes, {
    'get time entries: status is 200': (r) => r.status === 200,
    'get time entries: has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);
  requestsCount.add(1);
  responseTime.add(timeEntriesRes.timings.duration);
  sleep(0.5);
  
  // Step 5: Get active time entry
  const activeRes = http.get(`${BASE_URL}/time-entries/active`, { 
    headers, 
    tags: { name: 'TimeEntries_GetActive' },
  });
  check(activeRes, {
    'get active entry: status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  requestsCount.add(1);
  responseTime.add(activeRes.timings.duration);
  sleep(0.5);
  
  // Step 6: Create time entry (30% chance)
  if (Math.random() < 0.3) {
    const timeEntryData = {
      userId: userId,
      projectId: projectId || null,
      startTime: new Date().toISOString(),
      status: 'RUNNING',
    };
    
    const createRes = http.post(
      `${BASE_URL}/time-entries`,
      JSON.stringify(timeEntryData),
      { headers, tags: { name: 'TimeEntries_Create' } }
    );
    
    check(createRes, {
      'create time entry: status is 201': (r) => r.status === 201,
      'create time entry: has id': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.id;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
    requestsCount.add(1);
    responseTime.add(createRes.timings.duration);
    sleep(1);
    
    // If created, try to stop it (20% chance)
    if (createRes.status === 201 && Math.random() < 0.2) {
      try {
        const entry = JSON.parse(createRes.body);
        const stopRes = http.put(
          `${BASE_URL}/time-entries/${entry.id}/stop`,
          null,
          { headers, tags: { name: 'TimeEntries_Stop' } }
        );
        check(stopRes, {
          'stop time entry: status is 200': (r) => r.status === 200,
        }) || errorRate.add(1);
        requestsCount.add(1);
        responseTime.add(stopRes.timings.duration);
        sleep(0.5);
      } catch (e) {
        errorRate.add(1);
      }
    }
  }
  
  // Step 7: Get screenshot settings (10% chance)
  if (Math.random() < 0.1) {
    const settingsRes = http.get(
      `${BASE_URL}/companies/screenshot-settings`,
      { headers, tags: { name: 'Companies_GetScreenshotSettings' } }
    );
    check(settingsRes, {
      'get screenshot settings: status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    requestsCount.add(1);
    responseTime.add(settingsRes.timings.duration);
    sleep(0.3);
  }
  
  // Step 8: Get team activity (5% chance)
  if (Math.random() < 0.05) {
    const teamActivityRes = http.get(
      `${BASE_URL}/team-activity`,
      { headers, tags: { name: 'TeamActivity_Get' } }
    );
    check(teamActivityRes, {
      'get team activity: status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
    requestsCount.add(1);
    responseTime.add(teamActivityRes.timings.duration);
    sleep(0.3);
  }
  
  // Step 9: Upload screenshot (5% chance - only if has active time entry)
  if (Math.random() < 0.05) {
    try {
      const activeBody = JSON.parse(activeRes.body);
      if (activeBody && activeBody.id) {
        const screenshotData = {
          timeEntryId: activeBody.id,
          imageData: generateScreenshotData(),
        };
        
        const screenshotRes = http.post(
          `${BASE_URL}/screenshots`,
          JSON.stringify(screenshotData),
          { headers, tags: { name: 'Screenshots_Upload' } }
        );
        
        check(screenshotRes, {
          'upload screenshot: status is 201': (r) => r.status === 201,
        }) || errorRate.add(1);
        requestsCount.add(1);
        responseTime.add(screenshotRes.timings.duration);
        sleep(0.5);
      }
    } catch (e) {
      // Ignore errors for screenshot upload
    }
  }
  
  // Step 10: Get user profile
  const userMeRes = http.get(`${BASE_URL}/users/me`, { headers, tags: { name: 'Users_GetMe' } });
  check(userMeRes, {
    'get user me: status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  requestsCount.add(1);
  responseTime.add(userMeRes.timings.duration);
  sleep(0.5);
}

// Setup function - runs once before all VUs
export function setup() {
  console.log('🚀 Starting load test with configuration:');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Target: 200+ concurrent users`);
  console.log(`   Stages: 50 → 100 → 200 users over 5 minutes`);
  return {};
}

// Teardown function - runs once after all VUs
export function teardown(data) {
  console.log('✅ Load test completed');
}

