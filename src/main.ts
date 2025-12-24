import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Establecer prefijo global para todas las rutas
  app.setGlobalPrefix('api');
  
  // Habilitar CORS para permitir peticiones desde el frontend en desarrollo local
  app.enableCors({
    origin: [
      'http://localhost:8100', // Ionic serve
      'http://localhost:4200', // Angular dev server
      'http://localhost:8080', // Capacitor
      'capacitor://localhost', // Capacitor iOS
      'ionic://localhost', // Capacitor Android
    ],
    credentials: true,
  });
  
  // Aumentar límite de payload para permitir imágenes base64
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
