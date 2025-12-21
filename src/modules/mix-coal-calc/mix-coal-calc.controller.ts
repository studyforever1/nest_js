import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { MixCoalCalcService } from './mix-coal-calc.service';
import { StartMixCoalCalcDto, StopMixCoalCalcDto, MixCoalPaginationDto } from './dto/mix-coal-calc.dto';

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
  @ApiOperation({ summary: '查询混合煤性价比计算任务进度（分页）' })
  async progress(@Param('task_id') taskId: string, @Query() pagination: MixCoalPaginationDto) {
    return this.service.fetchProgress(taskId, pagination);
  }
}
