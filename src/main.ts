import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { join } from 'path';
import { appConfig } from './config/app.config';
import { ValidationPipe } from '@nestjs/common';
import { DateTimeInterceptor } from './common/interceptors/date-time.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ========== CORS ==========
  app.enableCors(
    appConfig.server.cors || {
      origin: ['http://127.0.0.1:5501', 'http://localhost:5501'],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    },
  );

  // ========== 全局校验 ==========
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // ========== 全局拦截 & 异常 ==========
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new DateTimeInterceptor());
  
  app.useGlobalFilters(new AllExceptionsFilter());

  // ========== 静态资源 ==========
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger 静态资源（本地）
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/',
  });

  // ========== Swagger ==========
  const config = new DocumentBuilder()
    .setTitle('API Docs')
    .setDescription('用户管理模块接口文档')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customCssUrl: '/swagger/swagger-ui.css',
    customJs: [
      '/swagger/swagger-ui-bundle.js',
      '/swagger/swagger-ui-standalone-preset.js',
    ],
  });

  // ========== 启动 ==========
  const port = appConfig.server.port;
  await app.listen(port);
}

bootstrap();
