import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 文件处理服务
 * 
 * 提供统一的文件处理功能，包括Excel文件的导入导出
 * 特点：
 * - 支持Excel文件处理
 * - 自动文件清理
 * - 文件类型验证
 * - 错误处理机制
 * 
 * @example
 * ```typescript
 * constructor(private readonly fileService: FileService) {}
 * 
 * async importData(file: Express.Multer.File) {
 *   const data = await this.fileService.processExcelFile(file);
 *   return data;
 * }
 * ```
 */
@Injectable()
export class FileService {
  /** 上传目录路径，从环境变量获取或使用默认值 */
  private readonly uploadDir = process.env.UPLOAD_PATH || './uploads';

  /**
   * 处理Excel文件，返回JSON数据
   * 
   * 将Excel文件转换为JSON格式，支持指定工作表
   * 
   * @param file 上传的Excel文件
   * @param sheetName 指定工作表名称，不指定则使用第一个工作表
   * @returns JSON数据数组
   * @throws BadRequestException 当文件处理失败时
   * 
   * @example
   * ```typescript
   * const data = await this.fileService.processExcelFile(file, 'Sheet1');
   * console.log(data); // [{ name: '张三', age: 25 }, ...]
   * ```
   */
  async processExcelFile(file: Express.Multer.File, sheetName?: string): Promise<any[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      
      const targetSheet = sheetName || workbook.worksheets[0].name;
      const worksheet = workbook.getWorksheet(targetSheet);
      
      if (!worksheet) {
        throw new BadRequestException(`工作表 ${targetSheet} 不存在`);
      }

      const jsonData: any[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头
        
        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
          const headerCell = worksheet.getCell(1, colNumber);
          if (headerCell.value) {
            rowData[headerCell.value.toString()] = cell.value;
          }
        });
        
        if (Object.keys(rowData).length > 0) {
          jsonData.push(rowData);
        }
      });
      
      if (jsonData.length === 0) {
        throw new BadRequestException('文件中没有有效数据');
      }

      return jsonData;
    } catch (error) {
      throw new BadRequestException(`处理Excel文件失败: ${error.message}`);
    }
  }

  /**
   * 导出数据到Excel文件
   * 
   * 将数据数组导出为Excel文件，支持自定义表头和样式
   * 
   * @param data 要导出的数据数组
   * @param filename 文件名
   * @param sheetName 工作表名称
   * @param headers 自定义表头映射，可选
   * @returns 生成的文件路径
   * @throws BadRequestException 当导出失败时
   * 
   * @example
   * ```typescript
   * const filePath = await this.fileService.exportToExcel(
   *   users, 
   *   'users.xlsx', 
   *   '用户列表',
   *   { name: '姓名', email: '邮箱' }
   * );
   * ```
   */
  async exportToExcel(
    data: any[], 
    filename: string, 
    sheetName: string,
    headers?: Record<string, string>
  ): Promise<string> {
    try {
      // 确保上传目录存在
      await this.ensureUploadDir();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      // 如果有自定义表头，转换数据
      const exportData = headers ? 
        data.map(item => {
          const convertedItem = {};
          Object.keys(headers).forEach(key => {
            convertedItem[headers[key]] = item[key];
          });
          return convertedItem;
        }) : data;

      if (exportData.length > 0) {
        // 添加表头
        const headerRow = Object.keys(exportData[0]);
        worksheet.addRow(headerRow);
        
        // 设置表头样式
        const headerRowObj = worksheet.getRow(1);
        headerRowObj.font = { bold: true };
        headerRowObj.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        // 添加数据行
        exportData.forEach(item => {
          const rowData = headerRow.map(key => item[key]);
          worksheet.addRow(rowData);
        });

        // 自动调整列宽
        worksheet.columns.forEach(column => {
          if (column && column.eachCell) {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
              const columnLength = cell.value ? cell.value.toString().length : 10;
              if (columnLength > maxLength) {
                maxLength = columnLength;
              }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
          }
        });
      }
      
      const filePath = path.join(this.uploadDir, filename);
      await workbook.xlsx.writeFile(filePath);
      
      return filePath;
    } catch (error) {
      throw new BadRequestException(`导出Excel文件失败: ${error.message}`);
    }
  }

  /**
   * 清理临时文件
   * 
   * 删除指定的临时文件，用于清理上传后的临时文件
   * 
   * @param filePath 要删除的文件路径
   * 
   * @example
   * ```typescript
   * await this.fileService.cleanupFile('/uploads/temp-file.xlsx');
   * ```
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      if (filePath && await this.fileExists(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error('文件清理失败:', error);
    }
  }

  /**
   * 生成唯一文件名
   * 
   * 基于时间戳和随机数生成唯一的文件名，避免文件名冲突
   * 
   * @param originalName 原始文件名
   * @param prefix 文件名前缀，可选
   * @returns 唯一的文件名
   * 
   * @example
   * ```typescript
   * const filename = this.fileService.generateUniqueFilename('data.xlsx', 'import');
   * // 返回: import-1703123456789-123456789.xlsx
   * ```
   */
  generateUniqueFilename(originalName: string, prefix?: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const filename = prefix ? `${prefix}-${timestamp}-${random}${ext}` : `${timestamp}-${random}${ext}`;
    return filename;
  }

  /**
   * 验证文件类型
   * 
   * 检查文件扩展名是否在允许的类型列表中
   * 
   * @param filename 文件名
   * @param allowedTypes 允许的文件类型列表，默认为Excel和CSV格式
   * @returns 是否为允许的文件类型
   * 
   * @example
   * ```typescript
   * const isValid = this.fileService.validateFileType('data.xlsx');
   * // 返回: true
   * 
   * const isValid2 = this.fileService.validateFileType('data.txt', ['.xlsx', '.xls']);
   * // 返回: false
   * ```
   */
  validateFileType(filename: string, allowedTypes: string[] = ['.xlsx', '.xls', '.csv']): boolean {
    const ext = path.extname(filename).toLowerCase();
    return allowedTypes.includes(ext);
  }

  /**
   * 确保上传目录存在
   * 
   * 检查并创建上传目录，如果目录不存在则创建
   * 
   * @throws BadRequestException 当目录创建失败时
   */
  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      throw new BadRequestException(`创建上传目录失败: ${error.message}`);
    }
  }

  /**
   * 检查文件是否存在
   * 
   * 异步检查指定路径的文件是否存在
   * 
   * @param filePath 文件路径
   * @returns 文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件大小（MB）
   * 
   * 获取指定文件的大小，以MB为单位返回
   * 
   * @param filePath 文件路径
   * @returns 文件大小（MB），如果文件不存在或读取失败返回0
   * 
   * @example
   * ```typescript
   * const size = await this.fileService.getFileSize('/uploads/data.xlsx');
   * console.log(`文件大小: ${size}MB`);
   * ```
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size / (1024 * 1024); // 转换为MB
    } catch (error) {
      return 0;
    }
  }
}
