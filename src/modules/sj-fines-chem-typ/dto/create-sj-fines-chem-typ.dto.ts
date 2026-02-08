import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateSjFinesChemTypDto {
  @ApiProperty({ description: '矿粉名称' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '化学成分典型值（composition，JSON 对象）',
    required: false,
    example: { Fe2O3: 60, SiO2: 5, Al2O3: 3 },
  })
  @IsOptional()
  @IsObject()
  composition?: Record<string, any>;
}
