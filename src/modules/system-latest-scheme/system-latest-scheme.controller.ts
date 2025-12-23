import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { SystemLatestSchemeService } from './system-latest-scheme.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SetLatestSchemeDto } from './dto/set-latest-scheme.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('系统当日最新方案')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('system-latest-scheme')
export class SystemLatestSchemeController {
  constructor(private readonly service: SystemLatestSchemeService) {}

  @Post('set-today')
  @ApiOperation({ summary: '设置为系统当日最新方案（按模块类型唯一）' })
  setToday(
    @CurrentUser() user: User,
    @Body() body: SetLatestSchemeDto,
  ) {
    return this.service.setTodayLatest(
      user,
      body.taskUuid,
      body.schemeIndex,
      body.module_type,
    );
  }

  @Get('latest')
  @ApiOperation({ summary: '获取系统最新方案（默认当天，可选最近几天）' })
  @ApiQuery({ name: 'days', required: false, description: '最近几天，默认1天', type: Number })
  @ApiQuery({ name: 'module_type', required: false, description: '模块类型筛选', type: String })
  getLatest(
    @Query('days') days?: number,
    @Query('module_type') module_type?: string,
  ) {
    const daysNum = Number(days) || 1; // 默认当天最新
    return this.service.getRecentLatest(daysNum, module_type);
  }
}
