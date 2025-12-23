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
@ApiTags('外购球团经济性评价-计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('pellet-econ-calc')
export class PelletEconCalcController {
  constructor(private readonly pelletService: PelletEconCalcService) {}

  /** 启动任务 */
  @Post('start')
  @Permissions('pellet:calc')
  @ApiOperation({ summary: '启动球团经济性评价任务（可多任务并行）' })
  async start(
    @CurrentUser() user: User,
    @Body() dto: StartPelletEconCalcDto,
  ) {
    return this.pelletService.startTask(user, dto.calculateType);
  }

  /** 停止任务 */
  @Post('stop')
  @Permissions('pellet:calc')
  @ApiOperation({ summary: '停止球团经济性评价任务' })
  async stop(@Body() dto: StopPelletEconCalcDto) {
    return this.pelletService.stopTask(dto.taskUuid);
  }

  /** 查询单个任务进度 */
  @Get('progress/:task_id')
  @Permissions('pellet:calc')
  @ApiOperation({ summary: '查询单个任务进度，返回结果已映射球团名称' })
  async getTaskProgress(
    @Param('task_id') task_id: string,
    @Query() pagination: PelletEconPaginationDto,
  ) {
    return this.pelletService.fetchAndSaveProgress(task_id, pagination);
  }
}
