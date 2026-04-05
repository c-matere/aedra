import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiPromptService } from './src/ai/ai-prompt.service';
import { UserRole } from './src/auth/roles.enum';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const aiPromptService = app.get(AiPromptService);

  const testCases = [
    {
      role: UserRole.UNIDENTIFIED,
      message: "I want to register my company 'Aedra Estates'",
    },
    {
      role: UserRole.UNIDENTIFIED,
      message: "How do I sign up?",
    }
  ];

  for (const tc of testCases) {
    console.log(`\n--- Testing Role: ${tc.role} | Message: "${tc.message}" ---`);
    try {
      const plan = await (aiPromptService as any).generateUnifiedPlan(
        tc.message,
        tc.role,
        { role: tc.role },
        []
      );
      console.log('Intent:', plan.intent);
      console.log('Steps:', JSON.stringify(plan.steps, null, 2));
      console.log('Immediate Response:', plan.immediateResponse);
      
      const hasRegisterTool = plan.steps.some((s: any) => s.tool === 'register_company');
      if (hasRegisterTool) {
        console.log('✅ SUCCESS: register_company tool found in plan.');
      } else {
        console.log('❌ FAILURE: register_company tool NOT found in plan.');
      }
    } catch (e) {
      console.error('Error during plan generation:', e.message);
    }
  }

  await app.close();
}

bootstrap();
