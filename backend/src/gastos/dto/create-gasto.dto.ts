import {
  IsDateString,
  IsDecimal,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateGastoDto {
  // FK opcional a caja: si no la mandas, el gasto queda sin caja
  @IsOptional()
  @IsInt()
  id_caja?: number;

  @IsString()
  @MaxLength(150)
  nombre_producto!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsInt()
  @IsPositive()
  cantidad!: number;

  // Guardamos DECIMAL como string (precision 10,2 en la entidad)
  @IsDecimal({ decimal_digits: '0,2' }) // acepta "12" o "12.34"
  precio!: string;

  // Opcional: si no viene, el service pone la fecha de hoy
  @IsOptional()
  @IsDateString()
  fecha?: string; // ISO YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ (lo normalizo a YYYY-MM-DD)
}
