import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SjEconInfo } from './entities/sj-econ-info.entity';
import { CreateSjEconInfoDto } from './dto/create-sj-econ-info.dto';
import { UpdateSjEconInfoDto } from './dto/update-sj-econ-info.dto';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 根据数据库实际数据提取的composition字段
 */
export const FIXED_HEADERS = [
  'P', 'S', 'As', 'Pb', 'Zn', 'CaO', 'K2O', 'MgO', 'TFe', 'Na2O',
  'SiO2', 'TiO2', 'V2O5', 'Al2O3', '价格', '烧损',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

/** 排序字段映射 */
const SORT_FIELD_MAP: Record<string, string> = {
  // 普通字段
  name: 'e.name',
  created_at: 'e.created_at',
  // JSON 字段
  'composition.TFe': "JSON_EXTRACT(e.composition, '$.TFe')",
  'composition.价格': "JSON_EXTRACT(e.composition, '$.价格')",
};

@Injectable()
export class SjEconInfoService {
  private readonly SORT_FIELD_MAP = SORT_FIELD_MAP;

  constructor(
    @InjectRepository(SjEconInfo)
    private readonly econRepo: Repository<SjEconInfo>,
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
  async create(dto: CreateSjEconInfoDto, username: string) {
    const econ = this.econRepo.create({
      ...dto,
      composition: dto.composition ?? {},
      modifier: username,
      enabled: true,
    });
    return this.econRepo.save(econ);
  }

  /** 更新 */
  async update(id: number, dto: UpdateSjEconInfoDto, username: string) {
    const econ = await this.econRepo.findOne({ where: { id } });
    if (!econ) throw new NotFoundException(`经济指标 ID ${id} 不存在`);

    Object.assign(econ, dto, {
      composition: dto.composition ?? econ.composition,
      modifier: username,
    });

    return this.econRepo.save(econ);
  }

  /** 查询（分页 + 名称模糊 + 排序） */
async query(options: {
  page?: number;
  pageSize?: number;
  name?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const { page = 1, pageSize = 10, name, sort, order } = options;

  const qb = this.econRepo.createQueryBuilder('e');

  // ================= 1️⃣ 名称模糊 =================
  if (name) {
    qb.andWhere('e.name LIKE :name', { name: `%${name}%` });
  }

  // ================= 2️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      const key = sort.replace('composition.', '');
      qb.orderBy(
        `CAST(JSON_EXTRACT(e.composition, '$."${key}"') AS DECIMAL)`,
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else if (this.SORT_FIELD_MAP[sort]) {
      qb.orderBy(
        this.SORT_FIELD_MAP[sort],
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else {
      qb.orderBy('e.id', 'ASC');
    }
  } else {
    qb.orderBy('e.id', 'ASC');
  }

  // ================= 3️⃣ 分页 =================
  qb.skip((page - 1) * pageSize).take(pageSize);

  const [records, total] = await qb.getManyAndCount();

  // ================= 4️⃣ 格式化 composition =================
  const mapped = records.map(item => ({
    ...item,
    composition: this.normalizeComposition(item.composition),
  }));

  return {
    data: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}


  /** 批量删除 */
  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供要删除的 ID');

    const list = await this.econRepo.findBy({ id: In(ids) });
    if (!list.length) {
      throw new NotFoundException(`ID ${ids.join(',')} 不存在`);
    }

    return this.econRepo.remove(list);
  }

  /** 删除全部 */
  async removeAll(username: string) {
    const list = await this.econRepo.find();
    if (!list.length) {
      return { status: 'error', message: '经济指标库为空' };
    }

    list.forEach(i => (i.modifier = username));
    await this.econRepo.remove(list);

    return {
      status: 'success',
      message: `成功删除 ${list.length} 条经济指标`,
    };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const list = await this.econRepo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('烧结经济性评价信息库');

    sheet.addRow(['名称', ...FIXED_HEADERS]);

    list.forEach(item => {
      const composition = this.normalizeComposition(item.composition);
      sheet.addRow([
        item.name,
        ...FIXED_HEADERS.map(h => composition[h]),
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
      if (!FIXED_HEADERS.includes(val as FixedHeader) && val !== '名称') {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['名称']) {
      throw new BadRequestException('缺少必要列：名称');
    }

    const result: SjEconInfo[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['名称'])?.value ?? '').trim();
      if (!name) return;

      const composition: Record<string, number> = {};

      FIXED_HEADERS.forEach(key => {
        const col = headerMap[key];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        composition[key] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.econRepo.create({
        name,
        composition,
        modifier: username,
        enabled: true,
      }));
    });

    if (!result.length) {
      return { status: 'error', message: '没有有效数据可导入' };
    }

    await this.econRepo.save(result);
    return { status: 'success', message: `成功导入 ${result.length} 条数据` };
  }

  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'sj-econ-info-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(['名称', ...FIXED_HEADERS]);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
  }
}
