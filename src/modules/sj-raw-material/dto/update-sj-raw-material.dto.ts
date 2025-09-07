import { PartialType } from '@nestjs/mapped-types';
import { CreateSjRawMaterialDto } from './create-sj-raw-material.dto';

export class UpdateSjRawMaterialDto extends PartialType(CreateSjRawMaterialDto) {}
