import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
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

const FIXED_HEADERS = [
  '矿粉名称','港口',
  'TFe', 'SiO2', 'Al2O3', 'P', 'S', 'MnO', 'H2O',
  '粉率', '车板价', '运费', '干粉价格',
  '厂内筛分搬到等费用', '干基不含税',
  'CaO', 'MgO', 'TiO2', 'Zn', 'K2O', 'Na2O',
  'Cr', 'Cu', 'As', 'Ni', '烧损',
];

@Injectable()
export class PortPelletLumpInfoService {
  constructor(
    @InjectRepository(PortPelletLumpInfo)
    private readonly repo: Repository<PortPelletLumpInfo>,
  ) {}

  async create(dto: CreatePortPelletLumpInfoDto, username: string) {
    return this.repo.save(
      this.repo.create({ ...dto, modifier: username }),
    );
  }

  async update(id: number, dto: UpdatePortPelletLumpInfoDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('数据不存在');
    Object.assign(entity, dto, { modifier: username });
    return this.repo.save(entity);
  }

async query(params: PortPelletLumpPaginationDto) {
  const { page = 1, pageSize = 10, name, sort, order } = params;
  const qb = this.repo.createQueryBuilder('ore');

  // 过滤名称
  if (name) {
    qb.andWhere('ore.name LIKE :name', { name: `%${name}%` });
  }

  // 安全处理排序字段和顺序
  const sortField = sort && SORT_FIELD_MAP[sort] ? SORT_FIELD_MAP[sort] : 'ore.id';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  qb.orderBy(sortField, sortOrder);

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
    const sheet = workbook.addWorksheet('球团块矿');

    sheet.addRow(FIXED_HEADERS);

    list.forEach(item => {
      sheet.addRow([
        item.name,
        ...FIXED_HEADERS.slice(1).map(k => item.composition?.[k] ?? 0),
      ]);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

async importExcel(file: Express.Multer.File, username: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel 中没有工作表');

  const result: PortPelletLumpInfo[] = [];

  // 1️⃣ 获取表头
  const headerRow = sheet.getRow(1);
  const headerMap: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value ?? '').trim();
    if (FIXED_HEADERS.includes(val)) {
      headerMap[val] = colNumber; // 记录列号
    }
  });

  // 2️⃣ 逐行解析
  sheet.eachRow({ includeEmpty: true }, (row, rowIndex) => {
    if (rowIndex === 1) return; // 跳过表头
    if (!row) return; // 空行跳过

    const nameCell = headerMap['矿粉名称'] ? row.getCell(headerMap['矿粉名称']) : null;
    const portCell = headerMap['港口'] ? row.getCell(headerMap['港口']) : null;

    const name = nameCell?.value ? String(nameCell.value).trim() : '';
    if (!name) return; // 没名字的行跳过

    const port = portCell?.value ? String(portCell.value).trim() : '未知港口';

    const composition: Record<string, number> = {};
    // ✅ 遍历 FIXED_HEADERS，排除前两列
    FIXED_HEADERS.forEach(key => {
      if (key === '矿粉名称' || key === '港口') return; // 跳过
      const colNum = headerMap[key];
      let val = 0;
      if (colNum !== undefined && row.getCell(colNum)) {
        const cellVal = row.getCell(colNum).value;
        val = Number.isFinite(parseFloat(String(cellVal ?? 0))) 
              ? parseFloat(String(cellVal ?? 0)) 
              : 0;
      }
      composition[key] = val;
    });

    result.push(
      this.repo.create({
        name,
        port,
        composition,
        inventory: 0,
        modifier: username,
      }),
    );
  });

  if (!result.length) {
    return { status: 'error', message: '没有有效数据可导入' };
  }

  await this.repo.save(result);
  return { status: 'success', message: `成功导入 ${result.length} 条数据` };
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
