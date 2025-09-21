// modules/sjconfig/sjconfig.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SjconfigService } from './sj-config.service';
import { User } from '../user/entities/user.entity';

@ApiTags('烧结参数配置')
@Controller('sjconfig')
export class SjconfigController {
  constructor(private readonly sjconfigService: SjconfigService) {}

  // 获取最新参数组
  @Get('latest')
  @ApiOperation({ summary: '获取最新参数组' })
  async latest(
    @Query('userId') userId: number,
    @Query('moduleName') moduleName: string,
  ) {
    const user = { user_id: userId } as User;
    return this.sjconfigService.getLatestConfigByName(user, moduleName);
  }

  // 保存或更新完整参数组（原料/化学/其他参数）
  @Post('save')
  @ApiOperation({ summary: '保存参数组（原料/化学/其他参数）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 10 },
        moduleName: { type: 'string', example: '烧结计算模块' },
        ingredientLimits: {
          type: 'object',
          example: {
            '1': { low_limit: 8.0, top_limit: 15.0, lose_index: 1.0 },
            '2': { low_limit: 8.0, top_limit: 15.0, lose_index: 1.0 },
          },
        },
        chemicalLimits: {
          type: 'object',
          example: {
            TFe: { low_limit: 51.3, top_limit: 51.3 },
            SiO2: { low_limit: 5.0, top_limit: 8.0 },
          },
        },
        otherSettings: {
          type: 'object',
          example: {
            成本间距: 1,
            最优方案个数: 50,
            S残存系数: 0.3,
          },
        },
      },
      required: ['userId', 'moduleName'],
    },
  })
  async save(
    @Body()
    body: {
      userId: number;
      moduleName: string;
      ingredientLimits?: Record<string, any>;
      chemicalLimits?: Record<string, any>;
      otherSettings?: Record<string, any>;
    },
  ) {
    const user = { user_id: body.userId } as User;
    return this.sjconfigService.saveFullConfig(
      user,
      body.moduleName,
      body.ingredientLimits,
      body.chemicalLimits,
      body.otherSettings,
    );
  }

  // 保存选中原料列表
  @Post('save-ingredient')
  @ApiOperation({ summary: '保存选中原料序号到参数组' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 10 },
        moduleName: { type: 'string', example: '烧结计算模块' },
        ingredientParams: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2],
        },
      },
      required: ['userId', 'moduleName', 'ingredientParams'],
    },
  })
  async saveIngredient(
    @Body()
    body: {
      userId: number;
      moduleName: string;
      ingredientParams: number[];
    },
  ) {
    const user = { user_id: body.userId } as User;
    return this.sjconfigService.saveIngredientParams(
      user,
      body.moduleName,
      body.ingredientParams,
    );
  }
}
