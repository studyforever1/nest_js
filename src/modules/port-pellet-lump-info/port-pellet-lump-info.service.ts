import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';
import { PortPelletLumpInfo } from './entities/port-pellet-lump-info.entity';
import { CreatePortPelletLumpInfoDto } from './dto/create-port-pellet-lump-info.dto';
import { UpdatePortPelletLumpInfoDto } from './dto/update-port-pellet-lump-info.dto';
import { PortPelletLumpPaginationDto } from './dto/pagination.dto';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'ore.name',
  inventory: 'ore.inventory',
  created_at: 'ore.created_at',
  'composition.TFe': "JSON_EXTRACT(ore.composition, '$.TFe')",
};

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 */
export const FIXED_HEADERS = [
  '矿粉名称', '港口',
  'TFe', 'SiO2', 'Al2O3', 'P', 'S', 'MnO', 'H2O',
  '粉率', '车板价', '运费', '干粉价格',
  '厂内筛分搬到等费用', '干基不含税',
  'CaO', 'MgO', 'TiO2', 'Zn', 'K2O', 'Na2O',
  'Cr', 'Cu', 'As', '烧损', 'Ni',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

@Injectable()
export class PortPelletLumpInfoService {
  constructor(
    @InjectRepository(PortPelletLumpInfo)
    private readonly repo: Repository<PortPelletLumpInfo>,
  ) {}

  /** =========================
   *  核心：规范化 composition
   * ========================= */
  private normalizeComposition(
    composition?: Record<string, number>,
  ): Record<string, number> {
    const result: Record<string, number> = {};

    FIXED_HEADERS.forEach((key) => {
      if (key === '矿粉名称' || key === '港口') return;
      result[key] = composition?.[key] ?? 0;
    });

    return result;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreatePortPelletLumpInfoDto, username: string) {
    return this.repo.save(
      this.repo.create({ ...dto, modifier: username }),
    );
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdatePortPelletLumpInfoDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('数据不存在');

    Object.assign(entity, dto, { modifier: username });
    return this.repo.save(entity);
  }

  /** ========================= 查询（核心修改点） ========================= */
  async query(params: PortPelletLumpPaginationDto) {
    const { page = 1, pageSize = 10, name, sort, order } = params;
    const qb = this.repo.createQueryBuilder('ore');

    if (name) {
      qb.andWhere('ore.name LIKE :name', { name: `%${name}%` });
    }

    const sortField = sort && SORT_FIELD_MAP[sort]
      ? SORT_FIELD_MAP[sort]
      : 'ore.id';

    qb.orderBy(sortField, order === 'desc' ? 'DESC' : 'ASC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await qb.getManyAndCount();

    /**
     * ✅ 只重排 composition
     * ❌ 不再返回 fixedRow
     */
    const mapped = list.map(item => ({
      ...item,
      composition: this.normalizeComposition(item.composition),
    }));

    return { list: mapped, total, page, pageSize };
  }

  /** ========================= 删除 ========================= */
  async remove(ids: number[]) {
    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) throw new NotFoundException('数据不存在');
    return this.repo.remove(list);
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const list = await this.repo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('球团块矿');

    sheet.addRow(FIXED_HEADERS);

    list.forEach(item => {
      const composition = this.normalizeComposition(item.composition);

      sheet.addRow([
        item.name,
        item.port,
        ...FIXED_HEADERS
          .filter(h => h !== '矿粉名称' && h !== '港口')
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

    const result: PortPelletLumpInfo[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['矿粉名称'])?.value ?? '').trim();
      if (!name) return;

      const port = headerMap['港口']
        ? String(row.getCell(headerMap['港口'])?.value ?? '').trim()
        : '未知港口';

      const composition: Record<string, number> = {};

      FIXED_HEADERS.forEach(key => {
        if (key === '矿粉名称' || key === '港口') return;
        const col = headerMap[key];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        composition[key] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.repo.create({
        name,
        port,
        composition,
        inventory: 0,
        modifier: username,
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
  private readonly templateFilename = 'port-pellet-lump-template.xlsx';

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

  /** ========================= 删除全部 ========================= */
  async removeAll(username: string) {
    const list = await this.repo.find();
    if (!list.length) {
      return { status: 'error', message: '没有数据可删除' };
    }

    list.forEach(i => (i.modifier = username));
    await this.repo.remove(list);

    return { status: 'success', message: `成功删除 ${list.length} 条原料` };
  }
}
