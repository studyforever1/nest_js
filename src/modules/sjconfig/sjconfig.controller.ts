// modules/sjconfig/sjconfig.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SjconfigService } from './sjconfig.service';
import { User } from '../../modules/user/entities/user.entity';

@ApiTags('烧结参数配置')
@Controller('sjconfig')
export class SjconfigController {
  constructor(private readonly sjconfigService: SjconfigService) {}

  @Post('save')
  @ApiOperation({ summary: '保存参数组' })
  async save(@Body() body: { userId: number; moduleId: number; groupName: string; configData: any }) {
    const user = { user_id: body.userId } as User;
    return this.sjconfigService.saveConfig(user, body.moduleId, body.groupName, body.configData);
  }

  @Get('latest')
  @ApiOperation({ summary: '获取最新参数组' })
  async latest(@Query('userId') userId: number, @Query('moduleId') moduleId: number) {
    const user = { user_id: userId } as User;
    return this.sjconfigService.getLatestConfig(user, moduleId);
  }

  @Post('save-raw-index')
  @ApiOperation({ summary: '保存烧结原料序号到参数组' })
  async saveRawIndex(@Body() body: { userId: number; moduleId: number; rawIndexes: number[] }) {
    const user = { user_id: body.userId } as User;
    return this.sjconfigService.saveRawMaterialIndex(user, body.moduleId, body.rawIndexes);
  }
}
