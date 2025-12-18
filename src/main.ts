import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Establecer prefijo global para todas las rutas
  app.setGlobalPrefix('api');
  
  // Habilitar CORS para permitir peticiones desde el frontend
  app.enableCors({
    origin: [
      'http://localhost:8100', // Ionic serve
      'http://localhost:4200', // Angular dev server
      'http://localhost:8080', // Capacitor
      'http://app4.local', // Producción nginx
      'capacitor://localhost', // Capacitor iOS
      'ionic://localhost', // Capacitor Android
    ],
    credentials: true,
  });
  
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
