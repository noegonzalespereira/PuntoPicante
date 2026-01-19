import { IsEnum, IsOptional } from 'class-validator';
import { MetodoPago } from '../pedido.entity';

export class PagarDto {
  @IsOptional() @IsEnum(MetodoPago)
  metodo?: MetodoPago;
}
