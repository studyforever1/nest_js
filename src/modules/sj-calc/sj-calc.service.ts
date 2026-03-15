import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { SjconfigService } from '../sj-config/sj-config.service';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { formatSJResultFull,sortSJResult } from '../../common/formatters/sj.formatter';
/** 分页参数 DTO */
export interface PaginationDto {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** 内存缓存结构 */
interface TaskCache {
  results: any[];
  lastUpdated: number;
}

/** 根据字段路径取值 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

@Injectable()
export class CalcService {
  private readonly logger = new Logger(CalcService.name);
  private readonly fastApiUrl = 'http://127.0.0.1:8000'; // 可替换为 appConfig.api.fastApiUrl

  /** 内存缓存：taskUuid -> TaskCache */
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
    private readonly sjconfigService: SjconfigService,
  ) { }

  /** ===================== 启动任务 ===================== */
  async startTask(moduleName: string, user: User): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const taskUuid = uuidv4();
      const config = await this.sjconfigService.getLatestConfigByName(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const ingredientData = config.ingredientData || [];
      const ingredientParams: Record<number, any> = {};
      ingredientData.forEach(raw => {
        ingredientParams[raw.id] = {
          ...raw.composition,
          TFe: raw.composition?.TFe ?? 0,
          烧损: raw.composition?.['烧损'] ?? 0,
          价格: raw.composition?.['价格'] ?? 0,
          库存: raw.inventory ?? 0,
        };
      });

      const ingredientLimits: Record<string, any> = {};
      Object.keys(config.ingredientLimits || {}).forEach(id => {
        const { name, ...limits } = config.ingredientLimits[id];
        ingredientLimits[id] = limits;
      });

      const fullParams = {
        calculateType: moduleName,
        ingredientData,
        ingredientParams,
        ingredientLimits,
        chemicalLimits: config.chemicalLimits || {},
        otherSettings: config.otherSettings || {},
      };

      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.INITIALIZING,
        parameters: fullParams,
        user,
      });
      await this.taskRepo.save(task);

      // 初始化缓存
      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

      // 后台启动 FastAPI
      this.startFastApiTask(taskUuid, fullParams).catch(err =>
        this.logger.error(`FastAPI 启动失败 task=${taskUuid}: ${err.message}`)
      );

      return ApiResponse.success({ taskUuid, status: 'INITIALIZING' }, '任务已创建，正在启动中');
    } catch (err) {
      return this.handleError(err, '启动任务失败');
    }
  }

  private async startFastApiTask(taskUuid: string, fullParams: any) {
    try {
      await this.apiPost('/sj/start/', { taskUuid, ...fullParams });
      await this.updateTaskStatus(taskUuid, TaskStatus.RUNNING);
    } catch (err) {
      await this.updateTaskStatus(taskUuid, TaskStatus.FAILED);
      throw err;
    }
  }

  /** ===================== 停止任务 ===================== */

  async pauseTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');
      if (task.status !== TaskStatus.RUNNING) return ApiResponse.error('任务当前状态不可暂停');

      // 1️⃣ 通知 FastAPI 暂停
      await this.apiPost('/sj/pause/', { taskUuid });
      await this.waitFastApiPause(taskUuid);

      // 2️⃣ 强制整理并保存结果到数据库
      await this.fetchAndSaveProgress(taskUuid, undefined, true);

      // 3️⃣ 更新任务状态为 PAUSED
      await this.updateTaskStatus(taskUuid, TaskStatus.PAUSED);

      // 4️⃣ 清理缓存
      this.taskCache.delete(taskUuid);

      return ApiResponse.success({ taskUuid, status: 'paused' }, '任务已暂停并保存整理好的结果');
    } catch (err) {
      return this.handleError(err, '暂停任务失败');
    }
  }

  /** ===================== 停止任务 ===================== */
  async stopTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 通知 FastAPI 停止
      await this.apiPost('/sj/stop/', { taskUuid });

      // 2️⃣ 强制整理并保存结果到数据库
      await this.fetchAndSaveProgress(taskUuid, undefined, true);

      // 3️⃣ 更新任务状态为 STOPPED
      await this.updateTaskStatus(taskUuid, TaskStatus.STOPPED);

      // 4️⃣ 清理缓存
      this.taskCache.delete(taskUuid);

      return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止并保存当前结果');
    } catch (err) {
      return this.handleError(err, '停止任务失败');
    }
  }

  private async waitFastApiPause(taskUuid: string, maxWait = 15000, interval = 300): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const res = await this.apiGet('/sj/progress/', { taskUuid });
        const status = res.data?.data?.status;

        // ✅ 只在状态真正是 paused 时返回
        if (status === 'paused') return;

        // 可选：如果返回 finished，也立即返回
        if (status === 'finished') return;

      } catch (err) {
        // 遇到网络或临时异常，继续轮询，不立即失败
        console.warn(`轮询暂停状态失败，taskUuid=${taskUuid}`, err);
      }

      // 等待 interval 再轮询
      await new Promise(r => setTimeout(r, interval));
    }

    throw new Error(`等待后端暂停超时 taskUuid=${taskUuid}`);
  }

  /** ===================== 继续任务 ===================== */
  async resumeTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiPost('/sj/resume/', { taskUuid });
      if (res.data?.data?.status === 'running') {
        const progressRes = await this.apiGet('/sj/progress/', { taskUuid });
        await this.updateTaskStatus(taskUuid, TaskStatus.RUNNING, progressRes.data?.data?.progress, progressRes.data?.data?.total);
        return ApiResponse.success({ taskUuid, status: 'running' }, '任务已继续');
      }
      return ApiResponse.error(res.data?.message || '继续失败');
    } catch (err) {
      return this.handleError(err, '继续任务失败');
    }
  }

  /** ===================== 查询任务进度 ===================== */
