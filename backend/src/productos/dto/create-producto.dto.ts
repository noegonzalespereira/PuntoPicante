import { IsEnum, isNotEmpty, IsString, MaxLength, IsDecimal, IsInt, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { TipoProducto } from '../producto.entity';
import { Transform } from 'class-transformer';
export class CreateProductoDto {
  @IsString() @MaxLength(120) @IsNotEmpty() 
  nombre!: string;
  @IsEnum(TipoProducto) @IsNotEmpty()
  tipo!: TipoProducto;
  @IsDecimal({ decimal_digits: '0,2' }) @IsNotEmpty()
  precio!: string;

  @IsOptional() @IsString() 
  img_url?: string | null;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsIn([0, 1])
  activo?: 0 | 1;
}
