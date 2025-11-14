import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { SjEconInfo } from '../entities/sj-econ-info.entity';
import { FileService } from '../../../common/services/file.service';
import { ApiResponse } from '../../../common/response/response.dto';

@Injectable()
export class SjEconInfoService {
  constructor(
    @InjectRepository(SjEconInfo) private readonly repository: Repository<SjEconInfo>,
    private readonly fileService: FileService,
  ) {}

  /**
   * 创建原料信息
   */
  async create(data: { name: string; composition: Record<string, any>; modifier?: string }): Promise<SjEconInfo> {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('参数错误：名称不能为空');
    }

    const entity = this.repository.create({
      name: data.name.trim(),
      composition: data.composition || {},
      modifier: data.modifier || 'admin',
      enabled: true,
    });

    return await this.repository.save(entity);
  }

  /**
   * 分页查询原料信息列表
   */
  async findAll(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await this.repository.findAndCount({
      where: { enabled: true },
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return {
      result: data.map(item => ({
        id: item.id,
        name: item.name,
        composition: item.composition,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 根据ID查询单个原料信息
   */
  async findOne(id: string): Promise<SjEconInfo> {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) {
      throw new BadRequestException('数据不存在');
    }
    return item;
  }

  /**
   * 更新原料信息
   */
  async update(id: string, data: { name?: string; composition?: Record<string, any>; modifier?: string }): Promise<SjEconInfo> {
    if (data.name !== undefined && (!data.name || data.name.trim() === '')) {
      throw new BadRequestException('参数错误：名称不能为空');
    }

    const entity = await this.findOne(id);
    if (data.name !== undefined) entity.name = data.name.trim();
    if (data.composition !== undefined) entity.composition = data.composition;
    if (data.modifier !== undefined) entity.modifier = data.modifier;

    return await this.repository.save(entity);
  }

  /**
   * 批量删除原料信息
   */
  async removeBatch(ids: string[]): Promise<{ deletedCount: number; ids: string[] }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('删除失败,参数错误或数据不存在');
    }

    const result = await this.repository.delete({ id: In(ids) });
    if (result.affected === 0) {
      throw new BadRequestException('删除失败,参数错误或数据不存在');
    }

    return {
      deletedCount: result.affected || 0,
      ids,
    };
  }

  /**
   * 单个删除原料信息
   */
  async remove(id: string): Promise<void> {
    await this.removeBatch([id]);
  }

  /**
   * 按名称模糊搜索
   */
  async searchByName(name: string, page: number = 1, pageSize: number = 10) {
    if (!name || name.trim() === '') {
      return this.findAll(page, pageSize);
    }

    const skip = (page - 1) * pageSize;
    const [data, total] = await this.repository.findAndCount({
      where: {
        name: Like(`%${name.trim()}%`),
        enabled: true,
      },
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return {
      result: data.map(item => ({
        id: item.id,
        name: item.name,
        composition: item.composition,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 从Excel文件导入数据
   * 文档格式：原料TFeCaOSiO2MgOAl2O3SPTIO2K2ONa2OZnPbAsV2O5烧损价格
   */
  async importFromExcel(file: Express.Multer.File): Promise<{ importedCount: number }> {
    try {
      // 使用文本方式读取，因为文档显示的是纯文本或制表符分隔格式
      const fs = require('fs');
      const fileContent = fs.readFileSync(file.path, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new BadRequestException('导入失败:文件格式错误或数据校验不通过');
      }

      // 解析表头（兼容制表符/空格分隔与无分隔直连两种格式）
      const header = lines[0].trim();
      const expectedTokens = ['原料','TFe','CaO','SiO2','MgO','Al2O3','S','P','TiO2','K2O','Na2O','Zn','Pb','As','V2O5','烧损','价格'];

      // 自动识别分隔符：优先\t，其次逗号，否则空白
      const detectDelimiter = (sample: string): RegExp => {
        if (sample.includes('\t')) return /\t+/;
        if (sample.includes(',')) return /,+/;
        return /\s+/;
      };
      const delimiter = detectDelimiter(header);

      const headerTokens = header.split(delimiter);
      const compactHeader = header.replace(/\s+/g, '');
      const compactExpected = expectedTokens.join('');

      // 表头大小写不敏感匹配；中文字段保持原样
      const toKey = (v: string) => v.replace(/\s+/g, '').toLowerCase();
      const tokensMatch = headerTokens.length === expectedTokens.length &&
        headerTokens.every((t, i) => {
          // 仅对英文部分做不区分大小写比较
          const expect = expectedTokens[i];
          const isChinese = /[\u4e00-\u9fa5]/.test(expect);
          return isChinese ? t === expect : toKey(t) === toKey(expect);
        });
      const compactMatch = compactHeader === compactExpected;
      if (!tokensMatch && !compactMatch) {
        throw new BadRequestException('导入失败：文件格式错误或数据校验不通过');
      }

      const importedRecords: SjEconInfo[] = [];
      const errors: string[] = [];

      // 解析数据行
      for (let i = 1; i < lines.length; i++) {
        try {
          const line = lines[i].trim();
          if (!line) continue;

          // 根据文档格式，数据是制表符/逗号/空格分隔的
          const values = line.split(detectDelimiter(line));
          // 期望：名称 + 16 列成分/价格 = 17 列
          if (values.length < 17) {
            errors.push(`第${i + 1}行: 数据列数不足`);
            continue;
          }

          const name = values[0];
          if (!name) {
            errors.push(`第${i + 1}行: 原料名称不能为空`);
            continue;
          }

          const composition: Record<string, any> = {
            TFe: parseFloat(values[1]) || 0,
            CaO: parseFloat(values[2]) || 0,
            SiO2: parseFloat(values[3]) || 0,
            MgO: parseFloat(values[4]) || 0,
            Al2O3: parseFloat(values[5]) || 0,
            S: parseFloat(values[6]) || 0,
            P: parseFloat(values[7]) || 0,
            TiO2: parseFloat(values[8]) || 0,
            K2O: parseFloat(values[9]) || 0,
            Na2O: parseFloat(values[10]) || 0,
            Zn: parseFloat(values[11]) || 0,
            Pb: parseFloat(values[12]) || 0,
            As: parseFloat(values[13]) || 0,
            V2O5: parseFloat(values[14]) || 0,
            烧损: parseFloat(values[15]) || 0,
            价格: parseFloat(values[16]) || 0,
          };

          const entity = this.repository.create({
            name,
            composition,
            modifier: 'admin',
            enabled: true,
          });

          const saved = await this.repository.save(entity);
          importedRecords.push(saved);
        } catch (error) {
          errors.push(`第${i + 1}行: ${error.message}`);
        }
      }

      // 清理临时文件
      await this.fileService.cleanupFile(file.path);

      if (importedRecords.length === 0) {
        throw new BadRequestException('导入失败：文件格式错误或数据校验不通过');
      }

      return {
        importedCount: importedRecords.length,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`导入失败：文件格式错误或数据校验不通过 - ${error.message}`);
    }
  }

  /**
   * 导出数据到Excel文件
   * 文档格式：原料TFeCaOSiO2MgOAl2O3SPTIO2K2ONa2OZnPbAsV2O5烧损价格
   */
  async exportToExcel(): Promise<string> {
    try {
      const records = await this.repository.find({
        where: { enabled: true },
        order: { createdAt: 'DESC' },
      });

      if (records.length === 0) {
        throw new BadRequestException('没有数据可导出');
      }

      // 准备导出数据（纯文本格式，符合文档要求）
      const lines: string[] = [];
      lines.push('原料TFeCaOSiO2MgOAl2O3SPTIO2K2ONa2OZnPbAsV2O5烧损价格');

      records.forEach(record => {
        const comp = record.composition || {};
        const line = [
          record.name || '',
          comp.TFe || 0,
          comp.CaO || 0,
          comp.SiO2 || 0,
          comp.MgO || 0,
          comp.Al2O3 || 0,
          comp.S || 0,
          comp.P || 0,
          comp.TiO2 || 0,
          comp.K2O || 0,
          comp.Na2O || 0,
          comp.Zn || 0,
          comp.Pb || 0,
          comp.As || 0,
          comp.V2O5 || 0,
          comp.烧损 || 0,
          comp.价格 || 0,
        ].join('\t');
        lines.push(line);
      });

      const fs = require('fs');
      const path = require('path');
      const filename = `sj-econ-info-export-${Date.now()}.txt`;
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      const filePath = path.join(uploadDir, filename);

      // 确保目录存在
      try {
        await fs.promises.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        // 目录已存在或创建失败，继续
      }
      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

      return filePath;
    } catch (error) {
      throw new BadRequestException(`导出数据失败: ${error.message}`);
    }
  }
}
