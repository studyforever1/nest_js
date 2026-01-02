import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProgressDto2 {
  @ApiProperty({ description: '任务 UUID', example: 'd40999b0-ad0e-4425-9d47-907274a0c7e2' })
  @IsString()
  taskUuid: string;
}
