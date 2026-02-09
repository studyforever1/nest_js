import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Express } from 'express';

import { SjFinesChemTyp } from './entities/sj-fines-chem-typ.entity';
import { CreateSjFinesChemTypDto } from './dto/create-sj-fines-chem-typ.dto';
import { UpdateSjFinesChemTypDto } from './dto/update-sj-fines-chem-typ.dto';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 's.name',
  created_at: 's.created_at',
  'composition.TFe': "JSON_EXTRACT(s.composition, '$.TFe')",
};


/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 注意：composition 中不包含"矿粉名称"
 */
export const FIXED_HEADERS = [
  '矿粉名称',
  '种类', 'TFe','SiO2','CaO','MgO','Al2O3','P','S','TiO2','MnO','K2O','Na2O','Zn','As','Pb',
  'FeO','Cu','烧损'
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

@Injectable()
export class SjFinesChemTypService {
  constructor(
    @InjectRepository(SjFinesChemTyp)
    private readonly repo: Repository<SjFinesChemTyp>,
  ) {}

  /** =========================
   *  核心：规范化 composition（按 FIXED_HEADERS 顺序，排除"矿粉名称"）
   * ========================= */
  private normalizeComposition(
    composition?: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    FIXED_HEADERS.forEach((key) => {
      if (key === '矿粉名称') return; // 排除"矿粉名称"
      result[key] = composition?.[key] ?? 0;
    });

    return result;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreateSjFinesChemTypDto, username: string) {
    const entity = this.repo.create({
      ...dto,
      composition: this.normalizeComposition(dto.composition),
      modifier: username,
      enabled: true,
    });
    return this.repo.save(entity);
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateSjFinesChemTypDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`ID ${id} 不存在`);

    Object.assign(entity, {
      ...dto,
      composition: dto.composition ? this.normalizeComposition(dto.composition) : entity.composition,
      modifier: username,
    });
    return this.repo.save(entity);
  }

  /** ========================= 查询（核心修改点） ========================= */
async query(options: { page?: number; pageSize?: number; name?: string; sort?: string; order?: 'asc' | 'desc' }) {
  const { page = 1, pageSize = 10, name, sort, order } = options;
  const qb = this.repo.createQueryBuilder('s');

  // ================= 1️⃣ 名称模糊 =================
  if (name) {
    qb.andWhere('s.name LIKE :name', { name: `%${name}%` });
  }

  // ================= 2️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      const key = sort.replace('composition.', '');
      qb.orderBy(
        `CAST(JSON_EXTRACT(s.composition, '$."${key}"') AS DECIMAL)`,
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else if (SORT_FIELD_MAP[sort]) {
      qb.orderBy(
        SORT_FIELD_MAP[sort],
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else {
      qb.orderBy('s.id', 'ASC');
    }
  } else {
    qb.orderBy('s.id', 'ASC');
  }

  // ================= 3️⃣ 分页 =================
  qb.skip((page - 1) * pageSize).take(pageSize);

  const [list, total] = await qb.getManyAndCount();

  // ================= 4️⃣ 格式化 composition =================
  const mapped = list.map(item => ({
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


  async remove(ids: number[]) {
    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) throw new NotFoundException('数据不存在');
    return this.repo.remove(list);
  }

  async removeAll(username: string) {
    const list = await this.repo.find();
    list.forEach(i => (i.modifier = username));
    await this.repo.remove(list);
    return { message: `已清空 ${list.length} 条数据` };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const list = await this.repo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('烧结矿粉化学成分典型值');

    // ✅ 按 FIXED_HEADERS 顺序导出
    sheet.addRow(FIXED_HEADERS);

    list.forEach(item => {
      const composition = this.normalizeComposition(item.composition);

      sheet.addRow([
        item.name,
        ...FIXED_HEADERS
          .filter(h => h !== '矿粉名称')
          .map(h => composition[h]),
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

  // ✅ 严格校验表头
  headerRow.eachCell((cell, col) => {
    const val = String(cell.value ?? '').trim();
    if (!val) return;
    if (!FIXED_HEADERS.includes(val as FixedHeader)) {
      throw new BadRequestException(`非法列名：${val}`);
    }
    headerMap[val] = col;
  });

  if (!headerMap['矿粉名称']) {
    throw new BadRequestException('缺少必要列：矿粉名称');
  }

  const result: SjFinesChemTyp[] = [];

  // 数值列，其余列按文本处理
  const NUMERIC_COLUMNS = [
    'TFe','SiO2','CaO','MgO','Al2O3','P','S','TiO2','MnO','K2O','Na2O','Zn','As','Pb',
    'FeO','Cu','烧损'
  ];

  sheet.eachRow({ includeEmpty: true }, (row, index) => {
    if (index === 1) return;

    const name = String(row.getCell(headerMap['矿粉名称'])?.value ?? '').trim();
    if (!name) return;

    const composition: Record<string, any> = {};

    FIXED_HEADERS.forEach(key => {
      if (key === '矿粉名称') return;

      const col = headerMap[key];
      const val = col ? row.getCell(col)?.value : null;

      if (NUMERIC_COLUMNS.includes(key)) {
        const num = Number(val);
        composition[key] = Number.isFinite(num) ? num : 0;
      } else {
        // 文本列，保留原始字符
        composition[key] = val != null ? String(val).trim() : '';
      }
    });

    result.push(this.repo.create({
      name,
      composition: this.normalizeComposition(composition),
      modifier: username,
      enabled: true,
    }));
  });

  if (!result.length) {
    return { status: 'error', message: '没有有效数据可导入' };
  }

  await this.repo.save(result);
  return { status: 'success', message: `成功导入 ${result.length} 条数据` };
}


  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'sj-fines-chem-typ-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(FIXED_HEADERS);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
  }
}
