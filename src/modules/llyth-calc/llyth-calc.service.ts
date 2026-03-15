import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import { GlConfigService } from '../gl-config/gl-config.service';
import { SjCandidate } from '../sj-candidate/entities/sj-candidate.entity';
import { appConfig } from '../../config/app.config';
import { formatLLYTHResultFull, sortLLYTHResult } from 'src/common/formatters/llyth.formatter';

const mainUnitMap: Record<string, string> = {
  综合入炉品位: '综合入炉品位(%)',
  吨材毛利润: '吨材毛利润(元/t)',
  本月毛利: '本月毛利(亿元/月)',
  边际效益: '边际效益(亿元/月)',
  吨铁成本: '吨铁成本(元/t)',
  铁水日产: '铁水日产(t/d)',
  吨钢成本: '吨钢成本(元/t)',
  钢坯日产: '钢坯日产(t/d)',
  吨坯毛利润: '吨坯毛利润(元/t)',
  吨材成本: '吨材成本(元/t)',
  带钢日产: '带钢日产(t/d)',
  矿耗: '矿耗(t/t)',
  燃料比: '燃料比(kg/t)',
  焦比: '焦比(t/t)',
  综合焦比: '综合焦比(t/t)',
  煤比: '煤比(t/t)',
};

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

function sortMainParameters(source: Record<string, any>, order: string[]) {
  const sorted: Record<string, any> = {};
  order.forEach(key => {
    if (source?.[key] != null) sorted[key] = source[key];
  });
  Object.keys(source || {}).forEach(key => {
    if (!sorted[key]) sorted[key] = source[key];
  });
  return sorted;
}

function generateLLYTHMainParamOrder(raw: Record<string, any>, fuel: Record<string, any>) {
  const order: string[] = [];

  order.push('综合入炉品位(%)');
  order.push('吨材毛利润(元/t)');
  order.push('本月毛利(亿元/月)');
  order.push('边际效益(亿元/月)');

  Object.values(raw).forEach(r => {
    if (r?.name) order.push(`${r.name}(%)`);
  });
  Object.values(fuel).forEach(f => {
    if (f?.name) order.push(`${f.name}(%)`);
  });
  order.push('吨铁成本(元/t)');
  order.push('铁水日产(t/d)');
  order.push('吨钢成本(元/t)');
  order.push('钢坯日产(t/d)');
  order.push('吨坯毛利润(元/t)');
  order.push('吨材成本(元/t)');
  order.push('吨钢成本(元/t)');
  order.push('带钢日产(t/d)');
  order.push('矿耗(t/t)');

  Object.values(raw).forEach(r => {
    if (r?.name) order.push(`${r.name}矿耗(t/t)`);
  });

  order.push('燃料比(kg/t)');
  order.push('焦比(t/t)');

  order.push('综合焦比(t/t)');

  Object.values(fuel).forEach(f => {
    if (f?.name) order.push(`${f.name}矿耗(t/t)`);
  });
  order.push('煤比(t/t)');


  return order;
}

function normalizeValue(val: any) {
  if (val == null) return null;
  if (typeof val === 'object' && 'value' in val) {
    return val.value;
  }
  return val;
}

