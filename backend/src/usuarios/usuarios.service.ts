import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './usuario.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(Usuario) private repo: Repository<Usuario>) {}
  async findAll() {
  
   return this.repo.find({
     select: ['id_usuario', 'nombre', 'email', 'rol', 'created_at'],
     order: { id_usuario: 'DESC' },
   });
  }
  // async findAll() {
  
  //   return this.repo.find({
  //     select: ['id_usuario', 'nombre', 'email', 'rol', 'created_at'],
  //     order: { id_usuario: 'DESC' },
  //   });
  // }

  async findOne(id: number) {
    const user = await this.repo.findOne({
      where: { id_usuario: id },
      select: ['id_usuario', 'nombre', 'email', 'rol', 'created_at'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findByEmailWithPassword(email: string) {
    // Para AuthService: incluye contrasena explícitamente
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.contrasena')
      .where('u.email = :email', { email })
      .getOne();
  }

  async create(dto: CreateUserDto) {
    console.log("Crear usuario:", dto); 
    // Verifica email único
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email ya registrado');

    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const entity = this.repo.create({
      nombre: dto.nombre,
      email: dto.email,
      contrasena: passwordHash,
      rol: dto.rol,
    });

    const saved = await this.repo.save(entity);
    // No devolvemos contrasena
    const { contrasena, ...rest } = saved as any;
    return rest;
  }

  async update(id: number, dto: UpdateUserDto) {
    console.log("Actualizar usuario:", dto);
    const user = await this.repo.findOne({ where: { id_usuario: id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== user.email) {
      const emailTaken = await this.repo.findOne({ where: { email: dto.email } });
      if (emailTaken) throw new ConflictException('Email ya registrado');
    }

    if (dto.nombre !== undefined) user.nombre = dto.nombre;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.rol !== undefined) user.rol = dto.rol;

    if (dto.password) {
      const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
      user.contrasena = await bcrypt.hash(dto.password, rounds);
    }

    const saved = await this.repo.save(user);
    const { contrasena, ...rest } = saved as any;
    return rest;
  }

  async remove(id: number) {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Usuario no encontrado');
    return { ok: true };
  }
}
