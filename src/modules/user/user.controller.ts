// user.controller.ts
import { Controller, Get, Post, Body, Param, Delete, UseGuards, ConflictException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { RoleService } from '../role/role.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserPaginationDto } from './dto/pagination.dto';
import * as bcrypt from 'bcryptjs';

@ApiTags('用户')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  /** 管理员创建用户 */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '管理员创建用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  async create(@Body() registerDto: RegisterDto) {
    const exist = await this.userService.findUsers({ username: registerDto.username });
    if (exist.total > 0) throw new ConflictException('用户名已存在');

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const roleNames = registerDto.roles && registerDto.roles.length > 0 ? registerDto.roles : ['user'];
    const roles = await this.roleService.findByNames(roleNames);

    return this.userService.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      roles,
    });
  }

  /** 查询用户列表（分页 + 模糊搜索） */
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: '查询用户列表（分页 + 模糊搜索）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'username', required: false })
  async queryUsers(@Query() query: UserPaginationDto) {
    return this.userService.findUsers(query);
  }

  /** 根据ID查询用户 */
  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: '根据ID查询用户' })
  @ApiParam({ name: 'id', description: '用户ID', example: 1 })
  async findOne(@Param('id') id: number) {
    return this.userService.findById(id);
  }

  /** 删除用户（软删除） */
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: '删除用户（软删除）' })
  @ApiParam({ name: 'id', description: '用户ID', example: 1 })
  async remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
