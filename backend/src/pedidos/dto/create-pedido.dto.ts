import { ValidateIf ,IsArray, ArrayMinSize, IsEnum, IsInt, IsOptional, IsPositive, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago, TipoPedido,EstadoPago } from '../pedido.entity';
import { DestinoItem,EstadoItem } from '../detalle-pedido.entity';
class ItemDto {
  @IsInt() @IsPositive()
  id_producto: number;

  @IsInt() @IsPositive()
  cantidad: number;

  @IsOptional()
  notas?: string;

  @IsOptional()
  @IsEnum(DestinoItem)
  destino?: DestinoItem;
  @IsOptional()
  @IsEnum(EstadoItem)
  estado_item?:EstadoItem;
}

export class CreatePedidoDto {
  @IsInt() @IsPositive()
  id_caja: number;

  @IsEnum(TipoPedido)
  tipo_pedido: TipoPedido;

  
  @ValidateIf((o) => o.tipo_pedido !== TipoPedido.LLEVAR)
  @IsInt()
  @Min(1)
  @Max(9)
  num_mesa?: number | null;
  @IsOptional()
  @IsEnum(MetodoPago)
  metodo_pago: MetodoPago | null;

  @IsOptional()
  @IsEnum(EstadoPago)
  estado_pago?: EstadoPago;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}