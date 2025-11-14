import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { verifyLicense } from './common/license/license-check';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// 1️⃣ 动态获取 .env 路径（pkg 打包后在 snapshot 内）
// pkg 打包后 snapshot 内无法直接访问 fs.readFileSync('.env')
const envPath = (() => {
  try {
    // 打包前（开发模式）
    const devPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(devPath)) return devPath;
  } catch {}
  try {
    // 打包后 exe 内存路径
    const snapshotPath = path.resolve(process.execPath, '../.env');
    if (fs.existsSync(snapshotPath)) return snapshotPath;
  } catch {}
  return null;
})();

if (envPath) {
  dotenv.config({ path: envPath });
  console.log('✅ 环境变量加载成功:', envPath);
} else {
  console.warn('⚠️ 未找到 .env 文件，使用系统环境变量');
}

async function bootstrap() {
  // verifyLicense(); // 启动前验证授权

  const app = await NestFactory.create(AppModule);

  // 启用 CORS
  app.enableCors({
    origin: ['http://127.0.0.1:5501', 'http://localhost:5501'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 全局验证、拦截、异常过滤
  app.useGlobalPipes(
    new (require('@nestjs/common').ValidationPipe)({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // =====================================================
  // Swagger 配置
  // =====================================================
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

  const customOptions: SwaggerCustomOptions = {
    customCssUrl: [
      'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css',
    ],
    customJs: [
      'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js',
      'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js',
    ],
  };

  SwaggerModule.setup('api-docs', app, document, customOptions);

  // =====================================================
  // 启动监听端口
  // =====================================================
  const port = 3000;
  await app.listen(port);

  const url = `http://localhost:${port}/api-docs`;
  console.log(`✅ 系统已启动！Swagger 文档地址：${url}`);

  // =====================================================
  // 自动打开浏览器（动态 import 方式，兼容 pkg）
  // =====================================================
  try {
    const openModule = await import('open'); // 动态导入 ESM
    const open = openModule.default;
    await open(url);
  } catch (err) {
    console.error('⚠️ 无法自动打开浏览器，请手动访问：', url);
  }
}

bootstrap();
