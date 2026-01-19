import { IsEnum, IsOptional, IsString, IsNumberString } from 'class-validator';
import { TipoProducto } from '../producto.entity';

export class QueryProductosDto {
  @IsOptional()
  @IsString()
  search?: string;               // busca por nombre

  @IsOptional()
  @IsEnum(TipoProducto)
  tipo?: TipoProducto;           // PLATO | BEBIDA

  @IsOptional()
  @IsNumberString()
  activo?: string;  // '0' o '1' desde query params              // 1=activos, 0=inactivos

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
