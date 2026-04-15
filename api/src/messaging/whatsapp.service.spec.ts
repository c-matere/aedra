import {
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  const originalEnv = process.env;
  const originalFetch = (global as any).fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.META_ACCESS_TOKEN = 'test-token';
    process.env.META_PHONE_NUMBER_ID = '12345';
  });

  afterEach(() => {
    process.env = originalEnv;
    (global as any).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeService() {
    const prismaMock: any = {
      company: { findUnique: jest.fn() },
      whatsAppLog: { create: jest.fn().mockResolvedValue({ id: 'log_1' }) },
    };
    return { service: new WhatsappService(prismaMock), prismaMock };
  }

  it('sendTextMessage rejects empty text', async () => {
    const { service } = makeService();
    await expect(
      service.sendTextMessage({ to: '254700000000', text: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendTextMessage throws on Meta non-2xx with details', async () => {
    const { service, prismaMock } = makeService();

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: { message: 'Invalid parameter', code: 131009 },
        }),
    });

    try {
      await service.sendTextMessage({ to: '254700000000', text: 'hi' });
      throw new Error('expected sendTextMessage to throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(InternalServerErrorException);
      const resp = typeof e.getResponse === 'function' ? e.getResponse() : null;
      const msg = resp?.message || '';
      expect(String(msg)).toContain('Invalid parameter');
      expect(String(msg)).toContain('code=131009');
    }

    expect(prismaMock.whatsAppLog.create).toHaveBeenCalledTimes(1);
  });

  it('sendInteractiveMessage throws on Meta non-2xx (no silent failure)', async () => {
    const { service } = makeService();

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    });

    await expect(
      service.sendInteractiveMessage({
        to: '254700000000',
        interactive: {
          type: 'button',
          body: { text: 'x' },
          action: { buttons: [] },
        },
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
