import { IsNumberString, IsOptional } from 'class-validator';

export class CloseCajaDto {
  @IsOptional()
  @IsNumberString()
  monto_cierre?: string; // efectivo contado al cierre
}
