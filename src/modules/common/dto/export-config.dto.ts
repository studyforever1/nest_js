import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ModuleName } from 'src/common/enums/module-type.enum';

export class ExportConfigDto {
  @ApiProperty({
    enum: ModuleName,
    description: '模块名称',
  })
  @IsString()
  @IsNotEmpty()
  moduleName: ModuleName;
}