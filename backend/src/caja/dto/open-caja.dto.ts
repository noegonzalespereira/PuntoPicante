import { IsNumberString } from 'class-validator';

export class OpenCajaDto {
  // monto de billetes con los que arrancas el día
  @IsNumberString()
  monto_apertura: string;
}
