import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { SjFinesChemTyp } from '../entities/sj-fines-chem-typ.entity';
import { CreateSjFinesChemTypDto, UpdateSjFinesChemTypDto, QuerySjFinesChemTypDto } from '../dto/sj-fines-chem-typ.dto';
import { PaginatedResult } from '../../../common/dto/pagination.dto';
import { StatisticsService } from '../../../common/services/statistics.service';
import { FileService } from '../../../common/services/file.service';

/**
 * 烧结矿粉化学成分典型值服务
 * 
 * 提供烧结矿粉化学成分数据的完整业务逻辑
 * 功能包括：
 * - CRUD操作（创建、查询、更新、删除）
 * - 分页查询和条件过滤
 * - Excel文件导入导出
 * - 数据统计分析
 * - 错误处理和验证
 * 
 * @example
 * ```typescript
 * constructor(private readonly sjFinesChemTypService: SjFinesChemTypService) {}
 * 
 * async getMaterials() {
 *   return await this.sjFinesChemTypService.findAll({ page: 1, limit: 10 });
 * }
 * ```
 */
@Injectable()
export class SjFinesChemTypService {
  constructor(
    @InjectRepository(SjFinesChemTyp)
    private readonly sjFinesChemTypRepository: Repository<SjFinesChemTyp>,
    private readonly statisticsService: StatisticsService,
    private readonly fileService: FileService,
  ) {}

  /**
   * 创建新的烧结矿粉化学成分记录
   * 
   * 根据提供的DTO数据创建新的记录，包含完整的化学成分信息
   * 
   * @param createDto 创建数据传输对象，包含所有必要的化学成分数据
   * @returns 创建的记录
   * @throws BadRequestException 当数据验证失败或创建过程中出现错误时
   * 
   * @example
   * ```typescript
   * const newMaterial = await this.sjFinesChemTypService.create({
   *   categoryCode: 'CAT001',
   *   materialName: '烧结矿粉001',
   *   tfe: 62.5,
   *   cao: 8.5,
   *   price: 500.0
   * });
   * ```、
   */
  async create(createDto: CreateSjFinesChemTypDto): Promise<SjFinesChemTyp> {
    try {
      const sjFinesChemTyp = this.sjFinesChemTypRepository.create(createDto);
      return await this.sjFinesChemTypRepository.save(sjFinesChemTyp);
    } catch (error) {
      throw new BadRequestException(`创建记录失败: ${error.message}`);
    }
  }

