import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, Min, ValidateNested } from 'class-validator';
/** Define el cupo diario por plato (para una fecha) */
export class AperturaPlatosDto {
  @IsDateString()
  fecha: string; // YYYY-MM-DD

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AperturaItemDto)
  items: AperturaItemDto[];
}

class AperturaItemDto {
  @IsInt()
  id_producto: number;

  @IsInt()
  @Min(0)
  cantidad_inicial: number;
}


