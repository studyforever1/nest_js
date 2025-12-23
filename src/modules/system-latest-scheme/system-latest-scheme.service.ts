import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import dayjs from 'dayjs';

import { SystemLatestScheme } from './entities/system-latest-scheme.entity';
import { Task } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { Between } from 'typeorm';

@Injectable()
export class SystemLatestSchemeService {
  constructor(
    @InjectRepository(SystemLatestScheme)
    private readonly repo: Repository<SystemLatestScheme>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /** 设置为系统当日最新方案（按模块类型唯一） */
/** 设置为系统当日最新方案 */
async setTodayLatest(
  user: User,
  taskUuid: string,
  schemeIndex: number,
  moduleType: string,
) {
  const task = await this.taskRepo.findOne({
    where: { task_uuid: taskUuid },
    relations: ['results'],
  });
  if (!task) return ApiResponse.error('任务不存在');

  let results = task.results?.[0]?.output_data;
  if (!results) return ApiResponse.error('任务结果为空');

  if (typeof results === 'string') {
    try {
      results = JSON.parse(results);
    } catch {
      return ApiResponse.error('任务结果解析失败');
    }
  }

  const scheme = results.find(r => r['方案序号'] === schemeIndex);
  if (!scheme) return ApiResponse.error('方案不存在');

  const today = dayjs().format('YYYY-MM-DD');
  const schemeId = `${task.task_uuid}-${schemeIndex}`;

  let record = await this.repo.findOne({
    where: { scheme_date: today, module_type: moduleType },
    relations: ['modifier', 'task'],
  });

  if (record) {
    record.task = task;
    record.scheme_id = schemeId;
    record.module_type = moduleType;
    record.result = scheme;
    record.modifier = user;
    await this.repo.save(record);
  } else {
    record = await this.repo.save(
      this.repo.create({
        scheme_date: today,
        module_type: moduleType,
        task,
        scheme_id: schemeId,
        result: scheme,
        modifier: user,
      }),
    );
  }

  return ApiResponse.success(
    {
      id: record.id,
      scheme_date: record.scheme_date,
      module_type: record.module_type,
      scheme_id: record.scheme_id,
      modifier: record.modifier?.username || user.username,
      result: record.result,
      updated_at: dayjs(record.updated_at).format('YYYY-MM-DD HH:mm:ss'),
    },
    '已设置为当日最新方案',
  );
}

/** 获取系统当日最新方案，可按模块类型查询 */
/** 获取最近几天的系统最新方案，可按模块类型筛选，默认当天最新 */
async getRecentLatest(days = 1, moduleType?: string) {
  const today = dayjs().startOf('day');
  const startDay = today.subtract(days - 1, 'day');

  const where: any = {
    scheme_date: Between(startDay.format('YYYY-MM-DD'), today.format('YYYY-MM-DD')),
  };
  if (moduleType) where.module_type = moduleType;

  const records = await this.repo.find({
    where,
    relations: ['modifier'],
    order: { scheme_date: 'DESC', module_type: 'ASC' },
  });

  if (!records?.length) {
    return ApiResponse.success([], `最近${days}天暂无系统最新方案`);
  }

  const data = records.map(r => ({
    id: r.id,
    scheme_date: r.scheme_date,
    module_type: r.module_type,
    scheme_id: r.scheme_id,
    modifier: r.modifier?.username || null,
    result: r.result,
    updated_at: dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss'),
  }));

  return ApiResponse.success(data, `获取最近${days}天系统最新方案成功`);
}


}
