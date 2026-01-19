import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { InventarioProducto,ModoInventario } from './inventario-producto.entity';
import { InventarioMovimiento, TipoMovimiento } from './inventario-mov.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';
import { AperturaPlatosDto } from './dto/apertura-platos.dto';
import { IngresoBebidaDto } from './dto/ingreso-bebida.dto';
import { MermaDto, MermaSobre } from './dto/merma.dto';
import { QueryDisponibleDto } from './dto/query-disponible.dto';


@Injectable()
export class InventarioService {
  constructor(
    @InjectRepository(InventarioProducto) private readonly invRepo: Repository<InventarioProducto>,
    @InjectRepository(InventarioMovimiento) private readonly movRepo: Repository<InventarioMovimiento>,
    @InjectRepository(Producto) private readonly prodRepo: Repository<Producto>,
  ) {}

  private ymd(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Stock disponible (PLATO por fecha, BEBIDA global) */
  async disponibleProducto(id_producto: number, fecha?: string): Promise<number> {
    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (prod.tipo === TipoProducto.PLATO) {
      const f = fecha ?? this.ymd();
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: f } });
      return row?.cantidad_inicial ?? 0;
    } else {
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: IsNull() } });
      return row?.cantidad_inicial ?? 0;
    }
  }

  /** Reserva (venta) — NO crea movimiento */
  async reservar(id_producto: number, cantidad: number, fecha?: string): Promise<void> {
    if (cantidad <= 0) throw new BadRequestException('Cantidad inválida');

    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (prod.tipo === TipoProducto.PLATO) {
      const f = fecha ?? this.ymd();
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: f } });
      if (!row) throw new BadRequestException(`No hay apertura para el plato ${id_producto} en ${f}`);
      if (row.cantidad_inicial < cantidad) {
        throw new BadRequestException(`Stock insuficiente (disponible ${row.cantidad_inicial})`);
      }
      row.cantidad_inicial -= cantidad;
      await this.invRepo.save(row);
    } else {
      const row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: IsNull()  } });
      if (!row) throw new BadRequestException(`No hay stock cargado para la bebida ${id_producto}`);
      if (row.cantidad_inicial < cantidad) {
        throw new BadRequestException(`Stock insuficiente (disponible ${row.cantidad_inicial})`);
      }
      row.cantidad_inicial -= cantidad;
      await this.invRepo.save(row);
    }
  }

  /** Libera (anulación) — NO crea movimiento */
  async liberar(id_producto: number, cantidad: number, fecha?: string): Promise<void> {
    if (cantidad <= 0) throw new BadRequestException('Cantidad inválida');

    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (prod.tipo === TipoProducto.PLATO) {
      const f = fecha ?? this.ymd();
      let row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: f } });
      if (!row) {
        row = this.invRepo.create({ 
          producto: { id_producto } as any,
          modo: ModoInventario.PLATO,
          fecha: f, 
          cantidad_inicial: 0 });
      }
      row.cantidad_inicial += cantidad;
      await this.invRepo.save(row);
    } else {
      let row = await this.invRepo.findOne({ where: { producto: { id_producto }, fecha: IsNull()  } });
      if (!row) row = this.invRepo.create({ 
        producto: { id_producto } as any,
        modo: ModoInventario.BEBIDA, 
        fecha: null, 
        cantidad_inicial: 0 });
      row.cantidad_inicial += cantidad;
      await this.invRepo.save(row);
    }
  }

  /** Apertura diaria de PLATOS */
