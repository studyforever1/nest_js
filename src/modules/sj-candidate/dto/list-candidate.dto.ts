import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListCandidateDto {
  @ApiPropertyOptional({ description: '模块类型，可选，一般是 sj-candidate' })
  module_type?: string;
}
