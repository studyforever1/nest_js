import { PartialType } from '@nestjs/mapped-types';
import { CreateCalcDto } from './create-calc.dto';

export class UpdateCalcDto extends PartialType(CreateCalcDto) {}
