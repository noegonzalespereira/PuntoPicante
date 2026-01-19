import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TipoMovimiento } from '../inventario-mov.entity';

export class CrearMovimientoDto {
  @IsInt() @Min(1)
  id_producto: number;

  @IsEnum(TipoMovimiento)
  tipo: TipoMovimiento; // 'INGRESO' | 'MERMA'

  @IsInt() @Min(1)
  cantidad: number;

  @IsOptional() @IsString()
  motivo?: string;
}
