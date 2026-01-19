import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ReportQueryDto } from './report-query.dto';
import { TipoProducto } from '../../productos/producto.entity';

export class ProductosRankingDto extends ReportQueryDto {
  @IsOptional()
  @IsEnum(TipoProducto)
  tipo?: TipoProducto;            // PLATO | BEBIDA (opcional)

  @IsOptional()
  @IsInt()
  @Min(1)
  limite?: number;                // default: 5
}
