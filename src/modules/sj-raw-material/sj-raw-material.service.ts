import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { SjRawMaterial } from './entities/sj-raw-material.entity';
import { CreateSjRawMaterialDto } from './dto/create-sj-raw-material.dto';
import { UpdateSjRawMaterialDto } from './dto/update-sj-raw-material.dto';
import * as ExcelJS from 'exceljs';
import { Express } from 'express';


@Injectable()
export class SjRawMaterialService {
  constructor(
    @InjectRepository(SjRawMaterial)
    private readonly rawRepo: Repository<SjRawMaterial>,
  ) {}

  async create(dto: CreateSjRawMaterialDto, username: string) {
    const raw = this.rawRepo.create({
      ...dto,
      modifier: username,
    });
    return await this.rawRepo.save(raw);
  }

  async update(id: number, dto: UpdateSjRawMaterialDto, username: string) {
    const raw = await this.findOne(id);
    Object.assign(raw, dto, { modifier: username });
    return await this.rawRepo.save(raw);
  }

  /** 格式化原料数据 */
  private formatRaw(raw: SjRawMaterial) {
    const { id, category, name, origin, composition } = raw;
    if (!composition) return { id, category, name, origin };

    const { TFe, 价格, H2O, 烧损, ...otherComposition } = composition;
    return {
      id,
      category,
      name,
      TFe: TFe ?? null,
      ...otherComposition,
      H2O: H2O ?? null,
      烧损: 烧损 ?? null,
      价格: 价格 ?? null,
      origin,
    };
  }

  async findAll(page: number = 1, pageSize: number = 10) {
  const [records, total] = await this.rawRepo.findAndCount({
    skip: (page - 1) * pageSize,
    take: pageSize,
    order: { id: 'ASC' },
  });

  return {
    data: records.map(this.formatRaw),
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

  async findByName(name?: string, page: number = 1, pageSize: number = 10) {
  const where = name ? { name: Like(`%${name}%`) } : {};
  const [records, total] = await this.rawRepo.findAndCount({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    order: { id: 'ASC' },
  });

  return {
    data: records.map(this.formatRaw),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

  async findByType(type?: 'T' | 'X' | 'R' | 'F', page: number = 1, pageSize: number = 10) {
  const where = type ? { category: Like(`${type}%`) } : {};
  const [records, total] = await this.rawRepo.findAndCount({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    order: { id: 'ASC' },
  });

  return {
    data: records.map(this.formatRaw),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供要删除的ID');
    const raws = await this.rawRepo.findBy({ id: In(ids) });
    if (!raws.length) throw new NotFoundException(`原料ID ${ids.join(',')} 不存在`);
    return await this.rawRepo.remove(raws);
  }

  async removeAll(username: string) {
    const raws = await this.rawRepo.find();
    if (!raws.length) return { status: 'error', message: '原料库为空，无需删除' };
    raws.forEach(raw => (raw.modifier = username));
    await this.rawRepo.remove(raws);
    return { status: 'success', message: `成功删除 ${raws.length} 条原料数据` };
  }

  async exportExcel(): Promise<Buffer> {
  const raws = await this.rawRepo.find();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('原料数据');

  // 固定表头（去掉 ID）
  const fixedHeaders = ['分类编号', '原料', 'TFe'];

  // 动态收集 composition 字段（排除 TFe、H2O、烧损、价格）
  const dynamicKeys = new Set<string>();
  raws.forEach(raw => {
    if (raw.composition) {
      Object.keys(raw.composition).forEach(key => {
        if (!['TFe', 'H2O', '烧损', '价格'].includes(key)) {
          dynamicKeys.add(key);
        }
      });
    }
  });

  // 表头顺序：固定列 + 动态成分列 + H2O + 烧损 + 价格 + 产地
  const headers = [
    ...fixedHeaders,
    ...Array.from(dynamicKeys).sort(),
    'H2O',
    '烧损',
    '价格',
    '产地',
  ];
  sheet.addRow(headers);

  // 填充数据
  raws.forEach(raw => {
    const row: any[] = [
      raw.category,
      raw.name,
      raw.composition?.['TFe'] ?? null,
    ];

    // 填充动态成分列
    Array.from(dynamicKeys).forEach(key => {
      row.push(raw.composition?.[key] ?? null);
    });

    // 填充固定列
    row.push(raw.composition?.['H2O'] ?? null);
    row.push(raw.composition?.['烧损'] ?? null);
    row.push(raw.composition?.['价格'] ?? null);
    row.push(raw.origin ?? '');

    sheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}


/** 导入 Excel */
async importExcel(file: Express.Multer.File, username: string) {
  try {
    if (!file?.buffer) return { status: 'error', message: '文件为空' };

    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Excel 中没有工作表');

    // 读取表头
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      headers.push(cell.value?.toString()?.trim() || '');
    });

    // 找到关键列索引
    const getIndex = (name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? idx + 1 : -1; // ExcelJS 列从 1 开始
    };

    const categoryIndex = getIndex('分类编号');
    const nameIndex = getIndex('原料');
    const originIndex = getIndex('产地');
    const TFeIndex = getIndex('TFe');
    const H2OIndex = getIndex('H2O');
    const 烧损Index = getIndex('烧损');
    const 价格Index = getIndex('价格');

    const rawsToSave: SjRawMaterial[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头


      // 构建 composition 对象
      const composition: Record<string, number> = {};
      headers.forEach((key, i) => {
        const col = i + 1; // ExcelJS 列从 1 开始
        if ([categoryIndex, nameIndex, originIndex, TFeIndex, H2OIndex, 烧损Index, 价格Index].includes(col)) return;

        const value = row.getCell(col).value;
        composition[key] = parseFloat(value as any) || 0;
      });

      rawsToSave.push(
        this.rawRepo.create({
          category: categoryIndex > 0 ? row.getCell(categoryIndex).value?.toString() || '' : '',
          name: nameIndex > 0 ? row.getCell(nameIndex).value?.toString() || '' : '',
          origin: originIndex > 0 ? row.getCell(originIndex).value?.toString() || '其他粉矿' : '其他粉矿',
          composition: {
            TFe: TFeIndex > 0 ? parseFloat(row.getCell(TFeIndex).value as any) || 0 : 0,
            ...composition,
            H2O: H2OIndex > 0 ? parseFloat(row.getCell(H2OIndex).value as any) || 0 : 0,
            烧损: 烧损Index > 0 ? parseFloat(row.getCell(烧损Index).value as any) || 0 : 0,
            价格: 价格Index > 0 ? parseFloat(row.getCell(价格Index).value as any) || 0 : 0,
          },
          modifier: username,
        }),
      );
    });

    if (rawsToSave.length === 0) return { status: 'error', message: '没有有效数据可导入' };

    await this.rawRepo.save(rawsToSave);
    return { status: 'success', message: `成功导入 ${rawsToSave.length} 条数据` };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: '导入失败，文件格式可能有误' };
  }
}

}
