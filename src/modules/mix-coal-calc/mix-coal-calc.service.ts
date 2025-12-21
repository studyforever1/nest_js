import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import _ from 'lodash';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { MixCoalPaginationDto } from './dto/mix-coal-calc.dto';
import { CoalEconInfo } from '../coal-econ-info/entities/coal-econ-info.entity';

@Injectable()
export class MixCoalCalcService {
    private readonly logger = new Logger(MixCoalCalcService.name);
    private readonly fastApiUrl = process.env.FASTAPI_URL;

    private readonly TASK_ENDPOINTS = {
        start: '/coalEcon2/start/',
        progress: '/coalEcon2/progress/',
        stop: '/coalEcon2/stop/',
    };

    constructor(
        @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
        @InjectRepository(CoalEconInfo) private readonly coalRepo: Repository<CoalEconInfo>,
        @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
    ) { }

    /** 启动任务 */
    async startTask(user: User, moduleName: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
        try {
            // 1️⃣ 获取用户最新配置组
            const group = await this.configRepo.findOne({
                where: { user: { user_id: user.user_id }, module: { name: moduleName }, is_latest: true },
            });
            if (!group) throw new Error(`模块 "${moduleName}" 没有参数组`);
            const configData = _.cloneDeep(group.config_data);

            // 2️⃣ 获取选择的煤种/焦炭 ID
            const coalIds: number[] = configData.coalParams || [];
            const coals = coalIds.length ? await this.coalRepo.findByIds(coalIds) : [];

            // 3️⃣ 构建 coalParams，生成完整参数
            const coalParams: Record<string, any> = {};
            coals.forEach(c => {
                const comp = c.composition || {};
                coalParams[c.id] = {
                    物料类别: comp.物料类别 ?? '',
                    挥发份: Number(comp.挥发份 ?? 0),
                    S: Number(comp.S ?? 0),
                    C: Number(comp.C ?? 0),
                    内水: Number(comp.内水 ?? 0),
                    灰分: Number(comp.灰分 ?? 0),
                    H2O: Number(comp.H2O ?? 0),
                    哈氏可磨: Number(comp.哈氏可磨 ?? 0),
                    发热量_检测值: Number(comp.发热量_检测值 ?? 0),
                    含税_含水_含粉合同价: Number(comp.含税_含水_含粉合同价 ?? 0),
                    运费: Number(comp.运费 ?? 0),
                    干基不含税到厂价: Number(comp.干基不含税到厂价 ?? 0)
                };

            });

            // 4️⃣ 组合完整参数
            const fullParams = {
                coalParams,
                coalLimits: configData.coalLimits || {},
                mixedCoalProperties: configData.mixedCoalProperties || {},
                coalCostSet: configData.coalCostSet || {},
            };

            console.log('启动混合煤任务参数:', JSON.stringify(fullParams, null, 2));

            // 5️⃣ 调用 FastAPI
            const res: AxiosResponse<any> = await axios.post(`${this.fastApiUrl}${this.TASK_ENDPOINTS.start}`, fullParams);
            const taskUuid = res.data?.data?.taskUuid;
            if (!taskUuid) throw new Error('任务启动失败，未返回 taskUuid');

            // 6️⃣ 保存任务记录
            const task = this.taskRepo.create({
                task_uuid: taskUuid,
                module_type: '混合煤性价比计算',
                status: TaskStatus.RUNNING,
                parameters: fullParams,
                user,
            });
            await this.taskRepo.save(task);

            return ApiResponse.success({ taskUuid, status: 'RUNNING' }, '任务已启动');
        } catch (err) {
            return this.handleError(err, '启动任务失败');
        }
    }

    /** 停止任务 */
    async stopTask(taskUuid: string) {
        try {
            await axios.post(`${this.fastApiUrl}${this.TASK_ENDPOINTS.stop}`, { taskUuid });

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

    /** 查询任务进度 */
    async fetchProgress(taskUuid: string, pagination?: MixCoalPaginationDto) {
        try {
            const res: AxiosResponse<any> = await axios.get(`${this.fastApiUrl}${this.TASK_ENDPOINTS.progress}`, {
                params: { taskUuid },
            });
            const data = res.data?.data || { results: [], status: 'RUNNING' };

            const page = Number(pagination?.page ?? 1);
            const pageSize = Number(pagination?.pageSize ?? 10);
            const start = (page - 1) * pageSize;
            const pagedResults = (data.results || []).slice(start, start + pageSize);

            return ApiResponse.success({
                taskUuid,
                status: data.status,
                progress: data.progress ?? 0,
                total: data.total ?? pagedResults.length,
                results: pagedResults,
                page,
                pageSize,
                totalResults: data.results?.length ?? 0,
                totalPages: Math.ceil((data.results?.length ?? 0) / pageSize),
            });
        } catch (err) {
            return this.handleError(err, '查询任务进度失败');
        }
    }

    private handleError(err: unknown, prefix = '操作失败') {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
        return ApiResponse.error(message);
    }
}
