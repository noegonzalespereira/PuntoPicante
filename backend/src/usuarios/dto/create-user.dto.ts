import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
import { Rol } from '../usuario.entity';

export class CreateUserDto {
  @IsNotEmpty()
  nombre: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsEnum(Rol)
  rol: Rol; 
}
