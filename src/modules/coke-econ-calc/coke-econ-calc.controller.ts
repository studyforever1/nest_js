import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CokeEconCalcService } from './coke-econ-calc.service';
import { StartEconCalcDto } from './dto/start-coke-econ-calc.dto';
import { StopEconCalcDto } from './dto/stop-coke-econ-calc.dto';
import { SJEconPaginationDto } from './dto/coke-econ-pagination.dto';

@ApiBearerAuth('JWT')
@ApiTags('焦炭经济性评价-计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('coke-econ-calc')
export class CokeEconCalcController {
  constructor(private readonly cokeService: CokeEconCalcService) {}

  /** 启动任务 */
  @Post('start')
  @Permissions('coke:calc')
  @ApiOperation({ summary: '启动焦炭经济性评价任务（多任务并行）' })
  async start(
    @CurrentUser() user: User,
    @Body() dto: StartEconCalcDto
  ) {
    return this.cokeService.startTasks(user, dto.calculateType);
  }

  /** 停止任务 */
  @Post('stop')
  @Permissions('coke:calc')
  @ApiOperation({ summary: '停止焦炭经济性评价任务' })
  async stop(@Body() dto: StopEconCalcDto) {
    return this.cokeService.stopTasks(dto.taskUuids);
  }

  /** 查询单个任务进度 */
  @Get('progress/:task_id')
  @Permissions('coke:calc')
  @ApiOperation({ summary: '查询单个任务进度，支持分页,焦炭性价比评价法按照性价比指数(desc)排序；单烧综合评价法按照质量评分(desc)' })
  async getTaskProgress(
    @Param('task_id') task_id: string,
    @Query() pagination: SJEconPaginationDto
  ) {
    return this.cokeService.fetchAndSaveProgress(task_id, pagination);
  }
}
