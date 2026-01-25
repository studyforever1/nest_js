import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PortIronOreInfo } from './entities/port-iron-ore-info.entity';
import { CreatePortIronOreInfoDto } from './dto/create-port-iron-ore-info.dto';
import { UpdatePortIronOreInfoDto } from './dto/update-port-iron-ore-info.dto';
import { PortIronOrePaginationDto } from './dto/pagination.dto';
import * as ExcelJS from 'exceljs';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'ore.name',
  inventory: 'ore.inventory',
  created_at: 'ore.created_at',
  'composition.TFe': "JSON_EXTRACT(ore.composition, '$.TFe')",
  'composition.价格': "JSON_EXTRACT(ore.composition, '$.价格')",
};

const FIXED_HEADERS = [
  '矿粉名称',
  'TFe', 'CaO', 'SiO2', 'MgO', 'Al2O3',
  'S', 'P', 'TiO2', 'MnO',
  'K2O', 'Na2O',
  'Zn', 'Pb', 'As', 'Cr', 'V', 'Cu',
  '烧损', '干基不含税',
];


@Injectable()
export class PortIronOreInfoService {
  constructor(
    @InjectRepository(PortIronOreInfo)
    private readonly repo: Repository<PortIronOreInfo>,
  ) {}

  async create(dto: CreatePortIronOreInfoDto, username: string) {
    const ore = this.repo.create({
      ...dto,
      inventory: dto.inventory ?? 0,
      modifier: username,
      remark: dto.remark ?? '',
    });
    return this.repo.save(ore);
  }

  async update(id: number, dto: UpdatePortIronOreInfoDto, username: string) {
    const ore = await this.repo.findOne({ where: { id } });
    if (!ore) throw new NotFoundException(`ID ${id} 不存在`);
    Object.assign(ore, dto, { modifier: username });
    return this.repo.save(ore);
  }

  async query(params: PortIronOrePaginationDto) {
    const { page = 1, pageSize = 10, name, sort, order } = params;
    const qb = this.repo.createQueryBuilder('ore');

    if (name) {
      qb.andWhere('ore.name LIKE :name', { name: `%${name}%` });
    }

    if (sort && SORT_FIELD_MAP[sort]) {
      qb.orderBy(SORT_FIELD_MAP[sort], order === 'desc' ? 'DESC' : 'ASC');
    } else {
      qb.orderBy('ore.id', 'ASC');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);
    const [list, total] = await qb.getManyAndCount();

    return { list, total, page, pageSize };
  }

  async remove(ids: number[]) {
    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) throw new NotFoundException('数据不存在');
    return this.repo.remove(list);
  }

async exportExcel(): Promise<Buffer> {
  const list = await this.repo.find();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('港口矿粉');

  sheet.addRow(FIXED_HEADERS);

  list.forEach(item => {
    const row = [
      item.name,
      ...FIXED_HEADERS.slice(1).map(k => item.composition?.[k] ?? 0),
    ];
    sheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}


async importExcel(file: Express.Multer.File, username: string) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Excel 中没有工作表');

    /** 1️⃣ 读取表头，建立列名 → 列号映射 */
    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim();
      if (FIXED_HEADERS.includes(val)) {
        headerMap[val] = colNumber;
      }
    });

    const ores: PortIronOreInfo[] = [];

    /** 2️⃣ 逐行解析 */
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
  if (rowNumber === 1) return; // 跳过表头
  if (!row) return; // 空行直接跳过

  const nameCell = headerMap['矿粉名称'] ? row.getCell(headerMap['矿粉名称']) : null;
  const portCell = headerMap['港口'] ? row.getCell(headerMap['港口']) : null;

  const name = nameCell?.value ? String(nameCell.value).trim() : '';
  if (!name) return; // 没名字的行跳过

  const port = portCell?.value ? String(portCell.value).trim() : '未知港口';

  // 不再用 slice(2)，而是直接遍历 FIXED_HEADERS，排除 "矿粉名称" 和 "港口"
const composition: Record<string, number> = {};
FIXED_HEADERS.forEach(key => {
  if (key === '矿粉名称' || key === '港口') return; // 跳过前两列
  const colNum = headerMap[key];
  let val = 0;
  if (colNum !== undefined) {
    const cellVal = row.getCell(colNum)?.value;
    val = Number.isFinite(parseFloat(String(cellVal ?? 0))) ? parseFloat(String(cellVal ?? 0)) : 0;
  }
  composition[key] = val;
});


  ores.push(
    this.repo.create({
      name,
      port,
      inventory: 0,
      remark: '',
      composition,
      modifier: username,
    }),
  );
});

    if (!ores.length) {
      return { status: 'error', message: '没有有效数据可导入' };
    }

    await this.repo.save(ores);
    return { status: 'success', message: `成功导入 ${ores.length} 条数据` };
  } catch (error) {
    console.error('importExcel error:', error);
    return { status: 'error', message: error.message || '导入失败' };
  }
}

  /** 删除所有原料 */
async removeAll(username: string) {
  try {
    const allRecords = await this.repo.find();
    if (!allRecords.length) {
      return { status: 'error', message: '没有数据可删除' };
    }

    // 可选：记录操作人
    allRecords.forEach(record => {
      record.modifier = username;
    });

    await this.repo.remove(allRecords);

    return { status: 'success', message: `成功删除 ${allRecords.length} 条原料` };
  } catch (error) {
    console.error('removeAll error:', error);
    return { status: 'error', message: '删除失败' };
  }
}

}
