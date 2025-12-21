import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { LumpEconCalcService } from './lump-econ-calc.service';
import { StartLumpEconCalcDto, StopLumpEconCalcDto, LumpEconPaginationDto } from './dto/lump-econ-calc.dto';

@ApiBearerAuth('JWT')
@ApiTags('块矿-经济性评价')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('lump-econ-calc')
export class LumpEconCalcController {
  constructor(private readonly service: LumpEconCalcService) {}

  /** 启动任务 */
  @Post('start')
  @Permissions('lump:calc')
  @ApiOperation({ summary: '启动块矿经济性评价任务' })
  async start(@CurrentUser() user: User, @Body() dto: StartLumpEconCalcDto) {
    return this.service.startTask(user, dto.calculateType);
  }

  /** 停止任务 */
  @Post('stop')
  @Permissions('lump:calc')
  @ApiOperation({ summary: '停止块矿经济性评价任务' })
  async stop(@Body() dto: StopLumpEconCalcDto) {
    return this.service.stopTask(dto.taskUuid);
  }

  /** 查询任务进度 */
  @Get('progress/:task_id')
  @Permissions('lump:calc')
  @ApiOperation({ summary: '查询块矿经济性任务进度，返回分页结果' })
  async getProgress(
    @Param('task_id') task_id: string,
    @Query() pagination: LumpEconPaginationDto
  ) {
    return this.service.fetchAndSaveProgress(task_id, pagination);
  }
}
