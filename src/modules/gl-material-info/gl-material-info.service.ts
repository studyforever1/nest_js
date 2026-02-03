import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GlMaterialInfo } from './entities/gl-material-info.entity';
import { CreateGlMaterialInfoDto } from './dto/create-gl-material-info.dto';
import { UpdateGlMaterialInfoDto } from './dto/update-gl-material-info.dto';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 / 计算
 * - 全部只存在于 composition 中
 */
export const FIXED_HEADERS = [
  'P', 'S', 'Cr', 'Ni', 'Pb', 'Zn', 'CaO', 'H2O', 'K2O', 'MgO', 'MnO',
  'TFe', 'Na2O', 'SiO2', 'TiO2', 'V2O5', 'Al2O3',
  '返矿率', '干基价格', '返矿价格',
] as const;

@Injectable()
export class GlMaterialInfoService {
  constructor(
    @InjectRepository(GlMaterialInfo)
    private readonly rawRepo: Repository<GlMaterialInfo>,
  ) {}

  /** =========================
   *  核心：规范化 composition
   * ========================= */
  private normalizeComposition(
    composition?: Record<string, number>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    FIXED_HEADERS.forEach(key => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreateGlMaterialInfoDto, username: string) {
    const raw = this.rawRepo.create({
      ...dto,
      composition: this.normalizeComposition(dto.composition),
      inventory: dto.inventory ?? 0,
      remark: dto.remark ?? '',
      modifier: username,
    });
    return this.rawRepo.save(raw);
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateGlMaterialInfoDto, username: string) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException('数据不存在');

    Object.assign(raw, {
      ...dto,
      composition: dto.composition
        ? this.normalizeComposition(dto.composition)
        : raw.composition,
      inventory: dto.inventory ?? raw.inventory,
      remark: dto.remark ?? raw.remark,
      modifier: username,
    });

    return this.rawRepo.save(raw);
  }

  /** ========================= 前端统一输出格式 ========================= */
  private formatRaw(raw: GlMaterialInfo) {
    const { id, category, name, origin, inventory, remark, composition } = raw;

    return {
      id,
      category,
      name,
      origin,
      inventory,
      remark,
      composition: this.normalizeComposition(composition),
    };
  }

  /** ========================= 分页查询 ========================= */
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
      qb.andWhere('raw.category LIKE :cat', { cat: `${type}%` });
    }

    const [records, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: records.map(r => this.formatRaw(r)),
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

  /** ========================= 删除 ========================= */
  async remove(ids: number[]) {
    if (!ids?.length) throw new BadRequestException('未提供要删除的ID');
    const raws = await this.rawRepo.findBy({ id: In(ids) });
    if (!raws.length) throw new NotFoundException('数据不存在');
    return this.rawRepo.remove(raws);
  }

  async removeAll(username: string) {
    const raws = await this.rawRepo.find();
    if (!raws.length) {
      return { status: 'error', message: '原料库为空' };
    }
    raws.forEach(r => (r.modifier = username));
    await this.rawRepo.remove(raws);
    return { status: 'success', message: `成功删除 ${raws.length} 条数据` };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const raws = await this.rawRepo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('高炉原料信息库');

    sheet.addRow(['分类编号', '原料', ...FIXED_HEADERS, '库存', '产地', '备注']);

    raws.forEach(raw => {
      const composition = this.normalizeComposition(raw.composition);
      sheet.addRow([
        raw.category ?? '',
        raw.name ?? '',
        ...FIXED_HEADERS.map(h => composition[h]),
        raw.inventory ?? 0,
        raw.origin ?? '',
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

    const allowedHeaders = ['分类编号', '原料', '库存', '产地', '备注', ...FIXED_HEADERS];

    headerRow.eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (!val) return;
      if (!allowedHeaders.includes(val)) {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['原料']) {
      throw new BadRequestException('缺少必要列：原料');
    }

    const result: GlMaterialInfo[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['原料'])?.value ?? '').trim();
      if (!name) return;

      const category = headerMap['分类编号']
        ? String(row.getCell(headerMap['分类编号'])?.value ?? '').trim()
        : '';

      const origin = headerMap['产地']
        ? String(row.getCell(headerMap['产地'])?.value ?? '').trim()
        : '其他粉矿';

      const inventory = headerMap['库存']
        ? Number(row.getCell(headerMap['库存'])?.value ?? 0)
        : 0;

      const remark = headerMap['备注']
        ? String(row.getCell(headerMap['备注'])?.value ?? '').trim()
        : '';

      const composition: Record<string, number> = {};
      FIXED_HEADERS.forEach(key => {
        const col = headerMap[key];
        const val = col ? Number(row.getCell(col)?.value ?? 0) : 0;
        composition[key] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.rawRepo.create({
        category,
        name,
        origin,
        inventory,
        remark,
        composition,
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
  private readonly templateFilename = 'gl-material-info-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板')
      .addRow(['分类编号', '原料', ...FIXED_HEADERS, '库存', '产地', '备注']);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
  }
}