async fetchAndSaveProgress(
  taskUuid: string,
  pagination?: PaginationDto,
  forceSave = false
): Promise<ApiResponse<any>> {
  try {
    const task = await this.findTask(taskUuid);
    if (!task) return this.taskInitializingFallback(taskUuid, pagination);

    let results: any[] = [];
    const parameters = task.parameters || {};

    const idNameMap: Record<string, string> = {};
    const idCategoryMap: Record<string, string> = {};
    (parameters.ingredientData || []).forEach(item => {
      if (item?.id != null) {
        idNameMap[String(item.id)] = item.name || '';
        idCategoryMap[String(item.id)] = item.category || '';
      }
    });

    const FINAL_STATUS = [
      TaskStatus.PAUSED,
      TaskStatus.STOPPED,
      TaskStatus.FINISHED
    ];

    if (FINAL_STATUS.includes(task.status) && !forceSave) {
      const cache = this.taskCache.get(taskUuid);
      if (cache?.results?.length) {
        results = cache.results;
      } else {
        results = await this.loadResultsFromDb(taskUuid);
      }
      results = results.map(item => sortSJResult(item));
    } else {
      const res = await this.apiGet('/sj/progress/', { taskUuid });
      const data = res.data?.data;
      if (!data || !Array.isArray(data.results))
        throw new Error('FastAPI 返回异常');

      const cache = this.taskCache.get(taskUuid) || { results: [], lastUpdated: Date.now() };
      results = this.mergeResults(cache.results, data.results);

      const newStatus = this.mapFastApiStatusToTaskStatus(data.status);
      await this.updateTaskStatus(taskUuid, newStatus, data.progress, data.total);

      const needFormat =
        newStatus === TaskStatus.FINISHED ||
        newStatus === TaskStatus.PAUSED ||
        newStatus === TaskStatus.STOPPED ||
        forceSave;

      if (needFormat) {
        results = results.map(item =>
          formatSJResultFull(
            item,
            idNameMap,
            idCategoryMap,
            parameters.ingredientLimits,
            parameters.chemicalLimits
          )
        );

        // ================= 计算排名 =================
        // 成本排名
        results.sort((a, b) => a["主要参数"].成本 - b["主要参数"].成本);
        results.forEach((item, idx) => item.成本排名 = idx + 1);

        // 吨度价排名
        results.sort((a, b) => a["主要参数"].吨度价 - b["主要参数"].吨度价);
        results.forEach((item, idx) => item.吨度价排名 = idx + 1);

        const taskEntity = await this.findTask(taskUuid);
        if (taskEntity && results.length) {
          await this.saveResults(taskEntity, results);
        }
      } else {
        // running阶段排序并计算排名
        results.sort((a, b) => a["方案序号"] - b["方案序号"]);
        results.forEach(item => sortSJResult(item));

        // 成本排名
        const sortedByCost = [...results].sort((a, b) => a["主要参数"].成本 - b["主要参数"].成本);
        sortedByCost.forEach((item, idx) => {
          const target = results.find(r => r === item);
          if (target) target.成本排名 = idx + 1;
        });

        // 吨度价排名
        const sortedByTonPrice = [...results].sort((a, b) => a["主要参数"].吨度价 - b["主要参数"].吨度价);
        sortedByTonPrice.forEach((item, idx) => {
          const target = results.find(r => r === item);
          if (target) target.吨度价排名 = idx + 1;
        });
      }

      this.taskCache.set(taskUuid, { results, lastUpdated: Date.now() });
      if (newStatus === TaskStatus.FINISHED) this.taskCache.delete(taskUuid);

      task.status = newStatus;
      task.progress = data.progress ?? task.progress;
      task.total = data.total ?? task.total;
    }

    const { pagedResults, totalResults, totalPages } = this.applyPaginationAndSort(results, pagination);

    return ApiResponse.success({
      taskUuid: task.task_uuid,
      status: task.status,
      progress: task.progress,
      total: task.total,
      results: pagedResults,
      page: pagination?.page ?? 1,
      pageSize: pagination?.pageSize ?? 10,
      totalResults,
      totalPages
    });

  } catch (err) {
    this.logger.error(`fetch progress error ${taskUuid}`, err);
    return this.taskInitializingFallback(taskUuid, pagination);
  }
}
  /** ===================== 导出方案 ===================== */
  async exportSchemeExcel(taskUuid: string, index: number) {
    const scheme = await this.getSchemeByIndex(taskUuid, index);
    if (!scheme) throw new Error('方案不存在');

    const task = await this.findTask(taskUuid);
    if (!task) throw new Error('任务不存在');

    const ingredientData = task.parameters?.ingredientData || [];
    const ingredientMap = new Map<number, any>(ingredientData.map(item => [item.id, item]));

    const ingredientWithLimits = scheme['原料配比'] || {};
    const ingredientParams: Record<string, any> = {};
    for (const idStr of Object.keys(ingredientWithLimits)) {
      const id = Number(idStr);
      const val = ingredientWithLimits[id];
      const raw = ingredientMap.get(id);
      if (!raw) continue;
      ingredientParams[val.name] = {
        原料产地: raw.origin || '',
        分类编号: raw.category || '',
        H2O: raw.composition?.H2O ?? 0,
        价格: raw.composition?.价格 ?? 0,
        lose_index: val?.lose_index ?? 1,
        配比: Number(val?.value) || 0,
      };
    }

    const mainParams = scheme['主要参数'] || {};
    const chemical = scheme['化学成分'] || {};
    const otherSettings = {
      ...task.parameters?.otherSettings,
      综合品位: chemical?.TFe?.value ?? chemical?.TFe ?? 0,
      干基总残存: mainParams['干基总残存(%)'] ?? 0,
      成本: mainParams['成本(元/t)'] ?? 0,
      吨度价: mainParams['吨度价'] ?? 0,
      品位: chemical?.TFe?.value ?? chemical?.TFe ?? 0,
      其他费用: task.parameters?.otherSettings?.['其他费用'] ?? 0,
      导出名称: `${taskUuid}-${index}`,
    };

    return { ingredientParams, otherSettings };
  }

  async callFastApi(payload: { ingredientParams: any; otherSettings: any }) {
    const res = await axios.post(`${this.fastApiUrl}/sj/export/excel/`, payload, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  }

  /** ===================== 工具方法 ===================== */
  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> {
    try { return await axios.post(`${this.fastApiUrl}${path}`, data); }
    catch (err: any) { throw new Error(err.response?.data?.message || err.message || '接口请求失败'); }
  }

  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> {
    try { return await axios.get(`${this.fastApiUrl}${path}`, { params }); }
    catch (err: any) { throw new Error(err.response?.data?.message || err.message || '接口请求失败'); }
  }

  private async findTask(taskUuid: string): Promise<Task | null> {
    return this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
  }

  private async saveResults(task: Task, results: any[]): Promise<void> {
    // 先查找是否已有结果
    let entity = await this.resultRepo.findOne({
      where: { task: { task_uuid: task.task_uuid } }
    });

    if (!entity) {
      // 直接存对象，不用 JSON.stringify
      entity = this.resultRepo.create({
        task,
        output_data: results,   // ✅ 直接存数组对象
        is_shared: false,
        finished_at: new Date(),
      });
    } else {
      // 更新时也直接存对象
      entity.output_data = results;  // ✅ 直接存对象
      entity.finished_at = new Date();
    }

    await this.resultRepo.save(entity);
  }

  private mergeResults(oldResults: any[], newResults: any[]): any[] {
    const map = new Map<number, any>();
    [...oldResults, ...newResults].forEach(r => { if (r['方案序号'] != null) map.set(r['方案序号'], r); });
    return Array.from(map.values()).sort((a, b) => a['方案序号'] - b['方案序号']);
  }

  private async loadResultsFromDb(taskUuid: string): Promise<any[]> {
    const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
    if (!resultEntity) return [];
    if (Array.isArray(resultEntity.output_data)) return resultEntity.output_data;
    if (typeof resultEntity.output_data === 'string') return JSON.parse(resultEntity.output_data);
    return resultEntity.output_data || [];
  }

  private async updateTaskStatus(taskUuid: string, status: TaskStatus, progress?: number, total?: number) {
    const task = await this.findTask(taskUuid);
    if (!task) return;
    task.status = status;
    if (progress != null) task.progress = progress;
    if (total != null) task.total = total;
    await this.taskRepo.save(task);
  }

  private mapFastApiStatusToTaskStatus(status: string): TaskStatus {
    switch (status) {
      case 'finished': return TaskStatus.FINISHED;
      case 'paused': return TaskStatus.PAUSED;
      case 'running': return TaskStatus.RUNNING;
      default: return TaskStatus.INITIALIZING;
    }
  }

  private applyPaginationAndSort(results: any[], pagination?: PaginationDto, task?: Task) {
    let sortedResults = results;

    if (pagination?.sort) {
      const order = pagination.order === 'desc' ? -1 : 1;
      sortedResults = [...results].sort((a, b) => {
        let va = getNestedValue(a, pagination.sort!);
        let vb = getNestedValue(b, pagination.sort!);
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) { va = na; vb = nb; } else { va = va ? String(va) : ''; vb = vb ? String(vb) : ''; }
        return va > vb ? order : va < vb ? -order : 0;
      });
    }

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 10;
    const start = (page - 1) * pageSize;

    return {
      pagedResults: sortedResults.slice(start, start + pageSize),
      totalResults: sortedResults.length,
      totalPages: Math.ceil(sortedResults.length / pageSize),
      taskUuid: task?.task_uuid,
      status: task?.status,
      progress: task?.progress,
      total: task?.total
    };
  }

  private taskInitializingFallback(taskUuid: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 10;
    return ApiResponse.success({
      taskUuid,
      status: 'initializing',
      progress: 0,
      total: 0,
      results: [],
      page,
      pageSize,
      totalResults: 0,
      totalPages: 0,
    }, '任务初始化中');
  }

  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }

  /** ===================== 获取单个方案 ===================== */
  async getSchemeByIndex(taskUuid: string, index: number): Promise<any | null> {
    const results = await this.loadResultsFromDb(taskUuid);
    const scheme = results.find(item => Number(item['方案序号']) === Number(index));
    if (!scheme) return null;

    // 只做排序，不生成空 value/limits
    return sortSJResult(scheme);
  }
}