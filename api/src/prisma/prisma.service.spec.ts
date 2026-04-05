import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(() => {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:4543/test?schema=public';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('RLS Extension', () => {
    it('should bypass RLS if isRlsSecondary is true', async () => {
      const { tenantContext } = require('../common/tenant-context');
      const spy = jest.spyOn(service, '$transaction' as any);
      
      await tenantContext.run({ 
        userId: '1', 
        isSuperAdmin: true, 
        role: 'SUPER_ADMIN', 
        isRlsSecondary: true 
      }, async () => {
        // Mock the underlying model operation to avoid DB call
        (service as any).property.findUnique = jest.fn().mockResolvedValue({ id: '1' });
        await service.property.findUnique({ where: { id: '1' } });
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('should start a transaction if isRlsSecondary is not set', async () => {
      const { tenantContext } = require('../common/tenant-context');
      const { PrismaClient } = require('@prisma/client');
      const spy = jest.spyOn(PrismaClient.prototype, '$transaction').mockImplementation(async (callback: any) => {
        return callback(service); // Simulate transaction client
      });
      
      await tenantContext.run({ 
        userId: '1', 
        isSuperAdmin: true, 
        role: 'SUPER_ADMIN'
      }, async () => {
        // Mock the underlying model operation to avoid DB call
        (service as any).property.findUnique = jest.fn().mockResolvedValue({ id: '1' });
        await service.property.findUnique({ where: { id: '1' } });
      });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
