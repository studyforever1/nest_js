import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { GlMaterialInfo } from './entities/gl-material-info.entity';
import { CreateGlMaterialInfoDto } from './dto/create-gl-material-info.dto';
import { UpdateGlMaterialInfoDto } from './dto/update-gl-material-info.dto';
import * as ExcelJS from 'exceljs';
import { Express } from 'express';

@Injectable()
export class GlMaterialInfoService {
  constructor(
    @InjectRepository(GlMaterialInfo)
    private readonly rawRepo: Repository<GlMaterialInfo>,
  ) {}

  async create(dto: CreateGlMaterialInfoDto, username: string) {
  const raw = this.rawRepo.create({
    ...dto,
    inventory: dto.inventory ?? 0,
    modifier: username,
    remark: dto.remark ?? '',  // 新增 remark
  });
  return await this.rawRepo.save(raw);
}

async update(id: number, dto: UpdateGlMaterialInfoDto, username: string) {
  const raw = await this.rawRepo.findOne({ where: { id } });
  if (!raw) throw new NotFoundException(`原料ID ${id} 不存在`);
  Object.assign(raw, dto, {
    inventory: dto.inventory ?? raw.inventory,
    modifier: username,
    remark: dto.remark ?? raw.remark,  // 更新 remark
  });
  return await this.rawRepo.save(raw);
}

  /** 格式化原料数据（输出到前端） */
  private formatRaw(raw: GlMaterialInfo) {
  const { id, category, name, composition, remark, inventory } = raw; // 加上 inventory
  if (!composition) return { id, category, name, remark, inventory };

  const { TFe = null, H2O = null,返矿率=null,干基价格=null,返矿价格=null, ...otherComposition } = composition as Record<string, any>;

  return {
    id,
    category,
    name,
    TFe,
    ...otherComposition,
    H2O,
    返矿率,
    返矿价格,
    干基价格,
    inventory,
    remark,
     // 输出库存
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

  /**
   * 导出 Excel（智能列头：固定 + 动态成分）
   */
  async exportExcel(): Promise<Buffer> {
  const raws = await this.rawRepo.find();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('原料数据');

  // 固定列头
  const fixedHeaders = ['分类编号', '原料', 'TFe'];

  // 收集动态成分键（排除常用字段）
  const dynamicKeys = new Set<string>();
  raws.forEach(raw => {
    if (raw.composition) {
      Object.keys(raw.composition).forEach(key => {
        if (!['TFe', 'H2O', '返矿率', '返矿价格','干基价格'].includes(key) && key.trim()) {
          dynamicKeys.add(key);
        }
      });
    }
  });

  // 最终列顺序
  const headers = [
    ...fixedHeaders,
    ...Array.from(dynamicKeys).sort(),
    'H2O',
    '返矿率',
    '返矿价格',
    '干基价格',
    '库存',
    '产地',
    '备注'
  ];
  sheet.addRow(headers);

  // 填充数据
  raws.forEach(raw => {
    const row: any[] = [];
    row.push(raw.category ?? '');
    row.push(raw.name ?? '');
    row.push(raw.composition?.['TFe'] ?? null);

    Array.from(dynamicKeys).forEach(key => {
      row.push(raw.composition?.[key] ?? null);
    });

    row.push(raw.composition?.['H2O'] ?? null);
    row.push(raw.composition?.['返矿率'] ?? null);
    row.push(raw.composition?.['返矿价格'] ?? null);
    row.push(raw.composition?.['干基价格'] ?? null);
    row.push(raw.inventory ?? 0);
    row.push(raw.origin ?? '');
    row.push(raw.remark ?? '');

    sheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

  /**
   * 导入 Excel（健壮解析、自动跳过空列、按行创建）
   * 返回导入结果（成功条数等）
   */
  async importExcel(file: Express.Multer.File, username: string) {
  try {
    if (!file?.buffer) return { status: 'error', message: '文件为空' };

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Excel 中没有工作表');

    // 读取表头
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      headers.push(cell.value ? String(cell.value).trim() : '');
    });

    // 获取列索引（从1开始）
    const getIndex = (name: string) => {
      const idx = headers.findIndex(h => h === name);
      return idx >= 0 ? idx + 1 : -1;
    };

    const categoryIndex = getIndex('分类编号');
    const nameIndex = getIndex('原料');
    const originIndex = getIndex('产地');
    const inventoryIndex = getIndex('库存');
    const remarkIndex = getIndex('备注');
    const TFeIndex = getIndex('TFe');
    const H2OIndex = getIndex('H2O');
    const 返矿率Index = getIndex('返矿率');
    const 返矿价格Index = getIndex('返矿价格');
    const 干基价格Index = getIndex('干基价格');

    // 动态字段（排除固定列）
    const dynamicFieldIndices: { idx: number; key: string }[] = [];
    headers.forEach((h, i) => {
      const col = i + 1;
      if ([categoryIndex, nameIndex, originIndex, inventoryIndex, remarkIndex, TFeIndex, H2OIndex, 返矿率Index, 返矿价格Index, 干基价格Index].includes(col)) return;
      if (h && h.trim()) dynamicFieldIndices.push({ idx: col, key: h });
    });

    const rawsToSave: GlMaterialInfo[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头

      const category = categoryIndex > 0 ? String(row.getCell(categoryIndex).value ?? '').trim() : '';
      const name = nameIndex > 0 ? String(row.getCell(nameIndex).value ?? '').trim() : '';
      const origin = originIndex > 0 ? String(row.getCell(originIndex).value ?? '').trim() : '其他粉矿';
      const inventory = inventoryIndex > 0 ? parseFloat(String(row.getCell(inventoryIndex).value ?? 0)) || 0 : 0;
      const remark = remarkIndex > 0 ? String(row.getCell(remarkIndex).value ?? '').trim() : '';

      if (!name) return; // 跳过关键字段为空的行

      // 构建 composition
      const composition: Record<string, any> = {};

      // 动态字段
      dynamicFieldIndices.forEach(({ idx, key }) => {
        const val = row.getCell(idx).value;
        const num = val === null || val === undefined || val === '' ? null : parseFloat(String(val).trim());
        composition[key] = (num !== null && !Number.isNaN(num)) ? num : val;
      });

      // 固定字段，只处理 Excel 中存在的列
      if (TFeIndex > 0) composition['TFe'] = parseFloat(String(row.getCell(TFeIndex).value ?? 0)) || 0;
      if (H2OIndex > 0) composition['H2O'] = parseFloat(String(row.getCell(H2OIndex).value ?? 0)) || 0;
      if (返矿率Index > 0) composition['返矿率'] = parseFloat(String(row.getCell(返矿率Index).value ?? 0)) || 0;
      if (返矿价格Index > 0) composition['返矿价格'] = parseFloat(String(row.getCell(返矿价格Index).value ?? 0)) || 0;
      if (干基价格Index > 0) composition['干基价格'] = parseFloat(String(row.getCell(干基价格Index).value ?? 0)) || 0;

      rawsToSave.push(this.rawRepo.create({
        category,
        name,
        origin,
        inventory,
        remark,
        composition,
        modifier: username,
      }));
    });

    if (!rawsToSave.length) return { status: 'error', message: '没有有效数据可导入' };

    await this.rawRepo.save(rawsToSave);
    return { status: 'success', message: `成功导入 ${rawsToSave.length} 条数据` };

  } catch (error) {
    console.error('importExcel error:', error);
    return { status: 'error', message: '导入失败，文件格式可能有误' };
  }
}


}
