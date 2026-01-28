import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ConflictException, UploadedFile, UseInterceptors
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiTags, ApiOperation, ApiResponse,
  ApiParam, ApiBody, ApiConsumes
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { RoleService } from '../role/role.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { UserPaginationDto } from './dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('用户')
@ApiBearerAuth('JWT')
@Controller('user')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  /* ======================== 用户管理 ======================== */

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '管理员创建用户' })
  @ApiBody({ type: CreateUserDto })
  async create(@Body() dto: CreateUserDto) {
    const exist = await this.userService.findByUsername(dto.username);
    if (exist) throw new ConflictException('用户名已存在');

    const password = await bcrypt.hash(dto.password, 10);
    const roleCodes = dto.roles?.length ? dto.roles : ['user'];
    const roles = await this.roleService.findByCodes(roleCodes);

    return this.userService.create({
      username: dto.username,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      avatarPath: dto.avatarPath,
      password,
      is_active: dto.is_active ?? true,
      roles,
      departmentId: dto.departmentId,
    });
  }

  @Get()
  @Roles('admin')
  async findAll(@Query() query: UserPaginationDto) {
    return this.userService.queryUsers({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      keyword: query.keyword,
    });
  }

  @Get(':id')
  @Roles('admin')
  async findOne(@Param('id') id: number) {
    return this.userService.findById(id);
  }

  @Put(':id')
  @Roles('admin')
  async update(@Param('id') id: number, @Body() dto: UpdateUserDto) {
    if (dto.username) {
      const exist = await this.userService.findByUsername(dto.username);
      if (exist && exist.user_id !== id) {
        throw new ConflictException('用户名已存在');
      }
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    let roles;
    if (dto.roles) {
      roles = await this.roleService.findByCodes(dto.roles);
    }

    return this.userService.update(id, { ...dto, roles, departmentId: dto.departmentId });
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }

  /* ======================== 个人中心 ======================== */

  @Get('profile/me')
  async getProfile(@CurrentUser() user) {
    return this.userService.findById(user.user_id);
  }

  @Put('profile/me')
  async updateProfile(
    @CurrentUser() user,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.user_id, dto);
  }

  @Post('profile/avatar')
@ApiOperation({ summary: '上传头像并自动删除旧头像' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
    },
  },
})
@UseInterceptors(
  FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const root = process.env.UPLOAD_PATH || './uploads';
        const dir = path.join(root, 'avatars');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `tmp-${Date.now()}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('仅支持图片'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }),
)
async uploadAvatar(
  @CurrentUser() user,
  @UploadedFile() file: Express.Multer.File,
) {
  const userId = user.user_id;
  const ext = path.extname(file.filename);
  const finalName = `avatar-${userId}-${Date.now()}${ext}`;
  const finalPath = path.join(path.dirname(file.path), finalName);

  fs.renameSync(file.path, finalPath);
  const avatarPath = path.relative(process.cwd(), finalPath).replace(/\\/g, '/');

  // 调用 service 更新头像并删除旧头像
  const avatarUrl = await this.userService.updateAvatar(userId, avatarPath);

  return { avatarPath, avatarUrl };
}

}
