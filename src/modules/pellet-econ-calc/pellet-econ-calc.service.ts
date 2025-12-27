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

  private readonly ECON_TASK = {
    name: '球团经济性评价',
    startUrl: '/pelletEcon/start/',
    progressUrl: '/pelletEcon/progress/',
    stopUrl: '/pelletEcon/stop/',
  };

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(PelletEconInfo) private readonly pelletRepo: Repository<PelletEconInfo>,
    @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
  ) {}

  /* ======================= 启动任务 ======================= */
  async startTask(
    user: User,
    moduleName: string,
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const group = await this.configRepo.findOne({
        where: { user: { user_id: user.user_id }, module: { name: moduleName }, is_latest: true },
      });
      if (!group) throw new Error(`模块 "${moduleName}" 没有参数组`);

      const configData = _.cloneDeep(group.config_data);

      /** 1️⃣ 读取球团 */
      const pelletIds: number[] = configData.pelletParams || [];
      const pellets = pelletIds.length
        ? await this.pelletRepo.find({ where: { id: In(pelletIds) } })
        : [];

      /** 2️⃣ 构建参数 */
      const pelletParams: Record<number, any> = {};
      pellets.forEach(p => {
        const comp = p.composition || {};
        pelletParams[p.id] = {
          港口: comp.港口 ?? '',
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

      console.log('启动球团任务参数:', JSON.stringify(fullParams, null, 2));

      /** 3️⃣ 调用 FastAPI */
      const res: AxiosResponse<any> = await this.apiPost(this.ECON_TASK.startUrl, fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      if (!taskUuid) throw new Error('任务启动失败，未返回 taskUuid');

      /** 4️⃣ 保存本地任务记录 */
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: this.ECON_TASK.name,
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

  /* ======================= 停止任务 ======================= */
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

  /* ======================= 查询进度（排序 + 分页） ======================= */
  async fetchAndSaveProgress(
    taskUuid: string,
    pagination?: PelletEconPaginationDto,
  ): Promise<ApiResponse<any>> {
    try {
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiGet(this.ECON_TASK.progressUrl, { taskUuid });
      const data = res.data?.data;
      if (!data) return ApiResponse.success({ status: 'RUNNING', results: [] });

      /** ---------- 提取球团标识 ---------- */
      const identifiers = new Set<string>();
      (data.results || []).forEach(item => {
        const idOrName = item['球团名称'];
        if (idOrName) identifiers.add(String(idOrName));
      });

      /** ---------- 查询数据库 ---------- */
      let pellets: PelletEconInfo[] = [];
      if (identifiers.size) {
        const numericIds = [...identifiers].map(v => Number(v)).filter(v => !isNaN(v));
        if (numericIds.length) {
          pellets = await this.pelletRepo.find({ where: { id: In(numericIds) } });
        }

        const nameStrings = [...identifiers].filter(v => isNaN(Number(v)));
        if (nameStrings.length) {
          const byName = await this.pelletRepo.find({ where: { name: In(nameStrings) } });
          pellets = pellets.concat(byName);
        }
      }

      /** ---------- 构建映射 ---------- */
      const nameMap: Record<string, string> = {};
      pellets.forEach(p => {
        nameMap[p.id] = p.name;
        nameMap[p.name] = p.name;
      });

      /** ---------- 映射结果 ---------- */
      const mappedResults = (data.results || []).map(item => ({
        ...item,
        球团名称: nameMap[item['球团名称']] || item['球团名称'],
      }));

      /** ---------- 排序 + 分页 ---------- */
      const { pagedResults, totalResults, totalPages } = this.applyPaginationAndSort(mappedResults, pagination);

      return ApiResponse.success({
        taskUuid,
        status: data.status,
        progress: data.progress ?? 0,
        total: data.total ?? totalResults,
        results: pagedResults,
        page: Number(pagination?.page ?? 1),
        pageSize: Number(pagination?.pageSize ?? 10),
        totalResults,
        totalPages,
      });
    } catch (err) {
      return this.handleError(err, '获取任务进度失败');
    }
  }

  /* ======================= 排序 + 分页工具 ======================= */
  private applyPaginationAndSort(
    results: any[],
    pagination?: PelletEconPaginationDto,
  ) {
    let sortedResults = results;

    if (pagination?.sort) {
      const fieldPath = pagination.sort;
      const order = pagination.order === 'desc' ? -1 : 1;

      sortedResults = [...results].sort((a, b) => {
        const va = this.getNestedValue(a, fieldPath);
        const vb = this.getNestedValue(b, fieldPath);

        const na = Number(va);
        const nb = Number(vb);

        if (!isNaN(na) && !isNaN(nb)) {
          return na > nb ? order : na < nb ? -order : 0;
        }
        return va > vb ? order : va < vb ? -order : 0;
      });
    }

    const page = Number(pagination?.page ?? 1);
    const pageSize = Number(pagination?.pageSize ?? 10);
    const start = (page - 1) * pageSize;

    const pagedResults = sortedResults.slice(start, start + pageSize);
    const totalResults = sortedResults.length;
    const totalPages = Math.ceil(totalResults / pageSize);

    return { pagedResults, totalResults, totalPages };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
  }

  /* ======================= HTTP & Error ======================= */
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
