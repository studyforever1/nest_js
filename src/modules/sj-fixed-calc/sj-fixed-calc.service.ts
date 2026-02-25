// ============================
// SjFixedCalcService
// ============================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { SjconfigService } from '../sj-config/sj-config.service';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { appConfig } from 'src/config/app.config';

@Injectable()
export class SjFixedCalcService {
    private readonly logger = new Logger(SjFixedCalcService.name);

    // ✅ FastAPI 基础地址（统一去掉末尾 /）
    private readonly fastApiBaseUrl = appConfig.api.fastApiUrl.replace(/\/$/, '');

    constructor(
        @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
        @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
        private readonly sjconfigService: SjconfigService,
    ) {
        this.logger.log(`FastAPI BaseURL => ${this.fastApiBaseUrl}`);
    }

    // ============================
    // FastAPI POST 统一封装（唯一出口）
    // ============================
    private async apiPost(
        path: string,
        data: any,
        params: any = {},
    ): Promise<AxiosResponse<any>> {
        const url = `${this.fastApiBaseUrl}/${path.replace(/^\/+/, '')}`;

        this.logger.debug(`[FastAPI POST] ${url}`);

        return axios.post(url, data, {
            params,
            headers: { 'Content-Type': 'application/json' },
            timeout: 60_000,
        });
    }

    // ============================
    // 启动任务
    // ============================
async startTask(
    user: User,
    calculateType: string,
): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
        if (!user) throw new Error('无法获取当前用户');

        const config = await this.sjconfigService.getLatestConfigByName(user, calculateType);
        if (!config) throw new Error(`未找到模块 ${calculateType} 的配置`);

        const safeNumber = (v: any, d = 0) =>
            v != null && !isNaN(Number(v)) ? Number(v) : d;

        // =========================
        // 1️⃣ 使用 ingredientData 快照
        // =========================
        const ingredientData: any[] = config.ingredientData || [];

        // 原料配比参数
        const ingredientParams: Record<string, any> = {};
        ingredientData.forEach(raw => {
            if (!raw.enabled) return;
            const comp = raw.composition || {};
            ingredientParams[raw.id] = {
                ...comp,
                TFe: comp.TFe ?? 0,
                烧损: comp['烧损'] ?? 0,
                价格: comp['价格'] ?? 0,
                库存: raw.inventory ?? 0,
            };
        });

        // 原料限制
        const ingredientLimitsClean: Record<string, any> = {};
        const limits = config.ingredientLimits || {};
        Object.keys(limits).forEach(id => {
            const { name, ...rest } = limits[id];
            ingredientLimitsClean[id] = {
                low_limit: safeNumber(rest.low_limit),
                top_limit: safeNumber(rest.top_limit),
                lose_index: safeNumber(rest.lose_index),
            };
        });

        // 原料结果（默认值）
        const ingredientResults = this.buildIngredientResults(config.ingredientResults);

        // 组装完整参数
        const fullParams = {
            calculateType,
            ingredientData, // 整个快照传给 FastAPI
            ingredientParams,
            ingredientLimits: ingredientLimitsClean,
            ingredientResults,
            chemicalLimits: config.chemicalLimits || {},
            otherSettings: config.otherSettings || {},
        };

        this.logger.debug('=== Full Params for FastAPI ===');
        this.logger.debug(JSON.stringify(fullParams, null, 2));

        // =========================
        // 2️⃣ 调用 FastAPI 启动任务
        // =========================
        const res = await this.apiPost('sj-fixed/start/', fullParams);
        const taskUuid = res.data?.data?.taskUuid;
        if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

        // =========================
        // 3️⃣ 保存任务
        // =========================
        const task = this.taskRepo.create({
            task_uuid: taskUuid,
            module_type: calculateType,
            status: TaskStatus.RUNNING,
            parameters: fullParams,
            user,
        });
        await this.taskRepo.save(task);

        return ApiResponse.success(
            { taskUuid, status: 'START' },
            '任务已创建，正在启动中',
        );
    } catch (err) {
        return this.handleError(err, '启动任务失败');
    }
}
    // ============================
    // 查询进度 / 结果
    // ============================
async getProgress(taskUuid: string): Promise<ApiResponse<any>> {
    try {
        const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
        if (!task) return ApiResponse.error('任务不存在');

        let results: any[] = [];

        if (task.status !== TaskStatus.FINISHED) {
            // 调 FastAPI 获取最新进度
            const res = await this.apiPost('sj-fixed/progress/', {}, { taskUuid });
            const data = res.data?.data;
            const fastApiResults = data?.results || [];

            // 更新任务状态和进度
            task.status = data?.status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
            task.progress = Number(data?.progress ?? 0);
            await this.taskRepo.save(task);

            if (fastApiResults.length) {
                const rawResult = { ...fastApiResults[0] };

                // =========================
                // 直接从 task.parameters.ingredientData 映射 id -> name
                // =========================
                const ingredientData: any[] = task.parameters?.ingredientData || [];
                const idToName: Record<string, string> = {};
                ingredientData.forEach(item => {
                    idToName[item.id.toString()] = item.name || item.id.toString();
                });

                // 原料配比
                if (rawResult['原料配比']) {
                    Object.entries(rawResult['原料配比']).forEach(([id, val]: [string, any]) => {
                        val.name = idToName[id] || id;
                        val.配比 = Number(((val?.配比 ?? 0)).toFixed(2));
                    });
                }


                results.push({
                    ...rawResult,
                    方案序号: rawResult['方案序号'] ?? 1,
                });

                // 任务完成，保存结果
                if (task.status === TaskStatus.FINISHED) {
                    await this.saveResults(task, results);
                }
            }
        } else {
            // 已完成 → 从数据库读取
            const resultEntity = await this.resultRepo.findOne({
                where: { task: { task_uuid: taskUuid } },
            });
            if (resultEntity?.output_data?.length) {
                results = resultEntity.output_data;
            }
        }

        return ApiResponse.success({
            taskUuid,
            status: task.status,
            progress: task.progress,
            total: results.length,
            results,
        });
    } catch (err) {
        return this.handleError(err, '获取任务结果失败');
    }
}
    // ============================
    // 保存结果
    // ============================
    private async saveResults(task: Task, results: any[]): Promise<void> {
        if (!results?.length) return;
        await this.resultRepo.save(
            this.resultRepo.create({
                task,
                output_data: results,
                is_shared: false,
                finished_at: new Date(),
            }),
        );
    }

    // ============================
    // ingredientResults 转换
    // ============================
    private buildIngredientResults(
        ingredientResults: Record<string, { name?: string; value: number }>,
    ): Record<string, number> {
        const result: Record<string, number> = {};
        Object.entries(ingredientResults || {}).forEach(([key, item]) => {
            if (item?.value == null) return;
            result[key.replace(/_$/, '')] = Number(item.value);
        });
        return result;
    }

    // ============================
    // 统一错误处理
    // ============================
    private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
        return ApiResponse.error(message);
    }
}
