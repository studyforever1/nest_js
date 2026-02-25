import { Controller, Post, Get, Body, Query, Param, UseGuards,Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { MixCoalCalcService } from './mix-coal-calc.service';
import { StartMixCoalCalcDto, StopMixCoalCalcDto, MixCoalPaginationDto } from './dto/mix-coal-calc.dto';
import type { Response } from 'express';

@ApiBearerAuth('JWT')
@ApiTags('混合煤性价比计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('mix-coal-calc')
export class MixCoalCalcController {
  constructor(private readonly service: MixCoalCalcService) {}

  /** 启动计算任务 */
  @Post('start')
  @Permissions('mix-coal:calc')
  @ApiOperation({ summary: '启动混合煤性价比计算任务' })
  async start(@CurrentUser() user: User, @Body() dto: StartMixCoalCalcDto) {
    return this.service.startTask(user, dto.calculateType);
  }

  /** 停止计算任务 */
  @Post('stop')
  @Permissions('mix-coal:calc')
  @ApiOperation({ summary: '停止混合煤性价比计算任务' })
  async stop(@Body() dto: StopMixCoalCalcDto) {
    return this.service.stopTask(dto.taskUuid);
  }

  /** 查询任务进度 */
  @Get('progress/:task_id')
@Permissions('mix-coal:calc')
@ApiOperation({ summary: '查询混合煤性价比计算任务进度' })
async progress(
  @Param('task_id') taskId: string,
) {
  return this.service.fetchProgress(taskId);
}

@Get('export/:task_id')
@Permissions('mix-coal:calc')
@ApiOperation({ summary: '导出混合煤性价比计算结果为Excel' })
async export(
  @Param('task_id') taskId: string,
  @Res() res: Response, // express Response
) {
  // 直接调用 service，流写 Excel 完成后结束
  await this.service.exportResult(taskId, res);
  // ⚠️ 不 return，不要让 Nest 再尝试发送 JSON
}

}
