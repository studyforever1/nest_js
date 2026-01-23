# NestJS 加密打包与 License 管理系统 - 部署指南

## ✅ 已完成的功能

### 1. 配置管理系统
- ✅ 创建了 `src/config/app.config.ts` 配置加载器
- ✅ 支持外部配置文件 `config/config.json`
- ✅ 配置优先级：外部文件 > 环境变量 > 默认值
- ✅ 已更新所有模块使用外部配置：
  - 数据库配置 (`database.module.ts`)
  - JWT 配置 (`auth.module.ts`, `jwt.strategy.ts`)
  - API 地址 (`sj-calc.service.ts`)
  - 服务器端口和 CORS (`main.ts`)

### 2. License 生成工具
- ✅ `build/generate-license.js` - License 生成脚本
- ✅ 基于机器指纹（CPU + 硬盘 + 主板）生成 License
- ✅ AES-256-CBC 加密保护

### 3. 代码加密打包
- ✅ `build/encrypt.js` - 加密打包脚本
- ✅ 使用 `bytenode` 将 JS 转换为字节码
- ✅ 使用 `javascript-obfuscator` 混淆主文件
- ✅ 自动创建配置文件模板

### 4. License 验证
- ✅ 启动时自动验证 License
- ✅ 检查机器指纹匹配
- ✅ 检查过期时间

## 📋 使用步骤

### 步骤 1: 安装依赖（如果尚未安装）

```bash
cd systemV1/system_backend
npm install
```

确保以下依赖已安装：
- `bytenode` (已在 devDependencies)
- `javascript-obfuscator` (已在 devDependencies)

### 步骤 2: 生成 License

```bash
# 自动获取当前机器指纹并生成 License
npm run license:generate 2025-12-31

# 或使用指定的机器指纹
npm run license:generate 2025-12-31 <机器指纹>
```

这将生成 `license.lic` 文件。

### 步骤 3: 加密打包

```bash
npm run build:encrypt
```

此命令会：
1. 编译 TypeScript 代码 (`npm run build`)
2. 将 JS 文件转换为字节码
3. 混淆主入口文件
4. 创建配置文件模板 `config/config.json`

### 步骤 4: 配置外部文件

编辑 `config/config.json`：

```json
{
  "database": {
    "host": "localhost",
    "port": 3306,
    "username": "root",
    "password": "your_password",
    "database": "iron_cost_system123"
  },
  "api": {
    "fastApiUrl": "http://localhost:8000"
  },
  "jwt": {
    "secret": "your_secret_key_here"
  },
  "server": {
    "port": 3000,
    "cors": {
      "origin": ["http://127.0.0.1:5501", "http://localhost:5501"],
      "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
      "credentials": true
    }
  }
}
```

### 步骤 5: 启动应用

```bash
# 开发环境（未加密）
npm run start:dev

# 生产环境（未加密）
npm run start:prod

# 加密后的应用
npm run start:encrypted
```

## 📁 部署包结构

部署时需要包含以下文件：

```
deployment/
├── dist-encrypted/          # 加密后的代码
│   ├── main.js             # 混淆的入口文件
│   ├── main.jsc            # 字节码文件
│   └── ...                 # 其他加密文件
├── config/                  # 外部配置目录
│   └── config.json         # 运行时配置文件
├── license.lic              # License 文件
├── node_modules/            # 依赖包
├── package.json             # 项目配置
└── README.md                # 说明文档
```

## 🔧 配置文件说明

### config/config.json

所有配置项说明：

- **database**: 数据库配置
  - `host`: 数据库主机地址
  - `port`: 数据库端口
  - `username`: 数据库用户名
  - `password`: 数据库密码
  - `database`: 数据库名称

- **api**: API 配置
  - `fastApiUrl`: FastAPI 服务地址

- **jwt**: JWT 配置
  - `secret`: JWT 密钥

- **server**: 服务器配置
  - `port`: 应用监听端口
  - `cors`: CORS 配置
    - `origin`: 允许的来源
    - `methods`: 允许的 HTTP 方法
    - `credentials`: 是否允许携带凭证

## 🚀 快速开始

1. **生成 License**:
   ```bash
   npm run license:generate 2025-12-31
   ```

2. **加密打包**:
   ```bash
   npm run build:encrypt
   ```

3. **配置应用**:
   编辑 `config/config.json`

4. **启动应用**:
   ```bash
   npm run start:encrypted
   ```

## ⚠️ 注意事项

1. **License 文件**: 必须与目标机器的硬件指纹匹配
2. **配置文件**: 部署时确保 `config/config.json` 包含正确的配置
3. **依赖包**: 确保 `node_modules` 中包含 `bytenode`（运行时需要）
4. **端口冲突**: 确保配置的端口未被占用

## 🔍 故障排查

### License 验证失败
- 检查 `license.lic` 文件是否存在
- 确认机器指纹匹配（运行生成工具查看当前指纹）
- 检查 License 是否过期

### 配置文件不生效
- 确认 `config/config.json` 路径正确
- 检查 JSON 格式是否正确
- 重启应用以加载新配置

### 加密打包失败
- 确保已运行 `npm run build` 生成 `dist/` 目录
- 检查依赖是否已安装
- 查看错误日志

## 📝 相关文件

- `src/config/app.config.ts` - 配置加载器
- `build/generate-license.js` - License 生成工具
- `build/encrypt.js` - 加密打包脚本
- `src/common/license/license-check.ts` - License 验证逻辑
- `src/main.ts` - 应用入口（已启用 License 验证）

## 🎯 下一步

1. 测试加密打包流程
2. 验证 License 生成和验证功能
3. 测试外部配置文件加载
4. 准备部署包

---

**完成时间**: 2024年
**版本**: 1.0

