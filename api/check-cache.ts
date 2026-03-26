import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const cacheManager = app.get(CACHE_MANAGER);
  
  const chatId = process.argv[2];
  if (!chatId) {
    console.log('Usage: npx ts-node check-cache.ts <chatId>');
    await app.close();
    return;
  }

  const identity = await cacheManager.get(`ai_session:${chatId}:identity`);
  const context = await cacheManager.get(`ai_session:${chatId}:context`);
  
  console.log('IDENTITY LOCK:', JSON.stringify(identity, null, 2));
  console.log('CONTEXT MEMORY:', JSON.stringify(context, null, 2));
  
  await app.close();
}

bootstrap();
