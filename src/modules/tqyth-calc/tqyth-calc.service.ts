import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity'; // 原料表，可复用
import { GlConfigService } from '../gl-config/gl-config.service'; // 可复用配置服务
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity'; // 燃料表，可复用
import { SjCandidate } from '../sj-candidate/entities/sj-candidate.entity';
import { appConfig } from 'src/config/app.config';


const mainUnitMap: Record<string, string> = {
  成本: '成本(元/t)',
  综合入炉品位: '综合入炉品位(%)',
  矿耗: '矿耗(t/t)',
  燃料比: '燃料比(kg/t)',
  综合焦比: '综合焦比(t/t)',
  焦比: '焦比(t/t)',
  煤比: '煤比(t/t)',
  固定费用: '固定费用(元)',
  生料比影响综合焦比: '生料比影响综合焦比(kg/t)'
};

function sortMainParameters(source: Record<string, any>, order: string[]) {
  const sorted: Record<string, any> = {};
  order.forEach(key => {
    if (source?.[key] != null) sorted[key] = source[key];
  });
  // 保留其他未在 order 中的字段
  Object.keys(source || {}).forEach(key => {
    if (!sorted[key]) sorted[key] = source[key];
  });
  return sorted;
}

function generateMainParamOrder(raw: Record<string, any>, fuel: Record<string, any>) {
  const order: string[] = [];

  // 1️⃣ 固定字段前置
  order.push("成本(元/t)");
  order.push("综合入炉品位(%)");

  // 2️⃣ 原料配比
  Object.values(raw).forEach(r => {
    if (r?.name) order.push(`${r.name}(%)`);
  });

  // 3️⃣ 原料矿耗
  Object.values(raw).forEach(r => {
    if (r?.name) order.push(`${r.name}矿耗(t/t)`);
  });

  // 4️⃣ 矿耗
  order.push("矿耗(t/t)");

  // 5️⃣ 燃料比 / 综合焦比 / 焦比
  order.push("燃料比(kg/t)");
  order.push("综合焦比(t/t)");
  order.push("焦比(t/t)");

  // 6️⃣ 燃料配比
  Object.values(fuel).forEach(f => {
    if (f?.name) order.push(`${f.name}(%)`);
  });

  // 7️⃣ 燃料矿耗
  Object.values(fuel).forEach(f => {
    if (f?.name) order.push(`${f.name}矿耗(t/t)`);
  });

  // 8️⃣ 煤比
  order.push("煤比(t/t)");


  return order;
}

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

function normalizeValue(val: any) {
  if (val == null) return null;

  // 如果已经是 { value: xxx }
  if (typeof val === "object" && "value" in val) {
    return val.value;
  }

  return val;
}

