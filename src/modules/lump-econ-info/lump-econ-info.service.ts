import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Express } from 'express';

import { LumpEconInfo } from './entities/lump-econ-info.entity';
import { CreateLumpEconInfoDto } from './dto/create-lump-econ-info.dto';
import { UpdateLumpEconInfoDto } from './dto/update-lump-econ-info.dto';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'l.name',
  created_at: 'l.created_at',
  'composition.TFe': "JSON_EXTRACT(l.composition, '$.TFe')",
};

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 注意：composition 中不包含"块矿名称"和"港口"
 */
export const FIXED_HEADERS = [
  '块矿名称', '港口',
  'TFe', 'SiO2', 'Al2O3', 'P', 'S', 'MnO', 'H2O',
  '粉率', '车板价', '运费', '干粉价格',
  '厂内筛分搬到等费用', '干基不含税',
  'CaO', 'MgO', 'TiO2', 'Zn', 'K2O', 'Na2O',
  'Cr', 'Cu', 'As', '烧损', 'Ni',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

@Injectable()
export class LumpEconInfoService {
  constructor(
    @InjectRepository(LumpEconInfo)
    private readonly repo: Repository<LumpEconInfo>,
  ) {}

  /** =========================
   *  核心：规范化 composition（按 FIXED_HEADERS 顺序，排除"块矿名称"和"港口"）
   * ========================= */
  private normalizeComposition(
    composition?: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    FIXED_HEADERS.forEach((key) => {
      if (key === '块矿名称' || key === '港口') return;
      result[key] = composition?.[key] ?? 0;
    });

    return result;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreateLumpEconInfoDto, username: string) {
    const normalized = this.normalizeComposition(dto.composition);
    // 保留"港口"字段（如果存在）
    if (dto.composition?.['港口']) {
      normalized['港口'] = dto.composition['港口'];
    }
    const entity = this.repo.create({
      ...dto,
      composition: normalized,
      modifier: username,
      enabled: true,
    });
    return this.repo.save(entity);
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateLumpEconInfoDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`ID ${id} 不存在`);

    let composition = entity.composition;
    if (dto.composition) {
      composition = this.normalizeComposition(dto.composition);
      // 保留"港口"字段（如果存在）
      if (dto.composition['港口']) {
        composition['港口'] = dto.composition['港口'];
      } else if (entity.composition?.['港口']) {
        composition['港口'] = entity.composition['港口'];
      }
    }

    Object.assign(entity, {
      ...dto,
      composition,
      modifier: username,
    });

    return this.repo.save(entity);
  }

  /** ========================= 查询（核心修改点） ========================= */
async query(options: {
  page?: number;
  pageSize?: number;
  name?: string;
  type?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const { page = 1, pageSize = 10, name, type, sort, order } = options;

  const qb = this.repo.createQueryBuilder('l');

  // ================= 1️⃣ 名称模糊 =================
  if (name) {
    qb.andWhere('l.name LIKE :name', { name: `%${name}%` });
  }

  // ================= 2️⃣ 分类筛选 =================
  if (type) {
    qb.andWhere('l.category LIKE :type', { type: `%${type}%` });
  }

  // ================= 3️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      // composition 内字段排序
      const key = sort.replace('composition.', '');
      qb.orderBy(
        `CAST(JSON_EXTRACT(l.composition, '$."${key}"') AS DECIMAL)`,
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else if (SORT_FIELD_MAP[sort]) {
      // 普通字段排序
      qb.orderBy(
        SORT_FIELD_MAP[sort],
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else {
      // fallback 默认排序
      qb.orderBy('l.id', 'ASC');
    }
  } else {
    qb.orderBy('l.id', 'ASC');
  }

  // ================= 4️⃣ 分页 =================
  qb.skip((page - 1) * pageSize).take(pageSize);

  const [list, total] = await qb.getManyAndCount();

  // ================= 5️⃣ 格式化 composition =================
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


  /** 批量删除 */
  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供删除 ID');

    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) {
      throw new NotFoundException(`ID ${ids.join(',')} 不存在`);
    }
    return this.repo.remove(list);
  }

  /** 清空 */
  async removeAll(username: string) {
    const list = await this.repo.find();
    if (!list.length) {
      return { status: 'error', message: '块矿经济性库为空' };
    }

    list.forEach(i => (i.modifier = username));
    await this.repo.remove(list);

    return {
      status: 'success',
      message: `成功删除 ${list.length} 条记录`,
    };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const list = await this.repo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('块矿经济性');

    // ✅ 按 FIXED_HEADERS 顺序导出
    sheet.addRow(FIXED_HEADERS);

    list.forEach(item => {
      const composition = this.normalizeComposition(item.composition);
      const port = item.composition?.['港口'] ?? '未知港口';

      sheet.addRow([
        item.name,
        port,
        ...FIXED_HEADERS
          .filter(h => h !== '块矿名称' && h !== '港口')
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

    // ✅ 严格校验表头：每个列名必须在 FIXED_HEADERS 中
    headerRow.eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (!val) return;
      if (!FIXED_HEADERS.includes(val as FixedHeader)) {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['块矿名称']) {
      throw new BadRequestException('缺少必要列：块矿名称');
    }

    const result: LumpEconInfo[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['块矿名称'])?.value ?? '').trim();
      if (!name) return;

      const port = headerMap['港口']
        ? String(row.getCell(headerMap['港口'])?.value ?? '').trim()
        : '未知港口';

      const composition: Record<string, any> = {};

      // ✅ 遍历 FIXED_HEADERS，缺失列自动补0（"港口"补默认值）
      FIXED_HEADERS.forEach(key => {
        if (key === '块矿名称') return;
        if (key === '港口') {
          composition[key] = port;
          return;
        }
        const col = headerMap[key];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        composition[key] = Number.isFinite(val) ? val : 0;
      });

      // 规范化 composition，但保留"港口"字段
      const normalized = this.normalizeComposition(composition);
      normalized['港口'] = port;

      result.push(this.repo.create({
        name,
        composition: normalized,
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
  private readonly templateFilename = 'lump-econ-info-template.xlsx';

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
