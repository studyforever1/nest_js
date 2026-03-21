import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlConfigService } from '../gl-config/gl-config.service';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import { appConfig } from '../../config/app.config';
import { formatGLResultFull,sortGLResult } from '../../common/formatters/gl.formatter'


@Injectable()
export class GlFixedCalcService {
  private readonly logger = new Logger(GlFixedCalcService.name);
  private readonly fastApiUrl = appConfig.api.fastApiUrl;

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glRawMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(GlFuelInfo) private readonly glFuelRepo: Repository<GlFuelInfo>,
    private readonly glconfigService: GlConfigService,
  ) { }

  // ============================
  // 启动任务
  // ============================
  async startTask(
    moduleName: string,
    user: User
  ): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      // ---------------- 获取模块配置 ----------------
      const config = await this.glconfigService.getLatestIngredients(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

      // ---------------- 原料参数 ----------------
      const ingredientData = config.ingredientData || [];
      const ingredientParams: Record<string, any> = {};
      const ingredientIdNameMap: Record<number, string> = {};

      ingredientData.forEach(raw => {
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
        if (raw.name) ingredientIdNameMap[raw.id] = raw.name;
      });

      // 原料限额
      const ingredientLimits: Record<string, any> = {};
      Object.entries(config.ingredientLimits || {}).forEach(([id, limit]: any) => {
        ingredientLimits[id] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      });

      // ---------------- 燃料参数 ----------------
      const fuelData = config.fuelData || [];
      const fuelParams: Record<string, any> = {};
      const fuelIdNameMap: Record<number, string> = {};

      fuelData.forEach(fuel => {
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
        if (fuel.name) fuelIdNameMap[fuel.id] = fuel.name;
      });

      // 燃料限额
      const fuelLimits: Record<string, any> = {};
      Object.entries(config.fuelLimits || {}).forEach(([id, limit]: any) => {
        fuelLimits[id] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      });

      // ---------------- 其他参数 ----------------
      const safeOtherSettings = Object.fromEntries(
        Object.entries(config.otherSettings || {}).map(([k, v]) => [k, typeof v === 'number' ? safeNumber(v) : String(v ?? '')])
      );

      // ---------------- 构建请求参数 ----------------
      const fullParams = {
        calculateType: moduleName,
        ingredientData,
        fuelData,
        ingredientParams,
        ingredientLimits,
        ingredientResults: config.ingredientResults || {},
        fuelParams,
        fuelLimits,
        fuelResults: config.fuelResults || {},
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
      const res = await this.apiPost('gl-fixed/start', fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results;
      if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

      // ---------------- 保存任务 ----------------
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user
      });
      await this.taskRepo.save(task);

      // ---------------- 构建 ID → Name 映射 ----------------
      const idNameMap: Record<number, string> = { ...ingredientIdNameMap, ...fuelIdNameMap };

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

  // ============================
  // 查询进度
  // ============================
async getProgress(taskUuid: string): Promise<ApiResponse<any>> {
  try {
    // ---------------- 1️⃣ 查询任务 ----------------
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });

    if (!task) {
      // ❗ 不报错，直接返回“初始化状态”
      return ApiResponse.success({
        taskUuid,
        status: 'initializing',
        progress: 0,
        total: 0,
        results: []
      });
    }

    let results: any[] = [];

    // ---------------- 构建名称映射 ----------------
    const parameters = task.parameters || {};
    const ingredientNameMap: Record<string, string> = {};
    const fuelNameMap: Record<string, string> = {};

    (parameters.ingredientData || []).forEach(item => {
      if (item?.id != null) {
        ingredientNameMap[String(item.id)] = item.name || '';
      }
    });

    (parameters.fuelData || []).forEach(item => {
      if (item?.id != null) {
        fuelNameMap[String(item.id)] = item.name || '';
      }
    });

    // ============================
    // 安全 format
    // ============================
    const safeFormat = (item: any) => {
      try {
        return formatGLResultFull(
          item,
          ingredientNameMap,
          fuelNameMap,
          parameters.ingredientLimits || {},
          parameters.fuelLimits || {},
          parameters.loadTopLimits || {},
          parameters.ironWaterTopLimits || {},
          parameters.slagLimits || {}
        );
      } catch (err) {
        this.logger.warn('formatGLResultFull 失败，已降级');
        return {};
      }
    };

    // ============================
    // 安全排序
    // ============================
    const safeSort = (list: any[]) => {
      try {
        return list.map(item =>
          sortGLResult({
            ...item,
            方案序号: item['方案序号'] ?? 1
          })
        );
      } catch (err) {
        this.logger.warn('sortGLResult 失败，跳过排序');
        return list;
      }
    };

    // ---------------- 2️⃣ 未完成任务 ----------------
    if (task.status !== TaskStatus.FINISHED) {

      let data: any = null;

      try {
        const res: AxiosResponse = await this.apiPost(
          'gl-fixed/progress',
          {},
          { taskUuid }
        );

        data = res.data?.data;

      } catch (err: any) {
        const status = err?.response?.status;

        if (status === 404) {
          this.logger.warn(`FastAPI 404: ${taskUuid} 未就绪`);
        } else {
          this.logger.error(`FastAPI 错误: ${err.message}`);
        }

        // ❗ 关键：不抛错
        data = null;
      }

      // ---------------- 有数据才处理 ----------------
      if (data && Array.isArray(data.results)) {

        results = data.results;

        // 更新任务状态
        task.status = data.status === 'finished'
          ? TaskStatus.FINISHED
          : TaskStatus.RUNNING;

        task.progress = Number(data.progress ?? 0);
        task.total = Number(data.total ?? 0);

        await this.taskRepo.save(task);

        // ---------------- 格式化 ----------------
        results = results.map(item => {
          const formatted = safeFormat(item);
          return {
            ...item,
            ...formatted
          };
        });

        // ---------------- 排序（可选） ----------------
        results = safeSort(results);

        // ---------------- 保存结果 ----------------
        if (results.length) {
          await this.saveResults(task, results);
        }
      }
    }

    // ---------------- 3️⃣ 已完成任务 ----------------
    else {
      const resultEntity = await this.resultRepo.findOne({
        where: { task: { task_uuid: taskUuid } }
      });

      if (resultEntity?.output_data?.length) {
        results = safeSort(resultEntity.output_data);
      }
    }

    // ---------------- 4️⃣ 返回统一结构 ----------------
    return ApiResponse.success({
      taskUuid,
      status: task.status,
      progress: task.progress ?? 0,
      total: results.length,
      results,
    });

  } catch (err: any) {
    // ❗ 最外层兜底（不能影响轮询）
    this.logger.error(`getProgress异常: ${err.message}`);
    
    return ApiResponse.success({
      taskUuid,
      status: 'running',
      progress: 0,
      total: 0,
      results: []
    });
  }
}

  // ============================
  // 保存结果到数据库
  // ============================
  private async saveResults(task: Task, results: any[]): Promise<void> {
    if (!results?.length) return;
    await this.resultRepo.save(this.resultRepo.create({
      task,
      output_data: results,
      is_shared: false,
      finished_at: new Date()
    }));
  }

  // ============================
  // 错误处理
  // ============================
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }

  // ============================
  // Axios 封装
  // ============================
  private async apiPost(path: string, data: any, params: any = {}): Promise<AxiosResponse<any>> {
    const url = `${this.fastApiUrl}/${path.replace(/^\/+/, '')}`;
    return axios.post(url, data, { params, headers: { 'Content-Type': 'application/json' } });
  }

  private async apiGet(path: string, params: any = {}): Promise<AxiosResponse<any>> {
    const url = `${this.fastApiUrl}/${path.replace(/^\/+/, '')}`;
    return axios.get(url, { params, headers: { 'Content-Type': 'application/json' } });
  }
}
