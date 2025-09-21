// modules/sjconfig/sjconfig.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SjconfigService {
  private readonly logger = new Logger(SjconfigService.name);

  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configRepo: Repository<ConfigGroup>,

    @InjectRepository(BizModule)
    private readonly moduleRepo: Repository<BizModule>,
  ) {}

  /** 获取最新参数组 */
  async getLatestConfigByName(user: User, moduleName: string) {
    try {
      this.logger.log(
        `获取最新参数组，userId=${user.user_id}, moduleName=${moduleName}`,
      );
      const module = await this.moduleRepo.findOne({
        where: { name: moduleName },
      });
      if (!module) {
        this.logger.warn(`模块 "${moduleName}" 不存在`);
        throw new Error(`模块 "${moduleName}" 不存在`);
      }

      const group = await this.configRepo.findOne({
        where: {
          user: { user_id: user.user_id },
          module: { module_id: module.module_id },
          is_latest: true,
        },
      });

      this.logger.log(`找到参数组: ${group ? '存在' : '不存在'}`);
      return group ? group.config_data : null;
    } catch (error) {
      this.logger.error('getLatestConfigByName 出错', error.stack);
      throw error;
    }
  }

  /** 保存完整参数组（原料/化学/其他） */
  async saveFullConfig(
    user: User,
    moduleName: string,
    ingredientLimits?: Record<string, any>,
    chemicalLimits?: Record<string, any>,
    otherSettings?: Record<string, any>,
  ) {
    try {
      this.logger.log(
        `保存完整参数组，userId=${user.user_id}, moduleName=${moduleName}`,
      );
      const module = await this.moduleRepo.findOne({
        where: { name: moduleName },
      });
      if (!module) {
        this.logger.warn(`模块 "${moduleName}" 不存在`);
        throw new Error(`模块 "${moduleName}" 不存在`);
      }

      let group = await this.configRepo.findOne({
        where: {
          user: { user_id: user.user_id },
          module: { module_id: module.module_id },
          is_latest: true,
        },
      });

      if (!group) {
        this.logger.log('未找到最新参数组，创建默认参数组');
        group = this.configRepo.create({
          user,
          module,
          group_name: '默认参数组',
          config_data: {},
          is_latest: true,
          is_shared: false,
        });
      }

      group.config_data = {
        ...((group.config_data as any) || {}),
        ...(ingredientLimits ? { ingredientLimits } : {}),
        ...(chemicalLimits ? { chemicalLimits } : {}),
        ...(otherSettings ? { otherSettings } : {}),
      };

      const savedGroup = await this.configRepo.save(group);
      this.logger.log('参数组保存成功');
      return savedGroup;
    } catch (error) {
      this.logger.error('saveFullConfig 出错', error.stack);
      throw error;
    }
  }

  /** 单独保存选中原料列表（ingredientParams）并保持 ingredientLimits 一致 */
  async saveIngredientParams(
    user: User,
    moduleName: string,
    ingredientParams: number[],
  ) {
    try {
      this.logger.log(
        `保存 ingredientParams，userId=${user.user_id}, moduleName=${moduleName}, params=${JSON.stringify(ingredientParams)}`,
      );

      // 查询模块
      const module = await this.moduleRepo.findOne({
        where: { name: moduleName },
      });
      if (!module) throw new Error(`模块 "${moduleName}" 不存在`);

      // 查询最新参数组
      let group = await this.configRepo.findOne({
        where: {
          user: { user_id: user.user_id },
          module: { module_id: module.module_id },
          is_latest: true,
        },
      });

      if (!group) {
        this.logger.log('未找到最新参数组，创建默认参数组');
        group = this.configRepo.create({
          user,
          module,
          group_name: '默认参数组',
          config_data: { ingredientParams: [], ingredientLimits: {} },
          is_latest: true,
          is_shared: false,
        });
      }

      // 保留原有 config_data
      const configData = { ...(group.config_data as any) };

      // 原有 ingredientLimits
      const oldLimits: Record<string, any> = configData.ingredientLimits || {};

      // 构建新的 ingredientLimits，保持和 ingredientParams 一致
      const newLimits: Record<string, any> = {};
      ingredientParams.forEach((idx) => {
        if (oldLimits[idx]) {
          newLimits[idx] = oldLimits[idx]; // 保留已有限值
        } else {
          // 新增序号，添加默认限值
          newLimits[idx] = { low_limit: 0, top_limit: 100, lose_index: 1 };
        }
      });

      // 更新 config_data
      group.config_data = {
        ...configData,
        ingredientParams,
        ingredientLimits: newLimits,
      };

      const savedGroup = await this.configRepo.save(group);
      this.logger.log('ingredientParams 保存成功，ingredientLimits 已同步');
      return savedGroup;
    } catch (error) {
      this.logger.error('saveIngredientParams 出错', error.stack);
      throw error;
    }
  }
}
