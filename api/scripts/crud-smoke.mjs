#!/usr/bin/env node

const API_BASE_URL = process.env.AEDRA_API_URL || process.env.SMOKE_API_URL || "http://localhost:3001";
const EMAIL = process.env.SMOKE_EMAIL || "admin@pwanimanagement.co.ke";
const PASSWORD = process.env.SMOKE_PASSWORD || "Aedra@2026";

const state = {
  token: "",
  created: {
    paymentId: null,
    expenseId: null,
    unitId: null,
    landlordId: null,
    tenantId: null,
    propertyId: null,
  },
  existing: {
    leaseId: null,
  },
};

function logStep(label) {
  console.log(`\n[STEP] ${label}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token && !headers.Authorization) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const detail = json?.message || json?.error || text || `HTTP ${response.status}`;
    throw new Error(`${options.method || "GET"} ${path} failed: ${detail}`);
  }

  return json;
}

async function login() {
  logStep("Login");
  const data = await api("/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
    headers: { Authorization: undefined },
  });

  assert(data?.accessToken, "Login response missing accessToken");
  state.token = data.accessToken;
  console.log(`[OK] Logged in as ${EMAIL}`);
}

async function readSanity() {
  logStep("Read sanity checks");
  const endpoints = [
    "/me",
    "/properties",
    "/tenants",
    "/landlords",
    "/units",
    "/expenses",
    "/leases",
    "/payments",
  ];

  for (const endpoint of endpoints) {
    const data = await api(endpoint);
    if (endpoint === "/leases" && Array.isArray(data) && data.length > 0) {
      state.existing.leaseId = data[0].id;
    }
    console.log(`[OK] GET ${endpoint}`);
  }
}

async function propertyCrud() {
  logStep("Property CRUD");
  const created = await api("/properties", {
    method: "POST",
    body: {
      name: `Smoke Property ${Date.now()}`,
      address: "Smoke Address",
    },
  });
  state.created.propertyId = created.id;
  console.log(`[OK] Created property ${created.id}`);

  await api(`/properties/${created.id}`, {
    method: "PATCH",
    body: { name: `${created.name} Updated` },
  });
  console.log(`[OK] Updated property ${created.id}`);
}

async function tenantCrud() {
  logStep("Tenant CRUD");
  const created = await api("/tenants", {
    method: "POST",
    body: {
      firstName: "Smoke",
      lastName: `Tenant-${Date.now()}`,
      email: `smoke.tenant.${Date.now()}@example.com`,
    },
  });
  state.created.tenantId = created.id;
  console.log(`[OK] Created tenant ${created.id}`);

  await api(`/tenants/${created.id}`, {
    method: "PATCH",
    body: { firstName: "SmokeUpdated" },
  });
  console.log(`[OK] Updated tenant ${created.id}`);
}

async function landlordCrud() {
  logStep("Landlord CRUD");
  const created = await api("/landlords", {
    method: "POST",
    body: {
      firstName: "Smoke",
      lastName: `Landlord-${Date.now()}`,
      email: `smoke.landlord.${Date.now()}@example.com`,
    },
  });
  state.created.landlordId = created.id;
  console.log(`[OK] Created landlord ${created.id}`);

  await api(`/landlords/${created.id}`, {
    method: "PATCH",
    body: { firstName: "SmokeUpdated" },
  });
  console.log(`[OK] Updated landlord ${created.id}`);
}

async function unitCrud() {
  logStep("Unit CRUD");
  assert(state.created.propertyId, "Property required before creating unit");

  const created = await api("/units", {
    method: "POST",
    body: {
      unitNumber: `SM-${Date.now().toString().slice(-5)}`,
      propertyId: state.created.propertyId,
      rentAmount: 12345,
    },
  });
  state.created.unitId = created.id;
  console.log(`[OK] Created unit ${created.id}`);

  await api(`/units/${created.id}`, {
    method: "PATCH",
    body: { rentAmount: 23456 },
  });
  console.log(`[OK] Updated unit ${created.id}`);
}

async function expenseCrud() {
  logStep("Expense CRUD");
  const created = await api("/expenses", {
    method: "POST",
    body: {
      description: `Smoke expense ${Date.now()}`,
      amount: 4567,
      propertyId: state.created.propertyId || undefined,
      unitId: state.created.unitId || undefined,
    },
  });
  state.created.expenseId = created.id;
  console.log(`[OK] Created expense ${created.id}`);

  await api(`/expenses/${created.id}`, {
    method: "PATCH",
    body: { amount: 5678 },
  });
  console.log(`[OK] Updated expense ${created.id}`);
}

async function paymentCrud() {
  logStep("Payment/Invoice CRUD");
  if (!state.existing.leaseId) {
    console.log("[SKIP] No lease found; skipped payment CRUD.");
    return;
  }

  const created = await api("/payments", {
    method: "POST",
    body: {
      leaseId: state.existing.leaseId,
      amount: 7890,
      method: "MPESA",
      type: "RENT",
      reference: `SMOKE-${Date.now()}`,
    },
  });
  state.created.paymentId = created.id;
  console.log(`[OK] Created payment ${created.id}`);

  await api(`/payments/${created.id}`, {
    method: "PATCH",
    body: { amount: 8901 },
  });
  console.log(`[OK] Updated payment ${created.id}`);
}

async function cleanup() {
  logStep("Cleanup");

  const order = [
    ["paymentId", "/payments"],
    ["expenseId", "/expenses"],
    ["unitId", "/units"],
    ["landlordId", "/landlords"],
    ["tenantId", "/tenants"],
    ["propertyId", "/properties"],
  ];

  for (const [key, path] of order) {
    const id = state.created[key];
    if (!id) continue;

    try {
      await api(`${path}/${id}`, { method: "DELETE" });
      console.log(`[OK] Deleted ${key} (${id})`);
    } catch (error) {
      console.log(`[WARN] Cleanup failed for ${key} (${id}): ${error.message}`);
    }
  }
}

async function run() {
  console.log(`CRUD smoke test against ${API_BASE_URL}`);

  try {
    await login();
    await readSanity();
    await propertyCrud();
    await tenantCrud();
    await landlordCrud();
    await unitCrud();
    await expenseCrud();
    await paymentCrud();
    console.log("\n[PASS] CRUD smoke test completed.");
  } catch (error) {
    console.error(`\n[FAIL] ${error.message}`);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

run();
