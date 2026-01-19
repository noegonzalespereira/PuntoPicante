import { Injectable, NotFoundException, ConflictException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, DeepPartial } from 'typeorm';
import { Producto, TipoProducto } from './producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-producto.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductosService {
  constructor(@InjectRepository(Producto) 
  private readonly repo: Repository<Producto>,
  private cloudinary: CloudinaryService
) {}

  async create(dto: CreateProductoDto) {

    const exists = await this.repo.findOne({ where: { nombre: dto.nombre } });
    if (exists) throw new ConflictException('Ya existe un producto con ese nombre');
    if (!dto.img_url || dto.img_url === '') {
      dto.img_url = 'https://res.cloudinary.com/dbur21xsb/image/upload/v1763073517/productos/dwfxgdkzxbjmcjxzrzsq.png';
    }

    
    const partial: DeepPartial<Producto> = {
      nombre: dto.nombre,
      tipo: dto.tipo,
      precio: dto.precio,
      img_url: dto.img_url,
      activo: dto.activo ?? 1,
    };

    const entity = this.repo.create(partial);
    return this.repo.save(entity);
  }

  async findAll(q: QueryProductosDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(q.pageSize ?? 50)));

    const where: any = {};
    if (q.tipo) where.tipo = q.tipo;
    if (q.activo !== undefined) where.activo = q.activo;

    const whereLike = q.search ? { nombre: Like(`%${q.search}%`) } : {};

    const [rows, total] = await this.repo.findAndCount({
      where: { ...where, ...whereLike },
      order: { nombre: 'ASC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    return { total, page, pageSize, data: rows };
  }

  async findOne(id: number) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async update(id: number, dto: UpdateProductoDto) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');

    if (dto.nombre !== undefined) p.nombre = dto.nombre;
    if (dto.tipo !== undefined) p.tipo = dto.tipo;
    if (dto.precio !== undefined) p.precio = dto.precio;

    if (!dto.img_url || dto.img_url === '') {
    p.img_url = 'https://res.cloudinary.com/dbur21xsb/image/upload/v1763073517/productos/dwfxgdkzxbjmcjxzrzsq.png';
  } else {
    p.img_url = dto.img_url;
  }

    if (dto.activo !== undefined) p.activo = dto.activo;

    return this.repo.save(p);
  }

  async remove(id: number) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    p.activo = 0;
    return this.repo.save(p);
  }

  async activar(id: number) {
    const p = await this.repo.findOne({ where: { id_producto: id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    p.activo = 1;
    return this.repo.save(p);
  }
  async findByType(tipo: TipoProducto) {
    return this.repo.find({
        where: { tipo, activo: 1 },
        select: ['id_producto', 'nombre'], 
        order: { nombre: 'ASC' },
    });
}
  
  
}
