import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';

/**
 * 统计结果接口
 * 
 * 定义统计数据的基本结构
 */
export interface StatisticsResult {
  /** 总记录数 */
  totalRecords: number;
  /** 各字段的统计信息 */
  statistics: Record<string, {
    min: number;    // 最小值
    max: number;    // 最大值
    avg: number;    // 平均值
    count: number;  // 记录数
  }>;
}

/**
 * 统计服务
 * 
 * 提供通用的数据统计功能，支持化学成分、价格、范围等统计
 * 特点：
 * - 支持多种统计类型
 * - 泛型支持，适配任何实体
 * - 支持条件过滤
 * - 时间序列统计
 * 
 * @example
 * ```typescript
 * constructor(private readonly statisticsService: StatisticsService) {}
 * 
 * async getStats() {
 *   return await this.statisticsService.getChemicalCompositionStats(
 *     this.repository, 
 *     ['tfe', 'cao', 'sio2'], 
 *     'price'
 *   );
 * }
 * ```
 */
@Injectable()
export class StatisticsService {
  /**
   * 获取化学成分统计信息
   * 
   * 计算指定化学成分字段的统计信息，包括最小值、最大值、平均值等
   * 
   * @param repository 实体仓库
   * @param chemicalFields 化学成分字段数组，如['tfe', 'cao', 'sio2']
   * @param priceField 价格字段名
   * @param whereConditions 过滤条件，可选
   * @returns 统计结果
   * 
   * @example
   * ```typescript
   * const stats = await this.statisticsService.getChemicalCompositionStats(
   *   this.materialRepository,
   *   ['tfe', 'cao', 'sio2'],
   *   'price',
   *   { category: 'iron_ore' }
   * );
   * ```
   */
  async getChemicalCompositionStats<T extends ObjectLiteral>(
    repository: Repository<T>,
    chemicalFields: string[],
    priceField: string,
    whereConditions?: any
  ): Promise<StatisticsResult> {
    const queryBuilder = repository.createQueryBuilder('entity');
    
    // 应用过滤条件
    if (whereConditions) {
      Object.keys(whereConditions).forEach(key => {
        if (whereConditions[key] !== undefined && whereConditions[key] !== null) {
          queryBuilder.andWhere(`entity.${key} = :${key}`, { [key]: whereConditions[key] });
        }
      });
    }

    // 构建统计查询字段
    const selectFields: string[] = [];
    chemicalFields.forEach(field => {
      selectFields.push(`MIN(entity.${field}) as ${field}Min`);
      selectFields.push(`MAX(entity.${field}) as ${field}Max`);
      selectFields.push(`AVG(entity.${field}) as ${field}Avg`);
    });
    
    selectFields.push(`MIN(entity.${priceField}) as ${priceField}Min`);
    selectFields.push(`MAX(entity.${priceField}) as ${priceField}Max`);
    selectFields.push(`AVG(entity.${priceField}) as ${priceField}Avg`);
    selectFields.push(`COUNT(*) as totalCount`);

    const result = await queryBuilder
      .select(selectFields)
      .getRawOne();

    const totalCount = parseInt(result.totalCount) || 0;

    return {
      totalRecords: totalCount,
      statistics: this.formatStatistics(result, chemicalFields, priceField)
    };
  }

  /**
   * 获取数值范围统计
   * 
   * 计算指定字段的数值范围统计，包括最小值、最大值、平均值和记录数
   * 
   * @param repository 实体仓库
   * @param field 要统计的字段名
   * @param whereConditions 过滤条件，可选
   * @returns 范围统计结果
   * 
   * @example
   * ```typescript
   * const rangeStats = await this.statisticsService.getRangeStats(
   *   this.materialRepository,
   *   'tfe',
   *   { category: 'iron_ore' }
   * );
   * // 返回: { min: 50.5, max: 65.2, avg: 58.3, count: 100 }
   * ```
   */
  async getRangeStats<T extends ObjectLiteral>(
    repository: Repository<T>,
    field: string,
    whereConditions?: any
  ): Promise<{ min: number; max: number; avg: number; count: number }> {
    const queryBuilder = repository.createQueryBuilder('entity');
    
    if (whereConditions) {
      Object.keys(whereConditions).forEach(key => {
        if (whereConditions[key] !== undefined && whereConditions[key] !== null) {
          queryBuilder.andWhere(`entity.${key} = :${key}`, { [key]: whereConditions[key] });
        }
      });
    }

    const result = await queryBuilder
      .select([
        `MIN(entity.${field}) as min`,
        `MAX(entity.${field}) as max`,
        `AVG(entity.${field}) as avg`,
        `COUNT(*) as count`
      ])
      .getRawOne();

    return {
      min: parseFloat(result.min) || 0,
      max: parseFloat(result.max) || 0,
      avg: parseFloat(result.avg) || 0,
      count: parseInt(result.count) || 0
    };
  }

