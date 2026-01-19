import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /** Valida email + password comparando hash con bcrypt */
  private async validate(email: string, password: string) {
    // MUY IMPORTANTE: incluir la contraseña (select:false en la entidad)
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.contrasena);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    return user;
  }

  /** Hace login y devuelve access_token + datos básicos del usuario */
  async login(dto: LoginDto) {
    const user = await this.validate(dto.email, dto.password);
    const payload = { sub: user.id_usuario, rol: user.rol, email: user.email };

    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
    };
  }
}
