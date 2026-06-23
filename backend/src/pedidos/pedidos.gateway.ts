import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'https://punto-picante.vercel.app',
    ],
    credentials: false,
  },
})
export class PedidosGateway {
  @WebSocketServer()
  server: Server;

  emitNuevoPedido(pedido: any) {
    this.server.emit('pedido:nuevo', pedido);
  }

  emitPedidoActualizado(pedido: any) {
    this.server.emit('pedido:actualizado', pedido);
  }

  emitItemListo(data: { id_pedido: number; id_detalle: number }) {
    this.server.emit('item:listo', data);
  }

  emitPedidoEntregado(id_pedido: number) {
    this.server.emit('pedido:entregado', { id_pedido });
  }
}
