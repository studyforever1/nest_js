import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import _ from 'lodash';
import { ApiResponse } from '../../common/response/response.dto';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class PriceProfitCalcService {
  private readonly logger = new Logger(PriceProfitCalcService.name);

  /** FastAPI 地址，可根据环境配置 */
  private readonly fastApiUrl = 'http://127.0.0.1:8000/currentPrice/start/';

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,

    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,
  ) {}

  // ============================================================
  // 公共工具方法（与 sjconfig 完全一致）
  // ============================================================

  async getDefaultGroup(moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    return this.configRepo.findOne({
      where: { module: { module_id: module.module_id }, is_default: true },
    });
  }

  async getOrCreateUserGroup(user: User, moduleName: string) {
    const module = await this.moduleRepo.findOne({ where: { name: moduleName } });
    if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

    let group = await this.configRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { module_id: module.module_id },
        is_latest: true,
        is_default: false,
      },
    });

    if (!group) {
      const defaultGroup = await this.getDefaultGroup(moduleName);
      if (!defaultGroup) throw new Error(`模块 "${moduleName}" 没有默认参数组`);

      this.logger.log(`用户无参数组，复制默认参数`);

      group = this.configRepo.create({
        user,
        module,
        config_data: _.cloneDeep(defaultGroup.config_data),
        is_latest: true,
        is_default: false,
      });

      await this.configRepo.save(group);
    }

    return group;
  }

  // ============================================================
  // 业务方法
  // ============================================================

  async getLatestParams(user: User, moduleName: string) {
    const group = await this.getOrCreateUserGroup(user, moduleName);
    return _.cloneDeep(group.config_data);
  }

  async saveParams(
    user: User,
    moduleName: string,
    params: {
      portPrice?: Record<string, number>;
      localPrice?: Record<string, number>;
      ingredientSet?: Record<string, any>;
      cokeSet?: Record<string, any>;
      resourceSet?: Record<string, any>;
      baseParaSet?: Record<string, number>;
      steelMakingParaSet?: Record<string, number>;
    },
  ) {
    const group = await this.getOrCreateUserGroup(user, moduleName);

    group.config_data = _.merge({}, group.config_data || {}, {
      ...(params.portPrice ? { portPrice: params.portPrice } : {}),
      ...(params.localPrice ? { localPrice: params.localPrice } : {}),
      ...(params.ingredientSet ? { ingredientSet: params.ingredientSet } : {}),
      ...(params.cokeSet ? { cokeSet: params.cokeSet } : {}),
      ...(params.resourceSet ? { resourceSet: params.resourceSet } : {}),
      ...(params.baseParaSet ? { baseParaSet: params.baseParaSet } : {}),
      ...(params.steelMakingParaSet ? { steelMakingParaSet: params.steelMakingParaSet } : {}),
    });

    return await this.configRepo.save(group);
  }

  // ============================================================
  // 调用 FastAPI 进行计算并返回结果
  // ============================================================

  async startCalculation(user: User, moduleName: string) {
  try {
    // 1️⃣ 获取最新参数组
    const group = await this.getOrCreateUserGroup(user, moduleName);
    const configData = _.cloneDeep(group.config_data);

    const results: Record<string, any> = {};

    // 2️⃣ 定义价格来源
    const priceSources: Array<'localPrice' | 'portPrice'> = ['localPrice', 'portPrice'];

    for (const source of priceSources) {
      if (!configData[source]) {
        this.logger.warn(`参数中没有 ${source}，跳过`);
        continue;
      }

      // 3️⃣ 构造 fullParams，替换 currentPrice
      const fullParams = _.merge({}, configData, {
        currentPrice: configData[source],
      });

      this.logger.debug(`调用 FastAPI 计算 (${source}) 参数: ${JSON.stringify(fullParams, null, 2)}`);

      try {
        const res = await axios.post(this.fastApiUrl, fullParams);
        if (res.data?.code === 0) {
          results[source] = res.data.data.result || res.data.data;
        } else {
          results[source] = { error: res.data?.message || '计算失败' };
        }
      } catch (err: any) {
        this.logger.error(`计算 ${source} 失败`, err);
        results[source] = { error: err?.message || '计算异常' };
      }
    }

    return ApiResponse.success(results);

  } catch (err: any) {
    this.logger.error('计算失败', err);
    return  ApiResponse.error('计算失败: ' + (err?.message || '未知错误'));
  }
}
}
