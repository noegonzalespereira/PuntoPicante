import api from './api';

export const pedidoService = {
  async getAll(filters = {}) {
    const params = {};
    if (filters.caja) params.caja = filters.caja;
    if (filters.tipo_pedido) params.tipo_pedido = filters.tipo_pedido;
    if (filters.ambiente) params.ambiente = filters.ambiente;
    if (filters.num_mesa) params.num_mesa = filters.num_mesa;
    if (filters.metodo_pago) params.metodo_pago = filters.metodo_pago;
    if (filters.estado_pago) params.estado_pago = filters.estado_pago;
    if (filters.estado_pedido) params.estado_pedido = filters.estado_pedido;
    if (filters.desde) params.desde = filters.desde;
    if (filters.hasta) params.hasta = filters.hasta;
    if (filters.page) params.page = filters.page;
    if (filters.pageSize) params.pageSize = filters.pageSize;

    const { data } = await api.get('/pedidos', { params });
    return { data: data.data || [], total: data.total || 0 };
  },

  async getOne(id) {
    const { data } = await api.get(`/pedidos/${id}`);
    return data;
  },

  async create(pedidoData) {
    const { data } = await api.post('/pedidos', pedidoData);
    return data;
  },

  async getDetalles(id) {
    const { data } = await api.get(`/pedidos/${id}`);
    return data;
  },

  async update(id, pedidoData) {
    const { data } = await api.patch(`/pedidos/${id}`, pedidoData);
    return data;
  },

  async addItems(id, items, prioritario = false) {
    const { data } = await api.post(`/pedidos/${id}/items`, { items, prioritario });
    return data;
  },

  async updateItem(id_pedido, id_detalle, itemData) {
    const { data } = await api.patch(`/pedidos/${id_pedido}/items/${id_detalle}`, itemData);
    return data;
  },

  async deleteItem(id_pedido, id_detalle) {
    const { data } = await api.delete(`/pedidos/${id_pedido}/items/${id_detalle}`);
    return data;
  },

  async updatePagoEstado(id, metodo = null) {
    const body = metodo ? { metodo } : {};
    const { data } = await api.patch(`/pedidos/${id}/pagar`, body);
    return data;
  },

  async entregar(id) {
    const { data } = await api.patch(`/pedidos/${id}/entregar`);
    return data;
  },

  async delete(id) {
    const { data } = await api.delete(`/pedidos/${id}`);
    return data;
  },
};
