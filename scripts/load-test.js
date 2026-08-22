// TryCode k6 Load Test Script
// Run: k6 run scripts/load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const executionDuration = new Trend('execution_duration');
export const queueDuration = new Trend('queue_duration');
export const executionCounter = new Counter('executions_total');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<5000'], // 95% of requests under 5s
    'errors': ['rate<0.1'],              // Error rate under 10%
    'execution_duration': ['p(95)<30000'], // Execution under 30s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_CODE = {
  python: 'print(sum(range(1000)))',
  javascript: 'console.log(Array.from({length: 1000}, (_, i) => i).reduce((a, b) => a + b, 0))',
  rust: 'fn main() { let sum: i32 = (0..1000).sum(); println!("{}", sum); }',
  go: 'package main\nimport "fmt"\nfunc main() { sum := 0; for i := 0; i < 1000; i++ { sum += i } fmt.Println(sum) }',
};

const LANGUAGES = ['python', 'javascript', 'rust', 'go'];

function getRandomLanguage() {
  return LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
}

function getAuthToken() {
  // In a real test, you'd authenticate and return a token
  // For now, we'll use a pre-created test user token
  return __ENV.AUTH_TOKEN || '';
}

export function setup() {
  // Register a test user and get auth token
  const registerPayload = {
    email: `loadtest-${Date.now()}@example.com`,
    password: 'loadtest123',
    name: 'Load Test User',
  };

  const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(registerPayload), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 201) {
    const data = res.json();
    return { token: data.access_token, refreshToken: data.refresh_token };
  }
  
  // Fallback to login if user exists
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: registerPayload.email,
    password: registerPayload.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    return loginRes.json();
  }

  return { token: '', refreshToken: '' };
}

export default function (data) {
  const authToken = data.token || getAuthToken();
  if (!authToken) {
    console.log('No auth token available, skipping execution test');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  const language = getRandomLanguage();
  const code = TEST_CODE[language];

  // Execute code
  const startTime = Date.now();
  const execRes = http.post(`${BASE_URL}/api/execute`, JSON.stringify({
    code: code,
    language: language,
    timeout_secs: 30,
  }), {
    headers: headers,
  });

  const execDuration = Date.now() - startTime;
  executionDuration.add(execDuration);

  const success = check(execRes, {
    'execution status 200/201': (r) => r.status === 200 || r.status === 201,
    'has execution_id': (r) => {
      try {
        const data = r.json();
        return !!data.execution_id;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  if (success && execRes.status === 200) {
    const execData = execRes.json();
    const execId = execData.execution_id;

    // If queued, poll for result
    if (execData.status === 'queued' || execData.status === 'running') {
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max

      while (attempts < maxAttempts) {
        sleep(1);
        attempts++;

        const statusRes = http.get(`${BASE_URL}/api/execute/${execId}/status`, { headers });
        if (statusRes.status === 200) {
          const statusData = statusRes.json();
          if (statusData.status === 'completed' || statusData.status === 'failed' || statusData.status === 'timeout') {
            const queueTime = Date.now() - startTime;
            queueDuration.add(queueTime);
            break;
          }
        }
      }
    }
  }

  // Test other endpoints
  const endpoints = [
    { path: '/api/auth/me', name: 'get current user' },
    { path: '/api/projects', name: 'list projects' },
    { path: '/health', name: 'health check', auth: false },
  ];

  endpoints.forEach(({ path, name, auth = true }) => {
    const res = http.get(`${BASE_URL}${path}`, {
      headers: auth ? headers : {},
    });
    check(res, {
      [`${name} status 200`]: (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  // Sleep between iterations
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}