import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { SjconfigService } from '../sj-config/sj-config.service'; // 可共用配置服务

export interface PaginationDto {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface TaskCache {
  results: any[];
  lastUpdated: number;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

@Injectable()
export class GlCalcService {
  private readonly logger = new Logger(GlCalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glRawMaterialRepo: Repository<GlMaterialInfo>,
    private readonly sjconfigService: SjconfigService,
  ) {}

  async startTask(moduleName: string, user: User): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      const config = await this.sjconfigService.getLatestConfigByName(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const ingredientIds = config.ingredientParams || [];
      const raws = await this.glRawMaterialRepo.find({ where: { id: In(ingredientIds), enabled: true } });

      const ingredientParams: Record<number, any> = {};
      raws.forEach(raw => {
        ingredientParams[raw.id] = { ...raw.composition, TFe: raw.composition?.TFe ?? 0, 烧损: raw.composition?.['烧损'] ?? 0, 价格: raw.composition?.['价格'] ?? 0, 库存: raw.inventory ?? 0 };
      });

      const ingredientLimitsClean: Record<string, any> = {};
      Object.keys(config.ingredientLimits || {}).forEach(id => {
        const { name, ...limits } = config.ingredientLimits[id];
        ingredientLimitsClean[id] = limits;
      });

      const fullParams = {
        calculateType: moduleName,
        ingredientParams,
        ingredientLimits: ingredientLimitsClean,
        chemicalLimits: config.chemicalLimits || {},
        otherSettings: config.otherSettings || {},
      };

      const res = await this.apiPost('/gl/start/', fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results;

      if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

      const task = this.taskRepo.create({ task_uuid: taskUuid, module_type: moduleName, status: TaskStatus.RUNNING, parameters: fullParams, user });
      await this.taskRepo.save(task);

      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

      const idNameMap: Record<number, string> = {};
      raws.forEach(raw => idNameMap[raw.id] = raw.name);

      const resultMap: Record<string, any> = {};
      if (resultsById) Object.keys(resultsById).forEach(idStr => { const id = Number(idStr); const name = idNameMap[id]; if (name) resultMap[name] = resultsById[id]; });

      return ApiResponse.success({ taskUuid, resultMap }, '任务启动成功');
    } catch (err: any) {
      return this.handleError(err, '启动任务失败');
    }
  }

  async stopTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiPost('/gl/stop/', { taskUuid });
      if (res.data?.status === 'stopped' || res.status === 200) {
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);
        this.taskCache.delete(taskUuid);
        return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止');
      }
      return ApiResponse.error(res.data?.message || '停止失败');
    } catch (err: unknown) {
      return this.handleError(err, '停止任务失败');
    }
  }

  async fetchAndSaveProgress(taskUuid: string, pagination?: PaginationDto): Promise<ApiResponse<any>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.success({ taskUuid, status: 'initializing', progress: 0, total: 0, results: [], page: 1, pageSize: 10, totalResults: 0, totalPages: 0 }, '任务初始化中');

      let results: any[] = [];
      if (task.status !== TaskStatus.FINISHED) {
        const res = await this.apiGet('/gl/progress/', { taskUuid });
        const { code, message, data } = res.data;
        if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');

        const idSet = new Set<number>();
        for (const result of data.results || []) Object.keys(result["原料配比"] || {}).forEach(idStr => idSet.add(Number(idStr)));

        const raws = await this.glRawMaterialRepo.find({ where: { id: In([...idSet]) } });
        const idNameMap: Record<string, string> = {};
        raws.forEach(raw => idNameMap[String(raw.id)] = raw.name);

        results = (data.results || []).map(item => {
          const mapped = { ...item };
          if (item["原料配比"]) {
            const newMix: Record<string, any> = {};
            Object.entries(item["原料配比"]).forEach(([id, val]) => { newMix[idNameMap[id] || id] = val; });
            mapped["原料配比"] = newMix;
          }
          return mapped;
        });

        const cache = this.taskCache.get(taskUuid) || { results: [], lastUpdated: Date.now() };
        cache.results.push(...results);
        cache.lastUpdated = Date.now();
        this.taskCache.set(taskUuid, cache);

        task.status = data.status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
        task.progress = data.progress;
        task.total = data.total;
        await this.taskRepo.save(task);

        results = cache.results;

        if (task.status === TaskStatus.FINISHED && results.length) {
          await this.saveResults(task, results);
          this.taskCache.delete(taskUuid);
        }
      } else {
        const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
        results = resultEntity?.output_data || [];
      }

      const { pagedResults, totalResults, totalPages } = this.applyPaginationAndSort(results, pagination);
      return ApiResponse.success({ taskUuid, status: task.status, progress: task.progress, total: task.total, results: pagedResults, page: pagination?.page ?? 1, pageSize: pagination?.pageSize ?? 10, totalResults, totalPages });
    } catch (err: any) {
      return this.handleError(err, '获取任务进度失败');
    }
  }

  private applyPaginationAndSort(results: any[], pagination?: PaginationDto) {
    let sortedResults = results;
    if (pagination?.sort) {
      const fieldPath = pagination.sort;
      const order = pagination.order === 'desc' ? -1 : 1;
      sortedResults = [...results].sort((a, b) => {
        let va = getNestedValue(a, fieldPath);
        let vb = getNestedValue(b, fieldPath);
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) { va = na; vb = nb; } else { va = va ? String(va) : ''; vb = vb ? String(vb) : ''; }
        return va > vb ? order : va < vb ? -order : 0;
      });
    }

    const page = pagination?.page ?? 1, pageSize = pagination?.pageSize ?? 10;
    const start = (page - 1) * pageSize;
    return { pagedResults: sortedResults.slice(start, start + pageSize), totalResults: sortedResults.length, totalPages: Math.ceil(sortedResults.length / pageSize) };
  }

  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> { return axios.post(`${this.fastApiUrl}${path}`, data); }
  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> { return axios.get(`${this.fastApiUrl}${path}`, { params }); }
  private async findTask(taskUuid: string): Promise<Task | null> { return this.taskRepo.findOne({ where: { task_uuid: taskUuid } }); }
  private async saveResults(task: Task, results: any[]): Promise<void> { await this.resultRepo.save(this.resultRepo.create({ task, output_data: results, is_shared: false, finished_at: new Date() })); }
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> { const message = err instanceof Error ? err.message : String(err); this.logger.error(`${prefix}: ${message}`); return ApiResponse.error(message); }
}