@Injectable()
export class LlythCalcService {
  private readonly logger = new Logger(LlythCalcService.name);
  private readonly fastApiUrl = appConfig.api.fastApiUrl;
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(GlFuelInfo) private readonly glFuelRepo: Repository<GlFuelInfo>,
    @InjectRepository(SjCandidate) private readonly sjCandidateRepo: Repository<SjCandidate>,
    private readonly glConfigService: GlConfigService,
  ) { }

  /** 启动利润一体化计算任务 */
  async startTask(
    moduleName: string,
    user: User
  ): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      const config = await this.glConfigService.getLatestIngredients(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

      // ---------- 原料处理（快照） ----------
      const ingredientData = config.ingredientData || [];
      const ingredientIds = config.ingredientParams || [];
      const ingredientParams: Record<string, any> = {};

      ingredientData.forEach(raw => {
        if (!ingredientIds.includes(raw.id)) return;
        const composition = typeof raw.composition === 'string' ? JSON.parse(raw.composition) : raw.composition || {};
        ingredientParams[String(raw.id)] = Object.fromEntries(
          Object.entries({
            ...composition,
            TFe: composition?.TFe ?? 0,
            库存: raw.inventory ?? 0,
            返矿率: composition?.['返矿率'] ?? 0,
            返矿价格: composition?.['返矿价格'] ?? 0,
            干基价格: composition?.['干基价格'] ?? 0,
          }).map(([k, v]) => [k, safeNumber(v)])
        );
      });

      // ---------- 原料限制 ----------
      const ingredientLimits: Record<string, any> = {};
      Object.keys(config.ingredientLimits || {}).forEach(id => {
        const limit = config.ingredientLimits[id];
        if (!ingredientIds.includes(Number(id))) return;
        ingredientLimits[id] = { low_limit: safeNumber(limit.low_limit), top_limit: safeNumber(limit.top_limit) };
      });

      // ---------- 燃料处理（快照） ----------
      const fuelData = config.fuelData || [];
      const fuelIds: number[] = config.fuelParams || [];
      const fuelParams: Record<string, any> = {};

      fuelData.forEach(fuel => {
        if (!fuelIds.includes(fuel.id)) return;
        const composition = typeof fuel.composition === 'string' ? JSON.parse(fuel.composition) : fuel.composition || {};
        fuelParams[String(fuel.id)] = Object.fromEntries(
          Object.entries({
            ...composition,
            TFe: composition?.TFe ?? 0,
            库存: fuel.inventory ?? 0,
            返焦率: composition?.['返焦率'] ?? 0,
            返焦价格: composition?.['返焦价格'] ?? 0,
            干基价格: composition?.['干基价格'] ?? 0,
          }).map(([k, v]) => [k, safeNumber(v)])
        );
      });

      const fuelLimits: Record<string, any> = {};
      fuelIds.forEach(id => {
        const limit = config.fuelLimits?.[id];
        if (!fuelIds.includes(id) || !limit) return;
        fuelLimits[String(id)] = { low_limit: safeNumber(limit.low_limit), top_limit: safeNumber(limit.top_limit) };
      });

      // ---------- 整理 SJPlan ----------
      const candidates = await this.sjCandidateRepo.find({
        where: { user: { user_id: user.user_id }, module_type: '烧结配料计算' },
        relations: ['task', 'user'],
      });

      const sjPlan: Record<string, any> = {};

      candidates.forEach(candidate => {
        const resultData = candidate.result;
        if (!resultData || !resultData['化学成分']) return;

        const planId = candidate.id.toString();
        const chemical = resultData['化学成分'];

        const flatChemical: Record<string, number> = {};
        Object.keys(chemical).forEach(key => {
          flatChemical[key] = chemical[key]?.value ?? null;
        });

        const mainParams = resultData['主要参数'] || {};
        const costKey = Object.keys(mainParams).find(key => key.startsWith('成本'));
        const costValue = costKey != null ? mainParams[costKey] : null;

        sjPlan[planId] = {
          ...flatChemical,
          ...(costValue != null ? { 成本: costValue } : {}),
        };
      });

      // ---------- 其他参数 ----------
      const safeOtherSettings = {
        ...config.otherSettings,
        固定配比: Array.isArray(config.otherSettings?.['固定配比']) ? config.otherSettings['固定配比'] : [],
        块矿: Array.isArray(config.otherSettings?.['块矿']) ? config.otherSettings['块矿'] : [],
      };

      const fullParams = {
        calculateType: moduleName,
        SJPlan: sjPlan,
        ingredientData,
        fuelData,
        ingredientParams,
        ingredientLimits,
        fuelParams,
        fuelLimits,
        slagLimits: Object.fromEntries(
          Object.entries(config.slagLimits || {}).map(([k, v]: any) => [k, { low_limit: safeNumber(v.low_limit), top_limit: safeNumber(v.top_limit) }])
        ),
        hotMetalRatio: Object.fromEntries(Object.entries(config.hotMetalRatio || {}).map(([k, v]) => [k, safeNumber(v)])),
        loadTopLimits: Object.fromEntries(Object.entries(config.loadTopLimits || {}).map(([k, v]) => [k, safeNumber(v)])),
        ironWaterTopLimits: Object.fromEntries(Object.entries(config.ironWaterTopLimits || {}).map(([k, v]) => [k, safeNumber(v)])),
        otherSettings: safeOtherSettings,
      };

      this.logger.debug('=== Full Params for FastAPI ===');
      this.logger.debug(JSON.stringify(fullParams, null, 2));

      const res = await this.apiPost('/llyth/start/', fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results;

      if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

      const task = this.taskRepo.create({ task_uuid: taskUuid, module_type: moduleName, status: TaskStatus.RUNNING, parameters: fullParams, user });
      await this.taskRepo.save(task);
      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

      const idNameMap: Record<number, string> = {};
      ingredientData.forEach(r => idNameMap[r.id] = r.name);
      fuelData.forEach(f => idNameMap[f.id] = f.name);

      const resultMap: Record<string, any> = {};
      if (resultsById) {
        Object.keys(resultsById).forEach(idStr => {
          const id = Number(idStr);
          const name = idNameMap[id];
          if (name) resultMap[name] = resultsById[id];
        });
      }

      return ApiResponse.success({ taskUuid, resultMap }, '任务启动成功');
    } catch (err: any) {
      return this.handleError(err, '启动任务失败');
    }
  }

  /** 停止任务 */
  async stopTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 通知 FastAPI 停止
      await this.apiPost('/llyth/stop/', { taskUuid });

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

  private formatSchemeOrder(scheme: any) {
    const fixedLoadOrder = ['S负荷', 'P负荷', 'Mn负荷', '碱金属负荷', 'Zn负荷', 'Ti负荷'];
    const fixedIronOrder = ['P', 'Ti', 'Mn', 'Pb', 'Cr', 'Ni'];
    const fixedSlagOrder = [
      'FeO', 'CaO', 'SiO2', 'MgO', 'Al2O3',
      'S', 'TiO2', 'MnO',
      'R2', 'R3', 'R4',
      '镁铝比', '总渣量'
    ];

    const sortByOrder = (source: Record<string, any>, order: string[]) => {
      const sorted: Record<string, any> = {};
      order.forEach(key => {
        if (source?.[key] !== undefined) sorted[key] = source[key];
      });
      Object.keys(source || {}).forEach(key => {
        if (!sorted[key]) sorted[key] = source[key];
      });
      return sorted;
    };

    const raw = scheme['原料配比和矿耗'] || {};
    const fuel = scheme['燃料配比和矿耗'] || {};
    const mainParamOrder = generateLLYTHMainParamOrder(raw, fuel);

    return {
      ...scheme,
      主要参数: sortMainParameters(scheme['主要参数'], mainParamOrder),
      负荷: sortByOrder(scheme['负荷'], fixedLoadOrder),
      铁水含量: sortByOrder(scheme['铁水含量'], fixedIronOrder),
      炉渣成分: sortByOrder(scheme['炉渣成分'], fixedSlagOrder),
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
    private async loadResultsFromDb(taskUuid: string): Promise<any[]> {
    const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
    if (!resultEntity) return [];
    if (Array.isArray(resultEntity.output_data)) return resultEntity.output_data;
    if (typeof resultEntity.output_data === 'string') return JSON.parse(resultEntity.output_data);
    return resultEntity.output_data || [];
  }

    private mergeResults(oldResults: any[], newResults: any[]): any[] {
    const map = new Map<number, any>();
    [...oldResults, ...newResults].forEach(r => { if (r['方案序号'] != null) map.set(r['方案序号'], r); });
    return Array.from(map.values()).sort((a, b) => a['方案序号'] - b['方案序号']);
  }
    private mapFastApiStatusToTaskStatus(status: string): TaskStatus {
    switch (status) {
      case 'finished': return TaskStatus.FINISHED;
      case 'paused': return TaskStatus.PAUSED;
      case 'running': return TaskStatus.RUNNING;
      default: return TaskStatus.INITIALIZING;
    }
  }

    private async updateTaskStatus(taskUuid: string, status: TaskStatus, progress?: number, total?: number) {
    const task = await this.findTask(taskUuid);
    if (!task) return;
    task.status = status;
    if (progress != null) task.progress = progress;
    if (total != null) task.total = total;
    await this.taskRepo.save(task);
  }
  /** 查询任务进度 */
  async fetchAndSaveProgress(
    taskUuid: string,
    pagination?: PaginationDto,
    forceSave = false
  ): Promise<ApiResponse<any>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return this.taskInitializingFallback(taskUuid, pagination);

      const params = task.parameters || {};
      const ingredientNameMap: Record<string, string> = {};
      const fuelNameMap: Record<string, string> = {};

      (params.ingredientData || []).forEach(item => {
        if (item?.id != null) ingredientNameMap[String(item.id)] = item.name || '';
      });

      (params.fuelData || []).forEach(item => {
        if (item?.id != null) fuelNameMap[String(item.id)] = item.name || '';
      });

      let results: any[] = [];
      const FINAL_STATUS = [TaskStatus.PAUSED, TaskStatus.STOPPED, TaskStatus.FINISHED];

      // ================== FINAL状态处理 ==================
      if (FINAL_STATUS.includes(task.status) && !forceSave) {
        const cache = this.taskCache.get(taskUuid);
        if (cache?.results?.length) {
          results = cache.results;
        } else {
          results = await this.loadResultsFromDb(taskUuid);
        }
        results = results.map(item => sortLLYTHResult(item));
      }
      // ================== RUNNING状态处理 ==================
      else {
        const res = await this.apiGet('/llyth/progress/', { taskUuid });
        const { code, message, data } = res.data;

        if (code !== 0 || !data || !Array.isArray(data.results)) {
          throw new Error(message || 'FastAPI 返回异常');
        }

        // 合并缓存
        const cache = this.taskCache.get(taskUuid) || { results: [], lastUpdated: Date.now() };
        results = this.mergeResults(cache.results, data.results);

        // 更新任务状态
        const newStatus = this.mapFastApiStatusToTaskStatus(data.status);
        await this.updateTaskStatus(taskUuid, newStatus, data.progress, data.total);

        const needFormat = newStatus === TaskStatus.FINISHED
          || newStatus === TaskStatus.PAUSED
          || newStatus === TaskStatus.STOPPED
          || forceSave;

        if (needFormat) {
          // 格式化所有结果
          results = results.map(item =>
            formatLLYTHResultFull(
              item,
              ingredientNameMap,
              fuelNameMap,
              params.ingredientLimits,
              params.fuelLimits,
              params.loadTopLimits,
              params.ironWaterTopLimits,
              params.slagLimits
            )
          );

          // 成本排序和排名
          results.sort((a, b) => a["主要参数"].本月毛利 - b["主要参数"].本月毛利);
          results.forEach((item, idx) => item.利润排名 = idx + 1);

          if (results.length) {
            await this.saveResults(task, results);
          }
        } else {
          // 运行中排序
          results.sort((a, b) => a["方案序号"] - b["方案序号"]);
          results.forEach(item => sortLLYTHResult(item));

          // 成本排名
          const sortedByCost = [...results].sort((a, b) => a["主要参数"].本月毛利 - b["主要参数"].本月毛利);
          sortedByCost.forEach((item, idx) => {
            const target = results.find(r => r === item);
            if (target) target.利润排名 = idx + 1;
          });
        }

        // 更新缓存
        this.taskCache.set(taskUuid, { results, lastUpdated: Date.now() });
        if (newStatus === TaskStatus.FINISHED) this.taskCache.delete(taskUuid);

        task.status = newStatus;
        task.progress = data.progress ?? task.progress;
        task.total = data.total ?? task.total;
      }

      // ================== 分页 ==================
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

  /** 获取指定方案 */
  async getSchemeByIndex(
    taskUuid: string,
    index: number
  ): Promise<any | null> {

    const results = await this.loadResultsFromDb(taskUuid);

    const scheme = results.find(
      item => Number(item['方案序号']) === Number(index)
    );

    if (!scheme) return null;

    // 只做排序
    return sortLLYTHResult(scheme);
  }

  // ---------------- 工具函数 ----------------
  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> { return axios.post(`${this.fastApiUrl}${path}`, data); }
  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> { return axios.get(`${this.fastApiUrl}${path}`, { params }); }
  private async findTask(taskUuid: string): Promise<Task | null> { return this.taskRepo.findOne({ where: { task_uuid: taskUuid } }); }
  private async saveResults(task: Task, results: any[]): Promise<void> { await this.resultRepo.save(this.resultRepo.create({ task, output_data: results, is_shared: false, finished_at: new Date() })); }
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> { const message = err instanceof Error ? err.message : String(err); this.logger.error(`${prefix}: ${message}`); return ApiResponse.error(message); }

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

  async pauseTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');
      if (task.status !== TaskStatus.RUNNING) return ApiResponse.error('任务当前状态不可暂停');

      // 1️⃣ 通知 FastAPI 暂停
      await this.apiPost('/llyth/pause/', { taskUuid });
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

  private async waitFastApiPause(taskUuid: string, maxWait = 15000, interval = 300): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const res = await this.apiGet('/llyth/progress/', { taskUuid });
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


  async resumeTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {

    try {

      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 调用 FastAPI 继续
      const res = await this.apiPost('/llyth/resume/', { taskUuid });

      const runningStatus = res.data?.data?.status;

      if (runningStatus === 'running') {

        task.status = TaskStatus.RUNNING;

        // 2️⃣ 同步最新进度
        const progressRes = await this.apiGet('/llyth/progress/', { taskUuid });
        const progressData = progressRes.data?.data;

        task.progress = progressData?.progress ?? task.progress;
        task.total = progressData?.total ?? task.total;

        await this.taskRepo.save(task);

        return ApiResponse.success(
          { taskUuid, status: 'running' },
          '任务已继续'
        );
      }

      return ApiResponse.error(res.data?.message || '继续失败');

    } catch (err: unknown) {
      return this.handleError(err, '继续任务失败');
    }
  }

}  