import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  // Orígenes permitidos. Se pueden sobrescribir desde Render con la variable
  // CORS_ORIGINS (separados por coma). Si no, se usan estos por defecto.
  const defaultOrigins = [
    'http://localhost:5173',                              // desarrollo local (Vite)
    'https://sistema-ventas-frontend-one.vercel.app',     // frontend en Vercel
  ];
  const envOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

  app.enableCors({
    origin: allowedOrigins,
    credentials: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // elimina campos no declarados en DTOs
    forbidNonWhitelisted: true, 
    transform: true,          
  }));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  // '0.0.0.0' = escuchar en todas las interfaces (necesario en Render/contenedores).
  await app.listen(port, '0.0.0.0');
  console.log(`API corriendo en el puerto ${port}`);
}
bootstrap();
