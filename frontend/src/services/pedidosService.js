import api from './api';

export const pedidoService = {
  async getAll(filters = {}) {
    const params = {};
    if (filters.caja) params.caja = filters.caja;
    if (filters.tipo_pedido) params.tipo_pedido = filters.tipo_pedido;
    if (filters.num_mesa) params.num_mesa = filters.num_mesa;
    if (filters.metodo_pago) params.metodo_pago = filters.metodo_pago;
    if (filters.estado_pago) params.estado_pago = filters.estado_pago;
    if (filters.estado_pedido) params.estado_pedido = filters.estado_pedido;
    if (filters.desde) params.desde = filters.desde;
    if (filters.hasta) params.hasta = filters.hasta;
    
    const { data } = await api.get('/pedidos', { params });
    return data.data || [];
  },

  // Obtener un pedido por ID
  async getOne(id) {
    const { data } = await api.get(`/pedidos/${id}`);
    return data;
  },

  // Crear nuevo pedido
  async create(pedidoData) {
    const { data } = await api.post('/pedidos', pedidoData);
    return data;
  },
  // Obtener detalles completos de un pedido (con items y productos)
    async getDetalles(id) {
    const { data } = await api.get(`/pedidos/${id}`);
    return data;
    },


  // Actualizar pedido
  async update(id, pedidoData) {
    const { data } = await api.patch(`/pedidos/${id}`, pedidoData);
    return data;
  },

  // Agregar items a un pedido existente
  async addItems(id, items) {
    const { data } = await api.post(`/pedidos/${id}/items`, { items });
    return data;
  },

  // Editar un item específico
  async updateItem(id_pedido, id_detalle, itemData) {
    const { data } = await api.patch(`/pedidos/${id_pedido}/items/${id_detalle}`, itemData);
    return data;
  },

  // Eliminar un item
  async deleteItem(id_pedido, id_detalle) {
    const { data } = await api.delete(`/pedidos/${id_pedido}/items/${id_detalle}`);
    return data;
  },

  

  // Cambiar estado de pago (pagado / sin pagar)
    async updatePagoEstado(id, metodo = null) {
    const body = metodo ? { metodo } : {};
    const { data } = await api.patch(`/pedidos/${id}/pagar`, body);
    return data;
    },
    



  // Eliminar pedido
  async delete(id) {
    const { data } = await api.delete(`/pedidos/${id}`);
    return data;
  },

  
  
};
