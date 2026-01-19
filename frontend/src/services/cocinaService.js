import api from './api';

export const cocinaService = {
  async getPendientes({ id_caja }) {
    const { data } = await api.get('/pedidos/cocina', {
      params: { id_caja, estado: 'PENDIENTE' },
    });
    return data;
  },
  async getListos({ id_caja }) {
    const { data } = await api.get('/pedidos/cocina/listos', {
      params: { id_caja },
    });
    return data;
  },
    
  
  async getResumen({ id_caja }) {
    const { data } = await api.get('/pedidos/cocina/resumen', {
      params: { id_caja },
    });
    return data;
  },

  async marcarItemDespachado(id_pedido, id_detalle) { // Recibe id_pedido y id_detalle
    // La URL debe ser /pedidos/:id/items/:detalleId/listo
    const { data } = await api.patch(`/pedidos/${id_pedido}/items/${id_detalle}/listo`); 
    return data;
  },
  // Obtener el stock disponible de productos 
  async getStockPlatos() {
    const hoy = new Date();
    const boliviaOffset = -4 * 60; // Bolivia está en UTC -4
    const utc = hoy.getTime() + hoy.getTimezoneOffset() * 60000;
    const local = new Date(utc + boliviaOffset * 60000);
    const fechaBolivia = local.toISOString().split('T')[0]; // Formato: YYYY-MM-DD

    const { data } = await api.get('/inventario/disponible', {
      params: { fecha: fechaBolivia }, // Enviar la fecha en formato 'YYYY-MM-DD'
    });
    return data;
  },
};
