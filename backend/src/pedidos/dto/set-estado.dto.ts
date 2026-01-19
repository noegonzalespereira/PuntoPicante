import { IsEnum } from 'class-validator';
import { EstadoItem } from '../detalle-pedido.entity';

export class SetEstadoDto {
  @IsEnum(EstadoItem)
  estado_item: EstadoItem;
}
