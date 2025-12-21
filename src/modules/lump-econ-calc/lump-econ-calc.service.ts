import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import _ from 'lodash';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { LumpEconInfo } from '../lump-econ-info/entities/lump-econ-info.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { LumpEconPaginationDto } from './dto/lump-econ-calc.dto';

@Injectable()
export class LumpEconCalcService {
  private readonly logger = new Logger(LumpEconCalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;

  private readonly ECON_TASK = {
    name: '外购块矿经济性评价',
    startUrl: '/lumpEcon/start/',
    progressUrl: '/lumpEcon/progress/',
    stopUrl: '/lumpEcon/stop/',
  };

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(LumpEconInfo) private readonly lumpRepo: Repository<LumpEconInfo>,
    @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
  ) {}

  /** 启动块矿经济性计算任务 */
  async startTask(user: User, moduleName: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const group = await this.configRepo.findOne({
        where: { user: { user_id: user.user_id }, module: { name: moduleName }, is_latest: true },
      });
      if (!group) throw new Error(`模块 "${moduleName}" 没有参数组`);

      const configData = _.cloneDeep(group.config_data);
      const lumpIds: number[] = configData.lumpParams || [];
      const lumps = lumpIds.length ? await this.lumpRepo.findByIds(lumpIds) : [];

      // 构建块矿参数
      const lumpParams: Record<number, any> = {};
      lumps.forEach(l => {
        const comp = l.composition || {};
        lumpParams[l.id] = {
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
        lumpParams,
        lumpCostSet: configData.lumpCostSet || {},
      };

      // 打印验证参数
      console.log('启动块矿任务参数:', JSON.stringify(fullParams, null, 2));

      // 调用 FastAPI 启动任务
      const res: AxiosResponse<any> = await this.apiPost(this.ECON_TASK.startUrl, fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      if (!taskUuid) throw new Error('任务启动失败，未返回 taskUuid');

      // 保存本地任务记录
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: this.ECON_TASK.name,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user,
      });
      await this.taskRepo.save(task);

      return ApiResponse.success({ taskUuid, status: 'RUNNING' }, '块矿经济性任务已启动');
    } catch (err) {
      return this.handleError(err, '启动任务失败');
    }
  }

  /** 停止任务 */
  async stopTask(taskUuid: string): Promise<ApiResponse<any>> {
    try {
      await this.apiPost(this.ECON_TASK.stopUrl, { taskUuid });
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (task) {
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);
      }
      return ApiResponse.success({ taskUuid, status: 'STOPPED' }, '任务已停止');
    } catch (err) {
      return this.handleError(err, '停止任务失败');
    }
  }

  /** 查询任务进度，支持分页，ID 转名称 */
  async fetchAndSaveProgress(taskUuid: string, pagination?: LumpEconPaginationDto): Promise<ApiResponse<any>> {
    try {
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiGet(this.ECON_TASK.progressUrl, { taskUuid });
      const data = res.data?.data;
      if (!data) return ApiResponse.success({ status: 'RUNNING', results: [] });

      // 提取所有块矿标识（ID 或名称）
      const identifiers = new Set<string>();
      (data.results || []).forEach(item => {
        const idOrName = item['块矿名称'];
        if (idOrName) identifiers.add(String(idOrName));
      });

      // 查询数据库中对应块矿
      let lumps: LumpEconInfo[] = [];
      if (identifiers.size) {
        const numericIds = [...identifiers].map(v => Number(v)).filter(v => !isNaN(v));
        if (numericIds.length) lumps = await this.lumpRepo.find({ where: { id: In(numericIds) } });

        const nameStrings = [...identifiers].filter(v => isNaN(Number(v)));
        if (nameStrings.length) {
          const nameLumps = await this.lumpRepo.find({ where: { name: In(nameStrings) } });
          lumps = lumps.concat(nameLumps);
        }
      }

      // 构建 ID/名称 -> 正式名称映射
      const nameMap: Record<string, string> = {};
      lumps.forEach(l => {
        nameMap[l.id] = l.name;
        nameMap[l.name] = l.name;
      });

      // 映射结果中的块矿名称
      const mappedResults = (data.results || []).map(item => ({
        ...item,
        块矿名称: nameMap[item['块矿名称']] || item['块矿名称'],
      }));

      // 分页处理
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
  private applyPagination(results: any[], pagination?: LumpEconPaginationDto) {
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
