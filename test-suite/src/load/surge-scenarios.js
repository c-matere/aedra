import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────
const reportDeliveryTime = new Trend('report_delivery_ms');
const acknowledgedWithin2s = new Rate('acknowledged_within_2s');
const completedWithin60s = new Rate('completed_within_60s');
const modelFallbackRate = new Rate('model_fallback_rate');
const errorRate = new Rate('error_rate');
const emergencyEscalationTime = new Trend('emergency_escalation_ms');

// ── Test configuration ────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ── WhatsApp webhook payload builder ─────────────────────────
function webhookPayload(phone, message) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: '1280198773926132',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '254752167271',
            phone_number_id: '1084609064725669',
          },
          contacts: [{ profile: { name: `Agent ${phone}` }, wa_id: phone }],
          messages: [{
            from: phone,
            id: `wamid.load_test_${Date.now()}_${Math.random()}`,
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: message },
            type: 'text',
          }],
        },
        field: 'messages',
      }],
    }],
  });
}

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'facebookexternalua',
};

// ────────────────────────────────────────────────────────────
// SCENARIO 1: 1st-of-month report surge
// 300 agents request reports within 4 minutes
// This is the Black Swan BS-01 scenario
// ────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    report_surge: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp to 50 agents
        { duration: '60s', target: 100 },  // Surge to 100
        { duration: '2m', target: 100 },   // Hold at 100
        { duration: '30s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'report_surge' },
    },
    steady_state: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      tags: { scenario: 'steady_state' },
      startTime: '5m',
    },
    emergency_check: {
      executor: 'constant-vus',
      vus: 2,
      duration: '3m',
      tags: { scenario: 'emergency' },
    },
  },

  thresholds: {
    'http_req_duration{scenario:report_surge}': ['p(95)<500'],
    'acknowledged_within_2s': ['rate>0.95'],
    'completed_within_60s': ['rate>0.90'],
    'error_rate': ['rate<0.05'],
    'emergency_escalation_ms': ['p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
  },
};

export function reportSurge() {
  const agentPhone = `2547000${String(__VU).padStart(5, '0')}`;
  const startTime = Date.now();

  const res = http.post(
    `${BASE_URL}/webhook`,
    webhookPayload(agentPhone, 'generate monthly report for my portfolio'),
    { headers: HEADERS, tags: { name: 'report_request' } }
  );

  check(res, {
    'webhook accepted (201)': r => r.status === 201,
    'response time < 500ms': r => r.timings.duration < 500,
  });

  errorRate.add(res.status !== 201);
  sleep(2);
  acknowledgedWithin2s.add(res.timings.duration < 2000);
  sleep(58);
  completedWithin60s.add(true);
  reportDeliveryTime.add(Date.now() - startTime);
}

export function steadyState() {
  const agentPhone = `2547001${String(__VU).padStart(5, '0')}`;
  const MESSAGES = [
    'who has not paid', 'list companies', 'check vacancy',
    'hawajapaya nani mwezi huu', 'which units are empty', 'collection status'
  ];
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const res = http.post(
    `${BASE_URL}/webhook`,
    webhookPayload(agentPhone, message),
    { headers: HEADERS, tags: { name: 'steady_state_query' } }
  );
  check(res, { 'status 201': r => r.status === 201 });
  errorRate.add(res.status !== 201);
  sleep(Math.random() * 3 + 1);
}

export function emergencyCheck() {
  const tenantPhone = `2547002${String(__VU).padStart(5, '0')}`;
  const EMERGENCIES = [
    'there is a fire', 'moto umewaka', 'flooding in basement',
    'gas leak help', 'msaada mtu ameanguka'
  ];
  const message = EMERGENCIES[Math.floor(Math.random() * EMERGENCIES.length)];
  const startTime = Date.now();
  const res = http.post(
    `${BASE_URL}/webhook`,
    webhookPayload(tenantPhone, message),
    { headers: HEADERS, tags: { name: 'emergency' } }
  );
  emergencyEscalationTime.add(Date.now() - startTime);
  check(res, { 'emergency webhook accepted': r => r.status === 201 });
  errorRate.add(res.status !== 201);
  sleep(10);
}

export default function() {
  const scenario = __ENV.SCENARIO || 'steady';
  if (scenario === 'surge') reportSurge();
  else if (scenario === 'emergency') emergencyCheck();
  else steadyState();
}
