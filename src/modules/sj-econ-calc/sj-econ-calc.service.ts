import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import _ from 'lodash';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { SjEconInfo } from '../sj-econ-info/entities/sj-econ-info.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { SJEconPaginationDto } from './dto/sj-econ-pagination.dto';

@Injectable()
export class SjEconCalcService {
    private readonly logger = new Logger(SjEconCalcService.name);
    private readonly fastApiUrl = process.env.FASTAPI_URL;

    private readonly ECON_TASKS = [
        { name: '品位综合评价法', startUrl: '/sjEcon1/start/', progressUrl: '/sjEcon1/progress/', stopUrl: '/sjEcon1/stop/' },
        { name: '单烧综合评价法', startUrl: '/sjEcon2/start/', progressUrl: '/sjEcon2/progress/', stopUrl: '/sjEcon2/stop/' },
        { name: '铁水成本评价法', startUrl: '/sjEcon3/start/', progressUrl: '/sjEcon3/progress/', stopUrl: '/sjEcon3/stop/' },
        { name: '基准矿粉对比评价法', startUrl: '/sjEcon4/start/', progressUrl: '/sjEcon4/progress/', stopUrl: '/sjEcon4/stop/' },
    ];

    constructor(
        @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
        @InjectRepository(SjEconInfo) private readonly rawRepo: Repository<SjEconInfo>,
        @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
        @InjectRepository(BizModule) private readonly moduleRepo: Repository<BizModule>,
    ) {}

async startTasks(
    user: User,
    moduleName: string
): Promise<ApiResponse<{ tasks: { taskUuid: string; name: string }[]; status: string }>> {
    try {
        const group = await this.configRepo.findOne({
            where: { user: { user_id: user.user_id }, module: { name: moduleName }, is_latest: true },
        });
        if (!group) throw new Error(`模块 "${moduleName}" 没有参数组`);

        const configData = _.cloneDeep(group.config_data);

        const ingredientIds: number[] = configData.ingredientParams || [];
        const raws = ingredientIds.length ? await this.rawRepo.findByIds(ingredientIds) : [];

        const ingredientParams: Record<number, any> = {};
        raws.forEach(raw => {
            ingredientParams[raw.id] = {
                Al2O3: raw.composition?.Al2O3 ?? 0,
                As: raw.composition?.As ?? 0,
                CaO: raw.composition?.CaO ?? 0,
                Cr: raw.composition?.Cr ?? 0,
                Cu: raw.composition?.Cu ?? 0,
                K2O: raw.composition?.K2O ?? 0,
                MgO: raw.composition?.MgO ?? 0,
                MnO: raw.composition?.MnO ?? 0,
                Na2O: raw.composition?.Na2O ?? 0,
                P: raw.composition?.P ?? 0,
                Pb: raw.composition?.Pb ?? 0,
                S: raw.composition?.S ?? 0,
                SiO2: raw.composition?.SiO2 ?? 0,
                TFe: raw.composition?.TFe ?? 0,
                TiO2: raw.composition?.TiO2 ?? 0,
                V: raw.composition?.V ?? 0,
                Zn: raw.composition?.Zn ?? 0,
                价格: raw.composition?.['价格'] ?? 0,
                烧损: raw.composition?.['烧损'] ?? 0,
            };
        });

        const ironCostSetProcessed = configData.ironCostSet || {};
        const singleBurnSetProcessed = configData.singleBurnSet || {};

        const fullParams = {
            ingredientParams,
            ironCostSet: ironCostSetProcessed,
            singleBurnSet: singleBurnSetProcessed,
        };

        console.log('启动经济性评价任务参数:', JSON.stringify(fullParams, null, 2));

        const tasks: { taskUuid: string; name: string }[] = [];
        for (const taskDef of this.ECON_TASKS) {
            try {
                const res: AxiosResponse<any> = await this.apiPost(taskDef.startUrl, fullParams);
                const taskUuid = res.data?.data?.taskUuid;
                if (taskUuid) {
                    tasks.push({ taskUuid, name: taskDef.name });
                    const task = this.taskRepo.create({
                        task_uuid: taskUuid,
                        module_type: taskDef.name,
                        status: TaskStatus.RUNNING,
                        parameters: fullParams,
                        user,
                    });
                    await this.taskRepo.save(task);
                }
            } catch (err) {
                this.logger.warn(`启动 ${taskDef.name} 失败: ${(err as any)?.message || err}`);
            }
        }

        return ApiResponse.success({ tasks, status: 'RUNNING' }, '四个经济性评价任务已启动');
    } catch (err: unknown) {
        return this.handleError(err, '启动任务失败');
    }
}


