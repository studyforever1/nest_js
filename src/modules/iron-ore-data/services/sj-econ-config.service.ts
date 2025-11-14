import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SjEconConfig } from '../entities/sj-econ-config.entity';
import { ConfigGroup } from '../../../database/entities/config-group.entity';
import { BizModule } from '../../../database/entities/biz-module.entity';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class SjEconConfigService {
  private readonly MODULE_NAME = '烧结原料经济性评价';

  constructor(
    @InjectRepository(SjEconConfig) private readonly repository: Repository<SjEconConfig>,
    @InjectRepository(ConfigGroup) private readonly configGroupRepo: Repository<ConfigGroup>,
    @InjectRepository(BizModule) private readonly moduleRepo: Repository<BizModule>,
  ) {}

  /**
   * 获取或创建用户的最新配置组
   */
  private async getOrCreateLatestConfigGroup(user: User): Promise<ConfigGroup> {
    const module = await this.moduleRepo.findOne({ where: { name: this.MODULE_NAME } });
    if (!module) {
      throw new BadRequestException(`模块 "${this.MODULE_NAME}" 不存在`);
    }

    let group = await this.configGroupRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { module_id: module.module_id },
        is_latest: true,
      },
    });

    if (!group) {
      group = this.configGroupRepo.create({
        user,
        module,
        config_data: {
          singleBurnSet: {
            原料成分设置: {},
            其他参数设置: {},
          },
          ironCostSet: {
            原料成分设置: {},
            其他参数设置: {},
            焦炭和煤成分设置: {},
          },
        },
        is_latest: true,
        is_shared: false,
      });
      group = await this.configGroupRepo.save(group);
    }

    return group;
  }

  /**
   * 获取最新参数组
   */
  async getLatestConfig(user: User) {
    const group = await this.getOrCreateLatestConfigGroup(user);
    const configData = group.config_data || {};
    
    return {
      singleBurnSet: configData.singleBurnSet || {
        原料成分设置: {},
        其他参数设置: {},
      },
      ironCostSet: configData.ironCostSet || {
        原料成分设置: {},
        其他参数设置: {},
        焦炭和煤成分设置: {},
      },
    };
  }

  /**
   * 修改 singleBurnSet 原料
   */
  async updateSingleBurnRawMaterial(user: User, materialKey: string, data: Record<string, any>) {
    const group = await this.getOrCreateLatestConfigGroup(user);
    const configData = group.config_data || {};
    
    if (!configData.singleBurnSet) {
      configData.singleBurnSet = { 原料成分设置: {}, 其他参数设置: {} };
    }
    if (!configData.singleBurnSet.原料成分设置) {
      configData.singleBurnSet.原料成分设置 = {};
    }

    configData.singleBurnSet.原料成分设置[materialKey] = data;
    group.config_data = configData;
    await this.configGroupRepo.save(group);

    return {
      singleBurnSet: configData.singleBurnSet,
    };
  }

  /**
   * 修改 singleBurnSet 其他参数
   */
  async updateSingleBurnOtherSettings(user: User, data: Record<string, any>) {
    const group = await this.getOrCreateLatestConfigGroup(user);
    const configData = group.config_data || {};
    
    if (!configData.singleBurnSet) {
      configData.singleBurnSet = { 原料成分设置: {}, 其他参数设置: {} };
    }

    configData.singleBurnSet.其他参数设置 = { ...configData.singleBurnSet.其他参数设置, ...data };
    group.config_data = configData;
    await this.configGroupRepo.save(group);

    return {
      singleBurnSet: configData.singleBurnSet,
    };
  }

  /**
   * 修改 ironCostSet 原料
   */
  async updateIronCostRawMaterial(user: User, materialKey: string, data: Record<string, any>) {
    const group = await this.getOrCreateLatestConfigGroup(user);
    const configData = group.config_data || {};
    
    if (!configData.ironCostSet) {
      configData.ironCostSet = { 原料成分设置: {}, 其他参数设置: {}, 焦炭和煤成分设置: {} };
    }
    if (!configData.ironCostSet.原料成分设置) {
      configData.ironCostSet.原料成分设置 = {};
    }

    configData.ironCostSet.原料成分设置[materialKey] = data;
    group.config_data = configData;
    await this.configGroupRepo.save(group);

    return {
      ironCostSet: configData.ironCostSet,
    };
  }

  /**
   * 修改 ironCostSet 其他参数
   */
  async updateIronCostOtherSettings(user: User, data: Record<string, any>) {
    const group = await this.getOrCreateLatestConfigGroup(user);
    const configData = group.config_data || {};
    
    if (!configData.ironCostSet) {
      configData.ironCostSet = { 原料成分设置: {}, 其他参数设置: {}, 焦炭和煤成分设置: {} };
    }

    configData.ironCostSet.其他参数设置 = { ...configData.ironCostSet.其他参数设置, ...data };
    group.config_data = configData;
    await this.configGroupRepo.save(group);

    return {
      ironCostSet: configData.ironCostSet,
    };
  }

  /**
   * 修改 ironCostSet 焦炭和煤参数
   */
  async updateIronCostCokeCoal(user: User, data: { 喷吹煤?: Record<string, any>; 焦炭?: Record<string, any> }) {
    const group = await this.getOrCreateLatestConfigGroup(user);
    const configData = group.config_data || {};
    
    if (!configData.ironCostSet) {
      configData.ironCostSet = { 原料成分设置: {}, 其他参数设置: {}, 焦炭和煤成分设置: {} };
    }
    if (!configData.ironCostSet.焦炭和煤成分设置) {
      configData.ironCostSet.焦炭和煤成分设置 = {};
    }

    if (data.喷吹煤) {
      configData.ironCostSet.焦炭和煤成分设置['喷吹煤'] = data.喷吹煤;
    }
    if (data.焦炭) {
      configData.ironCostSet.焦炭和煤成分设置['焦炭'] = data.焦炭;
    }

    group.config_data = configData;
    await this.configGroupRepo.save(group);

    return {
      ironCostSet: configData.ironCostSet,
    };
  }

  // 保留原有方法以兼容
  async findAll() { return await this.repository.find(); }
  async findOne(id: string) { return await this.repository.findOne({ where: { id } }); }
  async create(data: any) { const entity = this.repository.create(data); return await this.repository.save(entity); }
  async update(id: string, data: any) { await this.repository.update(id, data); return await this.findOne(id); }
  async remove(id: string) { await this.repository.delete(id); }
}
