import api from "./api";


export const productoService = {
  
  async getAll(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.search) params.append("search", filters.search);
    if (filters.tipo) params.append("tipo", filters.tipo);
    if (filters.activo !== "" && filters.activo !== undefined){
      params.append("activo", Number(filters.activo));

    } 
    const { data } = await api.get(`/productos?${params.toString()}`);
    return  data ;
  },

  
  async getById(id) {
    const { data } = await api.get(`/productos/${id}`);
    return data;
  },


  async create(formData, file) {
    const form = new FormData();
    form.append("nombre", formData.nombre);
    form.append("tipo", formData.tipo);
    form.append("precio", formData.precio);
  if (file) {
    form.append("file", file); 
  } else {
    form.append("img_url", 'https://res.cloudinary.com/dbur21xsb/image/upload/v1763073517/productos/dwfxgdkzxbjmcjxzrzsq.png'); // URL por defecto
  }

    form.append("activo", String(Number(formData.activo)));

    const { data } = await api.post("/productos", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
    
  },


  async update(id, formData, file) {
  const form = new FormData();
  form.append("nombre", formData.nombre);
  form.append("tipo", formData.tipo);
  form.append("precio", formData.precio);
  form.append("activo", String(Number(formData.activo)));

  if (file) form.append("file", file); 
  else if (!file) form.append("img_url", 'https://res.cloudinary.com/dbur21xsb/image/upload/v1763073517/productos/dwfxgdkzxbjmcjxzrzsq.png');

  const { data } = await api.patch(`/productos/${id}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
},

 
  async delete(id) {
    const { data } = await api.delete(`/productos/${id}`);
    return data;
  },

  async activar(id) {
    const { data } = await api.patch(`/productos/${id}/activar`);
    return data;
  },
  async listarPorTipo(tipo) {
        const { data } = await api.get(`/productos/tipo/${tipo}`);
        return data;
    },
};
