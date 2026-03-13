import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlConfigService } from '../gl-config/gl-config.service' // 可共用配置服务
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import ExcelJS from 'exceljs';
import { GLExportSchemeDto } from './dto/export-scheme.dto';
import { appConfig } from 'src/config/app.config';
import { SjCandidate } from '../sj-candidate/entities/sj-candidate.entity';

const mainUnitMap: Record<string, string> = {
  成本: '成本(元/t)',
  综合入炉品位: '综合入炉品位(%)',
  矿耗: '矿耗(t/t)',
  燃料比: '燃料比(kg/t)',
  综合焦比: '综合焦比(t/t)',
  焦比: '焦比(t/t)',
  煤比: '煤比(t/t)'
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

function normalizeValue(val: any) {
  if (val == null) return null;

  // 如果已经是 { value: xxx }
  if (typeof val === "object" && "value" in val) {
    return val.value;
  }

  return val;
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

@Injectable()
export class GlCalcService {
  private readonly logger = new Logger(GlCalcService.name);
  private readonly fastApiUrl = appConfig.api.fastApiUrl;
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glRawMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(SjCandidate) private readonly sjCandidateRepo: Repository<SjCandidate>,  // ✅ 新增燃料表

    private readonly glconfigService: GlConfigService,
  ) { }


  /** 启动高炉配料计算任务 */
  async startTask(
    moduleName: string,
    user: User
  ): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      // 1️⃣ 获取最新配置（含快照）
      const config = await this.glconfigService.getLatestIngredients(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

      // ---------------- 原料处理（使用快照） ----------------
      const ingredientData = config.ingredientData || [];
      const ingredientIds = config.ingredientParams || [];

      const ingredientParams: Record<string, any> = {};
      ingredientData.forEach(raw => {
        if (!ingredientIds.includes(raw.id)) return; // 只取当前选中的
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

      // ---------------- 燃料处理（使用快照） ----------------
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

      // ---------------- 其他参数处理 ----------------
      const safeOtherSettings = {
        "其他费用": safeNumber(config.otherSettings?.["其他费用"]),
        "品位上限": safeNumber(config.otherSettings?.["品位上限"]),
        "品位下限": safeNumber(config.otherSettings?.["品位下限"]),
        "品位间距": safeNumber(config.otherSettings?.["品位间距"]),
        "固定配比": Array.isArray(config.otherSettings?.["固定配比"]) ? config.otherSettings["固定配比"] : [],
        "块矿": Array.isArray(config.otherSettings?.["块矿"]) ? config.otherSettings["块矿"] : [],
        "块矿总比例上限": safeNumber(config.otherSettings?.["块矿总比例上限"]),
        "块矿总比例下限": safeNumber(config.otherSettings?.["块矿总比例下限"]),
        "焦丁折算系数": safeNumber(config.otherSettings?.["焦丁折算系数"]),
        "焦丁比": safeNumber(config.otherSettings?.["焦丁比"]),
        "焦比": safeNumber(config.otherSettings?.["焦比"]),
        "煤比": safeNumber(config.otherSettings?.["煤比"]),
        "煤比折算系数": safeNumber(config.otherSettings?.["煤比折算系数"]),
        "铁水产量": safeNumber(config.otherSettings?.["铁水产量"]),
        "铁水含铁量": safeNumber(config.otherSettings?.["铁水含铁量"]),
        "铁水回收率": safeNumber(config.otherSettings?.["铁水回收率"]),
        "高炉余量设置": safeNumber(config.otherSettings?.["高炉余量设置"]),
        "焦丁比选择": String(config.otherSettings?.["焦丁比选择"] ?? ''),
        "煤比选择": String(config.otherSettings?.["煤比选择"] ?? '')
      };

      const fullParams = {
        calculateType: moduleName,
        ingredientData,   // ← 整个原料列表
        fuelData,         // ← 整个燃料列表
        ingredientParams,
        ingredientLimits,
        fuelParams,
        fuelLimits,
        slagLimits: Object.fromEntries(
          Object.entries(config.slagLimits || {}).map(([k, v]: any) => [
            k,
            { low_limit: safeNumber(v.low_limit), top_limit: safeNumber(v.top_limit) },
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

      // ---------------- 调用 FastAPI ----------------
      const res = await this.apiPost("/gl/start/", fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results;

      if (!taskUuid) throw new Error(res.data?.message || "FastAPI 未返回 taskUuid");

      // 保存 Task
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user
      });
      await this.taskRepo.save(task);

      // 初始化缓存
      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

      // ID → Name 映射（用快照）
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
          totalPages: 0,
        }, '任务初始化中');
      }

      let results: any[] = [];

      // ================== 🔥 构建快照映射 ==================
      const params = task.parameters || {};
      const ingredientData = params.ingredientData || [];
      const fuelData = params.fuelData || [];

      const ingredientIdNameMap: Record<string, string> = {};
      ingredientData.forEach(item => {
        if (item?.id != null && item?.name) {
          ingredientIdNameMap[String(item.id)] = item.name;
        }
      });

      const fuelIdNameMap: Record<string, string> = {};
      fuelData.forEach(item => {
        if (item?.id != null && item?.name) {
          fuelIdNameMap[String(item.id)] = item.name;
        }
      });

      // ================== 未完成任务 ==================
      if (task.status !== TaskStatus.FINISHED) {

        const res = await this.apiGet('/gl/progress/', { taskUuid });
        const { code, message, data } = res.data;

        if (code !== 0 || !data) {
          throw new Error(message || 'FastAPI 返回异常');
        }

        if (!Array.isArray(data.results)) {
          throw new Error('FastAPI 返回 results 不是数组');
        }

        // 过滤有效结果（必须有成本）
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

        // 先加入历史
        cache.results.forEach(item => {
          if (item?.方案序号 != null) {
            combinedMap[String(item.方案序号)] = item;
          }
        });

        // 再加入新结果（覆盖）
        validResults.forEach(item => {
          if (item?.方案序号 != null) {
            combinedMap[String(item.方案序号)] = item;
          }
        });

        results = Object.values(combinedMap);

        // ================== 成本排序 + 排名 ==================
        results.sort((a, b) =>
          a["主要参数"].成本 - b["主要参数"].成本
        );

        results.forEach((item, index) => {
          item.成本排名 = index + 1;
        });
        const ingredientLimits = params.ingredientLimits || {};
        const fuelLimits = params.fuelLimits || {};
        const slagLimits = params.slagLimits || {};
        const ironWaterTopLimits = params.ironWaterTopLimits || {};
        const loadTopLimits = params.loadTopLimits || {};
        // ================== 名称映射（基于快照） ==================
        results = results.map(item => {
          // ================== 1️⃣ 已改造直接返回 ==================
          if (item.__formatted) return item;

          const mapped: Record<string, any> = { ...item };

          // ================== 2️⃣ 原料配比和矿耗 ==================
          if (item["原料配比和矿耗"]) {
            const newRaw: Record<string, any> = {};
            Object.entries(item["原料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
              if (val?.矿耗 != null && val?.value != null) {
                const limits = ingredientLimits[id] || {};
                newRaw[id] = {
                  ...val,
                  name: ingredientIdNameMap[id] || id,
                  low_limit: limits.low_limit ?? 0,
                  top_limit: limits.top_limit ?? 100
                };
              }
            });
            mapped["原料配比和矿耗"] = newRaw;
          }

          // ================== 3️⃣ 燃料配比和矿耗 ==================
          if (item["燃料配比和矿耗"]) {
            const newFuel: Record<string, any> = {};

            Object.entries(item["燃料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
              const limits = fuelLimits[id] || {};
              const name = fuelIdNameMap[id] || val?.name || id;

              newFuel[id] = {
                name,
                value: val?.value ?? '--',        // 没有 value 的就默认 '--'
                矿耗: val?.矿耗 ?? 0,
                日消耗: val?.日消耗 ?? 0,
                可用天数: val?.可用天数 ?? 0,
                low_limit: limits.low_limit ?? 0,
                top_limit: limits.top_limit ?? 100,
              };

              // 保留原始的配比字段
              if (val?.配比 != null) newFuel[id].配比 = val.配比;
            });

            mapped["燃料配比和矿耗"] = newFuel;
          }
          // ================== 4️⃣ 主要参数 ==================
          if (item["主要参数"]) {
            const main = item["主要参数"];
            const raw = mapped["原料配比和矿耗"] || {};
            const fuel = mapped["燃料配比和矿耗"] || {};

            const newMain: Record<string, any> = {};

            // 成本
            if (main.成本 != null) newMain[mainUnitMap["成本"]] = main.成本;

            // 综合入炉品位
            if (main.综合入炉品位 != null) newMain[mainUnitMap["综合入炉品位"]] = main.综合入炉品位;

            // 原料配比 value
            Object.values(raw).forEach((r: any) => {
              if (r?.name && r?.value != null) newMain[`${r.name}(%)`] = r.value;
            });

            // 原料矿耗
            Object.values(raw).forEach((r: any) => {
              if (r?.name && r?.矿耗 != null) newMain[`${r.name}矿耗(t/t)`] = r.矿耗;
            });

            // 矿耗
            if (main.矿耗 != null) newMain[mainUnitMap["矿耗"]] = main.矿耗;

            // 燃料比 / 综合焦比 / 焦比
            ["燃料比", "综合焦比", "焦比"].forEach(key => {
              if (main[key] != null) newMain[mainUnitMap[key]] = main[key];
            });

            // 燃料配比 value
            Object.values(fuel).forEach((f: any) => {
              if (f?.name && f?.value != null) newMain[`${f.name}(%)`] = f.value;
            });

            // 燃料矿耗
            Object.values(fuel).forEach((f: any) => {
              if (f?.name && f?.矿耗 != null) newMain[`${f.name}矿耗(t/t)`] = f.矿耗;
            });

            // 煤比
            if (main.煤比 != null) newMain[mainUnitMap["煤比"]] = main.煤比;

            // 动态生成顺序
            const mainParamOrder = generateMainParamOrder(raw, fuel);

            // 按顺序排序
            mapped["主要参数"] = sortMainParameters(newMain, mainParamOrder);
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

          // ================== 8️⃣ 标记已改造 ==================
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
        } else if (data.status === 'paused') {
          task.status = TaskStatus.PAUSED;
        } else {
          task.status = TaskStatus.RUNNING;
        }

        task.progress = data.progress;
        task.total = data.total;

        await this.taskRepo.save(task);

        // ================== 完成任务 → 持久化 ==================
        if (task.status === TaskStatus.FINISHED && results.length) {
          await this.saveResults(task, results);
          this.taskCache.delete(taskUuid);
        }

      } else {

        const resultEntity = await this.resultRepo.findOne({
          where: { task: { task_uuid: taskUuid } }
        });

        const dbResults =
          Array.isArray(resultEntity?.output_data)
            ? resultEntity.output_data
            : JSON.parse(resultEntity?.output_data || '[]');

        // 🔥 按固定顺序整理
        results = dbResults.map(item => this.formatSchemeOrder(item));
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
        totalPages,
      });

    } catch (err: any) {
      return ApiResponse.success({
        taskUuid,
        status: 'initializing',
        progress: 0,
        total: 0,
        results: [],
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalResults: 0,
        totalPages: 0,
      }, '任务初始化中');
    }
  }

  async stopTask(
    taskUuid: string
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 调用 FastAPI 停止
      const res = await this.apiPost('/gl/stop/', { taskUuid });

      if (res.data?.status === 'stopped' || res.status === 200) {

        // ================== 1️⃣ 获取缓存结果 ==================
        const cache = this.taskCache.get(taskUuid);

        if (cache?.results?.length) {
          // 按成本排序
          const results = [...cache.results].sort(
            (a, b) => a["主要参数"].成本 - b["主要参数"].成本
          );

          // 更新排名
          results.forEach((item, index) => {
            item.成本排名 = index + 1;
          });

          // ================== 2️⃣ 保存数据库 ==================
          await this.saveResults(task, results);
        }

        // ================== 3️⃣ 更新任务状态 ==================
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);

        // ================== 4️⃣ 清理缓存 ==================
        this.taskCache.delete(taskUuid);

        return ApiResponse.success(
          { taskUuid, status: 'stopped' },
          '任务已停止，结果已保存'
        );
      }

      return ApiResponse.error(res.data?.message || '停止失败');

    } catch (err: unknown) {
      return this.handleError(err, '停止任务失败');
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

    const raw = scheme["原料配比和矿耗"] || {};
    const fuel = scheme["燃料配比和矿耗"] || {};
    const mainParamOrder = generateMainParamOrder(raw, fuel);

    return {
      ...scheme,
      主要参数: sortMainParameters(scheme["主要参数"], mainParamOrder),
      负荷: sortByOrder(scheme["负荷"], fixedLoadOrder),
      铁水含量: sortByOrder(scheme["铁水含量"], fixedIronOrder),
      炉渣成分: sortByOrder(scheme["炉渣成分"], fixedSlagOrder),
    };
  }
  async getSchemeByIndex(
    taskUuid: string,
    schemeIndex: number
  ): Promise<ApiResponse<any>> {

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

    // 🔥 这里只做固定顺序排序，不再拼 limits

    const fixedLoadOrder = ['S负荷', 'P负荷', 'Mn负荷', '碱金属负荷', 'Zn负荷', 'Ti负荷'];
    const fixedIronOrder = ['P', 'Ti', 'Mn', 'Pb', 'Cr', 'Ni'];
    const fixedSlagOrder = ['FeO', 'CaO', 'SiO2', 'MgO', 'Al2O3', 'S', 'TiO2', 'MnO', 'R2', 'R3', 'R4', '镁铝比', '总渣量'];

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

    const raw = scheme["原料配比和矿耗"] || {};
    const fuel = scheme["燃料配比和矿耗"] || {};
    const mainParamOrder = generateMainParamOrder(raw, fuel);

    return ApiResponse.success({
      ...scheme,
      主要参数: sortMainParameters(scheme["主要参数"], mainParamOrder),
      负荷: sortByOrder(scheme['负荷'], fixedLoadOrder),
      铁水含量: sortByOrder(scheme['铁水含量'], fixedIronOrder),
      炉渣成分: sortByOrder(scheme['炉渣成分'], fixedSlagOrder),
    });
  }



  /** 导出单个高炉方案为 Excel，并整理所需参数 */
  async exportSchemeExcel(taskUuid: string, index: number) {

    // 1️⃣ 获取方案
    const scheme = await this.getSchemeByIndex(taskUuid, index);
    if (!scheme?.data) throw new Error('方案不存在');

    const data = scheme.data;

    const ingredient = data['原料配比和矿耗'] || {};
    const fuel = data['燃料配比和矿耗'] || {};
    const mainParams = data['主要参数'] || {};

    // 2️⃣ 获取任务
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
    });

    if (!task) throw new Error('任务不存在');

    const params = task.parameters || {};

    const ingredientParamsDB = params.ingredientParams || {};
    const fuelParamsDB = params.fuelParams || {};

    const ingredientData = params.ingredientData || [];
    const fuelData = params.fuelData || [];

    // ================== ID → Name 映射 ==================

    const ingredientNameMap: Record<string, string> = {};
    ingredientData.forEach(i => {
      ingredientNameMap[String(i.id)] = i.name;
    });

    const fuelNameMap: Record<string, string> = {};
    fuelData.forEach(f => {
      fuelNameMap[String(f.id)] = f.name;
    });

    // ================== ingredientParams ==================

    const ingredientParams: Record<string, any> = {};

    for (const id of Object.keys(ingredient)) {

      const schemeVal = ingredient[id];
      const base = ingredientParamsDB[id];

      if (!base) continue;

      const name = ingredientNameMap[id] || id;

      const category =
        ingredientData.find(i => String(i.id) === id)?.category || '';

      ingredientParams[name] = {
        返矿率: base['返矿率'] ?? 0,
        返矿价格: base['返矿价格'] ?? 0,
        干基价格: base['干基价格'] ?? 0,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
        配比: Number(schemeVal?.value) || 0,
      };
    }

    // ================== fuelParams ==================

    const fuelParams: Record<string, any> = {};

    const coalRatioId = String(params?.otherSettings?.['煤比选择'] ?? '');
    const cokeRatioId = String(params?.otherSettings?.['焦丁比选择'] ?? '');

    for (const id of Object.keys(fuel)) {

      const schemeVal = fuel[id];
      const base = fuelParamsDB[id];

      if (!base) continue;

      const name = fuelNameMap[id] || id;

      const category =
        fuelData.find(i => String(i.id) === id)?.category || '';

      const baseParams = {
        返焦率: base['返焦率'] ?? 0,
        返焦价格: base['返焦价格'] ?? 0,
        干基价格: base['干基价格'] ?? 0,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
      };

      // 煤比燃料不加配比
      if (id === coalRatioId) {
        fuelParams[name] = baseParams;
      } else {
        fuelParams[name] = {
          ...baseParams,
          配比: Number(schemeVal?.value) || 0,
        };
      }
    }

    // ================== otherSettings ==================

    const coalRatioName = fuelNameMap[coalRatioId] || '';
    const cokeRatioName = fuelNameMap[cokeRatioId] || '';

    const finalOtherSettings = {
      综合入炉品位: mainParams?.['综合入炉品位(%)'] ?? 0,
      燃料比: mainParams?.['燃料比(kg/t)'] ?? 0,
      煤比: mainParams?.['煤比(t/t)'] ?? 0,
      焦比: mainParams?.['焦比(t/t)'] ?? 0,
      焦丁比选择: cokeRatioName,
      煤比选择: coalRatioName,
      其他费用: params?.otherSettings?.['其他费用'] ?? 0,
      导出名称: `${taskUuid}-${index}`
    };
    console.log('ingredientParams:', ingredientParams);
    console.log('fuelParams:', fuelParams);
    console.log('otherSettings:', finalOtherSettings);
    console.log('原料数据:', ingredient);
    console.log('燃料数据:', fuel);
    console.log('主要参数:', mainParams);
    return {
      ingredientParams,
      fuelParams,
      otherSettings: finalOtherSettings,
    };
  }


  /** 导出单个高炉方案为 Excel，并整理所需参数 */
  async exportYTHSchemeExcel(taskUuid: string, index: number) {
    // 1️⃣ 获取方案
    const schemeRes = await this.getSchemeByIndex(taskUuid, index);
    if (!schemeRes?.data) throw new Error('方案不存在');
    console.log('原始方案数据:', schemeRes.data);
    const data = schemeRes.data;
    const ingredient = data['原料配比和矿耗'] || {};
    const fuel = data['燃料配比和矿耗'] || {};
    const mainParams = data['主要参数'] || {};

    // 2️⃣ 获取任务
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) throw new Error('任务不存在');

    const params = task.parameters || {};
    const ingredientData = params.ingredientData || [];
    const fuelData = params.fuelData || [];
    const ingredientParamsDB = params.ingredientParams || {};
    const fuelParamsDB = params.fuelParams || {};

    // 3️⃣ 构建 ID -> 名字映射
    const ingredientNameMap: Record<string, string> = {};
    ingredientData.forEach(i => ingredientNameMap[String(i.id)] = i.name);

    const fuelNameMap: Record<string, string> = {};
    fuelData.forEach(f => fuelNameMap[String(f.id)] = f.name);

    // 4️⃣ 变量选择
    const variableSelection: Record<string, string> = params?.otherSettings?.['变量选择'] || {};
    // 例: { "自产烧结矿": "64" }

    // 5️⃣ 读取 candidate 对应烧结矿序号
    const candidate = await this.sjCandidateRepo.findOne({
      where: { id: Number(data['烧结矿序号']) },
    });

    const candidateResult = candidate?.result || {};
    const candidateCost = candidateResult?.['主要参数']?.['成本(元)'] ?? null;

    console.log('变量选择:', variableSelection);
    console.log('烧结矿序号:', data['烧结矿序号']);
    console.log('候选成本:', candidateCost);

    // 6️⃣ 构建 ingredientParams
    const ingredientParams: Record<string, any> = {};
    for (const id of Object.keys(ingredient)) {
      const schemeVal = ingredient[id];
      const base = ingredientParamsDB[id];
      if (!base) continue;

      const name = ingredientNameMap[id] || id;
      const category = ingredientData.find(i => String(i.id) === id)?.category || '';

      let dryPrice = base['干基价格'] ?? 0;

      // ✅ 直接判断
      console.log('当前 ingredient ID:', id);
      console.log('当前 ingredient name:', name);
      console.log('默认干基价格:', dryPrice);
      console.log('variableSelection:', variableSelection);

      if (String(variableSelection) === id) {
        console.log(`✅ 匹配成功: ${name} 使用 sj_candidate 成本覆盖 ${candidateCost}`);
        dryPrice = candidateCost ?? dryPrice;
      }

      ingredientParams[name] = {
        返矿率: base['返矿率'] ?? 0,
        返矿价格: base['返矿价格'] ?? 0,
        干基价格: dryPrice,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
        配比: Number(schemeVal?.value) || 0,
      };
    }
    // 7️⃣ 构建 fuelParams
    const fuelParams: Record<string, any> = {};
    const coalRatioId = String(params?.otherSettings?.['煤比选择'] ?? '');
    const cokeRatioId = String(params?.otherSettings?.['焦丁比选择'] ?? '');

    for (const id of Object.keys(fuel)) {
      const schemeVal = fuel[id];
      const base = fuelParamsDB[id];
      if (!base) continue;

      const name = fuelNameMap[id] || id;
      const category = fuelData.find(i => String(i.id) === id)?.category || '';

      const baseParams = {
        返焦率: base['返焦率'] ?? 0,
        返焦价格: base['返焦价格'] ?? 0,
        干基价格: base['干基价格'] ?? 0,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
      };

      fuelParams[name] = id === coalRatioId
        ? baseParams
        : { ...baseParams, 配比: Number(schemeVal?.value) || 0 };
    }

    // 8️⃣ 构建其他参数
    const coalRatioName = fuelNameMap[coalRatioId] || '';
    const cokeRatioName = fuelNameMap[cokeRatioId] || '';
    const finalOtherSettings = {
      综合入炉品位: mainParams?.['综合入炉品位(%)'] ?? 0,
      燃料比: mainParams?.['燃料比(kg/t)'] ?? 0,
      煤比: mainParams?.['煤比(t/t)'] ?? 0,
      焦比: mainParams?.['焦比(t/t)'] ?? 0,
      焦丁比选择: cokeRatioName,
      煤比选择: coalRatioName,
      其他费用: params?.otherSettings?.['其他费用'] ?? 0,
      导出名称: `${taskUuid}-${index}`,
    };

    console.log('最终 ingredientParams:', ingredientParams);
    console.log('最终 fuelParams:', fuelParams);
    console.log('最终 otherSettings:', finalOtherSettings);

    return { ingredientParams, fuelParams, otherSettings: finalOtherSettings };
  }


  async callFastApi(payload: {
    ingredientParams: any;
    fuelParams: any;
    otherSettings: any;
  }) {
    const response = await axios.post(
      `${this.fastApiUrl}/gl/export/excel/`,
      payload,
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(response.data);
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

    if (task.status !== TaskStatus.RUNNING) {
      return ApiResponse.error('任务当前状态不可暂停');
    }

    // 1️⃣ 发出暂停信号
    const res = await this.apiPost('/gl/pause/', { taskUuid });
    if (res.status !== 200) {
      return ApiResponse.error(res.data?.message || '暂停失败');
    }

    // 2️⃣ 轮询等待后端真正暂停
    const interval = 500; // 每 0.5 秒检查一次
    const maxWait = 10000; // 最多等待 10 秒
    let elapsed = 0;
    let paused = false;
    let progress = task.progress;
    let total = task.total;

    while (elapsed < maxWait) {
      const check = await this.apiGet('/gl/progress/', { taskUuid });
      const status = check.data?.data?.status;

      if (status === 'paused') {
        paused = true;
        progress = check.data?.data?.progress ?? progress;
        total = check.data?.data?.total ?? total;
        break;
      }

      await new Promise(r => setTimeout(r, interval));
      elapsed += interval;
    }

    if (!paused) {
      return ApiResponse.error('等待后端暂停超时');
    }

    // 3️⃣ 从缓存取整理好的结果
    const cache = this.taskCache.get(taskUuid);
    const results = cache?.results || [];

    if (results.length > 0) {
      let resultEntity = await this.resultRepo.findOne({
        where: { task: { task_uuid: taskUuid } },
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

    // 4️⃣ 更新任务状态
    task.status = TaskStatus.PAUSED;
    task.progress = progress;
    task.total = total;
    await this.taskRepo.save(task);

    // 5️⃣ 可选：清理缓存
    this.taskCache.delete(taskUuid);

    return ApiResponse.success(
      { taskUuid, status: 'paused' },
      '任务已暂停并保存整理好的结果'
    );
  } catch (err) {
    return this.handleError(err, '暂停任务失败');
  }
}


  /** 继续任务 */
  async resumeTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {

    try {

      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 调用 FastAPI 继续
      const res = await this.apiPost('/gl/resume/', { taskUuid });

      const runningStatus = res.data?.data?.status;

      if (runningStatus === 'running') {

        task.status = TaskStatus.RUNNING;

        // 2️⃣ 同步最新进度
        const progressRes = await this.apiGet('/gl/progress/', { taskUuid });
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
