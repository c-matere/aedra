import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { AiReadToolService } from './ai-read-tool.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitsService } from '../units/units.service';
import { ReportsService } from '../reports/reports.service';
import { EmbeddingsService } from './embeddings.service';
import { MenuRouterService } from './menu-router.service';
import { AiEntityResolutionService } from './ai-entity-resolution.service';
import { ConsistencyValidatorService } from './consistency-validator.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserRole } from '../auth/roles.enum';

describe('AiReadToolService (Mock Mode)', () => {
  let service: AiReadToolService;

  beforeEach(async () => {
    process.env.BENCH_MOCK_MODE = 'true';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiReadToolService,
        { provide: PrismaService, useValue: {} },
        { provide: UnitsService, useValue: {} },
        { provide: ReportsService, useValue: {} },
        { provide: EmbeddingsService, useValue: {} },
        { provide: MenuRouterService, useValue: {} },
        { provide: AiEntityResolutionService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
        { provide: ConsistencyValidatorService, useValue: {} },
      ],
    }).compile();

    service = module.get<AiReadToolService>(AiReadToolService);
    // Explicitly load mock fixtures
    await service.onModuleInit();
    if (!service['mockFixtures']) {
      // Manual fallback for test environment
      const fixturePath = path.join(
        process.cwd(),
        'src/ai/bench-fixtures.json',
      );
      service['mockFixtures'] = JSON.parse(
        fs.readFileSync(fixturePath, 'utf8'),
      );
    }
  });

  it('should find property by propertyId in mock mode', async () => {
    const result = await service.executeReadTool(
      'get_property_details',
      { propertyId: 'prop-palm-grove-uuid' },
      { companyId: 'bench-co', role: UserRole.SUPER_ADMIN },
      UserRole.SUPER_ADMIN,
      'en',
    );
    expect(result).toBeDefined();
    expect(result.id).toBe('prop-palm-grove-uuid');
    expect(result.name).toBe('Palm Grove');
  });

  it('should find unit by unitId (id) in mock mode', async () => {
    const result = await service.executeReadTool(
      'get_unit_details',
      { unitId: 'unit-a1-uuid' },
      { companyId: 'bench-co', role: UserRole.SUPER_ADMIN },
      UserRole.SUPER_ADMIN,
      'en',
    );
    expect(result).toBeDefined();
    expect(result.id).toBe('unit-a1-uuid');
  });

  it('should find unit by unitNumber in mock mode (fallback)', async () => {
    const result = await service.executeReadTool(
      'get_unit_details',
      { unitNumber: 'A1' },
      { companyId: 'bench-co', role: UserRole.SUPER_ADMIN },
      UserRole.SUPER_ADMIN,
      'en',
    );
    expect(result).toBeDefined();
    expect(result.unitNumber).toBe('A1');
  });
});
