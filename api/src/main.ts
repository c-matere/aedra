import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { assertSessionSecretConfigured } from './auth/session-token';

async function bootstrap() {
  assertSessionSecretConfigured();
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