  /**
   * 分页查询烧结矿粉化学成分记录
   * 
   * 支持多种查询条件和分页功能，包括分类编号、原料名称、化学成分范围等过滤
   * 
   * @param queryDto 查询参数，包含分页信息和过滤条件
   * @returns 分页查询结果，包含数据列表和分页信息
   * @throws BadRequestException 当查询参数无效时
   * 
   * @example
   * ```typescript
   * const result = await this.sjFinesChemTypService.findAll({
   *   page: 1,
   *   limit: 10,
   *   categoryCode: 'CAT001',
   *   tfeMin: 60,
   *   tfeMax: 65
   * });
   * ```
   */
  async findAll(queryDto: QuerySjFinesChemTypDto): Promise<PaginatedResult<SjFinesChemTyp>> {
    try {
      const { page = 1, limit = 10, orderBy = 'createdAt', orderDirection = 'DESC', ...filters } = queryDto;
      
      const queryBuilder = this.sjFinesChemTypRepository.createQueryBuilder('sjFinesChemTyp');
      
      // 应用过滤条件
      if (filters.categoryCode) {
        queryBuilder.andWhere('sjFinesChemTyp.categoryCode LIKE :categoryCode', {
          categoryCode: `%${filters.categoryCode}%`
        });
      }

      if (filters.materialName) {
        queryBuilder.andWhere('sjFinesChemTyp.materialName LIKE :materialName', {
          materialName: `%${filters.materialName}%`
        });
      }

      if (filters.tfeMin !== undefined || filters.tfeMax !== undefined) {
        if (filters.tfeMin !== undefined) {
          queryBuilder.andWhere('sjFinesChemTyp.tfe >= :tfeMin', { tfeMin: filters.tfeMin });
        }
        if (filters.tfeMax !== undefined) {
          queryBuilder.andWhere('sjFinesChemTyp.tfe <= :tfeMax', { tfeMax: filters.tfeMax });
        }
      }

      if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
        if (filters.priceMin !== undefined) {
          queryBuilder.andWhere('sjFinesChemTyp.price >= :priceMin', { priceMin: filters.priceMin });
        }
        if (filters.priceMax !== undefined) {
          queryBuilder.andWhere('sjFinesChemTyp.price <= :priceMax', { priceMax: filters.priceMax });
        }
      }

      if (filters.startDate || filters.endDate) {
        if (filters.startDate) {
          queryBuilder.andWhere('sjFinesChemTyp.createdAt >= :startDate', { startDate: filters.startDate });
        }
        if (filters.endDate) {
          queryBuilder.andWhere('sjFinesChemTyp.createdAt <= :endDate', { endDate: filters.endDate });
        }
      }

      // 排序
      queryBuilder.orderBy(`sjFinesChemTyp.${orderBy}`, orderDirection);

      // 分页
      const [data, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return new PaginatedResult(data, total, page, limit);
    } catch (error) {
      throw new BadRequestException(`查询记录失败: ${error.message}`);
    }
  }