@Injectable()
export class TqythCalcService {
  private readonly logger = new Logger(TqythCalcService.name);
  private readonly fastApiUrl = appConfig.api.fastApiUrl;
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(GlFuelInfo) private readonly glFuelRepo: Repository<GlFuelInfo>,  // ✅ 新增燃料表
    @InjectRepository(SjCandidate) private readonly sjCandidateRepo: Repository<SjCandidate>,
    private readonly glConfigService: GlConfigService, // 可复用
  ) { }

  /** 启动铁前一体化配料计算I 任务，支持 SJPlan */
  async startTask(
    moduleName: string,
    user: User
  ): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      const config = await this.glConfigService.getLatestIngredients(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

      // ---------------- 原料处理（快照） ----------------
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

      // ---------------- 原料限制 ----------------
      const ingredientLimits: Record<string, any> = {};
      Object.keys(config.ingredientLimits || {}).forEach(id => {
        const limit = config.ingredientLimits[id];
        if (!ingredientIds.includes(Number(id))) return;
        ingredientLimits[id] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      });

      // ---------------- 燃料处理（快照） ----------------
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
        fuelLimits[String(id)] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      });

      // ---------------- 整理 SJPlan ----------------
      const candidates = await this.sjCandidateRepo.find({
        where: {
          user: { user_id: user.user_id },
          module_type: '烧结配料计算',
        },
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

        // 🔥 动态查找成本字段（兼容 成本 / 成本(元)）
        const mainParams = resultData['主要参数'] || {};
        const costKey = Object.keys(mainParams).find(key =>
          key.startsWith('成本')
        );

        const costValue =
          costKey != null ? mainParams[costKey] : null;

        sjPlan[planId] = {
          ...flatChemical,
          ...(costValue != null ? { 成本: costValue } : {}),
        };
      });

      // ---------------- 其他参数 ----------------
      const safeOtherSettings = {
        ...config.otherSettings,
        固定配比: Array.isArray(config.otherSettings?.["固定配比"]) ? config.otherSettings["固定配比"] : [],
        块矿: Array.isArray(config.otherSettings?.["块矿"]) ? config.otherSettings["块矿"] : [],
      };

      const fullParams = {
        calculateType: moduleName,
        SJPlan: sjPlan,
        ingredientData,           // ✅ 原始原料快照
        fuelData,                 // ✅ 原始燃料快照
        ingredientParams,
        ingredientLimits,
        fuelParams,
        fuelLimits,
        slagLimits: Object.fromEntries(
          Object.entries(config.slagLimits || {}).map(([k, v]: any) => [
            k,
            { low_limit: safeNumber(v.low_limit), top_limit: safeNumber(v.top_limit) }
          ])
        ),
        hotMetalRatio: Object.fromEntries(
          Object.entries(config.hotMetalRatio || {}).map(([k, v]) => [k, safeNumber(v)])
        ),
        loadTopLimits: Object.fromEntries(
          Object.entries(config.loadTopLimits || {}).map(([k, v]) => [k, safeNumber(v)])
        ),
        ironWaterTopLimits: Object.fromEntries(
          Object.entries(config.ironWaterTopLimits || {}).map(([k, v]) => [k, safeNumber(v)])
        ),
        otherSettings: safeOtherSettings,
      };

      this.logger.debug('=== Full Params for FastAPI ===');
      this.logger.debug(JSON.stringify(fullParams, null, 2));

      const res = await this.apiPost('/tqyth/start/', fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results;

      if (!taskUuid) throw new Error(res.data?.message || "FastAPI 未返回 taskUuid");

      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user
      });
      await this.taskRepo.save(task);
      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

      // ---------------- ID → Name 映射（快照） ----------------
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

      return ApiResponse.success({ taskUuid, resultMap }, "任务启动成功");

    } catch (err: any) {
      return this.handleError(err, "启动任务失败");
    }
  }

  /** 停止任务 */
  /** 停止任务（并保存已计算结果） */
  async stopTask(
    taskUuid: string,
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 调用 FastAPI 停止任务
      const res = await this.apiPost('/tqyth/stop/', { taskUuid });

      if (res.data?.status !== 'stopped' && res.status !== 200) {
        return ApiResponse.error(res.data?.message || '停止失败');
      }

      // 2️⃣ 尝试保存当前已计算结果
      const cache = this.taskCache.get(taskUuid);
      if (cache?.results?.length) {
        await this.saveResults(task, cache.results);
      }

      // 3️⃣ 更新任务状态
      task.status = TaskStatus.STOPPED;
      await this.taskRepo.save(task);

      // 4️⃣ 清理缓存
      this.taskCache.delete(taskUuid);

      return ApiResponse.success(
        { taskUuid, status: 'stopped' },
        '任务已停止，已保存当前计算结果',
      );
    } catch (err: unknown) {
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
        if (source?.[key] !== undefined) {
          sorted[key] = source[key];
        }
      });

      Object.keys(source || {}).forEach(key => {
        if (!sorted[key]) {
          sorted[key] = source[key];
        }
      });

      return sorted;
    };

    const main = scheme["主要参数"] || {};
    const raw = scheme["原料配比和矿耗"] || {};
    const fuel = scheme["燃料配比和矿耗"] || {};

    // ⚡ generateMainParamOrder 只负责生成基础顺序
    let mainParamOrder = generateMainParamOrder(raw, fuel);

    // 🔥 如果主要参数里有固定费用或生料比影响综合焦比，放到最后
    if ('固定费用' in main && !mainParamOrder.includes('固定费用(元)')) {
      mainParamOrder.push('固定费用(元)');
    }
    if ('生料比影响综合焦比' in main && !mainParamOrder.includes('生料比影响综合焦比(kg/t)')) {
      mainParamOrder.push('生料比影响综合焦比(kg/t)');
    }

    // 排序
    scheme["主要参数"] = sortMainParameters(main, mainParamOrder);

    return {
      ...scheme,
      主要参数: sortMainParameters(scheme["主要参数"], mainParamOrder),
      负荷: sortByOrder(scheme["负荷"], fixedLoadOrder),
      铁水含量: sortByOrder(scheme["铁水含量"], fixedIronOrder),
      炉渣成分: sortByOrder(scheme["炉渣成分"], fixedSlagOrder),
    };
  }

  /** 查询任务进度 */
  async fetchAndSaveProgress(
    taskUuid: string,
    pagination?: PaginationDto
  ): Promise<ApiResponse<any>> {
    try {

      const task = await this.findTask(taskUuid);

      if (!task) {
        return ApiResponse.success({
          taskUuid,
          status: 'initializing',
          progress: 0,
          total: 0,
          results: [],
          page: pagination?.page ?? 1,
          pageSize: pagination?.pageSize ?? 10,
          totalResults: 0,
          totalPages: 0
        }, '任务初始化中');
      }

      let results: any[] = [];

      // ================== 构建快照映射 ==================

      const params = task.parameters || {};

      const ingredientData = params.ingredientData || [];
      const fuelData = params.fuelData || [];

      const ingredientLimits = params.ingredientLimits || {};
      const fuelLimits = params.fuelLimits || {};

      const slagLimits = params.slagLimits || {};
      const ironWaterTopLimits = params.ironWaterTopLimits || {};
      const loadTopLimits = params.loadTopLimits || {};

      const ingredientIdNameMap: Record<string, string> = {};
      const fuelIdNameMap: Record<string, string> = {};

      ingredientData.forEach((item: any) => {
        if (item?.id != null && item?.name) {
          ingredientIdNameMap[String(item.id)] = item.name;
        }
      });

      fuelData.forEach((item: any) => {
        if (item?.id != null && item?.name) {
          fuelIdNameMap[String(item.id)] = item.name;
        }
      });

      // ================== 未完成任务 ==================

      if (task.status !== TaskStatus.FINISHED) {

        const res = await this.apiGet('/tqyth/progress/', { taskUuid });

        const { code, message, data } = res.data;

        if (code !== 0 || !data) {
          throw new Error(message || 'FastAPI 返回异常');
        }

        if (!Array.isArray(data.results)) {
          throw new Error('FastAPI 返回 results 不是数组');
        }

        // ================== 过滤有效方案 ==================

        const validResults = data.results.filter(item =>
          item &&
          item["主要参数"] &&
          typeof item["主要参数"].成本 === "number"
        );

        // ================== 合并缓存 ==================

        const cache = this.taskCache.get(taskUuid) || {
          results: [],
          lastUpdated: Date.now()
        };

        const combinedMap: Record<string, any> = {};

        cache.results.forEach(item => {
          if (item?.方案序号 != null) {
            combinedMap[String(item.方案序号)] = item;
          }
        });

        validResults.forEach(item => {
          if (item?.方案序号 != null) {
            combinedMap[String(item.方案序号)] = item;
          }
        });

        results = Object.values(combinedMap);

        // ================== 成本排序 ==================

        results.sort((a, b) =>
          a["主要参数"].成本 - b["主要参数"].成本
        );

        results.forEach((item, index) => {
          item.成本排名 = index + 1;
        });

        // ================== 名称映射 + 顺序整理 ==================

        results = results.map(item => {

          if (item.__formatted) return item;

          const mapped: Record<string, any> = { ...item };

          // ===== 原料 =====

          if (item["原料配比和矿耗"]) {

            const newRaw: Record<string, any> = {};

            Object.entries(item["原料配比和矿耗"]).forEach(([id, val]: any) => {

              const limits = ingredientLimits[id] || {};
              const name = ingredientIdNameMap[id] || val?.name || id;

              const value = val?.value ?? val?.配比;

              newRaw[id] = {
                name,
                value,
                矿耗: val?.矿耗 ?? 0,
                日消耗: val?.日消耗 ?? 0,
                可用天数: val?.可用天数 ?? 0,
                low_limit: limits.low_limit ?? 0,
                top_limit: limits.top_limit ?? 100
              };

            });

            mapped["原料配比和矿耗"] = newRaw;

          }

          // ===== 燃料 =====

          if (item["燃料配比和矿耗"]) {

            const newFuel: Record<string, any> = {};

            Object.entries(item["燃料配比和矿耗"]).forEach(([id, val]: any) => {

              const limits = fuelLimits[id] || {};
              const name = fuelIdNameMap[id] || val?.name || id;

              const value = val?.value ?? val?.配比 ?? '--';

              newFuel[id] = {
                name,
                value,
                矿耗: val?.矿耗 ?? 0,
                日消耗: val?.日消耗 ?? 0,
                可用天数: val?.可用天数 ?? 0,
                low_limit: limits.low_limit ?? 0,
                top_limit: limits.top_limit ?? 100
              };

            });

            mapped["燃料配比和矿耗"] = newFuel;

          }

          // ===== 主要参数排序 =====

          if (item["主要参数"]) {

            const main = item["主要参数"];

            const raw = mapped["原料配比和矿耗"] || {};
            const fuel = mapped["燃料配比和矿耗"] || {};

            const newMain: Record<string, any> = {};

            if (main.成本 != null)
              newMain[mainUnitMap["成本"]] = main.成本;

            if (main.综合入炉品位 != null)
              newMain[mainUnitMap["综合入炉品位"]] = main.综合入炉品位;



            // 原料配比
            Object.values(raw).forEach((r: any) => {
              if (r?.name && r?.value != null)
                newMain[`${r.name}(%)`] = r.value;
            });

            // 原料矿耗
            Object.values(raw).forEach((r: any) => {
              if (r?.name && r?.矿耗 != null)
                newMain[`${r.name}矿耗(t/t)`] = r.矿耗;
            });

            if (main.矿耗 != null)
              newMain[mainUnitMap["矿耗"]] = main.矿耗;

            ["燃料比", "综合焦比", "焦比"].forEach(key => {
              if (main[key] != null)
                newMain[mainUnitMap[key]] = main[key];
            });

            // 燃料配比
            Object.values(fuel).forEach((f: any) => {
              if (f?.name && f?.value != null)
                newMain[`${f.name}(%)`] = f.value;
            });

            // 燃料矿耗
            Object.values(fuel).forEach((f: any) => {
              if (f?.name && f?.矿耗 != null)
                newMain[`${f.name}矿耗(t/t)`] = f.矿耗;
            });

            if (main.煤比 != null)
              newMain[mainUnitMap["煤比"]] = main.煤比;

            if (main['固定费用'] != null)
              newMain[mainUnitMap['固定费用']] = main['固定费用'];

            if (main['生料比影响综合焦比'] != null)
              newMain[mainUnitMap['生料比影响综合焦比']] = main['生料比影响综合焦比'];
            const order = generateMainParamOrder(raw, fuel);

            mapped["主要参数"] = sortMainParameters(newMain, order);

          }
          // ================== 5️⃣ 负荷 ==================
          if (item["负荷"]) {
            const newLoad: Record<string, any> = {};
            Object.entries(item["负荷"]).forEach(([key, val]) => {
              const top = loadTopLimits[key];
              const realValue = normalizeValue(val);
              newLoad[key] = { value: realValue, low_limit: 0, top_limit: top ?? 100 };
            });
            mapped["负荷"] = newLoad;
          }

          // ================== 6️⃣ 铁水含量 ==================
          // ================== 6️⃣ 铁水含量 ==================
          // ================== 6️⃣ 铁水含量 ==================
          if (item["铁水含量"]) {
            const newIron: Record<string, any> = {};
            Object.entries(item["铁水含量"]).forEach(([key, val]) => {
              const top = ironWaterTopLimits[key] ?? 100;
              const realValue = Number((normalizeValue(val)).toFixed(2)); // ⚡ 乘以100并保留两位小数
              newIron[key] = { value: realValue, low_limit: 0, top_limit: top };
            });
            mapped["铁水含量"] = newIron;
          }

          // ================== 7️⃣ 炉渣成分 ==================
          if (item["炉渣成分"]) {
            const newSlag: Record<string, any> = {};

            Object.entries(item["炉渣成分"]).forEach(([key, val]) => {
              const limits = slagLimits[key] || {};
              let realValue = normalizeValue(val);
              newSlag[key] = {
                value: realValue,
                low_limit: limits.low_limit ?? 0,
                top_limit: limits.top_limit ?? 100
              };
            });

            mapped["炉渣成分"] = newSlag;
          }

          mapped.__formatted = true;

          return mapped;

        });

        // ================== 更新缓存 ==================

        cache.results = results;
        cache.lastUpdated = Date.now();
        this.taskCache.set(taskUuid, cache);

        // ================== 更新任务状态 ==================

        if (data.status === 'finished') {
          task.status = TaskStatus.FINISHED;
        }
        else if (data.status === 'paused') {
          task.status = TaskStatus.PAUSED;
        }
        else {
          task.status = TaskStatus.RUNNING;
        }

        task.progress = data.progress;
        task.total = data.total;

        await this.taskRepo.save(task);

        // ================== 完成任务 ==================

        if (task.status === TaskStatus.FINISHED && results.length) {

          await this.saveResults(task, results);

          this.taskCache.delete(taskUuid);

        }

      }

      // ================== 已完成任务 ==================

      else {

        const resultEntity = await this.resultRepo.findOne({
          where: { task: { task_uuid: taskUuid } }
        });

        const dbResults =
          Array.isArray(resultEntity?.output_data)
            ? resultEntity.output_data
            : JSON.parse(resultEntity?.output_data || '[]');

        results = dbResults.map(item =>
          this.formatSchemeOrder(item)
        );

      }

      // ================== 分页 ==================

      const { pagedResults, totalResults, totalPages } =
        this.applyPaginationAndSort(results, pagination);

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

    } catch {

      return ApiResponse.success({
        taskUuid,
        status: 'initializing',
        progress: 0,
        total: 0,
        results: [],
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalResults: 0,
        totalPages: 0
      }, '任务初始化中');

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

  async getSchemeByIndex(
    taskUuid: string,
    schemeIndex: number
  ): Promise<ApiResponse<any>> {

    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid }
    });

    if (!task)
      return ApiResponse.error('任务不存在', 404);

    const resultEntity = await this.resultRepo.findOne({
      where: { task: { task_uuid: taskUuid } }
    });

    if (!resultEntity)
      return ApiResponse.error('结果不存在', 404);

    const allResults =
      Array.isArray(resultEntity.output_data)
        ? resultEntity.output_data
        : JSON.parse(resultEntity.output_data || '[]');

    const scheme = allResults.find(
      item => item['方案序号'] === schemeIndex
    );

    if (!scheme)
      return ApiResponse.error('方案不存在', 404);

    const params = task.parameters || {};

    const ingredientData = params.ingredientData || [];
    const fuelData = params.fuelData || [];

    // ================== ID → Name ==================

    const ingredientNameMap: Record<string, string> = {};
    ingredientData.forEach(i => {
      ingredientNameMap[String(i.id)] = i.name;
    });

    const fuelNameMap: Record<string, string> = {};
    fuelData.forEach(f => {
      fuelNameMap[String(f.id)] = f.name;
    });

    // ================== 原料 ==================

    const rawMaterials: Record<string, any> = {};
    const raw = scheme['原料配比和矿耗'] || {};

    Object.entries(raw).forEach(([id, val]: any) => {
      rawMaterials[id] = {
        ...val,
        name: val?.name || ingredientNameMap[id] || id
      };
    });

    // ================== 燃料 ==================

    const fuelMaterials: Record<string, any> = {};
    const fuel = scheme['燃料配比和矿耗'] || {};

    Object.entries(fuel).forEach(([id, val]: any) => {
      fuelMaterials[id] = {
        ...val,
        name: val?.name || fuelNameMap[id] || id
      };
    });

    // ================== 固定排序 ==================

    const fixedLoadOrder = [
      'S负荷',
      'P负荷',
      'Mn负荷',
      '碱金属负荷',
      'Zn负荷',
      'Ti负荷'
    ];

    const fixedIronOrder = [
      'P',
      'Ti',
      'Mn',
      'Pb',
      'Cr',
      'Ni'
    ];

    const fixedSlagOrder = [
      'FeO',
      'CaO',
      'SiO2',
      'MgO',
      'Al2O3',
      'S',
      'TiO2',
      'MnO',
      'R2',
      'R3',
      'R4',
      '镁铝比',
      '总渣量'
    ];

    const sortByOrder = (source: Record<string, any>, order: string[]) => {
      const sorted: Record<string, any> = {};

      order.forEach(key => {
        if (source?.[key]) sorted[key] = source[key];
      });

      Object.keys(source || {}).forEach(key => {
        if (!sorted[key]) sorted[key] = source[key];
      });

      return sorted;
    };

    // ================== 主参数排序 ==================

    const main = scheme["主要参数"] || {};

    // ⚡ generateMainParamOrder 只负责生成基础顺序
    let mainParamOrder = generateMainParamOrder(raw, fuel);

    // 🔥 如果主要参数里有固定费用或生料比影响综合焦比，放到最后
    if ('固定费用' in main && !mainParamOrder.includes('固定费用(元)')) {
      mainParamOrder.push('固定费用(元)');
    }
    if ('生料比影响综合焦比' in main && !mainParamOrder.includes('生料比影响综合焦比(kg/t)')) {
      mainParamOrder.push('生料比影响综合焦比(kg/t)');
    }


    return ApiResponse.success({
      '原料配比和矿耗': rawMaterials,
      '燃料配比和矿耗': fuelMaterials,
      '主要参数': sortMainParameters(
        scheme['主要参数'],
        mainParamOrder
      ),
      '负荷': sortByOrder(scheme['负荷'], fixedLoadOrder),
      '铁水含量': sortByOrder(scheme['铁水含量'], fixedIronOrder),
      '炉渣成分': sortByOrder(scheme['炉渣成分'], fixedSlagOrder),
      '方案序号': scheme['方案序号'],
      '烧结矿序号': scheme['烧结矿序号']
    });
  }


  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> { return axios.post(`${this.fastApiUrl}${path}`, data); }
  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> { return axios.get(`${this.fastApiUrl}${path}`, { params }); }
  private async findTask(taskUuid: string): Promise<Task | null> { return this.taskRepo.findOne({ where: { task_uuid: taskUuid } }); }
  private async saveResults(task: Task, results: any[]): Promise<void> { await this.resultRepo.save(this.resultRepo.create({ task, output_data: results, is_shared: false, finished_at: new Date() })); }
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> { const message = err instanceof Error ? err.message : String(err); this.logger.error(`${prefix}: ${message}`); return ApiResponse.error(message); }


  /** 暂停任务 */
