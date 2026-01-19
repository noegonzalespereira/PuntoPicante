import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  // UseGuards,
} from '@nestjs/common';
import { UsersService } from './usuarios.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
// import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('users')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('GERENTE')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    console.log("Datos recibidos para crear usuario:", dto);
    return this.service.create(dto);

  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    console.log("Datos recibidos para actualizar usuario:", dto); 
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
