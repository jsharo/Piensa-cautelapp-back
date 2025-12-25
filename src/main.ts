import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Establecer prefijo global para todas las rutas
  app.setGlobalPrefix('api');
  
  // Habilitar CORS para permitir peticiones desde el frontend
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://cautelapp.netlify.app', process.env.FRONTEND_URL] // Producción
    : [ // Desarrollo
        'http://localhost:8100',
        'http://localhost:8101',
        'http://localhost:4200',
        'http://localhost:8080',
        'capacitor://localhost',
        'ionic://localhost',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (como apps móviles)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // En producción, permitir todos los orígenes para apps móviles
      }
    },
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
