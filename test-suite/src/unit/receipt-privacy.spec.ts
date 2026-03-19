import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptService } from '../../../api/src/ai/receipt.service';

const GOLDEN_FIXTURES = {
  receipt_exact_payment: {
    input: {
      tenantName: 'Sarah Ali',
      unit: 'A1',
      property: 'Doe Plaza',
      amount: 128702,
      mpesaCode: 'QGH7821KNM',
      paymentDate: '2026-03-15',
      month: 'March 2026',
      agentName: 'James Ochieng',
    },
    requiredFields: [
      'Sarah Ali',
      '128,702',
      'QGH7821KNM',
      'March 2026',
      'A1',
    ],
    prohibitedContent: [
      'undefined',
      'null',
      'NaN',
      '[object Object]',
    ],
    maxLength: 500,
  },
  receipt_partial_payment: {
    input: {
      tenantName: 'John Mwangi',
      unit: '4B',
      amount: 15000,
      expectedAmount: 18000,
      mpesaCode: 'PRT1234567',
      paymentDate: '2026-03-14',
      month: 'March 2026',
    },
    requiredFields: [
      'John Mwangi',
      '15,000',
      'PRT1234567',
      '3,000', // shortfall
    ],
    mustContainPartialWarning: true,
    maxLength: 600,
  },
};

describe('ReceiptService — privacy & compliance', () => {
  let service: ReceiptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReceiptService],
    }).compile();

    service = module.get<ReceiptService>(ReceiptService);
  });

  it('generates exact payment receipt with all required fields', () => {
    const fixture = GOLDEN_FIXTURES.receipt_exact_payment;
    const receipt = service.generate(fixture.input as any);

    fixture.requiredFields.forEach(field => {
      expect(receipt).toContain(field);
    });

    fixture.prohibitedContent.forEach(bad => {
      expect(receipt).not.toContain(bad);
    });

    expect(receipt.length).toBeLessThanOrEqual(fixture.maxLength);
  });

  it('generates partial payment receipt with shortfall warning', () => {
    const fixture = GOLDEN_FIXTURES.receipt_partial_payment;
    const receipt = service.generate(fixture.input as any);

    fixture.requiredFields.forEach(field => {
      expect(receipt).toContain(field);
    });

    expect(receipt).toMatch(/partial|outstanding|balance|baki/i);
  });

  it('masks potential sensitive data (phone numbers) in tenant names', () => {
    const receipt = service.generate({
      tenantName: 'Sarah Ali +254712345678',
      unit: 'A1',
      amount: 1000,
      mpesaCode: 'XYZ',
      paymentDate: '2026-03-15',
      month: 'March 2026',
    });
    expect(receipt).toContain('[MASKED]');
    expect(receipt).not.toContain('254712345678');
  });

  it('EN receipt does not contain Swahili keywords', () => {
    const receipt = service.generate({
      ...GOLDEN_FIXTURES.receipt_exact_payment.input,
      language: 'en',
    } as any);
    expect(receipt).not.toMatch(/asante|pango|kitengo|mwezi/i);
  });

  it('SW receipt contains Swahili vocabulary', () => {
    const receipt = service.generate({
      ...GOLDEN_FIXTURES.receipt_exact_payment.input,
      language: 'sw',
    } as any);
    expect(receipt).toMatch(/risiti|malipo|asante|mwezi/i);
  });
});
