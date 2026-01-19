import { Body, Controller, Get, Param, Patch, Post, Delete, Query, UseGuards,UploadedFile,UseInterceptors, BadRequestException } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { QueryProductosDto } from './dto/query-producto.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

import { FileInterceptor } from '@nestjs/platform-express';
import { TipoProducto } from './producto.entity';
@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Get()
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  list(@Query() q: QueryProductosDto) {
    if (q.activo !== undefined) (q as any).activo = Number(q.activo) as 0 | 1;
    return this.service.findAll(q);
  }

  @Get(':id')
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  get(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Post()
  @Roles('GERENTE')
  @UseInterceptors(FileInterceptor('file'))
  async create(@UploadedFile() file: Express.Multer.File, @Body() dto: CreateProductoDto) {
    if (!file) {
      dto.img_url = 'https://res.cloudinary.com/dbur21xsb/image/upload/v1763073517/productos/dwfxgdkzxbjmcjxzrzsq.png'; 
    } else {
      // Si hay una imagen, la subimos a Cloudinary
      const url = await this.service['cloudinary'].uploadImage(file);
      dto.img_url = url;
    }
    return this.service.create(dto);
   
  }
  

@Patch(':id')
@Roles('GERENTE')
@UseInterceptors(FileInterceptor('file'))
async update(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: UpdateProductoDto
) {
  if (file) {
    const url = await this.service['cloudinary'].uploadImage(file);
    dto.img_url = url; 
  }
  return this.service.update(Number(id), dto);
}


  @Delete(':id')
  @Roles('GERENTE')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }

  /** Activar  */
  @Patch(':id/activar')
  @Roles('GERENTE')
  activar(@Param('id') id: string) {
    return this.service.activar(Number(id));
  }


@Get('tipo/:tipo')
@Roles('GERENTE', 'CAJERO', 'COCINA')
listByType(@Param('tipo') tipo: TipoProducto) {
  if (!['PLATO', 'NORMAL', 'BEBIDA'].includes(tipo)) {
      throw new BadRequestException('Tipo de producto inválido');
  }
  return this.service.findByType(tipo);
}
}
