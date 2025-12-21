import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import _ from 'lodash';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { PelletEconInfo } from '../pellet-econ-info/entities/pellet-econ-info.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { PelletEconPaginationDto } from './dto/pellet-econ-calc.dto';

@Injectable()
export class PelletEconCalcService {
  private readonly logger = new Logger(PelletEconCalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;

  private readonly ECON_TASKS = [
    {
      name: '球团经济性评价',
      startUrl: '/pelletEcon/start/',
      progressUrl: '/pelletEcon/progress/',
      stopUrl: '/pelletEcon/stop/',
    },
  ];

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(PelletEconInfo) private readonly pelletRepo: Repository<PelletEconInfo>,
    @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
  ) {}

  /** 启动球团经济性计算任务 */
async startTask(user: User, moduleName: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
  try {
    const group = await this.configRepo.findOne({
      where: { user: { user_id: user.user_id }, module: { name: moduleName }, is_latest: true },
    });
    if (!group) throw new Error(`模块 "${moduleName}" 没有参数组`);

    const configData = _.cloneDeep(group.config_data);
    const pelletIds: number[] = configData.pelletParams || [];
    const pellets = pelletIds.length ? await this.pelletRepo.findByIds(pelletIds) : [];

    const pelletParams: Record<number, any> = {};
    pellets.forEach(p => {
      const comp = p.composition || {};
      pelletParams[p.id] = {
        港口: comp.港口 || '',
        TFe: Number(comp.TFe ?? 0),
        SiO2: Number(comp.SiO2 ?? 0),
        Al2O3: Number(comp.Al2O3 ?? 0),
        CaO: Number(comp.CaO ?? 0),
        MgO: Number(comp.MgO ?? 0),
        P: Number(comp.P ?? 0),
        S: Number(comp.S ?? 0),
        MnO: Number(comp.MnO ?? 0),
        H2O: Number(comp.H2O ?? 0),
        粉率: Number(comp.粉率 ?? 0),
        车板价: Number(comp.车板价 ?? 0),
        运费: Number(comp.运费 ?? 0),
        干粉价格: Number(comp.干粉价格 ?? 0),
      };
    });

    const fullParams = {
      pelletParams,
      pelletCostSet: configData.pelletCostSet || {},
    };
    console.log('Full Params:', fullParams);

    // 只有一个任务
    const taskDef = this.ECON_TASKS[0];
    const res: AxiosResponse<any> = await this.apiPost(taskDef.startUrl, fullParams);
    const taskUuid = res.data?.data?.taskUuid;

    if (!taskUuid) throw new Error('任务启动失败，未返回 taskUuid');

    const task = this.taskRepo.create({
      task_uuid: taskUuid,
      module_type: taskDef.name,
      status: TaskStatus.RUNNING,
      parameters: fullParams,
      user,
    });
    await this.taskRepo.save(task);

    return ApiResponse.success({ taskUuid, status: 'RUNNING' }, '球团经济性任务已启动');
  } catch (err) {
    return this.handleError(err, '启动任务失败');
  }
}


  /** 停止任务 */
async stopTask(taskUuid: string): Promise<ApiResponse<{ stopped: string }>> {
  const taskDef = this.ECON_TASKS[0]; // 这里只有一个任务类型
  try {
    // 调用 FastAPI 停止接口
    await this.apiPost(taskDef.stopUrl, { taskUuid });

    // 更新本地任务状态
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (task) {
      task.status = TaskStatus.STOPPED;
      await this.taskRepo.save(task);
    }

    return ApiResponse.success({ stopped: taskUuid }, '任务已停止');
  } catch (err) {
    this.logger.warn(`停止任务 ${taskUuid} 失败: ${(err as any)?.message || err}`);
    return ApiResponse.error(`停止任务失败: ${(err as any)?.message || err}`);
  }
}


  /** 查询任务进度，支持分页，ID 转名称 */
  async fetchAndSaveProgress(
  taskUuid: string,
  pagination?: PelletEconPaginationDto
): Promise<ApiResponse<any>> {
  try {
    // 查询任务
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) return ApiResponse.error('任务不存在');

    // 这里只有一个任务类型
    const taskDef = this.ECON_TASKS[0];

    // 请求 FastAPI 获取进度数据
    const res = await this.apiGet(taskDef.progressUrl, { taskUuid });
    const data = res.data?.data;
    if (!data) return ApiResponse.success({ status: 'RUNNING', results: [] });

    // ---------- 提取所有球团标识（ID 或名称） ----------
    const identifiers = new Set<string>();
    (data.results || []).forEach(item => {
      const idOrName = item['球团名称'];
      if (idOrName) identifiers.add(String(idOrName));
    });

    // 查询数据库中对应的球团信息
    let pellets: PelletEconInfo[] = [];
    if (identifiers.size) {
      // 尝试 ID 查询（数字）
      const numericIds = [...identifiers].map(v => Number(v)).filter(v => !isNaN(v));
      if (numericIds.length) {
        pellets = await this.pelletRepo.find({ where: { id: In(numericIds) } });
      }

      // 再尝试按名称匹配
      const nameStrings = [...identifiers].filter(v => isNaN(Number(v)));
      if (nameStrings.length) {
        const namePellets = await this.pelletRepo.find({ where: { name: In(nameStrings) } });
        pellets = pellets.concat(namePellets);
      }
    }

    // 构建映射：ID/名称 -> 正式名称
    const nameMap: Record<string, string> = {};
    pellets.forEach(p => {
      nameMap[p.id] = p.name;
      nameMap[p.name] = p.name;
    });

    // ---------- 映射球团名称 ----------
    const mappedResults = (data.results || []).map(item => ({
      ...item,
      球团名称: nameMap[item['球团名称']] || item['球团名称'],
    }));

    // ---------- 分页处理 ----------
    const { pagedResults, totalResults, totalPages } = this.applyPagination(mappedResults, pagination);

    return ApiResponse.success({
      taskUuid,
      status: data.status,
      progress: data.progress ?? 0,
      total: data.total ?? totalResults,
      results: pagedResults,
      page: pagination?.page ?? 1,
      pageSize: pagination?.pageSize ?? 10,
      totalResults,
      totalPages,
    });
  } catch (err) {
    return this.handleError(err, '获取任务进度失败');
  }
}

/** 分页工具方法 */
private applyPagination(results: any[], pagination?: PelletEconPaginationDto) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  const pagedResults = results.slice(start, start + pageSize);
  return {
    pagedResults,
    totalResults: results.length,
    totalPages: Math.ceil(results.length / pageSize),
  };
}


  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> {
    return axios.post(`${this.fastApiUrl}${path}`, data);
  }

  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> {
    return axios.get(`${this.fastApiUrl}${path}`, { params });
  }

  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }
}
