import { IsDateString, IsOptional } from 'class-validator';

export class QueryDisponibleDto {
  @IsOptional()
  @IsDateString()
  fecha?: string; // por defecto hoy
}
