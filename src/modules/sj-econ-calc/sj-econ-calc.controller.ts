import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SjEconCalcService } from './sj-econ-calc.service';
import { StartEconCalcDto } from './dto/start-econ-calc.dto';
import { StopEconCalcDto } from './dto/stop-econ-calc.dto';
import { Param } from '@nestjs/common';
import { SJEconPaginationDto } from './dto/sj-econ-pagination.dto';

@ApiBearerAuth('JWT')
@ApiTags('烧结-经济性综合评价')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj/econ')
export class SjEconCalcController {
  constructor(private readonly econService: SjEconCalcService) {}

  /** 启动经济性综合评价（四任务并行） */
  @Post('start')
  @Permissions('sj:calc')
  @ApiOperation({ summary: '启动经济性综合评价（四评价法并行）' })
  async start(
    @CurrentUser() user: User,
    @Body() dto: StartEconCalcDto
  ) {
    return this.econService.startTasks(user, dto.calculateType);
  }

  /** 停止四个任务 */
  @Post('stop')
  @Permissions('sj:calc')
  @ApiOperation({ summary: '停止经济性综合评价（四任务全部停止）' })
  async stop(@Body() dto: StopEconCalcDto) {
    return this.econService.stopTasks(dto.taskUuids);
  }

  /** 查询单个任务进度（分页 + 排序） */
  @Get('progress/:task_id')
  @Permissions('sj:calc')
  @ApiOperation({ summary: '查询单个任务进度，支持分页和排序, 品位综合评价法按照单品位价格折算后(asc)排序,\
    单烧综合评价法按照烧结矿单品位价折算后(asc),铁水成本评价法按照生铁成本(asc),基准矿粉对比评价法按照与PB粉对比(asc)' })
  async getTaskProgress(
    @Param('task_id') task_id: string,
    @Query() pagination: SJEconPaginationDto
  ) {
    return this.econService.fetchAndSaveProgress(task_id, pagination);
  }
}