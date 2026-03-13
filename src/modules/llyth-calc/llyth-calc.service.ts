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

      const res = await this.apiPost('/llyth/stop/', { taskUuid });
      if (res.data?.status !== 'stopped' && res.status !== 200) return ApiResponse.error(res.data?.message || '停止失败');

      const cache = this.taskCache.get(taskUuid);
      if (cache?.results?.length) await this.saveResults(task, cache.results);

      task.status = TaskStatus.STOPPED;
      await this.taskRepo.save(task);
      this.taskCache.delete(taskUuid);

      return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止，已保存当前计算结果');
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
          totalPages: 0,
        }, '任务初始化中');
      }

      let results: any[] = [];

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
        if (item?.id != null && item?.name) ingredientIdNameMap[String(item.id)] = item.name;
      });
      fuelData.forEach((item: any) => {
        if (item?.id != null && item?.name) fuelIdNameMap[String(item.id)] = item.name;
      });

      if (task.status !== TaskStatus.FINISHED) {
        const res = await this.apiGet('/llyth/progress/', { taskUuid });
        const { code, message, data } = res.data;

        if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');
        if (!Array.isArray(data.results)) throw new Error('FastAPI 返回 results 不是数组');

        // 过滤有效方案（有主要参数即可）
        const validResults = data.results.filter(
          item => item && item['主要参数'] && typeof item['主要参数'] === 'object' && Object.keys(item['主要参数']).length > 0
        );

        // 合并缓存
        const cache = this.taskCache.get(taskUuid) || { results: [], lastUpdated: Date.now() };
        const combinedMap: Record<string, any> = {};
        cache.results.forEach(item => {
          if (item?.方案序号 != null) combinedMap[String(item.方案序号)] = item;
        });
        validResults.forEach(item => {
          if (item?.方案序号 != null) combinedMap[String(item.方案序号)] = item;
        });
        results = Object.values(combinedMap);

        // 名称映射 + 主要参数构建（与 tqyth 一致）
        results = results.map(item => {
          if (item.__formatted) return item;

          const mapped: Record<string, any> = { ...item };

          // 原料（FastAPI 可能不返回原料配比，从快照补充）
          {
            const rawSource = item['原料配比和矿耗'] || {};
            const newRaw: Record<string, any> = {};
            // 先从 FastAPI 返回数据构建
            Object.entries(rawSource).forEach(([id, val]: any) => {
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
                top_limit: limits.top_limit ?? 100,
              };
            });
            // 如果 FastAPI 没有返回原料配比，从快照补充名称（value 用 null 占位）
            if (Object.keys(newRaw).length === 0) {
              ingredientData.forEach((ing: any) => {
                const id = String(ing.id);
                const limits = ingredientLimits[id] || {};
                newRaw[id] = {
                  name: ing.name,
                  value: null,
                  矿耗: 0,
                  日消耗: 0,
                  可用天数: 0,
                  low_limit: limits.low_limit ?? 0,
                  top_limit: limits.top_limit ?? 100,
                };
              });
            }
            mapped['原料配比和矿耗'] = newRaw;
          }

          // 燃料（FastAPI 可能不返回全部燃料配比，从快照补充）
          {
            const fuelSource = item['燃料配比和矿耗'] || {};
            const newFuel: Record<string, any> = {};
            // 先从快照初始化所有燃料（value 用 '--' 占位）
            fuelData.forEach((f: any) => {
              const id = String(f.id);
              const limits = fuelLimits[id] || {};
              newFuel[id] = {
                name: f.name,
                value: '--',
                矿耗: 0,
                日消耗: 0,
                可用天数: 0,
                low_limit: limits.low_limit ?? 0,
                top_limit: limits.top_limit ?? 100,
              };
            });
            // 再用 FastAPI 返回数据覆盖
            Object.entries(fuelSource).forEach(([id, val]: any) => {
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
                top_limit: limits.top_limit ?? 100,
              };
            });
            mapped['燃料配比和矿耗'] = newFuel;
          }

          // 主要参数构建
          if (item['主要参数']) {
            const main = item['主要参数'];
            const raw = mapped['原料配比和矿耗'] || {};
            const fuel = mapped['燃料配比和矿耗'] || {};
            const newMain: Record<string, any> = {};

            // 1️⃣ 固定头部字段
            if (main.综合入炉品位 != null) newMain[mainUnitMap['综合入炉品位']] = main.综合入炉品位;
            if (main.吨材毛利润 != null) newMain[mainUnitMap['吨材毛利润']] = main.吨材毛利润;
            if (main.本月毛利 != null) newMain[mainUnitMap['本月毛利']] = main.本月毛利;
            if (main.边际效益 != null) newMain[mainUnitMap['边际效益']] = main.边际效益;

            // 2️⃣ 原料配比
            Object.values(raw).forEach((r: any) => {
              if (r?.name && r?.value != null) newMain[`${r.name}(%)`] = r.value;
            });

            // 3️⃣ 燃料配比
            Object.values(fuel).forEach((f: any) => {
              if (f?.name && f?.value != null) newMain[`${f.name}(%)`] = f.value;
            });

            // 4️⃣ 固定中部字段
            if (main.吨铁成本 != null) newMain[mainUnitMap['吨铁成本']] = main.吨铁成本;
            if (main.铁水日产 != null) newMain[mainUnitMap['铁水日产']] = main.铁水日产;
            if (main.吨钢成本 != null) newMain[mainUnitMap['吨钢成本']] = main.吨钢成本;
            if (main.钢坯日产 != null) newMain[mainUnitMap['钢坯日产']] = main.钢坯日产;
            if (main.吨坯毛利润 != null) newMain[mainUnitMap['吨坯毛利润']] = main.吨坯毛利润;
            if (main.吨材成本 != null) newMain[mainUnitMap['吨材成本']] = main.吨材成本;
            if (main.带钢日产 != null) newMain[mainUnitMap['带钢日产']] = main.带钢日产;

            // 5️⃣ 矿耗
            if (main.矿耗 != null) newMain[mainUnitMap['矿耗']] = main.矿耗;

            // 6️⃣ 原料矿耗
            Object.values(raw).forEach((r: any) => {
              if (r?.name && r?.矿耗 != null) newMain[`${r.name}矿耗(t/t)`] = r.矿耗;
            });

            // 7️⃣ 燃料比 / 焦比 / 综合焦比
            if (main.燃料比 != null) newMain[mainUnitMap['燃料比']] = main.燃料比;
            if (main.焦比 != null) newMain[mainUnitMap['焦比']] = main.焦比;
            if (main.综合焦比 != null) newMain[mainUnitMap['综合焦比']] = main.综合焦比;

            // 8️⃣ 燃料矿耗
            Object.values(fuel).forEach((f: any) => {
              if (f?.name && f?.矿耗 != null) newMain[`${f.name}矿耗(t/t)`] = f.矿耗;
            });

            // 9️⃣ 煤比
            if (main.煤比 != null) newMain[mainUnitMap['煤比']] = main.煤比;

            const order = generateLLYTHMainParamOrder(raw, fuel);
            mapped['主要参数'] = sortMainParameters(newMain, order);
          }

          // 负荷
          if (item['负荷']) {
            const newLoad: Record<string, any> = {};
            Object.entries(item['负荷']).forEach(([key, val]) => {
              const top = loadTopLimits[key];
              newLoad[key] = { value: normalizeValue(val), low_limit: 0, top_limit: top ?? 100 };
            });
            mapped['负荷'] = newLoad;
          }

          // 铁水含量
          if (item['铁水含量']) {
            const newIron: Record<string, any> = {};
            Object.entries(item['铁水含量']).forEach(([key, val]) => {
              const top = ironWaterTopLimits[key] ?? 100;
              const realValue = Number((normalizeValue(val) ?? 0).toFixed(2));
              newIron[key] = { value: realValue, low_limit: 0, top_limit: top };
            });
            mapped['铁水含量'] = newIron;
          }

          // 炉渣成分
          if (item['炉渣成分']) {
            const newSlag: Record<string, any> = {};
            Object.entries(item['炉渣成分']).forEach(([key, val]) => {
              const limits = slagLimits[key] || {};
              newSlag[key] = {
                value: normalizeValue(val),
                low_limit: limits.low_limit ?? 0,
                top_limit: limits.top_limit ?? 100,
              };
            });
            mapped['炉渣成分'] = newSlag;
          }

          mapped.__formatted = true;
          return mapped;
        });

        // 利润排名（按本月毛利降序）
        results.sort((a, b) => {
          const aVal = a['主要参数']?.[mainUnitMap['本月毛利']] ?? a['主要参数']?.本月毛利 ?? 0;
          const bVal = b['主要参数']?.[mainUnitMap['本月毛利']] ?? b['主要参数']?.本月毛利 ?? 0;
          return bVal - aVal;
        });
        results.forEach((item, index) => { item.利润排名 = index + 1; });

        // 更新缓存
        cache.results = results;
        cache.lastUpdated = Date.now();
        this.taskCache.set(taskUuid, cache);

        // 更新任务状态
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

        if (task.status === TaskStatus.FINISHED && results.length) {
          await this.saveResults(task, results);
          this.taskCache.delete(taskUuid);
        }

      } else {
        // 已完成 → 从数据库读取
        const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
        const dbResults = Array.isArray(resultEntity?.output_data)
          ? resultEntity.output_data
          : JSON.parse(resultEntity?.output_data || '[]');
        results = dbResults.map(item => this.formatSchemeOrder(item));
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
        totalPages,
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
        totalPages: 0,
      }, '任务初始化中');
    }
  }

  /** 获取指定方案 */
  async getSchemeByIndex(taskUuid: string, schemeIndex: number): Promise<ApiResponse<any>> {
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) return ApiResponse.error('任务不存在', 404);

    const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
    if (!resultEntity) return ApiResponse.error('结果不存在', 404);

    let allResults: any[] = [];
    if (Array.isArray(resultEntity.output_data)) allResults = resultEntity.output_data;
    else if (typeof resultEntity.output_data === 'string') {
      try { allResults = JSON.parse(resultEntity.output_data); } catch { return ApiResponse.error('结果解析错误'); }
    }

    const scheme = allResults.find(item => item['方案序号'] === schemeIndex);
    if (!scheme) return ApiResponse.error('方案不存在', 404);

    const { ingredientLimits = {}, fuelLimits = {}, slagLimits = {}, ironWaterTopLimits = {}, loadTopLimits = {} } = task.parameters || {};

    const params = task.parameters || {};
    const ingredientData = params.ingredientData || [];
    const fuelData = params.fuelData || [];

    const ingredientIdNameMap: Record<string, string> = {};
    ingredientData.forEach((item: any) => {
      if (item.id != null && item.name) ingredientIdNameMap[String(item.id)] = item.name;
    });

    const fuelIdNameMap: Record<string, string> = {};
    fuelData.forEach((item: any) => {
      if (item.id != null && item.name) fuelIdNameMap[String(item.id)] = item.name;
    });

    const processMaterials = (field: string, limitsMap: Record<string, any>, nameMap: Record<string, string>) => {
      const data: Record<string, any> = scheme[field] || {};
      const result: Record<string, any> = {};
      Object.entries(data).forEach(([id, val]: any) => {
        const limits = limitsMap[id] || {};
        result[id] = { ...val, name: val.name || nameMap[id] || id, low_limit: limits.low_limit ?? 0, top_limit: limits.top_limit ?? 100 };
      });
      return result;
    };

    const processValuesWithLimits = (data: Record<string, any>, limitsMap: Record<string, any>, lowDefault = 0, topDefault = 100) => {
      const result: Record<string, any> = {};
      Object.entries(data || {}).forEach(([key, val]) => {
        const limits = limitsMap[key] || {};
        result[key] = { value: normalizeValue(val), low_limit: limits.low_limit ?? lowDefault, top_limit: limits.top_limit ?? topDefault };
      });
      return result;
    };

    const rawMaterials = processMaterials('原料配比和矿耗', ingredientLimits, ingredientIdNameMap);
    const fuelMaterials = processMaterials('燃料配比和矿耗', fuelLimits, fuelIdNameMap);
    const load = processValuesWithLimits(scheme['负荷'], loadTopLimits);
    const slag = processValuesWithLimits(scheme['炉渣成分'], slagLimits);
    const ironWater = processValuesWithLimits(scheme['铁水含量'], ironWaterTopLimits);

    const mainParamOrder = generateLLYTHMainParamOrder(rawMaterials, fuelMaterials);
    const sortedMainParams = sortMainParameters(scheme['主要参数'], mainParamOrder);

    const fixedLoadOrder = ['S负荷', 'P负荷', 'Mn负荷', '碱金属负荷', 'Zn负荷', 'Ti负荷'];
    const fixedIronOrder = ['P', 'Ti', 'Mn', 'Pb', 'Cr', 'Ni'];
    const fixedSlagOrder = ['FeO', 'CaO', 'SiO2', 'MgO', 'Al2O3', 'S', 'TiO2', 'MnO', 'R2', 'R3', 'R4', '镁铝比', '总渣量'];

    const sortByOrder = (source: Record<string, any>, order: string[]) => {
      const sorted: Record<string, any> = {};
      order.forEach(key => { if (source?.[key]) sorted[key] = source[key]; });
      Object.keys(source || {}).forEach(key => { if (!sorted[key]) sorted[key] = source[key]; });
      return sorted;
    };

    return ApiResponse.success({
      '原料配比和矿耗': rawMaterials,
      '燃料配比和矿耗': fuelMaterials,
      '负荷': sortByOrder(load, fixedLoadOrder),
      '炉渣成分': sortByOrder(slag, fixedSlagOrder),
      '铁水含量': sortByOrder(ironWater, fixedIronOrder),
      '主要参数': sortedMainParams,
      '方案序号': scheme['方案序号'],
      '烧结矿序号': scheme['烧结矿序号'],
    }, '获取成功');
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

