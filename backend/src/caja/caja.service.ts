import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Caja, EstadoCaja } from './caja.entity';
import { OpenCajaDto } from './dto/open-caja.dto';
import { CloseCajaDto } from './dto/close-caja.dto';
import { Pedido, EstadoPago } from '../pedidos/pedido.entity';
import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Producto } from '../productos/producto.entity';
import { Gasto } from '../gastos/gasto.entity';

type Rol = 'GERENTE' | 'CAJERO' | 'COCINA';

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(Caja) private readonly cajas: Repository<Caja>,
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(DetallePedido)
    private readonly detalles: Repository<DetallePedido>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    @InjectRepository(Gasto) private readonly gastos: Repository<Gasto>,
  ) {}

  /** Abre una caja para el usuario.
   *  Regla: solo UNA caja ABIERTA por cajero a la vez.
   */
  async abrir(userId: number, _rol: Rol, dto: OpenCajaDto) {
    const abierta = await this.cajas.findOne({
      where: { id_usuario: userId, estado: EstadoCaja.ABIERTA },
    });
    if (abierta) {
      throw new BadRequestException('Ya tienes una caja ABIERTA');
    }

    const caja = this.cajas.create({
      id_usuario: userId,
      estado: EstadoCaja.ABIERTA,
      monto_apertura: dto.monto_apertura,
      fecha_apertura: new Date(),
    });

    return this.cajas.save(caja);
  }

  /** Devuelve la caja ABIERTA del usuario actual  */
  async cajaAbiertaDe(userId: number) {
    return this.cajas.findOne({
      where: { id_usuario: userId, estado: EstadoCaja.ABIERTA },
    });
  }

  /** Cierra la caja (CAJERO solo la suya; GERENTE cualquiera) */
  async cerrar(userId: number, rol: Rol, id_caja: number, dto: CloseCajaDto) {
    const caja = await this.cajas.findOne({ where: { id_caja } });
    if (!caja) throw new NotFoundException('Caja no existe');

    if (caja.estado === EstadoCaja.CERRADA) {
      throw new BadRequestException('La caja ya está CERRADA');
    }

    if (rol === 'CAJERO' && caja.id_usuario !== userId) {
      throw new ForbiddenException('No puedes cerrar cajas de otros usuarios');
    }
    //Verificar si hay pedidos NO pagados asociados a esta caja
    const pedidosNoPagados = await this.pedidos.count({
      where: { caja: { id_caja }, estado_pago: EstadoPago.SIN_PAGAR },
    });

    if (pedidosNoPagados > 0) {
      throw new BadRequestException(
        `No se puede cerrar la caja. Existen ${pedidosNoPagados} pedido(s) sin pagar.`
      );
    }

    
    caja.estado = EstadoCaja.CERRADA;
    caja.fecha_cierre = new Date();
    if (dto.monto_cierre !== undefined) {
      caja.monto_cierre = dto.monto_cierre;
    }

    await this.cajas.save(caja);

    // Devuelve también el resumen para imprimir/revisar
    const resumen = await this.resumen(id_caja);
    return { caja, resumen };
  }

 
  async resumen(id_caja: number) {
    const caja = await this.cajas.findOne({ where: { id_caja } });
    if (!caja) throw new NotFoundException('Caja no existe');

    const inicio = caja.fecha_apertura;
    const fin = caja.fecha_cierre ?? new Date();

    // --- Ventas por método (solo pedidos PAGADOS) ---
    const ventas = await this.pedidos
      .createQueryBuilder('p')
      .select([
        "COALESCE(SUM(p.total), 0) AS total_vendido",
        "COALESCE(SUM(CASE WHEN p.metodo_pago = 'EFECTIVO' AND p.estado_pago = 'PAGADO' THEN p.total ELSE 0 END), 0) AS total_efectivo",
        "COALESCE(SUM(CASE WHEN p.metodo_pago = 'QR'       AND p.estado_pago = 'PAGADO' THEN p.total ELSE 0 END), 0) AS total_qr",
      ])
      .where('p.id_caja = :id_caja', { id_caja })
      .andWhere('p.estado_pago = :pagado', { pagado: EstadoPago.PAGADO })
      .andWhere('p.created_at BETWEEN :ini AND :fin', { ini: inicio, fin })
      .getRawOne<{ total_vendido: string; total_efectivo: string; total_qr: string }>();

    // --- Gastos (se consideran salida de efectivo) ---
    const gastos = await this.gastos
      .createQueryBuilder('g')
      .select("COALESCE(SUM(g.precio * g.cantidad), 0)", 'total_gastos')
      .where('g.id_caja = :id_caja', { id_caja })
      .andWhere('g.fecha BETWEEN :ini AND :fin', { ini: inicio, fin })
      .getRawOne<{ total_gastos: string }>();

    // --- Desglose por tipo de producto (solo pedidos PAGADOS) ---
    const desglose = await this.detalles
      .createQueryBuilder('dp')
      .innerJoin(Pedido, 'pe', 'pe.id_pedido = dp.id_pedido')
      .innerJoin(Producto, 'pr', 'pr.id_producto = dp.id_producto')
      .select('pr.tipo', 'tipo')
      .addSelect('COALESCE(SUM(dp.cantidad), 0)', 'cantidad')
      .addSelect('COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0)', 'total')
      .where('pe.id_caja = :id_caja', { id_caja })
      .andWhere("pe.estado_pago = 'PAGADO'")
      .andWhere('pe.created_at BETWEEN :ini AND :fin', { ini: inicio, fin })
      .groupBy('pr.tipo')
      .getRawMany<{ tipo: 'PLATO' | 'BEBIDA'; cantidad: string; total: string }>();

    const platos = desglose.find((d) => d.tipo === 'PLATO');
    const bebidas = desglose.find((d) => d.tipo === 'BEBIDA');

    const total_vendido = Number(ventas?.total_vendido ?? 0);
    const total_efectivo = Number(ventas?.total_efectivo ?? 0);
    const total_qr = Number(ventas?.total_qr ?? 0);
    const total_gastos = Number(gastos?.total_gastos ?? 0);
    const apertura = Number(caja.monto_apertura ?? 0);

    // Efectivo esperado = apertura + ventas EFECTIVO - gastos
    const efectivo_esperado = apertura + total_efectivo - total_gastos;

    // Diferencia si hay conteo físico guardado
    const conteo = caja.monto_cierre != null ? Number(caja.monto_cierre) : null;
    const diferencia =
      conteo !== null ? Number((conteo - efectivo_esperado).toFixed(2)) : null;

    return {
      caja: {
        id_caja: caja.id_caja,
        usuario: caja.id_usuario,
        estado: caja.estado,
        fecha_apertura: caja.fecha_apertura,
        fecha_cierre: caja.fecha_cierre,
        monto_apertura: Number(caja.monto_apertura),
        monto_cierre: conteo,
      },
      ventas: {
        total_vendido: Number(total_vendido.toFixed(2)),
        total_efectivo: Number(total_efectivo.toFixed(2)),
        total_qr: Number(total_qr.toFixed(2)),
      },
      gastos: {
        total_gastos: Number(total_gastos.toFixed(2)),
      },
      productos: {
        platos: {
          cantidad: Number(platos?.cantidad ?? 0),
          total: Number(Number(platos?.total ?? 0).toFixed(2)),
        },
        bebidas: {
          cantidad: Number(bebidas?.cantidad ?? 0),
          total: Number(Number(bebidas?.total ?? 0).toFixed(2)),
        },
      },
      efectivo: {
        apertura: Number(apertura.toFixed(2)),
        esperado_en_caja: Number(efectivo_esperado.toFixed(2)),
        conteo_fisico: conteo,
        diferencia, // conteo_fisico - esperado_en_caja
      },
    };
  }
  /**
 * Lista todas las cajas con opción de filtrar por usuario o rango de fechas
 * - Solo para GERENTE
 */
