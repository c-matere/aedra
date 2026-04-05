
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiReadToolService } from './src/ai/ai-read-tool.service';
import { UserRole } from './src/auth/roles.enum';

async function verifyMockPropertySelection() {
  process.env.BENCH_MOCK_MODE = 'true';
  const app = await NestFactory.createApplicationContext(AppModule);
  const readToolService = app.get(AiReadToolService);

  console.log('Testing get_property_details with propertyId...');
  const result = await readToolService.executeReadTool(
    'get_property_details',
    { propertyId: 'palm-grove-001' },
    { companyId: 'bench-co', role: UserRole.SUPER_ADMIN },
    UserRole.SUPER_ADMIN,
    'en'
  );

  console.log('Result:', JSON.stringify(result, null, 2));

  if (result && result.id === 'palm-grove-001') {
    console.log('SUCCESS: Property found by propertyId');
  } else {
    console.log('FAILURE: Property NOT found by propertyId');
    process.exit(1);
  }

  console.log('\nTesting get_unit_details with unitId...');
  const unitResult = await readToolService.executeReadTool(
    'get_unit_details',
    { unitId: 'palm-grove-001-a1' },
    { companyId: 'bench-co', role: UserRole.SUPER_ADMIN },
    UserRole.SUPER_ADMIN,
    'en'
  );
  console.log('Unit Result:', JSON.stringify(unitResult, null, 2));
  if (unitResult && (unitResult.id === 'palm-grove-001-a1' || unitResult.unitNumber === 'A1')) {
    console.log('SUCCESS: Unit found by unitId');
  } else {
    console.log('FAILURE: Unit NOT found by unitId');
    process.exit(1);
  }

  await app.close();
}

verifyMockPropertySelection().catch(err => {
  console.error(err);
  process.exit(1);
});
