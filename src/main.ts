import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局启用 CORS
  app.enableCors({
    origin: ['http://127.0.0.1:5501', 'http://localhost:5501'], // 前端地址
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 全局验证管道
  app.useGlobalPipes(
    new (require('@nestjs/common').ValidationPipe)({
      whitelist: true, // 移除 DTO 中没有的字段
      forbidNonWhitelisted: false, // 不报错，允许额外字段
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger 配置
  const config = new DocumentBuilder()
    .setTitle('API Docs')
    .setDescription('用户管理模块接口文档')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT', // 这里的名字可以自定义
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();
