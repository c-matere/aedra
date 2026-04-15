import * as fs from 'fs';
import * as path from 'path';

// Mocking Prisma and NestJS Decorators to run standalone
class Logger {
  log(m: string) {
    console.log(`[LOG] ${m}`);
  }
  warn(m: string) {
    console.warn(`[WARN] ${m}`);
  }
  error(m: string) {
    console.error(`[ERROR] ${m}`);
  }
}

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'bench-fixtures.json'), 'utf8'),
);

const mockPrisma: any = {
  tenant: {
    findFirst: async ({ where }: any) => {
      const q = where;
      return fixtures.tenants.find((t: any) => {
        if (q.id && t.id !== q.id) return false;
        if (q.OR) {
          // Very basic OR mock for findFirst
          return q.OR.some((cond: any) => {
            if (
              cond.firstName?.equals &&
              t.firstName.toLowerCase() === cond.firstName.equals.toLowerCase()
            )
              return true;
            if (
              cond.lastName?.equals &&
              t.lastName.toLowerCase() === cond.lastName.equals.toLowerCase()
            )
              return true;
            return false;
          });
        }
        return false;
      });
    },
    findMany: async ({ where }: any) => {
      return fixtures.tenants.filter((t: any) => {
        if (where.OR) {
          return where.OR.some((cond: any) => {
            if (
              cond.firstName?.contains &&
              t.firstName
                .toLowerCase()
                .includes(cond.firstName.contains.toLowerCase())
            )
              return true;
            if (
              cond.lastName?.contains &&
              t.lastName
                .toLowerCase()
                .includes(cond.lastName.contains.toLowerCase())
            )
              return true;
            if (
              cond.email?.contains &&
              t.email?.toLowerCase().includes(cond.email.contains.toLowerCase())
            )
              return true;
            return false;
          });
        }
        return true;
      });
    },
    count: async ({ where }: any) => {
      return fixtures.tenants.filter((t: any) => t.id === where.id).length;
    },
  },
  unit: {
    findFirst: async ({ where }: any) => {
      return fixtures.units.find((u: any) => {
        if (
          where.unitNumber?.equals &&
          u.unitNumber.toLowerCase() === where.unitNumber.equals.toLowerCase()
        )
          return true;
        return false;
      });
    },
    findMany: async ({ where }: any) => {
      return fixtures.units.filter((u: any) => {
        if (where.OR) {
          return where.OR.some((cond: any) => {
            if (
              cond.unitNumber?.contains &&
              u.unitNumber
                .toLowerCase()
                .includes(cond.unitNumber.contains.toLowerCase())
            )
              return true;
            return false;
          });
        }
        return true;
      });
    },
    count: async ({ where }: any) => {
      return fixtures.units.filter((u: any) => u.id === where.id).length;
    },
  },
  property: {
    findFirst: async ({ where }: any) => {
      return fixtures.properties.find((p: any) =>
        p.name.toLowerCase().includes(where.name.contains.toLowerCase()),
      );
    },
    count: async ({ where }: any) => {
      return fixtures.properties.filter((p: any) => p.id === where.id).length;
    },
  },
};

// Import the service (using require to avoid transpilation issues in some environments)
const { AiEntityResolutionService } = require('./ai-entity-resolution.service');
const service = new AiEntityResolutionService(mockPrisma);

async function runTests() {
  console.log('--- STARTING DIAGNOSTIC ---');

  const testCases = [
    { type: 'unit', q: 'B4', expected: 'unit-b4-uuid' },
    { type: 'unit', q: 'Unit B4', expected: 'unit-b4-uuid' },
    { type: 'unit', q: 'unit-b4-uuid', expected: 'unit-b4-uuid' },
    { type: 'tenant', q: 'Fatuma Ali', expected: 'tenant-fatuma-ali-uuid' },
    { type: 'tenant', q: 'Fatuma', expected: 'tenant-fatuma-ali-uuid' },
    { type: 'tenant', q: 'Ali', expected: 'tenant-fatuma-ali-uuid' },
    { type: 'property', q: 'Palm Grove', expected: 'prop-palm-grove-uuid' },
  ];

  for (const tc of testCases) {
    const result = await service.resolveId(
      tc.type as any,
      tc.q,
      'bench-company-001',
    );
    const passed = result === tc.expected;
    console.log(
      `[${passed ? 'PASS' : 'FAIL'}] ${tc.type} "${tc.q}" -> ${JSON.stringify(result)} (Expected: ${tc.expected})`,
    );
  }

  // Test Ambiguity
  console.log('\n--- TESTING AMBIGUITY ---');
  // Add a fake unit to trigger ambiguity
  fixtures.units.push({
    id: 'unit-b44-uuid',
    unitNumber: 'B44',
    propertyId: 'prop-palm-grove-uuid',
  });
  const ambigResult = await service.resolveId(
    'unit',
    'B4',
    'bench-company-001',
  );
  // Wait, B4 should still match B4 exactly if I implemented strict filtering safely.
  console.log(
    `[INFO] unit "B4" with B4 and B44 in DB -> ${JSON.stringify(ambigResult)}`,
  );

  if (typeof ambigResult === 'string' && ambigResult === 'unit-b4-uuid') {
    console.log('[PASS] Exact match "B4" prioritized over partial "B44"');
  } else {
    console.log('[FAIL] B4 should have correctly resolved to the exact match.');
  }

  console.log('--- DIAGNOSTIC COMPLETE ---');
}

runTests().catch(console.error);