  /**
   * 获取分组统计
   * 
   * 按指定字段分组统计记录数量
   * 
   * @param repository 实体仓库
   * @param groupField 分组字段名
   * @param countField 计数字段名，默认为'id'
   * @returns 分组统计结果数组
   * 
   * @example
   * ```typescript
   * const groupStats = await this.statisticsService.getGroupStats(
   *   this.materialRepository,
   *   'category'
   * );
   * // 返回: [{ group: 'iron_ore', count: 50 }, { group: 'coal', count: 30 }]
   * ```
   */
  async getGroupStats<T extends ObjectLiteral>(
    repository: Repository<T>,
    groupField: string,
    countField: string = 'id'
  ): Promise<Array<{ group: string; count: number }>> {
    const result = await repository
      .createQueryBuilder('entity')
      .select([`entity.${groupField} as group`, `COUNT(entity.${countField}) as count`])
      .groupBy(`entity.${groupField}`)
      .getRawMany();

    return result.map(item => ({
      group: item.group,
      count: parseInt(item.count) || 0
    }));
  }

  /**
   * 格式化统计结果
   * 
   * 将原始查询结果格式化为标准的统计结果格式
   * 
   * @param result 原始查询结果
   * @param chemicalFields 化学成分字段数组
   * @param priceField 价格字段名
   * @returns 格式化后的统计结果
   */
  private formatStatistics(result: any, chemicalFields: string[], priceField: string): Record<string, any> {
    const statistics = {};
    
    chemicalFields.forEach(field => {
      statistics[field] = {
        min: parseFloat(result[`${field}Min`]) || 0,
        max: parseFloat(result[`${field}Max`]) || 0,
        avg: parseFloat(result[`${field}Avg`]) || 0,
        count: parseInt(result.totalCount) || 0
      };
    });

    statistics[priceField] = {
      min: parseFloat(result[`${priceField}Min`]) || 0,
      max: parseFloat(result[`${priceField}Max`]) || 0,
      avg: parseFloat(result[`${priceField}Avg`]) || 0,
      count: parseInt(result.totalCount) || 0
    };

    return statistics;
  }

  /**
   * 获取时间序列统计
   * 
   * 按日期分组统计指定字段的平均值，用于生成时间序列图表数据
   * 
   * @param repository 实体仓库
   * @param dateField 日期字段名
   * @param valueField 数值字段名
   * @param startDate 开始日期，可选
   * @param endDate 结束日期，可选
   * @returns 时间序列数据数组
   * 
   * @example
   * ```typescript
   * const timeSeries = await this.statisticsService.getTimeSeriesStats(
   *   this.materialRepository,
   *   'createdAt',
   *   'price',
   *   new Date('2024-01-01'),
   *   new Date('2024-12-31')
   * );
   * // 返回: [{ date: '2024-01-01', value: 500.5 }, ...]
   * ```
   */
  async getTimeSeriesStats<T extends ObjectLiteral>(
    repository: Repository<T>,
    dateField: string,
    valueField: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ date: string; value: number }>> {
    const queryBuilder = repository.createQueryBuilder('entity');
    
    if (startDate) {
      queryBuilder.andWhere(`entity.${dateField} >= :startDate`, { startDate });
    }
    
    if (endDate) {
      queryBuilder.andWhere(`entity.${dateField} <= :endDate`, { endDate });
    }

    const result = await queryBuilder
      .select([
        `DATE(entity.${dateField}) as date`,
        `AVG(entity.${valueField}) as value`
      ])
      .groupBy(`DATE(entity.${dateField})`)
      .orderBy(`DATE(entity.${dateField})`, 'ASC')
      .getRawMany();

    return result.map(item => ({
      date: item.date,
      value: parseFloat(item.value) || 0
    }));
  }
}