async pauseTask(
  taskUuid: string
): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
  try {
    const task = await this.findTask(taskUuid);

    if (!task) {
      return ApiResponse.error('任务不存在');
    }

    if (task.status !== TaskStatus.RUNNING) {
      return ApiResponse.error('任务当前状态不可暂停');
    }

    // 1️⃣ 发出暂停信号
    const res = await this.apiPost('/llyth/pause/', { taskUuid });
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
      const check = await this.apiGet('/llyth/progress/', { taskUuid });
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
        relations: ['task'],
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

    // 5️⃣ 清理缓存
    this.taskCache.delete(taskUuid);

    return ApiResponse.success(
      { taskUuid, status: 'paused' },
      '任务已暂停并保存整理好的结果'
    );
  } catch (err) {
    return this.handleError(err, '暂停任务失败');
  }
}


  async resumeTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {

      const task = await this.findTask(taskUuid);

      if (!task) {
        return ApiResponse.error('任务不存在');
      }

      if (task.status !== TaskStatus.PAUSED) {
        return ApiResponse.error('任务未处于暂停状态');
      }

      const res = await this.apiPost('/llyth/resume/', { taskUuid });

      if (res.status !== 200) {
        return ApiResponse.error(res.data?.message || '恢复失败');
      }

      task.status = TaskStatus.RUNNING;

      await this.taskRepo.save(task);

      return ApiResponse.success({
        taskUuid,
        status: 'running'
      }, '任务继续执行');

    } catch (err) {
      return this.handleError(err, '恢复任务失败');
    }
  }
}  