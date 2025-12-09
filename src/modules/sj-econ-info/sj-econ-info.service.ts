import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { SjEconInfo } from './entities/sj-econ-info.entity';
import { CreateSjEconInfoDto } from './dto/create-sj-econ-info.dto';
import { UpdateSjEconInfoDto } from './dto/update-sj-econ-info.dto';
import * as ExcelJS from 'exceljs';
import { Express } from 'express';

@Injectable()
export class SjEconInfoService {
  constructor(
    @InjectRepository(SjEconInfo)
    private readonly sjEconInfoRepo: Repository<SjEconInfo>,
  ) {}


  /**
   * 格式化输出数据（用于列表）
   */
  private formatData(info: SjEconInfo) {
    return {
      id: info.id,
      name: info.name,
      composition: info.composition || {},
    };
  }

  /**
   * 格式化输出数据（用于详情，包含完整信息）
   */
  private formatDataDetail(info: SjEconInfo) {
    return {
      id: info.id,
      name: info.name,
      composition: info.composition || {},
      enabled: info.enabled,
      modifier: info.modifier,
      created_at: info.created_at,
      updated_at: info.updated_at,
    };
  }

  /**
   * 新增原料
   */
  async create(dto: CreateSjEconInfoDto, username: string) {
    const info = this.sjEconInfoRepo.create({
      name: dto.name,
      composition: dto.composition || {},
      modifier: username,
      enabled: true,
    });
    const saved = await this.sjEconInfoRepo.save(info);
    return this.formatDataDetail(saved);
  }

  /**
   * 更新原料
   */
  async update(id: number, dto: UpdateSjEconInfoDto, username: string) {
    const info = await this.sjEconInfoRepo.findOne({ where: { id } });
    if (!info) {
      throw new NotFoundException(`原料ID ${id} 不存在`);
    }

    if (dto.name !== undefined) info.name = dto.name;
    
    // 更新composition（如果提供了新的composition，则合并）
    if (dto.composition !== undefined) {
      info.composition = { ...(info.composition || {}), ...dto.composition };
    }

    info.modifier = username;
    const saved = await this.sjEconInfoRepo.save(info);
    return this.formatDataDetail(saved);
  }

