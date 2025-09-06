import { Controller, Get, Post, Body, Param, Delete, UseGuards, ConflictException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegisterDto } from '../auth/dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';


@ApiTags('用户')
@ApiBearerAuth('JWT')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 管理员创建用户
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async create(@Body() registerDto: RegisterDto) {
    const exist = await this.userService.findByUsername(registerDto.username);
    if (exist) throw new ConflictException('用户名已存在');

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    return this.userService.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      role: registerDto.role || 'user',
    });
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async findOne(@Param('id') id: number) {
    return this.userService.findById(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
