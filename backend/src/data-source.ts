import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Usuario } from './usuarios/usuario.entity';
import { Caja } from './caja/caja.entity';
import { Producto } from './productos/producto.entity';
import { Pedido } from './pedidos/pedido.entity';
import { DetallePedido } from './pedidos/detalle-pedido.entity';
import { Gasto } from './gastos/gasto.entity';
import { InventarioProducto } from './inventario/inventario-producto.entity';
import { InventarioMovimiento } from './inventario/inventario-mov.entity';


export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5433', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [Usuario, Caja, Producto, Pedido, DetallePedido, Gasto,InventarioProducto, InventarioMovimiento,
    ],
  migrations: ['src/migrations/*.{ts,js}'], 
  synchronize: false,
  ssl: false, 
  extra: {
    // Evita que el driver intente métodos de autenticación que fallan en local
    options: '-c statement_timeout=10000' 
  }
});
