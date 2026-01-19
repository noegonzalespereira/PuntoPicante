import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export enum MermaSobre { PLATO = 'PLATO', BEBIDA = 'BEBIDA' }

export class MermaDto {
  @IsEnum(MermaSobre)
  sobre: MermaSobre;

  @IsInt()
  id_producto: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsInt()
  @IsPositive()
  cantidad: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  motivo?: string;
}
