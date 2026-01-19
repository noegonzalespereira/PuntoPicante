import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class IngresoBebidaDto {
  @IsInt()
  id_producto: number;

  @IsInt()
  @IsPositive()
  cantidad: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  motivo?: string;
}
