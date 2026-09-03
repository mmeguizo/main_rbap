import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: parseLogLevel(process.env.LOG_LEVEL || 'info'),
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global validation - strips unknown fields, validates DTOs, etc.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());

  // all routes are prefixed with /api/v1
  app.setGlobalPrefix('api/v1');

  // SWAGGER AUTHENTICATION
  const swaggerEnabled = process.env.SWAGGER_ENABLED === 'true';
  const swaggerUser = process.env.SWAGGER_USER;
  const swaggerPassword = process.env.SWAGGER_PASSWORD;

  if (swaggerEnabled) {
    if (!swaggerUser || !swaggerPassword) {
      console.warn(
        'SWAGGER_ENABLED is true but SWAGGER_USER or SWAGGER_PASSWORD is not set. Swagger UI will be unprotected.',
      );
      throw new Error(
        'SWAGGER_ENABLED is true but SWAGGER_USER or SWAGGER_PASSWORD is not set. Please set these environment variables to enable Swagger UI authentication.',
      );
    }

    app.use(
      ['/api/docs', '/api/docs-json'],
      basicAuth({
        challenge: true,
        users: {
          [swaggerUser]: swaggerPassword,
        },
      }),
    );

    // Swagger setup
    const config = new DocumentBuilder()
      .setTitle('RBAP IDM API ENDPOINTS')
      .setDescription('Backend API for the RBAP IDM project')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Redirect root URL to Swagger docs
    app.getHttpAdapter().get('/', (req, res) => {
      res.redirect('/api/docs#/');
    });
  }

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
}

function parseLogLevel(level: string): ('log' | 'warn' | 'error' | 'verbose' | 'debug' | 'fatal')[] {
  const levels: Record<string, ('log' | 'warn' | 'error' | 'verbose' | 'debug' | 'fatal')[]> = {
    debug: ['debug', 'verbose', 'log', 'warn', 'error'],
    info: ['log', 'warn', 'error'],
    warn: ['warn', 'error'],
    error: ['error'],
  };
  return levels[level] ?? ['log', 'warn', 'error'];
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
