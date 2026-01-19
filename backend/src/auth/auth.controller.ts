import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /auth/login — recibe email y password, devuelve JWT */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** GET /auth/me — verifica token y devuelve el "perfil" del token */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    // req.user viene desde JwtStrategy.validate
    return {
      id: req.user.userId,
      email: req.user.email,
      rol: req.user.rol,
    };
  }
}