async aperturaPlatos(dto: AperturaPlatosDto) {
  // 1) Validaciones básicas
  const ids = dto.items.map(i => i.id_producto);
  const productos = await this.prodRepo.find({ where: { id_producto: In(ids) } });
  const porId = new Map(productos.map(p => [p.id_producto, p]));

  for (const it of dto.items) {
    const p = porId.get(it.id_producto);
    if (!p) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
    if (p.tipo !== TipoProducto.PLATO)
      throw new BadRequestException(`Producto ${it.id_producto} no es PLATO`);
  }

  const results: { id_producto: number; fecha: string; cantidad_inicial: number }[] = [];

  // 2) Procesar cada plato
  for (const it of dto.items) {
    // buscar fila de inventario del día
    let inv = await this.invRepo.findOne({
      where: { producto: { id_producto: it.id_producto }, fecha: dto.fecha },
    });

    const oldQty = inv?.cantidad_inicial ?? 0;
    const newQty = it.cantidad_inicial;                       // “stock del día” del DTO
    const delta  = newQty - oldQty;

    // 2.a) crear/actualizar inventario
    if (inv) {
      inv.cantidad_inicial = newQty;
      inv = await this.invRepo.save(inv);          // ← ya persistido
    } else {
      inv = await this.invRepo.save(               // ← save devuelve la entidad
        this.invRepo.create({
          producto: { id_producto: it.id_producto } as any,
          modo: ModoInventario.PLATO,
          fecha: dto.fecha,
          cantidad_inicial: newQty,
        }),
      );
    }

    // 2.b) registrar movimiento solo si hubo cambio (delta ≠ 0)
    if (delta !== 0) {
      await this.movRepo.save(
        this.movRepo.create({
          inventario: inv,                         // ← inv NO es null aquí
          tipo: delta > 0 ? TipoMovimiento.INGRESO : TipoMovimiento.MERMA,
          cantidad: Math.abs(delta),
          motivo: 'APERTURA',
        }),
      );
    }

    results.push({ id_producto: it.id_producto, fecha: dto.fecha, cantidad_inicial: newQty });
  }

  return { ok: true, items: results };
}


  /** Ingreso para BEBIDA (global) */
  async ingresoBebida(dto: IngresoBebidaDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');
    if (prod.tipo !== TipoProducto.BEBIDA) throw new BadRequestException('Solo aplica a BEBIDA');

    let row = await this.invRepo.findOne({ where: { producto: { id_producto: dto.id_producto }, fecha: IsNull () } });
    if (!row)
      row = this.invRepo.create({ 
      producto: { id_producto: dto.id_producto } as any, 
      modo: ModoInventario.BEBIDA,
      fecha: null, 
      cantidad_inicial: 0 
    });

    row.cantidad_inicial += dto.cantidad;
    row = await this.invRepo.save(row);

    await this.movRepo.save(
      this.movRepo.create({
        inventario: row,
        tipo: TipoMovimiento.INGRESO,
        cantidad: dto.cantidad,
        motivo: dto.motivo ?? 'INGRESO',
      }),
    );

    return { ok: true, id_producto: dto.id_producto, stock: row.cantidad_inicial };
  }
  
  /** Merma (PLATO por día o BEBIDA global) */
  async merma(dto: MermaDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    if (dto.sobre === MermaSobre.PLATO) {
      if (prod.tipo !== TipoProducto.PLATO) throw new BadRequestException('El producto no es PLATO');
      const fecha = dto.fecha ?? this.ymd();
      const row = await this.invRepo.findOne({ where: { producto: { id_producto: dto.id_producto }, fecha } });
      if (!row || row.cantidad_inicial < dto.cantidad) throw new BadRequestException('Stock insuficiente');
      row.cantidad_inicial -= dto.cantidad;
      const saved = await this.invRepo.save(row);

      await this.movRepo.save(
        this.movRepo.create({
          inventario: saved,
          tipo: TipoMovimiento.MERMA,
          cantidad: dto.cantidad,
          motivo: dto.motivo ?? 'MERMA',
        }),
      );
      return { ok: true, id_producto: dto.id_producto, fecha, stock: row.cantidad_inicial };
    }

    // BEBIDA
    if (prod.tipo !== TipoProducto.BEBIDA) throw new BadRequestException('El producto no es BEBIDA');
    const row = await this.invRepo.findOne({ where: { producto: { id_producto: dto.id_producto }, fecha: IsNull() } });
    if (!row || row.cantidad_inicial < dto.cantidad) throw new BadRequestException('Stock insuficiente');
    row.cantidad_inicial -= dto.cantidad;
    const saved = await this.invRepo.save(row);

    await this.movRepo.save(
      this.movRepo.create({
        inventario: saved,
        tipo: TipoMovimiento.MERMA,
        cantidad: dto.cantidad,
        motivo: dto.motivo ?? 'MERMA',
      }),
    );
    return { ok: true, id_producto: dto.id_producto, stock: row.cantidad_inicial };
  }
  

  async disponible(q: QueryDisponibleDto) {
    const fecha = q.fecha ?? this.ymd();

    const platos = await this.invRepo.find({
      where: { fecha },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    const bebidas = await this.invRepo.find({
      where: { fecha: IsNull() },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    return {
      fecha,
      platos: platos.map((i) => ({ id_producto: i.id_producto, nombre: i.producto.nombre, stock: i.cantidad_inicial })),
      bebidas: bebidas.map((i) => ({ id_producto: i.id_producto, nombre: i.producto.nombre, stock: i.cantidad_inicial })),
    };
  }
  async listarMermas(): Promise<any[]> {
    const movimientos = await this.movRepo.find({
      where: { tipo: TipoMovimiento.MERMA },
      relations: { inventario: { producto: true } },
      order: { created_at: 'DESC' },
    });
    return movimientos.map(mov => ({
      id_mov: mov.id_mov,
      producto: mov.inventario.producto.nombre,
      tipo: mov.inventario.modo,
      cantidad: mov.cantidad,
      motivo: mov.motivo,
      fecha:mov.inventario.fecha ?? 'GLOBAL',
    }));
  }
  // InventarioService.ts (CORRECCIÓN FINAL)

// ... (todas las importaciones y funciones auxiliares previas se mantienen)

// ... (métodos aperturaPlatos, ingresoBebida, merma se mantienen)

async getDesgloseStockDelDia(fecha: string) {
    const f = fecha ?? this.ymd();
    
    // 1. Obtener los inventarios de PLATOS para la fecha (stock restante)
    const invPlatos = await this.invRepo.find({
        where: { fecha: f, modo: ModoInventario.PLATO },
        relations: { producto: true },
    });
    
    // 2. Obtener movimientos de SALIDA (MERMA y RESERVA) para el cálculo
    const movimientosSalida = await this.movRepo
        .createQueryBuilder('mov')
        .innerJoin('mov.inventario', 'inv')
        .innerJoin('inv.producto', 'prod')
        .where('inv.fecha = :fecha', { fecha: f })
        .andWhere('inv.modo = :modo', { modo: ModoInventario.PLATO })
        // CORRECCIÓN CLAVE: Envía el array de tipos de movimiento [MERMA, RESERVA]
        .andWhere('mov.tipo IN (:...tipos)', { tipos: [TipoMovimiento.MERMA, 'RESERVA',TipoMovimiento.INGRESO] }) 
        .select('prod.id_producto', 'id_producto')
        .addSelect('SUM(CASE WHEN mov.tipo = "RESERVA" THEN mov.cantidad ELSE 0 END)', 'vendido')
        .addSelect('SUM(CASE WHEN mov.tipo = "MERMA" THEN mov.cantidad ELSE 0 END)', 'merma')
        .addSelect('SUM(CASE WHEN mov.tipo = "INGRESO" THEN mov.cantidad ELSE 0 END)', 'ingreso_neto_dia')
        .groupBy('prod.id_producto')
        .getRawMany();

    const movMap = new Map(movimientosSalida.map(m => [m.id_producto, m]));

    // 3. Consolidar el resumen y calcular el stock inicial
    const resultadosPlatos = invPlatos.map(inv => {
        const mov = movMap.get(inv.id_producto) || {};
        
        const vendido = parseInt(mov.vendido || 0);
        const merma = parseInt(mov.merma || 0);
        const ingresoNeto = parseInt(mov.ingreso_neto_dia || 0);
        const stockFinal = inv.cantidad_inicial; 
        
        
        const stockInicialAcumulado = stockFinal + vendido + merma;
        // NOTA: Con la lógica actual de tu backend, el valor de 'stock_inicial_acumulado'
    // es lo que el usuario ve como "Stock Día". El campo 'ingresoNeto' te serviría
    // para reportes, pero para la tabla, la suma inversa es la correcta.
        return {
            id_producto: inv.id_producto,
            nombre: inv.producto.nombre,
            stock_inicial: stockInicialAcumulado, // Stock Inicial Acumulado
            vendido: vendido,                    // Cantidad Vendida
            merma: merma,                        // Cantidad Mermada
            stock_final: stockFinal,             // Stock Disponible (Final)
        };
    });

    // 4. Obtener Bebidas (Mantener simple)
    const bebidas = await this.invRepo.find({
        where: { fecha: IsNull(), modo: ModoInventario.BEBIDA },
        relations: { producto: true },
    });

    return {
        fecha: f,
        platos: resultadosPlatos,
        bebidas: bebidas.map((i) => ({ id_producto: i.id_producto, nombre: i.producto.nombre, stock: i.cantidad_inicial })),
    };
}
}
