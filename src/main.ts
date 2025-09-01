import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger 配置
  const config = new DocumentBuilder()
    .setTitle('User Management API')
    .setDescription('用户管理模块接口文档')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();