    async stopTasks(taskUuids: string[]): Promise<ApiResponse<{ stopped: string[] }>> {
        const stopped: string[] = [];
        for (let i = 0; i < taskUuids.length; i++) {
            const taskUuid = taskUuids[i];
            const taskDef = this.ECON_TASKS[i];
            try {
                await this.apiPost(taskDef.stopUrl, { taskUuid });
                stopped.push(taskUuid);

                const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
                if (task) {
                    task.status = TaskStatus.STOPPED;
                    await this.taskRepo.save(task);
                }
            } catch (err) {
                this.logger.warn(`停止任务 ${taskUuid} 失败: ${(err as any)?.message || err}`);
            }
        }
        return ApiResponse.success({ stopped }, '已停止任务');
    }

    async fetchAndSaveProgress(
        taskUuid: string,
        pagination?: SJEconPaginationDto
    ): Promise<ApiResponse<any>> {
        try {
            const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
            if (!task) return ApiResponse.error('任务不存在');

            const taskDef = this.ECON_TASKS.find(t => t.name === task.module_type);
            if (!taskDef) return ApiResponse.error('任务定义不存在');

            const res = await this.apiGet(taskDef.progressUrl, { taskUuid });
            const data = res.data?.data;
            if (!data) return ApiResponse.success({ status: 'RUNNING', results: [] });

            const idSet = new Set<number>();
            (data.results || []).forEach(item => {
                const rawId = Number(item['原料']);
                if (!isNaN(rawId)) idSet.add(rawId);
            });

            const raws = idSet.size
                ? await this.rawRepo.find({ where: { id: In([...idSet]) } })
                : [];
            const idNameMap: Record<number, string> = {};
            raws.forEach(raw => (idNameMap[raw.id] = raw.name));

            const mappedResults = (data.results || []).map(item => {
                const rawId = Number(item['原料']);
                return {
                    ...item,
                    原料: idNameMap[rawId] || item['原料'],
                };
            });

            const { pagedResults, totalResults, totalPages } = this.applyPaginationAndSort(
                mappedResults,
                pagination
            );

            return ApiResponse.success({
                taskUuid,
                status: data.status,
                progress: data.progress ?? 0,
                total: data.total ?? 0,
                results: pagedResults,
                page: pagination?.page ?? 1,
                pageSize: pagination?.pageSize ?? 10,
                totalResults,
                totalPages,
            });
        } catch (err) {
            return this.handleError(err, '获取任务进度失败');
        }
    }

    private applyPaginationAndSort(results: any[], pagination?: SJEconPaginationDto) {
        let sortedResults = results;

        if (pagination?.sort) {
            const fieldPath = pagination.sort;
            const order = pagination.order === 'desc' ? -1 : 1;

            sortedResults = [...results].sort((a, b) => {
                const va = this.getNestedValue(a, fieldPath);
                const vb = this.getNestedValue(b, fieldPath);

                const na = Number(va);
                const nb = Number(vb);
                if (!isNaN(na) && !isNaN(nb)) return na > nb ? order : na < nb ? -order : 0;

                return va > vb ? order : va < vb ? -order : 0;
            });
        }

        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        const start = (page - 1) * pageSize;

        const pagedResults = sortedResults.slice(start, start + pageSize);
        const totalResults = sortedResults.length;
        const totalPages = Math.ceil(totalResults / pageSize);

        return { pagedResults, totalResults, totalPages };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
    }

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
