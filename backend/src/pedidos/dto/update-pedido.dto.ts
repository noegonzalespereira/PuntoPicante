import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago, TipoPedido } from '../pedido.entity';
import { DestinoItem,EstadoItem } from '../detalle-pedido.entity';
class ItemUpdDto {
  @IsInt() @IsPositive()
  id_producto: number;

  @IsInt() @IsPositive()
  cantidad: number;

  @IsOptional()
  notas?: string | null;

  @IsOptional() @IsEnum(DestinoItem)
  destino?: DestinoItem | null;
  @IsOptional() @IsEnum(EstadoItem)
  estado_item?: EstadoItem;
}

export class UpdatePedidoDto {
  @IsOptional() @IsEnum(TipoPedido)
  tipo_pedido?: TipoPedido;

  @IsOptional() @IsInt()
  num_mesa?: number | null;

  @IsOptional() @IsIn(['PATIO', 'OFICINA'])
  ambiente?: string;

  @IsOptional() @IsString() @MaxLength(100)
  nombre_cliente?: string | null;

  @IsOptional() @IsEnum(MetodoPago)
  metodo_pago?: MetodoPago;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => ItemUpdDto)
  items?: ItemUpdDto[];
}
