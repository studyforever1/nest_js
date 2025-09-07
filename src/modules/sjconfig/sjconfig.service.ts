// modules/sjconfig/sjconfig.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Module } from '../../database/entities/module.entity';

@Injectable()
export class SjconfigService {
  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configGroupRepo: Repository<ConfigGroup>,
  ) {}

  /** 保存参数组 */
  async saveConfig(user: User, moduleId: number, groupName: string, configData: any) {
    // 标记之前最新版本为 false
    await this.configGroupRepo.update(
      { user, module: { module_id: moduleId }, is_latest: true },
      { is_latest: false },
    );

    const group = this.configGroupRepo.create({
      user,
      module: { module_id: moduleId } as Module,
      group_name: groupName,
      config_data: configData,
      is_latest: true,
      is_shared: false,
    });

    return await this.configGroupRepo.save(group);
  }

  /** 获取用户最新参数组 */
  async getLatestConfig(user: User, moduleId: number) {
    const group = await this.configGroupRepo.findOne({
      where: { user, module: { module_id: moduleId }, is_latest: true },
    });
    if (!group) throw new NotFoundException('未找到最新参数组');
    return group;
  }

  /** 保存烧结原料序号到参数组 */
  async saveRawMaterialIndex(user: User, moduleId: number, rawIndexes: number[]) {
    const group = await this.getLatestConfig(user, moduleId);
    const config = group.config_data || {};
    config.rawMaterialIndexes = rawIndexes; // 保存原料序号
    group.config_data = config;
    return await this.configGroupRepo.save(group);
  }
}
