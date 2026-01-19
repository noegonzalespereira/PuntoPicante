import { IsArray, ArrayMinSize, IsInt, IsPositive, IsOptional, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DestinoItem } from '../detalle-pedido.entity';
class ItemAddDto {
  @IsInt() @IsPositive()
  id_producto: number;

  @IsInt() @IsPositive()
  cantidad: number;

  @IsOptional()
  notas?: string;
  @IsOptional() @IsEnum(DestinoItem)
  destino?: DestinoItem;
}

export class AddItemsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => ItemAddDto)
  items: ItemAddDto[];
}
