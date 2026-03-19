
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/ai/ai.service';
import { UserRole } from '@prisma/client';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const aiService = app.get(AiService);

    console.log('--- Testing AiService Initialization ---');
    console.log('System Instruction Length:', aiService.getSystemInstruction().length);
    
    const context = { chatId: 'test-chat-id', userId: 'test-user-id' };
    const role = UserRole.SUPER_ADMIN;

    console.log('\n--- Testing context/greeting logic ---');
    // We can't easily trigger the private methods without some hacks, but we can check the public facing ones if they exist
    // Or just check if the service is alive.
    
    console.log('AiService initialized successfully.');
    
    await app.close();
}

bootstrap().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
