import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { MetodoPago, TipoPedido } from '../../pedidos/pedido.entity';

export enum Granularidad {
  DIA = 'dia',
  SEMANA = 'semana',
  MES = 'mes',
  ANIO = 'anio',
}

export class ReportQueryDto {
  @IsOptional() desde?: string;   // ISO o YYYY-MM-DD
  @IsOptional() hasta?: string;   // ISO o YYYY-MM-DD

  @IsOptional()
  @IsEnum(Granularidad)
  granularidad?: Granularidad;    // default: dia

  @IsOptional()
  @IsEnum(TipoPedido)
  tipo_pedido?: TipoPedido;       // SALON | LLEVAR

  @IsOptional()
  @IsEnum(MetodoPago)
  metodo_pago?: MetodoPago;       // EFECTIVO | QR

  @IsOptional()
  @IsInt()
  cajero?: number;                // id_usuario (cajero)
}