async historial(filtros: { cajeroId?: number; desde?: string; hasta?: string }) {
  const qb = this.cajas
    .createQueryBuilder('c')
    .innerJoin('c.usuario', 'u')
    .select([
      'c.id_caja AS id_caja',
      'u.nombre AS usuario_nombre',
      'c.estado AS estado',
      'c.monto_apertura AS monto_apertura',
      'c.monto_cierre AS monto_cierre',
      'c.fecha_apertura AS fecha_apertura',
      'c.fecha_cierre AS fecha_cierre',
    ])
    .orderBy('c.fecha_apertura', 'DESC');

  if (filtros.cajeroId) {
    qb.andWhere('c.id_usuario = :id', { id: filtros.cajeroId });
  }

  if (filtros.desde && filtros.hasta) {
    qb.andWhere('DATE(c.fecha_apertura) BETWEEN :desde AND :hasta', {
      desde: filtros.desde,
      hasta: filtros.hasta,
    });
  } else if (filtros.desde) {
    qb.andWhere('DATE(c.fecha_apertura) >= :desde', { desde: filtros.desde });
  } else if (filtros.hasta) {
    qb.andWhere('DATE(c.fecha_apertura) <= :hasta', { hasta: filtros.hasta });
  }

  const cajas = await qb.getRawMany();

  return cajas.map((c) => ({
    id_caja: Number(c.id_caja),
    cajero: c.usuario_nombre,
    estado: c.estado,
    monto_apertura: Number(c.monto_apertura),
    monto_cierre: c.monto_cierre ? Number(c.monto_cierre) : null,
    fecha_apertura: c.fecha_apertura,
    fecha_cierre: c.fecha_cierre,
  }));
}

}
