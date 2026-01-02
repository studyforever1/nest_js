import { Controller, Post, Get, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SBalanceCalcService } from './s-balance-calc.service';
import { StartTask1Dto } from './dto/start-task.dto';
import { ProgressDto2 } from './dto/progress.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';

@ApiBearerAuth('JWT')
@ApiTags('硫平衡计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('s-balance')
export class SBalanceCalcController {
  constructor(private readonly service: SBalanceCalcService) {}

  /**
   * 启动计算任务
   */
  @Post('start')
  @Permissions('s-balance:calc')
  @ApiOperation({ summary: '启动硫平衡计算任务' })
  @ApiOkResponseData(StartTask1Dto)
  @ApiErrorResponse()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async start(
    @CurrentUser() user: User,
    @Body() dto: StartTask1Dto,
  ) {
    return this.service.startTask(user, dto.calculateType);
  }

  /**
   * 查询任务进度
   */
  @Get('progress')
  @Permissions('s-balance:calc')
  @ApiOperation({ summary: '获取硫平衡计算任务进度/结果' })
  @ApiOkResponseData(ProgressDto2)
  @ApiErrorResponse()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async progress(@Query() query: ProgressDto2) {
    return this.service.getProgress(query.taskUuid);
  }
}