async pauseTask(
  taskUuid: string
): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
  try {
    const task = await this.findTask(taskUuid);
    if (!task) return ApiResponse.error('任务不存在');

    // 1️⃣ 发出暂停信号
    await this.apiPost('/tqyth/pause/', { taskUuid });

    // 2️⃣ 轮询检查任务是否真正暂停
    const maxWait = 5000; // 最多等待 10 秒
    const interval = 500;  // 每 0.5 秒检查一次
    let elapsed = 0;
    let paused = false;
    let progress = task.progress;
    let total = task.total;

    while (elapsed < maxWait) {
      const res = await this.apiGet('/tqyth/progress/', { taskUuid });
      const status = res.data?.data?.status;
      if (status === 'paused') {
        paused = true;
        progress = res.data?.data?.progress ?? progress;
        total = res.data?.data?.total ?? total;
        break;
      }
      await new Promise(r => setTimeout(r, interval));
      elapsed += interval;
    }

    if (!paused) {
      return ApiResponse.error('等待后端暂停超时');
    }

    // 3️⃣ 更新任务状态
    task.status = TaskStatus.PAUSED;
    task.progress = progress;
    task.total = total;
    await this.taskRepo.save(task);

    // 4️⃣ 保存缓存结果到数据库
    const cache = this.taskCache.get(taskUuid);
    const results = cache?.results || [];

    if (results.length) {
      let resultEntity = await this.resultRepo.findOne({
        where: { task: { task_uuid: taskUuid } },
        relations: ['task']
      });

      if (resultEntity) {
        resultEntity.output_data = results;
        resultEntity.finished_at = new Date();
        await this.resultRepo.save(resultEntity);
      } else {
        await this.resultRepo.save({
          task,
          output_data: results,
          is_shared: false,
          finished_at: new Date(),
        });
      }
    }

    // 5️⃣ 可选：清理缓存
    // this.taskCache.delete(taskUuid);

    return ApiResponse.success(
      { taskUuid, status: 'paused' },
      '任务已暂停并保存最新结果'
    );

  } catch (err: unknown) {
    return this.handleError(err, '暂停任务失败');
  }
}

  /** 继续任务 */
  async resumeTask(
    taskUuid: string
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {

    try {

      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 调用 FastAPI 继续
      const res = await this.apiPost('/tqyth/resume/', { taskUuid });

      const runningStatus = res.data?.data?.status;

      if (runningStatus === 'running') {

        task.status = TaskStatus.RUNNING;

        // 2️⃣ 同步最新进度
        const progressRes = await this.apiGet('/tqyth/progress/', { taskUuid });
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
