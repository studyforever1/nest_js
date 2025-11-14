import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PermissionService } from './modules/permission/permission.service';
import { RoleService } from './modules/role/role.service';

async function initPermissions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const permissionService = app.get(PermissionService);
  const roleService = app.get(RoleService);

  console.log('开始初始化权限...');

  // 定义计算相关权限
  const calcPermissions = [
    { code: 'calc:start', name: '启动计算', description: '启动烧结计算任务' },
    { code: 'calc:stop', name: '停止计算', description: '停止烧结计算任务' },
    { code: 'calc:details', name: '查看计算详情', description: '查看计算任务进度和结果' },
    { code: 'calc:view', name: '查看计算', description: '查看计算任务列表' }
  ];

  // 定义铁矿数据相关权限
  const ironOreDataPermissions = [
    // 烧结矿粉化学成分典型值权限
    { code: 'sj-fines-chem-typ:create', name: '创建烧结矿粉化学成分典型值', description: '创建新的烧结矿粉化学成分典型值记录' },
    { code: 'sj-fines-chem-typ:read', name: '查看烧结矿粉化学成分典型值', description: '查看烧结矿粉化学成分典型值列表和详情' },
    { code: 'sj-fines-chem-typ:update', name: '更新烧结矿粉化学成分典型值', description: '修改烧结矿粉化学成分典型值记录' },
    { code: 'sj-fines-chem-typ:delete', name: '删除烧结矿粉化学成分典型值', description: '删除烧结矿粉化学成分典型值记录' },
    { code: 'sj-fines-chem-typ:import', name: '导入烧结矿粉化学成分典型值', description: '从Excel文件导入烧结矿粉化学成分典型值数据' },
    { code: 'sj-fines-chem-typ:export', name: '导出烧结矿粉化学成分典型值', description: '导出烧结矿粉化学成分典型值数据到Excel' },
    { code: 'sj-fines-chem-typ:statistics', name: '查看烧结矿粉化学成分典型值统计', description: '查看烧结矿粉化学成分典型值统计信息' },

    // 主要矿山典型指标权限
    { code: 'mine-typ-ind:create', name: '创建主要矿山典型指标', description: '创建新的主要矿山典型指标记录' },
    { code: 'mine-typ-ind:read', name: '查看主要矿山典型指标', description: '查看主要矿山典型指标列表和详情' },
    { code: 'mine-typ-ind:update', name: '更新主要矿山典型指标', description: '修改主要矿山典型指标记录' },
    { code: 'mine-typ-ind:delete', name: '删除主要矿山典型指标', description: '删除主要矿山典型指标记录' },
    { code: 'mine-typ-ind:import', name: '导入主要矿山典型指标', description: '从Excel文件导入主要矿山典型指标数据' },
    { code: 'mine-typ-ind:export', name: '导出主要矿山典型指标', description: '导出主要矿山典型指标数据到Excel' },

    // 铁矿粉高温基础特性(块矿/球团)权限
    { code: 'lump-pellet-ht-prop:create', name: '创建铁矿粉高温基础特性', description: '创建新的铁矿粉高温基础特性记录' },
    { code: 'lump-pellet-ht-prop:read', name: '查看铁矿粉高温基础特性', description: '查看铁矿粉高温基础特性列表和详情' },
    { code: 'lump-pellet-ht-prop:update', name: '更新铁矿粉高温基础特性', description: '修改铁矿粉高温基础特性记录' },
    { code: 'lump-pellet-ht-prop:delete', name: '删除铁矿粉高温基础特性', description: '删除铁矿粉高温基础特性记录' },

    // 铁矿粉高温基础特性(粉矿)权限
    { code: 'fines-ht-base-prop:create', name: '创建铁矿粉高温基础特性(粉矿)', description: '创建新的铁矿粉高温基础特性记录' },
    { code: 'fines-ht-base-prop:read', name: '查看铁矿粉高温基础特性(粉矿)', description: '查看铁矿粉高温基础特性列表和详情' },
    { code: 'fines-ht-base-prop:update', name: '更新铁矿粉高温基础特性(粉矿)', description: '修改铁矿粉高温基础特性记录' },
    { code: 'fines-ht-base-prop:delete', name: '删除铁矿粉高温基础特性(粉矿)', description: '删除铁矿粉高温基础特性记录' },

    // 外购块矿成分价格信息管理权限
    { code: 'lump-econ-info:create', name: '创建外购块矿成分价格信息', description: '创建新的外购块矿成分价格信息记录' },
    { code: 'lump-econ-info:read', name: '查看外购块矿成分价格信息', description: '查看外购块矿成分价格信息列表和详情' },
    { code: 'lump-econ-info:update', name: '更新外购块矿成分价格信息', description: '修改外购块矿成分价格信息记录' },
    { code: 'lump-econ-info:delete', name: '删除外购块矿成分价格信息', description: '删除外购块矿成分价格信息记录' },

    // 外购块矿经济性评价参数设置权限
    { code: 'lump-econ-config:create', name: '创建外购块矿经济性评价参数', description: '创建新的外购块矿经济性评价参数记录' },
    { code: 'lump-econ-config:read', name: '查看外购块矿经济性评价参数', description: '查看外购块矿经济性评价参数列表和详情' },
    { code: 'lump-econ-config:update', name: '更新外购块矿经济性评价参数', description: '修改外购块矿经济性评价参数记录' },
    { code: 'lump-econ-config:delete', name: '删除外购块矿经济性评价参数', description: '删除外购块矿经济性评价参数记录' },

    // 外购球团经济性评价参数设置权限
    { code: 'pellet-econ-config:create', name: '创建外购球团经济性评价参数', description: '创建新的外购球团经济性评价参数记录' },
    { code: 'pellet-econ-config:read', name: '查看外购球团经济性评价参数', description: '查看外购球团经济性评价参数列表和详情' },
    { code: 'pellet-econ-config:update', name: '更新外购球团经济性评价参数', description: '修改外购球团经济性评价参数记录' },
    { code: 'pellet-econ-config:delete', name: '删除外购球团经济性评价参数', description: '删除外购球团经济性评价参数记录' },

    // 外购球团成分价格信息管理权限
    { code: 'pellet-econ-info:create', name: '创建外购球团成分价格信息', description: '创建新的外购球团成分价格信息记录' },
    { code: 'pellet-econ-info:read', name: '查看外购球团成分价格信息', description: '查看外购球团成分价格信息列表和详情' },
    { code: 'pellet-econ-info:update', name: '更新外购球团成分价格信息', description: '修改外购球团成分价格信息记录' },
    { code: 'pellet-econ-info:delete', name: '删除外购球团成分价格信息', description: '删除外购球团成分价格信息记录' },

    // 喷吹煤经济性评价参数设置权限
    { code: 'coal-econ-config:create', name: '创建喷吹煤经济性评价参数', description: '创建新的喷吹煤经济性评价参数记录' },
    { code: 'coal-econ-config:read', name: '查看喷吹煤经济性评价参数', description: '查看喷吹煤经济性评价参数列表和详情' },
    { code: 'coal-econ-config:update', name: '更新喷吹煤经济性评价参数', description: '修改喷吹煤经济性评价参数记录' },
    { code: 'coal-econ-config:delete', name: '删除喷吹煤经济性评价参数', description: '删除喷吹煤经济性评价参数记录' },

    // 喷吹煤成分价格信息管理权限
    { code: 'coal-econ-info:create', name: '创建喷吹煤成分价格信息', description: '创建新的喷吹煤成分价格信息记录' },
    { code: 'coal-econ-info:read', name: '查看喷吹煤成分价格信息', description: '查看喷吹煤成分价格信息列表和详情' },
    { code: 'coal-econ-info:update', name: '更新喷吹煤成分价格信息', description: '修改喷吹煤成分价格信息记录' },
    { code: 'coal-econ-info:delete', name: '删除喷吹煤成分价格信息', description: '删除喷吹煤成分价格信息记录' },

    // 焦炭经济性评价参数设置权限
    { code: 'coke-econ-config:create', name: '创建焦炭经济性评价参数', description: '创建新的焦炭经济性评价参数记录' },
    { code: 'coke-econ-config:read', name: '查看焦炭经济性评价参数', description: '查看焦炭经济性评价参数列表和详情' },
    { code: 'coke-econ-config:update', name: '更新焦炭经济性评价参数', description: '修改焦炭经济性评价参数记录' },
    { code: 'coke-econ-config:delete', name: '删除焦炭经济性评价参数', description: '删除焦炭经济性评价参数记录' },

    // 焦炭成分价格信息管理权限
    { code: 'coke-econ-info:create', name: '创建焦炭成分价格信息', description: '创建新的焦炭成分价格信息记录' },
    { code: 'coke-econ-info:read', name: '查看焦炭成分价格信息', description: '查看焦炭成分价格信息列表和详情' },
    { code: 'coke-econ-info:update', name: '更新焦炭成分价格信息', description: '修改焦炭成分价格信息记录' },
    { code: 'coke-econ-info:delete', name: '删除焦炭成分价格信息', description: '删除焦炭成分价格信息记录' },

    // 烧结原料经济性评价参数设置权限
    { code: 'sj-econ-config:create', name: '创建烧结原料经济性评价参数', description: '创建新的烧结原料经济性评价参数记录' },
    { code: 'sj-econ-config:read', name: '查看烧结原料经济性评价参数', description: '查看烧结原料经济性评价参数列表和详情' },
    { code: 'sj-econ-config:update', name: '更新烧结原料经济性评价参数', description: '修改烧结原料经济性评价参数记录' },
    { code: 'sj-econ-config:delete', name: '删除烧结原料经济性评价参数', description: '删除烧结原料经济性评价参数记录' },

    // 烧结原料经济性评价信息管理权限
    { code: 'sj-econ-info:create', name: '创建烧结原料经济性评价信息', description: '创建新的烧结原料经济性评价信息记录' },
    { code: 'sj-econ-info:read', name: '查看烧结原料经济性评价信息', description: '查看烧结原料经济性评价信息列表和详情' },
    { code: 'sj-econ-info:update', name: '更新烧结原料经济性评价信息', description: '修改烧结原料经济性评价信息记录' },
    { code: 'sj-econ-info:delete', name: '删除烧结原料经济性评价信息', description: '删除烧结原料经济性评价信息记录' },

    // 港口含铁料信息管理权限
    { code: 'port-material-info:create', name: '创建港口含铁料信息', description: '创建新的港口含铁料信息记录' },
    { code: 'port-material-info:read', name: '查看港口含铁料信息', description: '查看港口含铁料信息列表和详情' },
    { code: 'port-material-info:update', name: '更新港口含铁料信息', description: '修改港口含铁料信息记录' },
    { code: 'port-material-info:delete', name: '删除港口含铁料信息', description: '删除港口含铁料信息记录' }
  ];

  try {
    // 创建计算相关权限
    for (const perm of calcPermissions) {
      const existing = await permissionService.findByCode(perm.code);
      if (!existing) {
        await permissionService.createPermission(perm);
        console.log(`权限已创建: ${perm.code} - ${perm.name}`);
      } else {
        console.log(`权限已存在: ${perm.code}`);
      }
    }

    // 创建铁矿数据相关权限
    for (const perm of ironOreDataPermissions) {
      const existing = await permissionService.findByCode(perm.code);
      if (!existing) {
        await permissionService.createPermission(perm);
        console.log(`权限已创建: ${perm.code} - ${perm.name}`);
      } else {
        console.log(`权限已存在: ${perm.code}`);
      }
    }

    // 给admin角色分配所有权限
    const adminRole = await roleService.findByName('admin');
    if (adminRole) {
      const allPermissions = [...calcPermissions, ...ironOreDataPermissions];
      await roleService.assignPermissionsToRole('admin', allPermissions.map(p => p.code));
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