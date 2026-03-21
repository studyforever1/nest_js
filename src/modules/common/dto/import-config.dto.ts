import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ModuleName } from 'src/common/enums/module-type.enum';


export class ImportConfigDto {
  @ApiProperty({
    description: '模块名称',
    enum: ModuleName, // ⭐ 关键：Swagger 下拉框
  })
    @IsString()
    @IsNotEmpty()
  moduleName: ModuleName;
}