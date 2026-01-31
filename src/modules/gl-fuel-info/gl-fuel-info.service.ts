import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { GlFuelInfo } from './entities/gl-fuel-info.entity';
import { CreateGlFuelInfoDto } from './dto/create-gl-fuel-info.dto';
import { UpdateGlFuelInfoDto } from './dto/update-gl-fuel-info.dto';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 根据数据库实际数据提取的composition字段（不包含category、name、inventory、remark等基础字段）
 */
export const FIXED_HEADERS = [
  'P', 'S', 'Cr', 'Ni', 'Pb', 'Zn', 'CaO', 'H2O', 'K2O', 'MgO', 'MnO',
  'TFe', 'Na2O', 'SiO2', 'TiO2', 'V2O5', 'Al2O3', '返焦率', '干基价格', '返焦价格',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

@Injectable()
export class GlFuelInfoService {
  constructor(
    @InjectRepository(GlFuelInfo)
    private readonly rawRepo: Repository<GlFuelInfo>,
  ) {}

  /** =========================
   *  核心：规范化 composition
   * ========================= */
  private normalizeComposition(
    composition?: Record<string, number>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    FIXED_HEADERS.forEach((key) => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreateGlFuelInfoDto, username: string) {
    const raw = this.rawRepo.create({
      ...dto,
      composition: this.normalizeComposition(dto.composition),
      inventory: dto.inventory ?? 0,
      modifier: username,
      remark: dto.remark ?? '',
    });
    return await this.rawRepo.save(raw);
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateGlFuelInfoDto, username: string) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException('数据不存在');
    Object.assign(raw, dto, {
      composition: dto.composition ? this.normalizeComposition(dto.composition) : raw.composition,
      inventory: dto.inventory ?? raw.inventory,
      modifier: username,
      remark: dto.remark ?? raw.remark,
    });
    return await this.rawRepo.save(raw);
  }

  /** 格式化原料数据（输出到前端） */
  private formatRaw(raw: GlFuelInfo) {
    const { id, category, name, composition, remark, inventory } = raw;
    if (!composition) return { id, category, name, remark, inventory };

    const normalized = this.normalizeComposition(composition);
    const { TFe = null, H2O = null, 返焦率 = null, 干基价格 = null, 返焦价格 = null, ...otherComposition } = normalized;

    return {
      id,
      category,
      name,
      TFe,
      ...otherComposition,
      H2O,
      返焦率,
      返焦价格,
      干基价格,
      inventory,
      remark,
    };
  }



  /**
   * 合并查询接口（返回分页 + 总数 + data）
   * 支持 name 模糊、type 前缀匹配（严格以 type 开头）
   */
  async query(options: {
    page?: number;
    pageSize?: number;
    name?: string;
    type?: string;
  }) {
    const { page = 1, pageSize = 10, name, type } = options;

    const qb = this.rawRepo.createQueryBuilder('raw').orderBy('raw.id', 'ASC');

    if (name) {
      qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });
    }

    if (type) {
      // 以 type 为前缀（保持原有意图），防止误匹配更复杂字符串
      qb.andWhere('raw.category LIKE :cat', { cat: `${type}%` });
    }

    const [records, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();

    const mapped = records.map(item => ({
      ...item,
      composition: this.normalizeComposition(item.composition),
    }));

    return {
      data: mapped.map(this.formatRaw),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: number) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException(`原料ID ${id} 不存在`);
    return this.formatRaw(raw);
  }

  /**
   * 批量删除
   */
  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供要删除的ID');
    const raws = await this.rawRepo.findBy({ id: In(ids) });
    if (!raws.length) throw new NotFoundException(`原料ID ${ids.join(',')} 不存在`);
    return await this.rawRepo.remove(raws);
  }

  /**
   * 删除全部（并记录 modifier）
   */
  async removeAll(username: string) {
    const raws = await this.rawRepo.find();
    if (!raws.length) return { status: 'error', message: '原料库为空，无需删除' };
    // 更新 modifier 字段以记录操作者（不过这里使用 remove，因此只是先着色）
    raws.forEach(raw => (raw.modifier = username));
    await this.rawRepo.remove(raws);
    return { status: 'success', message: `成功删除 ${raws.length} 条原料数据` };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const raws = await this.rawRepo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('高炉燃料信息库');

    sheet.addRow(['分类编号', '原料', ...FIXED_HEADERS, '库存', '备注']);

    raws.forEach(raw => {
      const composition = this.normalizeComposition(raw.composition);
      sheet.addRow([
        raw.category ?? '',
        raw.name ?? '',
        ...FIXED_HEADERS.map(h => composition[h]),
        raw.inventory ?? 0,
        raw.remark ?? '',
      ]);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** ========================= 导入 Excel ========================= */
  async importExcel(file: Express.Multer.File, username: string) {
    if (!file?.buffer) throw new BadRequestException('文件为空');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel 中没有工作表');

    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};

    headerRow.eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (!val) return;
      const allowedHeaders = ['分类编号', '原料', '库存', '备注', ...FIXED_HEADERS];
      if (!allowedHeaders.includes(val)) {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['原料']) {
      throw new BadRequestException('缺少必要列：原料');
    }

    const result: GlFuelInfo[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['原料'])?.value ?? '').trim();
      if (!name) return;

      const category = headerMap['分类编号'] ? String(row.getCell(headerMap['分类编号'])?.value ?? '').trim() : '';
      const inventory = headerMap['库存'] ? parseFloat(String(row.getCell(headerMap['库存'])?.value ?? 0)) || 0 : 0;
      const remark = headerMap['备注'] ? String(row.getCell(headerMap['备注'])?.value ?? '').trim() : '';

      const composition: Record<string, number> = {};

      FIXED_HEADERS.forEach(key => {
        const col = headerMap[key];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        composition[key] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.rawRepo.create({
        category,
        name,
        composition,
        inventory,
        remark,
        modifier: username,
      }));
    });

    if (!result.length) {
      return { status: 'error', message: '没有有效数据可导入' };
    }

    await this.rawRepo.save(result);
    return { status: 'success', message: `成功导入 ${result.length} 条数据` };
  }

  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'gl-fuel-info-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(['分类编号', '原料', ...FIXED_HEADERS, '库存', '备注']);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
  }

}
