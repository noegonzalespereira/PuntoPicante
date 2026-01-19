import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SetStockContinuoDto {
  @IsInt() @Min(1)
  id_producto: number;

  @IsInt() @Min(0)
  cantidad_inicial: number;

  @IsOptional() @IsString()
  notas?: string;
}
