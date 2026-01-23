import * as fs from 'fs';
import * as path from 'path';

/**
 * 应用配置接口
 */
export interface AppConfig {
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  api: {
    fastApiUrl: string;
  };
  jwt: {
    secret: string;
  };
   // ✅ 新增 IM 配置
  im: {
    sdkAppId: number;
    secretKey: string;
    adminIdentifier: string; // 通常是 administrator
    userSigExpire?: number;
  };
  server: {
    port: number;
    cors?: {
      origin: string | string[];
      methods?: string;
      credentials?: boolean;
    };
  };
}

// 配置缓存
let configCache: AppConfig | null = null;

/**
 * 加载应用配置
 * 优先级: 外部配置文件 > 环境变量 > 默认值
 */
export function loadConfig(): AppConfig {
  if (configCache) {
    return configCache;
  }

  // 优先读取外部配置文件
  const configPath = path.resolve(process.cwd(), 'config', 'config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const configData = fs.readFileSync(configPath, 'utf-8');
      configCache = JSON.parse(configData);
      console.log('✅ 已加载外部配置文件:', configPath);
      return configCache!;
    } catch (error) {
      console.warn('⚠️  外部配置文件读取失败，使用环境变量:', (error as Error).message);
    }
  } else {
    console.log('ℹ️  外部配置文件不存在，使用环境变量');
  }

  // 回退到环境变量
  configCache = {
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '123456',
      database: process.env.DB_NAME || 'iron_cost_system1101',
    },
    api: {
      fastApiUrl: 'http://127.0.0.1:8000',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'your_secret_key123123',
    },
    im: {
    sdkAppId: 1600123207,
    secretKey: '1f7559e6c886a7e72f49207de9fa4c41cbccc6e09475deb220b554eac84f801d',
    adminIdentifier: 'administrator',
    userSigExpire: 86400,
  },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      cors: {
        origin: process.env.CORS_ORIGIN 
          ? process.env.CORS_ORIGIN.split(',') 
          : ['http://127.0.0.1:5501', 'http://localhost:5501'],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      },
    },
  };

  return configCache;
}

// 导出配置实例
export const appConfig = loadConfig();

