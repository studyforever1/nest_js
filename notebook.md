git add .
git commit -m "9.11,新增聊天模块"
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
nest g res modules/user

# 创建模块文件夹
mkdir src/modules/calc

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