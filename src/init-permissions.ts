import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PermissionService } from './modules/permission/permission.service';
import { RoleService } from './modules/role/role.service';

async function initPermissions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const permissionService = app.get(PermissionService);
  const roleService = app.get(RoleService);

  console.log('开始初始化权限...');

  const permissions = [
    // ===================== 计算相关 =====================
    { permissionCode: 'calc:start', permissionName: '启动计算', description: '启动烧结计算任务' },
    { permissionCode: 'calc:stop', permissionName: '停止计算', description: '停止烧结计算任务' },
    { permissionCode: 'calc:details', permissionName: '查看计算详情', description: '查看计算任务进度和结果' },
    { permissionCode: 'calc:view', permissionName: '查看计算', description: '查看计算任务列表' },

    // ===================== 烧结矿粉化学成分典型值 =====================
    { permissionCode: 'sj-fines-chem-typ:create', permissionName: '创建烧结矿粉化学成分典型值', description: '创建新的烧结矿粉化学成分典型值记录' },
    { permissionCode: 'sj-fines-chem-typ:read', permissionName: '查看烧结矿粉化学成分典型值', description: '查看烧结矿粉化学成分典型值列表和详情' },
    { permissionCode: 'sj-fines-chem-typ:update', permissionName: '更新烧结矿粉化学成分典型值', description: '修改烧结矿粉化学成分典型值记录' },
    { permissionCode: 'sj-fines-chem-typ:delete', permissionName: '删除烧结矿粉化学成分典型值', description: '删除烧结矿粉化学成分典型值记录' },
    { permissionCode: 'sj-fines-chem-typ:import', permissionName: '导入烧结矿粉化学成分典型值', description: '从Excel文件导入烧结矿粉化学成分典型值数据' },
    { permissionCode: 'sj-fines-chem-typ:export', permissionName: '导出烧结矿粉化学成分典型值', description: '导出烧结矿粉化学成分典型值数据到Excel' },
    { permissionCode: 'sj-fines-chem-typ:statistics', permissionName: '查看烧结矿粉化学成分典型值统计', description: '查看烧结矿粉化学成分典型值统计信息' },

    // ===================== 主要矿山典型指标 =====================
    { permissionCode: 'mine-typ-ind:create', permissionName: '创建主要矿山典型指标', description: '创建新的主要矿山典型指标记录' },
    { permissionCode: 'mine-typ-ind:read', permissionName: '查看主要矿山典型指标', description: '查看主要矿山典型指标列表和详情' },
    { permissionCode: 'mine-typ-ind:update', permissionName: '更新主要矿山典型指标', description: '修改主要矿山典型指标记录' },
    { permissionCode: 'mine-typ-ind:delete', permissionName: '删除主要矿山典型指标', description: '删除主要矿山典型指标记录' },
    { permissionCode: 'mine-typ-ind:import', permissionName: '导入主要矿山典型指标', description: '从Excel文件导入主要矿山典型指标数据' },
    { permissionCode: 'mine-typ-ind:export', permissionName: '导出主要矿山典型指标', description: '导出主要矿山典型指标数据到Excel' },

    // ===================== 铁矿粉高温基础特性 =====================
    { permissionCode: 'lump-pellet-ht-prop:create', permissionName: '创建铁矿粉高温基础特性(块矿/球团)', description: '创建新的铁矿粉高温基础特性记录' },
    { permissionCode: 'lump-pellet-ht-prop:read', permissionName: '查看铁矿粉高温基础特性(块矿/球团)', description: '查看铁矿粉高温基础特性列表和详情' },
    { permissionCode: 'lump-pellet-ht-prop:update', permissionName: '更新铁矿粉高温基础特性(块矿/球团)', description: '修改铁矿粉高温基础特性记录' },
    { permissionCode: 'lump-pellet-ht-prop:delete', permissionName: '删除铁矿粉高温基础特性(块矿/球团)', description: '删除铁矿粉高温基础特性记录' },

    { permissionCode: 'fines-ht-base-prop:create', permissionName: '创建铁矿粉高温基础特性(粉矿)', description: '创建新的铁矿粉高温基础特性记录' },
    { permissionCode: 'fines-ht-base-prop:read', permissionName: '查看铁矿粉高温基础特性(粉矿)', description: '查看铁矿粉高温基础特性列表和详情' },
    { permissionCode: 'fines-ht-base-prop:update', permissionName: '更新铁矿粉高温基础特性(粉矿)', description: '修改铁矿粉高温基础特性记录' },
    { permissionCode: 'fines-ht-base-prop:delete', permissionName: '删除铁矿粉高温基础特性(粉矿)', description: '删除铁矿粉高温基础特性记录' },

    // ===================== 外购块矿/球团经济性评价 =====================
    { permissionCode: 'lump-econ-info:create', permissionName: '创建外购块矿成分价格信息', description: '创建新的外购块矿成分价格信息记录' },
    { permissionCode: 'lump-econ-info:read', permissionName: '查看外购块矿成分价格信息', description: '查看外购块矿成分价格信息列表和详情' },
    { permissionCode: 'lump-econ-info:update', permissionName: '更新外购块矿成分价格信息', description: '修改外购块矿成分价格信息记录' },
    { permissionCode: 'lump-econ-info:delete', permissionName: '删除外购块矿成分价格信息', description: '删除外购块矿成分价格信息记录' },

    { permissionCode: 'lump-econ-config:create', permissionName: '创建外购块矿经济性评价参数', description: '创建新的外购块矿经济性评价参数记录' },
    { permissionCode: 'lump-econ-config:read', permissionName: '查看外购块矿经济性评价参数', description: '查看外购块矿经济性评价参数列表和详情' },
    { permissionCode: 'lump-econ-config:update', permissionName: '更新外购块矿经济性评价参数', description: '修改外购块矿经济性评价参数记录' },
    { permissionCode: 'lump-econ-config:delete', permissionName: '删除外购块矿经济性评价参数', description: '删除外购块矿经济性评价参数记录' },

    { permissionCode: 'pellet-econ-info:create', permissionName: '创建外购球团成分价格信息', description: '创建新的外购球团成分价格信息记录' },
    { permissionCode: 'pellet-econ-info:read', permissionName: '查看外购球团成分价格信息', description: '查看外购球团成分价格信息列表和详情' },
    { permissionCode: 'pellet-econ-info:update', permissionName: '更新外购球团成分价格信息', description: '修改外购球团成分价格信息记录' },
    { permissionCode: 'pellet-econ-info:delete', permissionName: '删除外购球团成分价格信息', description: '删除外购球团成分价格信息记录' },

    { permissionCode: 'pellet-econ-config:create', permissionName: '创建外购球团经济性评价参数', description: '创建新的外购球团经济性评价参数记录' },
    { permissionCode: 'pellet-econ-config:read', permissionName: '查看外购球团经济性评价参数', description: '查看外购球团经济性评价参数列表和详情' },
    { permissionCode: 'pellet-econ-config:update', permissionName: '更新外购球团经济性评价参数', description: '修改外购球团经济性评价参数记录' },
    { permissionCode: 'pellet-econ-config:delete', permissionName: '删除外购球团经济性评价参数', description: '删除外购球团经济性评价参数记录' },

    // ===================== 喷吹煤经济性评价 =====================
    { permissionCode: 'coal-econ-config:create', permissionName: '创建喷吹煤经济性评价参数', description: '创建新的喷吹煤经济性评价参数记录' },
    { permissionCode: 'coal-econ-config:read', permissionName: '查看喷吹煤经济性评价参数', description: '查看喷吹煤经济性评价参数列表和详情' },
    { permissionCode: 'coal-econ-config:update', permissionName: '更新喷吹煤经济性评价参数', description: '修改喷吹煤经济性评价参数记录' },
    { permissionCode: 'coal-econ-config:delete', permissionName: '删除喷吹煤经济性评价参数', description: '删除喷吹煤经济性评价参数记录' },

    { permissionCode: 'coal-econ-info:create', permissionName: '创建喷吹煤成分价格信息', description: '创建新的喷吹煤成分价格信息记录' },
    { permissionCode: 'coal-econ-info:read', permissionName: '查看喷吹煤成分价格信息', description: '查看喷吹煤成分价格信息列表和详情' },
    { permissionCode: 'coal-econ-info:update', permissionName: '更新喷吹煤成分价格信息', description: '修改喷吹煤成分价格信息记录' },
    { permissionCode: 'coal-econ-info:delete', permissionName: '删除喷吹煤成分价格信息', description: '删除喷吹煤成分价格信息记录' },

    // ===================== 焦炭经济性评价 =====================
    { permissionCode: 'coke-econ-config:create', permissionName: '创建焦炭经济性评价参数', description: '创建新的焦炭经济性评价参数记录' },
    { permissionCode: 'coke-econ-config:read', permissionName: '查看焦炭经济性评价参数', description: '查看焦炭经济性评价参数列表和详情' },
    { permissionCode: 'coke-econ-config:update', permissionName: '更新焦炭经济性评价参数', description: '修改焦炭经济性评价参数记录' },
    { permissionCode: 'coke-econ-config:delete', permissionName: '删除焦炭经济性评价参数', description: '删除焦炭经济性评价参数记录' },

    { permissionCode: 'coke-econ-info:create', permissionName: '创建焦炭成分价格信息', description: '创建新的焦炭成分价格信息记录' },
    { permissionCode: 'coke-econ-info:read', permissionName: '查看焦炭成分价格信息', description: '查看焦炭成分价格信息列表和详情' },
    { permissionCode: 'coke-econ-info:update', permissionName: '更新焦炭成分价格信息', description: '修改焦炭成分价格信息记录' },
    { permissionCode: 'coke-econ-info:delete', permissionName: '删除焦炭成分价格信息', description: '删除焦炭成分价格信息记录' },

    // ===================== 烧结原料经济性评价 =====================
    { permissionCode: 'sj-econ-config:create', permissionName: '创建烧结原料经济性评价参数', description: '创建新的烧结原料经济性评价参数记录' },
    { permissionCode: 'sj-econ-config:read', permissionName: '查看烧结原料经济性评价参数', description: '查看烧结原料经济性评价参数列表和详情' },
    { permissionCode: 'sj-econ-config:update', permissionName: '更新烧结原料经济性评价参数', description: '修改烧结原料经济性评价参数记录' },
    { permissionCode: 'sj-econ-config:delete', permissionName: '删除烧结原料经济性评价参数', description: '删除烧结原料经济性评价参数记录' },

    { permissionCode: 'sj-econ-info:create', permissionName: '创建烧结原料经济性评价信息', description: '创建新的烧结原料经济性评价信息记录' },
    { permissionCode: 'sj-econ-info:read', permissionName: '查看烧结原料经济性评价信息', description: '查看烧结原料经济性评价信息列表和详情' },
    { permissionCode: 'sj-econ-info:update', permissionName: '更新烧结原料经济性评价信息', description: '修改烧结原料经济性评价信息记录' },
    { permissionCode: 'sj-econ-info:delete', permissionName: '删除烧结原料经济性评价信息', description: '删除烧结原料经济性评价信息记录' },

    // ===================== 港口含铁料信息 =====================
    { permissionCode: 'port-material-info:create', permissionName: '创建港口含铁料信息', description: '创建新的港口含铁料信息记录' },
    { permissionCode: 'port-material-info:read', permissionName: '查看港口含铁料信息', description: '查看港口含铁料信息列表和详情' },
    { permissionCode: 'port-material-info:update', permissionName: '更新港口含铁料信息', description: '修改港口含铁料信息记录' },
    { permissionCode: 'port-material-info:delete', permissionName: '删除港口含铁料信息', description: '删除港口含铁料信息记录' },
  ];

  try {
    // 创建或跳过已存在权限
    for (const perm of permissions) {
      const existing = await permissionService.findByCode(perm.permissionCode);
      if (!existing) {
        await permissionService.create(perm);
        console.log(`权限已创建: ${perm.permissionCode} - ${perm.permissionName}`);
      } else {
        console.log(`权限已存在: ${perm.permissionCode}`);
      }
    }

    // 给 admin 分配所有权限
    const adminRole = await roleService.findByCode('admin');
    if (adminRole) {
      await roleService.assignPermissionsToRole(
        'admin',
        permissions.map(p => p.permissionCode),
      );
      console.log('admin角色权限分配完成');
    } else {
      console.log('admin角色不存在');
    }

    console.log('权限初始化完成！');
  } catch (error) {
    console.error('权限初始化失败:', error);
  } finally {
    await app.close();
  }
}

initPermissions();
