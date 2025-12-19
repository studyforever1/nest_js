git add .
git commit -m "12.07"
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
mkdir src/modules/SysMenu

# 移动文件夹
mv src/calc/calc.module.ts src/modules/calc/
mv src/calc/calc.service.ts src/modules/calc/
mv src/calc/calc.controller.ts src/modules/calc/
mv src/calc/entities src/modules/calc/
mv src/calc/dto src/modules/calc/

# 接口文档
http://localhost:3000/api-docs 


nest g module modules/sj-econ-calc
nest g service modules/sj-econ-calc
nest g controller modules/sj-econ-calc

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


# 运行node脚本
npx ts-node -r tsconfig-paths/register src/init-permissions.ts

npm run build
npm run build:exe  


# 数据迁移
npm install typeorm -D
npm install @nestjs/typeorm typeorm mysql2

npx typeorm migration:create src/migrations/AddSomeTable src/database/database.module.ts

# 数据传到git
git创建新仓库
git init初始化
git remote add origin https://github.com/studyforever1/nest_js.git    
或 git remote set-url origin https://github.com/studyforever1/nest_js.git
git remote -v   如果显示如下表示连接成功 
origin  https://github.com/studyforever1/nest_js.git (fetch)
origin  https://github.com/studyforever1/nest_js.git (push)
就可以正常的上传代码了
git add .
git commit -m "12.07"
git push

