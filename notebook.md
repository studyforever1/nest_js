git add .
git commit -m "9.30"
git push

npm run start

# 使用 eslint 进行代码检查和自动修复
$ npm run lint

# 使用 prettier 进行代码格式化
$ npm run format

# 安装 连接MYSQL所需连接的的框架
npm add @nestjs/typeorm typeorm mysql

# 创建项目 CRUD项目
nest g resource 

# 安装Graphql
npm i @nestjs/graphql @nestjs/apollo @apollo/server graphql

# 快速生成CRUD
nest g res modules/gl-material-info

# 创建模块文件夹
mkdir src/modules/history

# 移动文件夹
mv src/calc/calc.module.ts src/modules/calc/
mv src/calc/calc.service.ts src/modules/calc/
mv src/calc/calc.controller.ts src/modules/calc/
mv src/calc/entities src/modules/calc/
mv src/calc/dto src/modules/calc/

# 接口文档
http://localhost:3000/api-docs 


nest g module modules/chat
nest g service modules/chat
nest g controller modules/chat

# 打包
npm run build
npm install -g pkg
pkg dist/main.js --targets node18-win-x64 --output sintering-api.exe

--targets node18-win-x64 指定运行环境（可改为 linux-x64 或 macos-x64）
--output 指定输出文件名
dist/main.js 是 Nest 编译产物的入口

# 生成许可证
npm install ts-node -D
npx ts-node src/common/generate-license.ts 2026-01-01

