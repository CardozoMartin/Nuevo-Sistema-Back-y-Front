import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Mismo prefijo que usa el frontend (VITE_API_URL / proxy de Vite).
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',') });
  // Rechaza campos desconocidos, convierte los tipos de los DTO y devuelve un solo
  // mensaje por campo. Ojo: class-validator corre los decoradores de abajo hacia arriba,
  // por eso en los DTO el @IsNotEmpty («Ingrese…») va último, pegado a la propiedad.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
