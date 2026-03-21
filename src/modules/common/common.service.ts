import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';

import { encrypt, decrypt } from 'src/common/utils/crypto.util';

@Injectable()
export class CommonService {
  constructor(
    @InjectRepository(ConfigGroup)
    private readonly configGroupRepo: Repository<ConfigGroup>,

    @InjectRepository(BizModule)
    private readonly bizModuleRepo: Repository<BizModule>,
  ) {}

  /**
   * 📤 导出（加密 .wz）
   */
  async exportConfig(moduleName: string, user: User) {
    if (!moduleName) {
      throw new BadRequestException('moduleName 不能为空');
    }

    if (!user?.user_id) {
      throw new BadRequestException('用户未登录');
    }

    // ✅ 查模块
    const module = await this.bizModuleRepo.findOne({
      where: { name: moduleName },
    });

    if (!module) {
      throw new BadRequestException(`模块 "${moduleName}" 不存在`);
    }

    // ✅ 查用户最新配置
    let group = await this.configGroupRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { module_id: module.module_id },
        is_latest: true,
        is_default: false,
      },
      relations: ['module', 'user'],
      order: { updated_at: 'DESC' },
    });

    // ✅ 没有 → 查默认
    if (!group) {
      const defaultGroup = await this.configGroupRepo.findOne({
        where: {
          module: { module_id: module.module_id },
          is_default: true,
        },
        order: { updated_at: 'DESC' },
      });

      if (!defaultGroup) {
        throw new BadRequestException('未找到默认配置');
      }

      group = defaultGroup;
    }

    // ✅ 构造数据
    const payload = {
      version: '1.0',
      moduleName: module.name,
      userId: user.user_id,
      data: group.config_data,
    };

    const json = JSON.stringify(payload);

    // 🔐 加密
    const encrypted = encrypt(json);

    return {
      fileName: `${module.name}_${user.username || user.user_id}.config`,
      content: encrypted,
    };
  }

  /**
   * 📥 导入（解密 .wz）
   */
async importConfig(
  file: Express.Multer.File,
  moduleName: string,
  user: User,
) {
  if (!file) {
    throw new BadRequestException('未上传文件');
  }

  if (!user?.user_id) {
    throw new BadRequestException('用户未登录');
  }

  // ✅ 1️⃣ 校验文件后缀
  const fileName = file.originalname || '';
  if (!fileName.endsWith('.config')) {
    throw new BadRequestException('仅支持 .config 文件');
  }

  // 🔓 2️⃣ 解密
  let decrypted: string;
  try {
    decrypted = decrypt(file.buffer.toString());
  } catch {
    throw new BadRequestException('文件解密失败（可能被篡改）');
  }

  // 📦 3️⃣ JSON 解析
  let data: any;
  try {
    data = JSON.parse(decrypted);
  } catch {
    throw new BadRequestException('文件内容非法');
  }

  // ✅ 4️⃣ 结构校验（防伪造 JSON）
  if (
    !data ||
    typeof data !== 'object' ||
    !data.version ||
    !data.moduleName ||
    !data.userId ||
    !data.data
  ) {
    throw new BadRequestException('文件结构非法');
  }

  // ✅ 5️⃣ 版本校验
  if (data.version !== '1.0') {
    throw new BadRequestException('文件版本不兼容');
  }

  // ✅ 6️⃣ 模块校验
  if (data.moduleName !== moduleName) {
    throw new BadRequestException('模块不一致');
  }

  // ✅ 7️⃣ 用户校验（防跨用户导入）
  if (data.userId !== user.user_id) {
    throw new BadRequestException('无权限导入该文件');
  }

  // ✅ 8️⃣ 数据校验（避免空/异常）
  if (!data.data || Object.keys(data.data).length === 0) {
    throw new BadRequestException('配置数据为空');
  }

  // ✅ 9️⃣ 查模块
  const module = await this.bizModuleRepo.findOne({
    where: { name: moduleName },
  });

  if (!module) {
    throw new BadRequestException('模块不存在');
  }

  // 🔁 10️⃣ 关闭旧配置
  await this.configGroupRepo.update(
    {
      user: { user_id: user.user_id },
      module: { module_id: module.module_id },
      is_latest: true,
    },
    { is_latest: false },
  );

  // 💾 11️⃣ 保存新配置
  const group = this.configGroupRepo.create({
    module,
    user,
    config_data: data.data,
    is_latest: true,
    is_default: false,
  });

  await this.configGroupRepo.save(group);

  return {
    message: '导入成功',
    groupId: group.group_id,
  };
}
}