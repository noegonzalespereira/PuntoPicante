// src/reportes/dto/report-range.dto.ts
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { MetodoPago, TipoPedido } from '../../pedidos/pedido.entity';

export class ReportRangeDto {
  @IsOptional() @IsDateString()
  desde?: string;        // inclusive

  @IsOptional() @IsDateString()
  hasta?: string;        // inclusive (se normaliza a 23:59:59)

  @IsOptional() @IsInt() @Min(1)
  caja?: number;

  @IsOptional() @IsEnum(TipoPedido)
  tipo_pedido?: TipoPedido;

  @IsOptional() @IsEnum(MetodoPago)
  metodo_pago?: MetodoPago;
}
