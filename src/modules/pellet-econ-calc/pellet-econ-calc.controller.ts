import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { PelletEconCalcService } from './pellet-econ-calc.service';
import { StartPelletEconCalcDto, StopPelletEconCalcDto, PelletEconPaginationDto } from './dto/pellet-econ-calc.dto';

@ApiBearerAuth('JWT')
@ApiTags('外购球团块矿经济性评价-计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('pellet-lump-econ-calc')
export class PelletEconCalcController {
  constructor(private readonly pelletService: PelletEconCalcService) {}

  /** 启动任务 */
  @Post('start')
  @ApiOperation({ summary: '启动球团块矿经济性评价任务（可多任务并行）' })
  async start(
    @CurrentUser() user: User,
    @Body() dto: StartPelletEconCalcDto,
  ) {
    return this.pelletService.startTask(user, dto.calculateType);
  }

  /** 启动港口球团块矿资源库评价任务 */
@Post('start-port-pellet-lump')
@Permissions('pellet:calc')
@ApiOperation({ summary: '启动港口球团块矿资源库评价任务（可多任务并行）' })
async startPortPelletLump(
  @CurrentUser() user: User,
  @Body() dto: StartPelletEconCalcDto,
) {
  return this.pelletService.startPortPelletLumpTask(user, dto.calculateType);
}

  

  /** 停止任务 */
  @Post('stop')
  @ApiOperation({ summary: '停止球团块矿经济性评价任务' })
  async stop(@Body() dto: StopPelletEconCalcDto) {
    return this.pelletService.stopTask(dto.taskUuid);
  }

  /** 查询单个任务进度 */
  @Get('progress/:task_id')
  @ApiOperation({ summary: '查询单个任务进度，返回结果已映射球团块矿名称' })
  async getTaskProgress(
    @Param('task_id') task_id: string,
    @Query() pagination: PelletEconPaginationDto,
  ) {
    return this.pelletService.fetchAndSaveProgress(task_id, pagination);
  }

  /** 获取港口球团块矿资源库评价任务进度 */
@Get('port-pellet-lump/progress/:task_id')
@Permissions('pellet:calc')
@ApiOperation({ summary: '获取港口球团块矿资源库评价任务进度' })
async getPortPelletLumpProgress(
  @Param('task_id') task_id: string,
    @Query() pagination: PelletEconPaginationDto,
) {
  return this.pelletService.fetchAndSavePortPelletLumpProgress(
    task_id,
    pagination,
  );
}

}