  /**
   * 查询（支持分页、名称模糊搜索）
   */
  async query(options: {
    page?: number;
    pageSize?: number;
    name?: string;
  }) {
    const { page = 1, pageSize = 10, name } = options;

    const qb = this.sjEconInfoRepo.createQueryBuilder('info')
      .where('info.enabled = :enabled', { enabled: true })
      .orderBy('info.id', 'ASC');

    if (name) {
      qb.andWhere('info.name LIKE :name', { name: `%${name}%` });
    }

    const [records, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: records.map(this.formatData.bind(this)),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 根据ID查询单个
   */
  async findOne(id: number) {
    const info = await this.sjEconInfoRepo.findOne({ 
      where: { id, enabled: true } 
    });
    if (!info) {
      throw new NotFoundException(`原料ID ${id} 不存在`);
    }
    return this.formatDataDetail(info);
  }

  /**
   * 批量删除
   */
  async remove(ids: number[]) {
    if (!ids?.length) {
      throw new Error('未提供要删除的ID');
    }
    
    const infos = await this.sjEconInfoRepo.findBy({ id: In(ids) });
    if (!infos.length) {
      throw new NotFoundException(`原料ID ${ids.join(',')} 不存在`);
    }

    // 软删除：设置enabled为false
    infos.forEach(info => {
      info.enabled = false;
    });
    await this.sjEconInfoRepo.save(infos);

    return {
      deletedCount: infos.length,
      ids: infos.map(i => i.id),
    };
  }

  /**
   * 导出Excel
   */
  async exportExcel(): Promise<Buffer> {
    const infos = await this.sjEconInfoRepo.find({
      where: { enabled: true },
      order: { id: 'ASC' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('烧结原料经济性评价信息');

    // 固定列头（与导入格式保持一致）
    const headers = [
      '原料',
      'TFe',
      'CaO',
      'SiO2',
      'MgO',
      'Al2O3',
      'S',
      'P',
      'TiO2',
      'K2O',
      'Na2O',
      'Zn',
      'Pb',
      'As',
      'V2O5',
      'V',
      'Cr',
      'Cu',
      'MnO',
      'H2O',
      '烧损',
      '价格',
    ];
    sheet.addRow(headers);

    // 填充数据
    infos.forEach(info => {
      const composition = info.composition || {};
      const row = [
        info.name || '',
        composition.TFe ?? null,
        composition.CaO ?? null,
        composition.SiO2 ?? null,
        composition.MgO ?? null,
        composition.Al2O3 ?? null,
        composition.S ?? null,
        composition.P ?? null,
        composition.TiO2 ?? null,
        composition.K2O ?? null,
        composition.Na2O ?? null,
        composition.Zn ?? null,
        composition.Pb ?? null,
        composition.As ?? null,
        composition.V2O5 ?? null,
        composition.V ?? null,
        composition.Cr ?? null,
        composition.Cu ?? null,
        composition.MnO ?? null,
        composition.H2O ?? null,
        composition.烧损 ?? null,
        composition.价格 ?? null,
      ];
      sheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 导入Excel
   */
  async importExcel(file: Express.Multer.File, username: string) {
    try {
      if (!file?.buffer) {
        return {
          code: 4005,
          message: '导入失败: 文件格式错误或数据校验不通过',
          data: {
            importedCount: 0,
          },
        };
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as any);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error('Excel 中没有工作表');
      }

      // 读取表头
      const headers: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
        headers.push(cell.value ? String(cell.value).trim() : '');
      });

      // 获取列索引
      const getIndex = (name: string) => {
        const idx = headers.findIndex(h => h === name);
        return idx >= 0 ? idx + 1 : -1;
      };

      // 支持"原料"和"原料名称"两种列名
      const nameIndex = getIndex('原料') > 0 ? getIndex('原料') : getIndex('原料名称');
      const TFeIndex = getIndex('TFe');
      const CaOIndex = getIndex('CaO');
      const SiO2Index = getIndex('SiO2');
      const MgOIndex = getIndex('MgO');
      const Al2O3Index = getIndex('Al2O3');
      const SIndex = getIndex('S');
      const PIndex = getIndex('P');
      const TiO2Index = getIndex('TiO2');
      const K2OIndex = getIndex('K2O');
      const Na2OIndex = getIndex('Na2O');
      const ZnIndex = getIndex('Zn');
      const PbIndex = getIndex('Pb');
      const AsIndex = getIndex('As');
      const V2O5Index = getIndex('V2O5');
      const VIndex = getIndex('V');
      const CrIndex = getIndex('Cr');
      const CuIndex = getIndex('Cu');
      const MnOIndex = getIndex('MnO');
      const H2OIndex = getIndex('H2O');
      const 烧损Index = getIndex('烧损');
      const 价格Index = getIndex('价格');

      const infosToSave: SjEconInfo[] = [];

      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头

        const name = nameIndex > 0 ? String(row.getCell(nameIndex).value ?? '').trim() : '';
        if (!name) return; // 跳过名称为空的行

        const composition: Record<string, any> = {};

        const parseNumber = (index: number) => {
          if (index <= 0) return null;
          const val = row.getCell(index).value;
          if (val === null || val === undefined || val === '') return null;
          const num = parseFloat(String(val).trim());
          return !Number.isNaN(num) ? num : null;
        };

        if (TFeIndex > 0) composition.TFe = parseNumber(TFeIndex);
        if (CaOIndex > 0) composition.CaO = parseNumber(CaOIndex);
        if (SiO2Index > 0) composition.SiO2 = parseNumber(SiO2Index);
        if (MgOIndex > 0) composition.MgO = parseNumber(MgOIndex);
        if (Al2O3Index > 0) composition.Al2O3 = parseNumber(Al2O3Index);
        if (SIndex > 0) composition.S = parseNumber(SIndex);
        if (PIndex > 0) composition.P = parseNumber(PIndex);
        if (TiO2Index > 0) composition.TiO2 = parseNumber(TiO2Index);
        if (K2OIndex > 0) composition.K2O = parseNumber(K2OIndex);
        if (Na2OIndex > 0) composition.Na2O = parseNumber(Na2OIndex);
        if (ZnIndex > 0) composition.Zn = parseNumber(ZnIndex);
        if (PbIndex > 0) composition.Pb = parseNumber(PbIndex);
        if (AsIndex > 0) composition.As = parseNumber(AsIndex);
        if (V2O5Index > 0) composition.V2O5 = parseNumber(V2O5Index);
        if (VIndex > 0) composition.V = parseNumber(VIndex);
        if (CrIndex > 0) composition.Cr = parseNumber(CrIndex);
        if (CuIndex > 0) composition.Cu = parseNumber(CuIndex);
        if (MnOIndex > 0) composition.MnO = parseNumber(MnOIndex);
        if (H2OIndex > 0) composition.H2O = parseNumber(H2OIndex);
        if (烧损Index > 0) composition.烧损 = parseNumber(烧损Index);
        if (价格Index > 0) composition.价格 = parseNumber(价格Index);

        infosToSave.push(
          this.sjEconInfoRepo.create({
            name,
            composition,
            modifier: username,
            enabled: true,
          }),
        );
      });

      if (!infosToSave.length) {
        return {
          code: 4005,
          message: '导入失败: 文件格式错误或数据校验不通过',
          data: {
            importedCount: 0,
          },
        };
      }

      await this.sjEconInfoRepo.save(infosToSave);
      return {
        code: 0,
        message: `成功导入 ${infosToSave.length} 条数据`,
        data: {
          importedCount: infosToSave.length,
        },
      };
    } catch (error: any) {
      console.error('importExcel error:', error);
      return {
        code: 4005,
        message: '导入失败: 文件格式错误或数据校验不通过',
        data: {
          result: {
            importedCount: 0,
          },
        },
      };
    }
  }
}

