import { IsEmail, IsEnum, IsOptional, MinLength } from 'class-validator';
import { Rol } from '../usuario.entity';

export class UpdateUserDto {
  @IsOptional()
  nombre?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;
}
