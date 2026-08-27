import { ValidateIf, IsArray, ArrayMinSize, IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, ValidateNested, Min, Max, IsBoolean } from 'class-validator';
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
  // Se acepta para tolerar clientes que reutilicen el formulario de añadir.
  // La prioridad solo se aplica al agregar ítems a un pedido existente.
  @IsOptional() @IsBoolean()
  prioritario?: boolean;

  @IsInt() @IsPositive()
  id_caja: number;

  @IsEnum(TipoPedido)
  tipo_pedido: TipoPedido;

  
  @ValidateIf((o) => o.tipo_pedido !== TipoPedido.LLEVAR && o.ambiente !== 'OFICINA')
  @IsInt()
  @Min(1)
  @Max(50)
  num_mesa?: number | null;

  @IsOptional()
  @IsIn(['PATIO', 'OFICINA'])
  ambiente?: string;

  @ValidateIf((o) => o.ambiente === 'OFICINA')
  @IsString()
  @MaxLength(100)
  nombre_cliente?: string | null;
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