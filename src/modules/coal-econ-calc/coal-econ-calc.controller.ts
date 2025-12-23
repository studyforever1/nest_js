import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CoalEconCalcService } from './coal-econ-calc.service';
import {
  StartCoalEconCalcDto,
  StopCoalEconCalcDto,
  CoalEconPaginationDto,
} from './dto/coal-econ-calc.dto';

@ApiBearerAuth('JWT')
@ApiTags('喷吹煤经济性评价-计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('coal-econ-calc')
export class CoalEconCalcController {
  constructor(private readonly service: CoalEconCalcService) {}

  /** 启动任务 */
  @Post('start')
  @Permissions('coal:calc')
  @ApiOperation({ summary: '启动喷吹煤经济性评价任务' })
  async start(@CurrentUser() user: User, @Body() dto: StartCoalEconCalcDto) {
    return this.service.startTask(user, dto.calculateType);
  }

  /** 停止任务 */
  @Post('stop')
  @Permissions('coal:calc')
  @ApiOperation({ summary: '停止喷吹煤经济性评价任务' })
  async stop(@Body() dto: StopCoalEconCalcDto) {
    return this.service.stopTask(dto.taskUuid);
  }

  /** 查询任务进度 */
  @Get('progress/:task_id')
  @Permissions('coal:calc')
  @ApiOperation({ summary: '查询喷吹煤经济性任务进度（分页）' })
  async progress(
    @Param('task_id') taskId: string,
    @Query() pagination: CoalEconPaginationDto,
  ) {
    return this.service.fetchAndSaveProgress(taskId, pagination);
  }
}