  /**
   * 根据ID获取单条记录
   * 
   * 通过记录ID查找特定的烧结矿粉化学成分记录
   * 
   * @param id 记录的唯一标识符
   * @returns 找到的记录
   * @throws NotFoundException 当记录不存在时
   * 
   * @example
   * ```typescript
   * const material = await this.sjFinesChemTypService.findOne('uuid-string');
   * console.log(material.materialName); // 输出原料名称
   * ```
   */
  async findOne(id: string): Promise<SjFinesChemTyp> {
    const record = await this.sjFinesChemTypRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('未找到指定的记录');
    }
    return record;
  }

  /**
   * 更新记录
   * 
   * 根据ID更新指定的烧结矿粉化学成分记录
   * 
   * @param id 记录的唯一标识符
   * @param updateDto 更新数据传输对象，包含要更新的字段
   * @returns 更新后的记录
   * @throws NotFoundException 当记录不存在时
   * @throws BadRequestException 当更新过程中出现错误时
   * 
   * @example
   * ```typescript
   * const updatedMaterial = await this.sjFinesChemTypService.update('uuid-string', {
   *   tfe: 63.0,
   *   price: 520.0
   * });
   * ```
   */
  async update(id: string, updateDto: UpdateSjFinesChemTypDto): Promise<SjFinesChemTyp> {
    const record = await this.findOne(id);
    
    try {
      Object.assign(record, updateDto);
      return await this.sjFinesChemTypRepository.save(record);
    } catch (error) {
      throw new BadRequestException(`更新记录失败: ${error.message}`);
    }
  }

  /**
   * 删除记录
   * 
   * 根据ID删除指定的烧结矿粉化学成分记录
   * 
   * @param id 记录的唯一标识符
   * @throws NotFoundException 当记录不存在时
   * @throws BadRequestException 当删除过程中出现错误时
   * 
   * @example
   * ```typescript
   * await this.sjFinesChemTypService.remove('uuid-string');
   * ```
   */
  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    
    try {
      await this.sjFinesChemTypRepository.remove(record);
    } catch (error) {
      throw new BadRequestException(`删除记录失败: ${error.message}`);
    }
  }

  /**
   * 批量创建记录
   * 
   * 一次性创建多条烧结矿粉化学成分记录，用于批量导入
   * 
   * @param records 创建数据传输对象数组
   * @returns 创建的记录数组
   * @throws BadRequestException 当批量创建过程中出现错误时
   * 
   * @example
   * ```typescript
   * const records = [
   *   { categoryCode: 'CAT001', materialName: '原料1', tfe: 62.5 },
   *   { categoryCode: 'CAT002', materialName: '原料2', tfe: 63.0 }
   * ];
   * const createdRecords = await this.sjFinesChemTypService.bulkCreate(records);
   * ```
   */
  async bulkCreate(records: CreateSjFinesChemTypDto[]): Promise<SjFinesChemTyp[]> {
    try {
      const entities = this.sjFinesChemTypRepository.create(records);
      return await this.sjFinesChemTypRepository.save(entities);
    } catch (error) {
      throw new BadRequestException(`批量创建记录失败: ${error.message}`);
    }
  }

  /**
   * 从Excel文件导入数据
   * 
   * 解析Excel文件并批量导入烧结矿粉化学成分数据
   * 支持多种列名格式，自动处理数据转换和验证
   * 
   * @param file 上传的Excel文件
   * @returns 导入结果，包含成功导入数量、总行数和错误信息
   * @throws BadRequestException 当文件处理失败时
   * 
   * @example
   * ```typescript
   * const result = await this.sjFinesChemTypService.importFromExcel(file);
   * console.log(`成功导入 ${result.importedCount} 条记录，共 ${result.totalRows} 行`);
   * ```
   */
  async importFromExcel(file: Express.Multer.File): Promise<{ importedCount: number; totalRows: number; errors: string[] }> {
    try {
      const jsonData = await this.fileService.processExcelFile(file);
      const importedRecords: SjFinesChemTyp[] = [];
      const errors: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        try {
          const row = jsonData[i];
          const record: CreateSjFinesChemTypDto = {
            categoryCode: row['分类编号'] || row['categoryCode'] || `CAT_${i + 1}`,
            materialName: row['原料名称'] || row['materialName'] || `原料_${i + 1}`,
            tfe: parseFloat(row['TFe含量'] || row['tfe'] || 0),
            cao: parseFloat(row['CaO含量'] || row['cao'] || 0),
            sio2: parseFloat(row['SiO2含量'] || row['sio2'] || 0),
            mgo: parseFloat(row['MgO含量'] || row['mgo'] || 0),
            al2o3: parseFloat(row['Al2O3含量'] || row['al2o3'] || 0),
            s: parseFloat(row['S含量'] || row['s'] || 0),
            p: parseFloat(row['P含量'] || row['p'] || 0),
            tio2: parseFloat(row['TiO2含量'] || row['tio2'] || 0),
            mno: parseFloat(row['MnO含量'] || row['mno'] || 0),
            cr: parseFloat(row['Cr含量'] || row['cr'] || 0),
            pb: parseFloat(row['Pb含量'] || row['pb'] || 0),
            zn: parseFloat(row['Zn含量'] || row['zn'] || 0),
            k2o: parseFloat(row['K2O含量'] || row['k2o'] || 0),
            na2o: parseFloat(row['Na2O含量'] || row['na2o'] || 0),
            ni: parseFloat(row['Ni含量'] || row['ni'] || 0),
            v2o5: parseFloat(row['V2O5含量'] || row['v2o5'] || 0),
            h2o: parseFloat(row['H2O含量'] || row['h2o'] || 0),
            burnOff: parseFloat(row['烧毁'] || row['burnOff'] || 0),
            price: parseFloat(row['价格'] || row['price'] || 0),
            returnOreRate: parseFloat(row['返矿率'] || row['returnOreRate'] || 0),
            returnOrePrice: parseFloat(row['返矿价格'] || row['returnOrePrice'] || 0),
            dryBasePrice: parseFloat(row['干基价格'] || row['dryBasePrice'] || 0)
          };

          const createdRecord = await this.create(record);
          importedRecords.push(createdRecord);
        } catch (error) {
          errors.push(`第${i + 1}行: ${error.message}`);
        }
      }

      // 清理临时文件
      await this.fileService.cleanupFile(file.path);

      return {
        importedCount: importedRecords.length,
        totalRows: jsonData.length,
        errors
      };
    } catch (error) {
      throw new BadRequestException(`导入数据失败: ${error.message}`);
    }
  }

  /**
   * 导出数据到Excel文件
   * 
   * 将所有烧结矿粉化学成分数据导出为Excel文件
   * 包含完整的化学成分信息和价格数据
   * 
   * @returns 生成的Excel文件路径
   * @throws BadRequestException 当没有数据可导出或导出失败时
   * 
   * @example
   * ```typescript
   * const filePath = await this.sjFinesChemTypService.exportToExcel();
   * console.log(`Excel文件已生成: ${filePath}`);
   * ```
   */
  async exportToExcel(): Promise<string> {
    try {
      const records = await this.sjFinesChemTypRepository.find({
        order: { createdAt: 'DESC' }
      });

      if (records.length === 0) {
        throw new BadRequestException('没有数据可导出');
      }

      // 准备导出数据
      const exportData = records.map(record => ({
        '分类编号': record.categoryCode,
        '原料名称': record.materialName,
        'TFe含量(%)': record.tfe,
        'CaO含量(%)': record.cao,
        'SiO2含量(%)': record.sio2,
        'MgO含量(%)': record.mgo,
        'Al2O3含量(%)': record.al2o3,
        'S含量(%)': record.s,
        'P含量(%)': record.p,
        'TiO2含量(%)': record.tio2,
        'MnO含量(%)': record.mno,
        'Cr含量(%)': record.cr,
        'Pb含量(%)': record.pb,
        'Zn含量(%)': record.zn,
        'K2O含量(%)': record.k2o,
        'Na2O含量(%)': record.na2o,
        'Ni含量(%)': record.ni,
        'V2O5含量(%)': record.v2o5,
        'H2O含量(%)': record.h2o,
        '烧毁(%)': record.burnOff,
        '价格(元/吨)': record.price,
        '返矿率(%)': record.returnOreRate,
        '返矿价格(元/吨)': record.returnOrePrice,
        '干基价格(元/吨)': record.dryBasePrice,
        '创建时间': record.createdAt,
        '更新时间': record.updatedAt
      }));

      const filename = this.fileService.generateUniqueFilename(
        `烧结矿粉化学成分典型值_${new Date().toISOString().split('T')[0]}.xlsx`,
        'sj-fines-chem-typ'
      );

      return await this.fileService.exportToExcel(
        exportData,
        filename,
        '烧结矿粉化学成分典型值'
      );
    } catch (error) {
      throw new BadRequestException(`导出数据失败: ${error.message}`);
    }
  }

  /**
   * 获取统计信息
   * 
   * 计算烧结矿粉化学成分的统计信息，包括各化学成分的最小值、最大值、平均值等
   * 
   * @returns 统计结果，包含各化学成分和价格的统计信息
   * @throws BadRequestException 当统计计算失败时
   * 
   * @example
   * ```typescript
   * const stats = await this.sjFinesChemTypService.getStatistics();
   * console.log(`TFe平均含量: ${stats.statistics.tfe.avg}%`);
   * console.log(`价格范围: ${stats.statistics.price.min} - ${stats.statistics.price.max}`);
   * ```
   */
  async getStatistics(): Promise<any> {
    try {
      const chemicalFields = ['tfe', 'sio2', 'al2o3', 'cao', 'mgo'];
      const priceField = 'price';

      return await this.statisticsService.getChemicalCompositionStats(
        this.sjFinesChemTypRepository,
        chemicalFields,
        priceField
      );
    } catch (error) {
      throw new BadRequestException(`获取统计信息失败: ${error.message}`);
    }
  }
}
