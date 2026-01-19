import {
  IsDateString,
  IsDecimal,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGastoDto {
  // Permite cambiar la caja o quitarla (null)
  @IsOptional()
  @ValidateIf((o) => o.id_caja !== null) // si es null, no validamos IsInt
  @IsInt()
  id_caja?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre_producto?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cantidad?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  precio?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}
