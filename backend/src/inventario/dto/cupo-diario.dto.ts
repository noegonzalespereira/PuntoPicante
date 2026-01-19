import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class SetCupoDiarioDto {
  @IsInt() @Min(1)
  id_producto: number;


  @IsOptional() @IsString()
  fecha?: string;

  @IsInt() @Min(0)
  cantidad_inicial: number;

  @IsOptional() @IsString()
  notas?: string;
}
