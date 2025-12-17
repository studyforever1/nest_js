import {
  Controller,
  Put,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

import { PriceProfitCalcService } from './price-profit-calc.service';
import { SavePriceProfitParamsDto } from './dto/save-price-profit-params.dto';

@ApiTags('现价成本与利润测算')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('currentPrice')
export class PriceProfitCalcController {
  constructor(
    private readonly calcService: PriceProfitCalcService,
  ) {}

  private readonly MODULE_NAME = '现价成本与利润测算';

  /**
   * 保存参数
   */
  @Put('save-params')
//   @Permissions('price-profit:calc')
  @ApiOperation({
    summary: '保存测算参数',
    description: '保存现价成本与利润测算所需的全部参数',
  })
  async saveParams(
    @CurrentUser() user: User,
    @Body() body: SavePriceProfitParamsDto,
  ) {
    return this.calcService.saveParams(
      user,
      this.MODULE_NAME,
      body,
    );
  }

  /**
   * 获取最新参数
   */
  @Get('latest-params')
//   @Permissions('price-profit:calc')
  @ApiOperation({
    summary: '获取最新参数',
  })
  async latestParams(@CurrentUser() user: User) {
    return this.calcService.getLatestParams(
      user,
      this.MODULE_NAME,
    );
  }

  /**
   * 启动计算并返回结果
   */
  @Post('start')
// @Permissions('price-profit:calc')
@ApiOperation({
  summary: '计算现价成本与利润',
  description: '从数据库读取参数并计算 localPrice 和 portPrice，返回结果',
})
async start(@CurrentUser() user: User) {
  return this.calcService.startCalculation(
    user,
    this.MODULE_NAME,
  );
}

}
