import React, { useEffect, useState, useMemo } from "react";
import {
  Container, Row, Col, Card, Button, Table, Modal, Form, Badge, Spinner, Alert, Pagination,
  Dropdown, DropdownButton
} from "react-bootstrap";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { pedidoService } from "../../services/pedidosService";
import { productoService } from "../../services/productoService";
import { cajaService } from "../../services/cajaService";
import { stockService } from "../../services/stockService";
import "../../styles/PedidosPage.css";
import {
  BsPlusCircle, BsListCheck
} from "react-icons/bs";
import PageHeader from "../../components/molecules/PageHeader";
import IconButton from "../../components/atoms/IconButton";
import EstadoBadge from "../../components/atoms/EstadoBadge";
import Money from "../../components/atoms/Money";
function asArray(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp?.data && Array.isArray(resp.data)) return resp.data;
  if (resp?.data?.data && Array.isArray(resp.data.data)) return resp.data.data;
  return [];
}
function hoyBolivia() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/La_Paz",
  });
  return formatter.format(new Date()).replace(/\//g, "-");
}

/** Normaliza mensaje de error para SweetAlert */
function getAxiosMessage(err) {
  const d = err?.response?.data;
  if (!d) return err?.message || "Error desconocido";
  if (typeof d === "string") return d;
  if (typeof d.message === "string") return d.message;
  if (typeof d.error === "string") return d.error;
  if (d?.errors && typeof d.errors === "object") {
    const lines = [];
    for (const [k, v] of Object.entries(d.errors)) {
      lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    }
    return lines.join("\n");
  }
  try { return JSON.stringify(d); } catch { return String(d); }
}

export default function PedidosPage() {

  const [activeTab, setActiveTab] = useState("nuevo");
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
  const [searchProducto, setSearchProducto] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [filtros, setFiltros] = useState({ tipo_pedido: '', ambiente: '' });
  const PAGE_SIZE = 15;
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [stockDisponible, setStockDisponible] = useState({ platos: [], bebidas: [], extras: [] });
  const [appendContext, setAppendContext] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalEditar, setModalEditar] = useState({ open: false, loading: false, pedido: null });
  const [modalVer, setModalVer] = useState({ open: false, loading: false, pedido: null });

  const getStockRestante = (id_producto) => Number(stockMap?.get(id_producto) ?? 0);

  const [pedidoActual, setPedidoActual] = useState({
    tipo_pedido: "MESA",
    ambiente: "PATIO",
    num_mesa: "",
    nombre_cliente: "",
    estado_pago: "SIN_PAGAR",
    metodo_pago: null,
    items: [],
  });

  const esMesaRequerida = (tipo) => tipo === "MESA" || tipo === "MIXTO";
  const mesaValida = (n) => Number.isInteger(n) && n >= 1 && n <= 8;

  async function cargarStockDelDia() {
    try {
      const hoy = hoyBolivia();
    
      const data = await stockService.getDisponible(hoy);
      setStockDisponible({
        platos: data.platos || [],
        bebidas: data.bebidas || [],
        extras: data.extras || [],
      });
    } catch (error) {
      console.error("Error al cargar stock del día:", error);
    }
  }

  async function loadData(page = currentPage, filt = filtros) {
    try {
      setLoading(true);
      const cajaData = await cajaService.getCajaAbierta();
      setCajaAbierta(cajaData || null);

      const prodData = await productoService.getAll({ activo: 1 });
      setProductos(prodData.data ?? prodData ?? []);

      const params = { page, pageSize: PAGE_SIZE };
      if (filt.tipo_pedido) params.tipo_pedido = filt.tipo_pedido;
      if (filt.ambiente)    params.ambiente    = filt.ambiente;

      const result = await pedidoService.getAll(params);
      setPedidos(result.data ?? []);
      setTotalPedidos(result.total ?? 0);

      await cargarStockDelDia();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(1, filtros); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const categorias = ["Todos", "PLATO", "BEBIDA", "EXTRA"];

  const stockMap = useMemo(() => {
    const map = new Map();
    for (const x of [...stockDisponible.platos, ...stockDisponible.bebidas, ...stockDisponible.extras]) {
      map.set(x.id_producto, x.stock);
    }
    return map;
  }, [stockDisponible]);

  const productosFiltrados = useMemo(() => productos.filter((p) => {
    const cat = categoriaActiva === "Todos" || p.tipo === categoriaActiva;
    const search = p.nombre.toLowerCase().includes(searchProducto.toLowerCase());
    const tieneStock = (stockMap.get(p.id_producto) ?? 0) > 0;
    return cat && search && tieneStock;
  }), [productos, categoriaActiva, searchProducto, stockMap]);


  function agregarProducto(producto) {
    if (!cajaAbierta && !appendContext) {
      toast.warning("Debe abrir una caja primero");
      return false;
    }
    const restante = getStockRestante(producto.id_producto);
    const enCarrito = pedidoActual.items
      .filter((i) => i.id_producto === producto.id_producto)
      .reduce((sum, i) => sum + i.cantidad, 0);

    if (restante <= 0 || enCarrito + 1 > restante) {
      toast.warning(`Sin stock suficiente — solo hay ${restante} unidad(es) de ${producto.nombre}.`);
      return false;
    }
    const existe = pedidoActual.items.find((i) => i.id_producto === producto.id_producto);
    const destinoPorDefecto = pedidoActual.tipo_pedido === "LLEVAR" ? "LLEVAR" : "MESA";

    if (existe) {
      setPedidoActual((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id_producto === producto.id_producto ? { ...i, cantidad: i.cantidad + 1 } : i
        ),
      }));
    } else {
      setPedidoActual((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            id_producto: producto.id_producto,
            nombre: producto.nombre,
            precio: Number(producto.precio),
            cantidad: 1,
            destino: destinoPorDefecto,
            notas: "",
          },
        ],
      }));
    }
  }

  const totalPedido = useMemo(
    () => pedidoActual.items.reduce((sum, i) => sum + i.precio * i.cantidad, 0),
    [pedidoActual.items]
  );

  function validarAntesDeEnviar() {
    if (!cajaAbierta && !appendContext) {
      toast.warning("Debe abrir una caja primero");
      return false;
    }
    if (pedidoActual.items.length === 0) {
      toast.warning("Agregue al menos un producto");
      return false;
    }
    if (!appendContext && esMesaRequerida(pedidoActual.tipo_pedido)) {
      if (pedidoActual.ambiente === "OFICINA") {
        // nombre_cliente es opcional para oficina
      } else {
        const nMesa = Number(pedidoActual.num_mesa);
        if (!mesaValida(nMesa)) {
          toast.warning("Número de mesa inválido (1–8)");
          return false;
        }
      }
    }
    if (!appendContext && pedidoActual.estado_pago === "PAGADO" && !pedidoActual.metodo_pago) {
      toast.warning("Seleccione el método de pago (EFECTIVO/QR)");
      return false;
    }
    if (pedidoActual.tipo_pedido === "MIXTO") {
      const sinDestino = pedidoActual.items.find((i) => !i.destino);
      if (sinDestino) {
        toast.warning("Cada ítem debe tener destino (MESA o LLEVAR)");
        return false;
      }
    }
    return true;
  }

  async function handleConfirmPedidoActual() {
    if (saving) return;
    if (!validarAntesDeEnviar()) return;

    const esOficina = esMesaRequerida(pedidoActual.tipo_pedido) && pedidoActual.ambiente === "OFICINA";
    const esLlevar = pedidoActual.tipo_pedido === "LLEVAR";
    const payload = {
      id_caja: cajaAbierta?.id_caja,
      tipo_pedido: pedidoActual.tipo_pedido,
      ambiente: esMesaRequerida(pedidoActual.tipo_pedido) ? pedidoActual.ambiente : undefined,
      num_mesa: esOficina ? null : esMesaRequerida(pedidoActual.tipo_pedido) ? Number(pedidoActual.num_mesa) : null,
      nombre_cliente: (esOficina || esLlevar) ? (pedidoActual.nombre_cliente || "").trim() : null,
      estado_pago: pedidoActual.estado_pago,
      metodo_pago: pedidoActual.estado_pago === "PAGADO" ? pedidoActual.metodo_pago : null,
      items: pedidoActual.items.map((i) => ({
        id_producto: i.id_producto,
        cantidad: i.cantidad,
        notas: i.notas || null,
        destino:
          pedidoActual.tipo_pedido === "MIXTO"
            ? i.destino
            : pedidoActual.tipo_pedido === "LLEVAR"
            ? "LLEVAR"
            : "MESA",
      })),
    };

    setSaving(true);
    if (appendContext) {
      try {
        await pedidoService.addItems(appendContext.id_pedido, payload.items);
        await cargarStockDelDia();
        toast.success(`${payload.items.length} ítem(s) añadidos al pedido #${appendContext.num_pedido}`);
        setPedidoActual({
          tipo_pedido: "MESA",
          ambiente: "PATIO",
          num_mesa: "",
          nombre_cliente: "",
          estado_pago: "SIN_PAGAR",
          metodo_pago: null,
          items: [],
        });
        setAppendContext(null);
        setActiveTab("listado");
        loadData(1, filtros);
      } catch (err) {
        toast.error(getAxiosMessage(err));
      } finally {
        setSaving(false);
      }
    } else {
      try {
        const res = await pedidoService.create(payload);
        await cargarStockDelDia();
        toast.success(`Pedido #${res.num_pedido} creado correctamente`);
        setPedidoActual({
          tipo_pedido: "MESA",
          ambiente: "PATIO",
          num_mesa: "",
          nombre_cliente: "",
          estado_pago: "SIN_PAGAR",
          metodo_pago: null,
          items: [],
        });
        setActiveTab("listado");
        loadData(1, filtros);
      } catch (err) {
        toast.error(getAxiosMessage(err));
      } finally {
        setSaving(false);
      }
    }
  }


  async function abrirModalEditar(pResumen) {
    setModalEditar({ open: true, loading: true, pedido: null });
    try {
      const p = await pedidoService.getDetalles(pResumen.id_pedido);

      const mapProducto = new Map((productos || []).map((pr) => [pr.id_producto, pr]));

      const itemsNormalizados =
        (p.items || []).map((d) => {
          const idProd = d.producto?.id_producto ?? d.id_producto;
          const prodInfo = d.producto ?? mapProducto.get(idProd) ?? {};
          return {
            id_detalle: d.id_detalle ?? d.id_detalle_pedido,
            id_producto: idProd,
            producto: {
              id_producto: idProd,
              nombre: prodInfo.nombre ?? d.nombre,
              tipo: prodInfo.tipo,
            },
            nombre: prodInfo.nombre ?? d.nombre,
            cantidad: Number(d.cantidad),
            precio_unitario: Number(d.precio_unitario ?? d.precio ?? 0),
            destino: d.destino ?? null,
            notas: d.notas ?? "",
          };
        }) ?? [];

      const snapshot = JSON.parse(JSON.stringify(itemsNormalizados));

      setModalEditar({
        open: true,
        loading: false,
        pedido: {
          ...p,
          items: itemsNormalizados,
          originalItems: snapshot,
          estado_pago_original: p.estado_pago,
        },
      });
    } catch (err) {
      toast.error("No se pudo cargar el pedido");
      setModalEditar({ open: false, loading: false, pedido: null });
    }
  }

  const handleGuardarEdicion = async () => {
  const p = modalEditar.pedido;
  if (!p) return;

  // Si pasa de SIN_PAGAR -> PAGADO, el método es obligatorio
  const quierePagar = p.estado_pago === "PAGADO" && p.estado_pago_original !== "PAGADO";
  if (quierePagar && !p.metodo_pago) {
    toast.warning("Selecciona el método de pago: EFECTIVO o QR.");
    return;
  }

  try {
    setModalEditar((prev) => ({ ...prev, loading: true }));

    // 1) Actualizar cabecera (tipo/mesa). No forzamos pago aquí; hay endpoint dedicado.
    const payloadUpdate = {};
    if (p.tipo_pedido) payloadUpdate.tipo_pedido = p.tipo_pedido;
    if (p.tipo_pedido === "MESA" || p.tipo_pedido === "MIXTO") {
      // Añadimos el ambiente al payload para que se guarde
      if (p.ambiente) payloadUpdate.ambiente = p.ambiente;

      if (p.ambiente === 'OFICINA') {
        payloadUpdate.num_mesa = null;
        payloadUpdate.nombre_cliente = p.nombre_cliente ?? null;
      } else { // PATIO
        payloadUpdate.num_mesa = Number(p.num_mesa ?? 1);
        payloadUpdate.nombre_cliente = null; // Los pedidos de patio no tienen nombre de cliente
      }

    } else if (p.tipo_pedido === "LLEVAR") {
      payloadUpdate.num_mesa = null;
      payloadUpdate.nombre_cliente = p.nombre_cliente ?? null;
    }

    if (Object.keys(payloadUpdate).length > 0) {
      await pedidoService.update(p.id_pedido, payloadUpdate);
    }

    // 2) Sincronizar ítems (editar existentes, eliminar removidos, agregar nuevos)
    const original = p.originalItems || [];
    const edited = p.items || [];

    const mapById = (arr) =>
      new Map(arr.filter((i) => i.id_detalle).map((i) => [i.id_detalle, i]));

    const origById = mapById(original);
    const editById = mapById(edited);

    // 2.a) Actualizar los que existen
    for (const [id_detalle, itNow] of editById) {
      const itOld = origById.get(id_detalle);
      if (!itOld) continue;

      const patch = {};
      let needsUpdate = false;

      // cantidad
      if (+itNow.cantidad !== +itOld.cantidad) {
        patch.cantidad = +itNow.cantidad;
        needsUpdate = true;
      }

      // notas (permitir null para limpiar)
      const nowNotas = (itNow.notas ?? "") === "" ? null : itNow.notas;
      const oldNotas = (itOld.notas ?? "") === "" ? null : itOld.notas;
      if (nowNotas !== oldNotas) {
        patch.notas = nowNotas;
        needsUpdate = true;
      }

      // destino (solo relevante/obligatorio para MIXTO)
      if (p.tipo_pedido === "MIXTO") {
        const nowDestino = (itNow.destino || "MESA");
        const oldDestino = (itOld.destino || "MESA");
        if (nowDestino !== oldDestino) {
          patch.destino = nowDestino;
          needsUpdate = true;
        }
      }

      // estado_item (opcional)
      if (itNow.estado_item && itNow.estado_item !== itOld.estado_item) {
        patch.estado_item = itNow.estado_item; // 'PENDIENTE' | 'LISTO'
        needsUpdate = true;
      }

      if (needsUpdate) {
        await pedidoService.updateItem(p.id_pedido, id_detalle, patch);
      }
    }

    // 2.b) Eliminar los que ya no están
    for (const old of original) {
      if (old.id_detalle && !editById.has(old.id_detalle)) {
        await pedidoService.deleteItem(p.id_pedido, old.id_detalle);
      }
    }

    // 2.c) Agregar los nuevos
    const nuevos = edited
      .filter((i) => !i.id_detalle)
      .map((i) => ({
        id_producto: i.id_producto,
        cantidad: Number(i.cantidad),
        notas: (i.notas ?? "") === "" ? null : i.notas,
        destino:
          p.tipo_pedido === "MIXTO"
            ? (i.destino || "MESA")
            : p.tipo_pedido === "LLEVAR"
            ? "LLEVAR"
            : "MESA",
      }));

    if (nuevos.length) {
      await pedidoService.addItems(p.id_pedido, nuevos);
    }

    // 3) Pago ahora (endpoint dedicado)
    if (quierePagar) {
      await pedidoService.updatePagoEstado(p.id_pedido, p.metodo_pago);
    }

    toast.success(
      quierePagar
        ? `Pedido #${p.num_pedido} actualizado y marcado como PAGADO.`
        : `Pedido #${p.num_pedido} actualizado.`
    );

    setModalEditar({ open: false, loading: false, pedido: null });
    await cargarStockDelDia();
    await loadData(currentPage, filtros);
  } catch (err) {
    console.error("Editar/pagar pedido ->", err?.response?.data || err);
    setModalEditar((prev) => ({ ...prev, loading: false }));
    toast.error(getAxiosMessage(err));
  }
};


  const calcularTotalModal = (p) =>
    p?.items?.reduce(
      (acc, it) => acc + Number(it.precio_unitario ?? 0) * Number(it.cantidad ?? 0),
      0
    ) || 0;

  const cerrarModal = () => setModalEditar({ open: false, loading: false, pedido: null });

  const irAlMenuParaAnadir = () => {
    const p = modalEditar.pedido;
    if (!p) return;

    setPedidoActual({
      tipo_pedido: p.tipo_pedido,
      num_mesa: p.num_mesa ?? "",
      estado_pago: "SIN_PAGAR",
      metodo_pago: null,
      items: [],
    });

    setAppendContext({
      id_pedido: p.id_pedido,
      num_pedido: p.num_pedido,
      tipo_pedido: p.tipo_pedido,
      num_mesa: p.num_mesa ?? null,
    });

    setActiveTab("nuevo");
    setModalEditar({ open: false, loading: false, pedido: null });
    toast.info(`Añadiendo productos al pedido #${p.num_pedido}`);
  };
  async function abrirModalVer(pResumen) {
    setModalVer({ open: true, loading: true, pedido: null });
    try {
      const p = await pedidoService.getDetalles(pResumen.id_pedido);
      const items = (p.items || []).map((d) => {
        const idProd = d.producto?.id_producto ?? d.id_producto;
        const nombre = d.producto?.nombre ?? d.nombre ?? `#${idProd}`;
        const tipo = d.producto?.tipo;
        return {
          id_detalle: d.id_detalle ?? d.id_detalle_pedido,
          id_producto: idProd,
          nombre,
          producto: { id_producto: idProd, nombre, tipo },
          cantidad: Number(d.cantidad),
          precio_unitario: Number(d.precio_unitario ?? d.precio ?? 0),
          destino: d.destino ?? null,
          notas: d.notas ?? "",
        };
      });
      setModalVer({
        open: true,
        loading: false,
        pedido: { ...p, items },
      });
    } catch (err) {
      toast.error("No se pudo cargar el resumen del pedido");
      setModalVer({ open: false, loading: false, pedido: null });
    }
  }
 
  const cerrarModalVer = () => setModalVer({ open: false, loading: false, pedido: null });


  async function handleEliminarPedido(p) {
    if (!p) return;
    if (p.estado_pago === "PAGADO") {
      Swal.fire("", "No puedes eliminar un pedido PAGADO.", "warning");
      return;
    }
    const ok = await Swal.fire({
      title: `¿Eliminar pedido #${p.num_pedido}?`,
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;

    try {
      await pedidoService.delete(p.id_pedido);
      toast.success("Pedido eliminado");
      await cargarStockDelDia();
      await loadData(currentPage, filtros);
    } catch (err) {
      console.error(err);
      toast.error(getAxiosMessage(err));
    }
  }

  async function handleCobrarRapido(p, metodo) {
    try {
      await pedidoService.updatePagoEstado(p.id_pedido, metodo);
      toast.success(`Pedido #${p.num_pedido} cobrado en ${metodo}`);
      // Actualización local — evita recargar toda la página
      setPedidos(prev => prev.map(x =>
        x.id_pedido === p.id_pedido
          ? { ...x, estado_pago: 'PAGADO', metodo_pago: metodo }
          : x
      ));
    } catch (err) {
      toast.error(getAxiosMessage(err));
    }
  }

  const renderItemRow = (pedidoRef, item) => (
    <Row
      key={item.id_detalle ?? item.id_detalle_pedido ?? item.id_producto}
      className="align-items-center border rounded-3 p-2 mb-2 bg-light item-row-edit"
    >
      <Col md={4}>
        <strong>{item.producto?.nombre || item.nombre || `#${item.id_producto}`}</strong>
        <div className="small text-muted">
          {Number(item.precio_unitario ?? item.precio ?? 0).toFixed(2)} Bs
        </div>
        <Form.Control
          as="textarea"
          rows={1}
          placeholder="Notas (opcional)"
          className="mt-1 input-notes"
          value={item.notas || ""}
          onChange={(e) =>
            setModalEditar((prev) => ({
              ...prev,
              pedido: {
                ...prev.pedido,
                items: prev.pedido.items.map((i) =>
                  (i.id_detalle ?? i.id_detalle_pedido ?? i.id_producto) === (item.id_detalle ?? item.id_detalle_pedido ?? item.id_producto)
                    ? { ...i, notas: e.target.value }
                    : i
                ),
              },
            }))
          }
        />
      </Col>

      {pedidoRef.tipo_pedido === "MIXTO" && (
        <Col md={3}>
          <Form.Select
            value={item.destino || "MESA"}
            onChange={(e) =>
              setModalEditar((prev) => ({
                ...prev,
                pedido: {
                  ...prev.pedido,
                  items: prev.pedido.items.map((i) =>
                    (i.id_detalle ?? i.id_detalle_pedido ?? i.id_producto) === (item.id_detalle ?? item.id_detalle_pedido ?? item.id_producto)
                      ? { ...i, destino: e.target.value }
                      : i
                  ),
                },
              }))
            }
            className="input-destino"
          >
            <option value="MESA">MESA</option>
            <option value="LLEVAR">LLEVAR</option>
          </Form.Select>
        </Col>
      )}

      <Col md={pedidoRef.tipo_pedido === "MIXTO" ? 3 : 5} className="text-center">
        <Button
          variant="outline-danger"
          size="sm"
          onClick={() =>
            setModalEditar((prev) => ({
              ...prev,
              pedido: {
                ...prev.pedido,
                items: prev.pedido.items.map((i) =>
                  (i.id_detalle ?? i.id_detalle_pedido ?? i.id_producto) === (item.id_detalle ?? item.id_detalle_pedido ?? item.id_producto)
                    ? { ...i, cantidad: Math.max(1, Number(i.cantidad) - 1) }
                    : i
                ),
              },
            }))
          }
        >
          <i className="bi bi-dash"></i>
        </Button>
        <span className="mx-2 fw-bold">{item.cantidad}</span>
        <Button
          variant="outline-success"
          size="sm"
          onClick={() => {
            const itemKey = item.id_detalle ?? item.id_detalle_pedido ?? item.id_producto;
            const originalItem = (pedidoRef.originalItems ?? []).find(
              (o) => (o.id_detalle ?? o.id_detalle_pedido ?? o.id_producto) === itemKey
            );
            const originalCantidad = Number(originalItem?.cantidad ?? 0);
            const nuevaCantidad = Number(item.cantidad) + 1;
            const delta = nuevaCantidad - originalCantidad;
            const stockDisp = stockMap.get(item.id_producto) ?? 0;
            if (delta > 0 && stockDisp < delta) {
              toast.warning(
                `Sin stock suficiente para "${item.producto?.nombre ?? item.nombre}" — solo quedan ${stockDisp} unidad(es) disponibles.`
              );
              return;
            }
            setModalEditar((prev) => ({
              ...prev,
              pedido: {
                ...prev.pedido,
                items: prev.pedido.items.map((i) =>
                  (i.id_detalle ?? i.id_detalle_pedido ?? i.id_producto) === itemKey
                    ? { ...i, cantidad: nuevaCantidad }
                    : i
                ),
              },
            }));
          }}
        >
          <i className="bi bi-plus"></i>
        </Button>
      </Col>

      <Col md={2} className="text-center fw-bold text-success">
        {(Number(item.precio_unitario ?? item.precio ?? 0) * Number(item.cantidad ?? 0)).toFixed(2)} Bs
      </Col>

      <Col md={1} className="text-end">
        <Button
          variant="outline-danger"
          size="sm"
          onClick={() =>
            setModalEditar((prev) => ({
              ...prev,
              pedido: {
                ...prev.pedido,
                items: prev.pedido.items.filter((i) =>
                  (i.id_detalle ?? i.id_detalle_pedido ?? i.id_producto) !== (item.id_detalle ?? item.id_detalle_pedido ?? item.id_producto)
                ),
              },
            }))
          }
        >
          <i className="bi bi-trash"></i>
        </Button>
      </Col>
    </Row>
  );

  if (loading) return <div className="text-center p-5">Cargando datos...</div>;

  return (
    <Container fluid className="py-0 pedidos-page">
      {/* HEADER */}
      <PageHeader title="Gestión de Pedidos" subtitle="Toma de órdenes y gestión de ventas">
        {cajaAbierta && (
          <Badge bg="light" text="dark" className="fs-6 px-3 py-2">
            <i className="bi bi-cash-stack me-1" />
            Caja: ABIERTA
          </Badge>
        )}
      </PageHeader>

      {/* TABS */}
      <div className="d-flex gap-2 border-bottom mb-3 flex-wrap px-3">
        <Button
          variant={activeTab === "nuevo" ? "success" : "outline-success"}
          onClick={() => {
            setAppendContext(null);
            setActiveTab("nuevo");
          }}
          className="btn-tab-pedido"
        >
          <i className="bi bi-plus-circle me-1"></i>
          {appendContext ? `Añadir al Pedido #${appendContext.num_pedido}` : "Nuevo Pedido"}
        </Button>

        <Button
          variant={activeTab === "listado" ? "warning" : "outline-warning"}
          onClick={() => setActiveTab("listado")}
          className="btn-tab-pedido"
        >
          <i className="bi bi-list-check me-1"></i> Listado
        </Button>

        {!cajaAbierta && (
          <Alert variant="danger" className="p-2 ms-auto mb-0 fw-bold">
            Caja Cerrada - No se pueden crear pedidos.
          </Alert>
        )}
      </div>

      {/* NUEVO / AÑADIR */}
      {activeTab === "nuevo" && (
        <Row className="g-4 px-3">
          {/* Menú */}
          <Col lg={8}>
            <Card className="shadow-sm border-0 mb-3">
              <Card.Header className="bg-light fw-bold card-header-menu">
                <i className="bi bi-egg-fried me-2"></i>Menú
              </Card.Header>
              <Card.Body>
                <Form.Control
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchProducto}
                  onChange={(e) => setSearchProducto(e.target.value)}
                  className="mb-3 input-search"
                />
                <div className="mb-3 d-flex gap-2 flex-wrap">
                  {categorias.map((cat) => (
                    <Button
                      key={cat}
                      variant={categoriaActiva === cat ? "warning" : "outline-warning"}
                      onClick={() => setCategoriaActiva(cat)}
                      size="sm"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
                <Row xs={2} md={3} lg={4} className="g-3">
                  {productosFiltrados.map((p) => (
                    <Col key={p.id_producto}>
                      <Card
                        className={`producto-card shadow-sm h-100 text-center border-0 ${
                          p.activo === 0 ? "card-disabled" : ""
                        }`}
                        onClick={() => p.activo === 1 && agregarProducto(p)}
                        role="button"
                      >
                        {p.img_url ? (
                          <Card.Img variant="top" src={p.img_url} className="img-producto" />
                        ) : (
                          <div className="text-center py-4 bg-light placeholder-img">
                            <i className="bi bi-image fs-2 text-secondary" />
                          </div>
                        )}
                        <Card.Body className="p-2">
                          <Card.Title className="fs-6 product-title">{p.nombre}</Card.Title>
                          <Card.Text className="text-success fw-bold mb-1 product-price">
                            {Number(p.precio).toFixed(2)} Bs
                          </Card.Text>
                          {(() => {
                            const restante = stockMap.get(p.id_producto) ?? 0;
                            const texto =
                              restante <= 0
                                ? "Sin stock"
                                : restante <= 5
                                ? `Poco stock (${restante})`
                                : `Disponible: ${restante}`;
                            const color =
                              restante <= 0
                                ? "text-danger"
                                : restante <= 5
                                ? "text-warning"
                                : "text-success";
                            return <small className={color}>{texto}</small>;
                          })()}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>

          {/* Carrito */}
          <Col lg={4}>
            <Card className="shadow-sm border-0 sticky-top card-carrito" style={{ top: 12 }}>
              <Card.Header className="bg-success text-light fw-bold d-flex align-items-center justify-content-between header-carrito">
                <span>
                  <i className="bi bi-cart-check me-2"></i>
                  {appendContext
                    ? `Añadir al Pedido #${appendContext.num_pedido}`
                    : "Pedido Actual"}
                </span>
                {appendContext && (
                  <Badge bg="light" text="dark" className="badge-editando">
                    <i className="bi bi-pencil-square me-1" />
                    Editando
                  </Badge>
                )}
              </Card.Header>
              <Card.Body>
                
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">Tipo de Pedido</Form.Label>
                  <div className="d-flex gap-3">
                    {[{v:"MESA",l:"Mesa"},{v:"LLEVAR",l:"Llevar"},{v:"MIXTO",l:"Mixto"}].map(({v,l}) => (
                      <Form.Check
                        key={v} type="radio" id={`tipo-${v}`}
                        label={l} value={v}
                        checked={pedidoActual.tipo_pedido === v}
                        disabled={!!appendContext}
                        onChange={() => setPedidoActual((prev) => ({
                          ...prev,
                          tipo_pedido: v,
                          ambiente: v === "LLEVAR" ? "PATIO" : prev.ambiente,
                          num_mesa: v === "LLEVAR" ? "" : prev.num_mesa,
                          nombre_cliente: v === "LLEVAR" ? "" : prev.nombre_cliente,
                          items: prev.items.map((it) => ({ ...it, destino: v === "LLEVAR" ? "LLEVAR" : "MESA" })),
                        }))}
                      />
                    ))}
                  </div>
                </Form.Group>

                
                {esMesaRequerida(pedidoActual.tipo_pedido) && !appendContext && (
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Ambiente</Form.Label>
                    <div className="d-flex gap-3">
                      {[{v:"PATIO",l:"Patio"},{v:"OFICINA",l:"Oficina"}].map(({v,l}) => (
                        <Form.Check
                          key={v} type="radio" id={`amb-${v}`}
                          label={l} value={v}
                          checked={pedidoActual.ambiente === v}
                          onChange={() => setPedidoActual((prev) => ({
                            ...prev, ambiente: v, num_mesa: "", nombre_cliente: "",
                          }))}
                        />
                      ))}
                    </div>
                  </Form.Group>
                )}

                {esMesaRequerida(pedidoActual.tipo_pedido) && !appendContext && pedidoActual.ambiente === "PATIO" && (
                  <Form.Group className="mb-3">
                    <Form.Label>Número de Mesa</Form.Label>
                    <Form.Select
                      value={pedidoActual.num_mesa}
                      onChange={(e) =>
                        setPedidoActual((prev) => ({ ...prev, num_mesa: e.target.value }))
                      }
                    >
                      <option value="">Seleccionar mesa...</option>
                      {[1,2,3,4,5,6,7,8].map((n) => (
                        <option key={n} value={n}>Mesa {n}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                )}

                {((esMesaRequerida(pedidoActual.tipo_pedido) && pedidoActual.ambiente === "OFICINA") || pedidoActual.tipo_pedido === "LLEVAR") && !appendContext && (
                  <Form.Group className="mb-3">
                    <Form.Label>Nombre del Cliente</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Nombre del cliente"
                      value={pedidoActual.nombre_cliente}
                      onChange={(e) =>
                        setPedidoActual((prev) => ({ ...prev, nombre_cliente: e.target.value }))
                      }
                    />
                  </Form.Group>
                )}

                {appendContext && esMesaRequerida(pedidoActual.tipo_pedido) && (
                  <Form.Group className="mb-3">
                    <Form.Text className="text-muted">
                      Usando la mesa del pedido #{appendContext.num_pedido}.
                    </Form.Text>
                  </Form.Group>
                )}

                {!appendContext && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">Estado del Pago</Form.Label>
                      <div className="d-flex gap-3">
                        {[{v:"SIN_PAGAR",l:"Sin pagar"},{v:"PAGADO",l:"Pagado"}].map(({v,l}) => (
                          <Form.Check
                            key={v} type="radio" id={`pago-${v}`}
                            label={l} value={v}
                            checked={pedidoActual.estado_pago === v}
                            onChange={() => setPedidoActual((prev) => ({
                              ...prev,
                              estado_pago: v,
                              metodo_pago: v === "PAGADO" ? "EFECTIVO" : null,
                            }))}
                          />
                        ))}
                      </div>
                    </Form.Group>

                    {pedidoActual.estado_pago === "PAGADO" && (
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">Método de Pago</Form.Label>
                        <div className="d-flex gap-3">
                          {[{v:"EFECTIVO",l:"Efectivo"},{v:"QR",l:"QR"}].map(({v,l}) => (
                            <Form.Check
                              key={v} type="radio" id={`metodo-${v}`}
                              label={l} value={v}
                              checked={pedidoActual.metodo_pago === v}
                              onChange={() => setPedidoActual((prev) => ({ ...prev, metodo_pago: v }))}
                            />
                          ))}
                        </div>
                      </Form.Group>
                    )}
                  </>
                )}

                {/* Mensajes guía según tipo cuando se está añadiendo */}
                {appendContext && pedidoActual.tipo_pedido === "LLEVAR" && (
                  <Alert variant="info" className="mb-3">
                    Este pedido es <strong>PARA LLEVAR</strong>. Los nuevos ítems se registrarán como LLEVAR.
                  </Alert>
                )}
                {appendContext && pedidoActual.tipo_pedido === "MESA" && (
                  <Alert variant="info" className="mb-3">
                    Este pedido es <strong>DE MESA #{appendContext.num_mesa ?? "-"}</strong>. Los ítems se registrarán para MESA.
                  </Alert>
                )}
                {appendContext && pedidoActual.tipo_pedido === "MIXTO" && (
                  <Alert variant="info" className="mb-3">
                    Este pedido es <strong>MIXTO</strong>. Elige el destino (MESA/LLEVAR) por ítem.
                  </Alert>
                )}

                <hr className="mt-0" />

                {/* Items carrito */}
                {pedidoActual.items.length ? (
                  <>
                    {pedidoActual.items.map((item) => (
                      <div key={item.id_producto} className="py-2 item-carrito-resumen">
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="me-2">
                            <strong>{item.nombre}</strong>
                            <div className="text-muted small">
                              {(item.precio * item.cantidad).toFixed(2)} Bs
                            </div>
                          </div>
                          <div className="d-flex align-items-center">
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="btn-qty"
                              onClick={() =>
                                setPedidoActual((prev) => ({
                                  ...prev,
                                  items: prev.items.map((i) =>
                                    i.id_producto === item.id_producto
                                      ? { ...i, cantidad: Math.max(1, i.cantidad - 1) }
                                      : i
                                  ),
                                }))
                              }
                            >
                              <i className="bi bi-dash"></i>
                            </Button>
                            <span className="mx-2 fw-bold">{item.cantidad}</span>
                            <Button
                              size="sm"
                              variant="outline-success"
                              className="btn-qty"
                              onClick={() =>
                                setPedidoActual((prev) => {
                                  const restante = getStockRestante(item.id_producto);
                                  const actual = prev.items.find(
                                    (i) => i.id_producto === item.id_producto
                                  )?.cantidad ?? 0;

                                  if (restante <= 0 || actual + 1 > restante) {
                                    toast.warning(`Sin stock suficiente — solo hay ${restante} unidad(es) de ${item.nombre}.`);
                                    return prev;
                                  }
                                  return {
                                  ...prev,
                                  items: prev.items.map((i) =>
                                    i.id_producto === item.id_producto
                                      ? { ...i, cantidad: i.cantidad + 1 }
                                      : i
                                  ),
                                };
                              })
                            }
                            >
                              <i className="bi bi-plus"></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="ms-2 btn-remove-item"
                              onClick={() =>
                                setPedidoActual((prev) => ({
                                  ...prev,
                                  items: prev.items.filter(
                                    (i) => i.id_producto !== item.id_producto
                                  ),
                                }))
                              }
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Form.Control
                            size="sm"
                            type="text"
                            placeholder="Notas (opcional)"
                            value={item.notas || ""}
                            onChange={(e) =>
                              setPedidoActual((prev) => ({
                                ...prev,
                                items: prev.items.map((i) =>
                                  i.id_producto === item.id_producto
                                    ? { ...i, notas: e.target.value }
                                    : i
                                ),
                              }))
                            }
                          />
                        </div>

                        {pedidoActual.tipo_pedido === "MIXTO" && (
                          <div className="d-flex justify-content-end mt-1 small">
                            <Form.Select
                              size="sm"
                              className="w-auto input-destino-mix"
                              value={item.destino}
                              onChange={(e) =>
                                setPedidoActual((prev) => ({
                                  ...prev,
                                  items: prev.items.map((i) =>
                                    i.id_producto === item.id_producto
                                      ? { ...i, destino: e.target.value }
                                      : i
                                  ),
                                }))
                              }
                            >
                              <option value="MESA">MESA</option>
                              <option value="LLEVAR">LLEVAR</option>
                            </Form.Select>
                          </div>
                        )}
                        <hr className="my-2" />
                      </div>
                    ))}

                    <div className="mt-3 text-end">
                      <h5 className="text-success fw-bold total-value-carrito">
                        Total: {totalPedido.toFixed(2)} Bs
                      </h5>
                      <Button
                        variant="success"
                        className="w-100 mt-2 btn-confirmar-pedido"
                        onClick={handleConfirmPedidoActual}
                        disabled={!cajaAbierta || saving}
                      >
                        {saving ? (
                          <><Spinner animation="border" size="sm" className="me-2" />Guardando...</>
                        ) : (
                          <><i className="bi bi-check2-circle me-2"></i>{appendContext ? "Añadir al pedido" : "Crear Pedido"}</>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted">
                    <i className="bi bi-cart-x me-1"></i>No hay productos agregados
                  </p>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* LISTADO */}
      {activeTab === "listado" && (
        <Card className="shadow-sm border-0 mx-3 card-listado-pedidos">
          <Card.Header className="bg-warning fw-bold header-listado">
            <i className="bi bi-clipboard-data me-2"></i>Listado de Pedidos
          </Card.Header>
          <Card.Body>
            {/* Filtros */}
            <Row className="mb-3 g-2 align-items-end">
              <Col xs="auto">
                <Form.Label className="fw-semibold mb-1">Tipo</Form.Label>
                <Form.Select
                  value={filtros.tipo_pedido}
                  style={{ minWidth: 130 }}
                  onChange={(e) => {
                    const nf = { ...filtros, tipo_pedido: e.target.value };
                    setFiltros(nf);
                    setCurrentPage(1);
                    loadData(1, nf);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="MESA">Mesa</option>
                  <option value="LLEVAR">Llevar</option>
                  <option value="MIXTO">Mixto</option>
                </Form.Select>
              </Col>
              <Col xs="auto">
                <Form.Label className="fw-semibold mb-1">Ambiente</Form.Label>
                <Form.Select
                  value={filtros.ambiente}
                  style={{ minWidth: 130 }}
                  onChange={(e) => {
                    const nf = { ...filtros, ambiente: e.target.value };
                    setFiltros(nf);
                    setCurrentPage(1);
                    loadData(1, nf);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="PATIO">Patio</option>
                  <option value="OFICINA">Oficina</option>
                </Form.Select>
              </Col>
              <Col xs="auto" className="d-flex align-items-end">
                {(filtros.tipo_pedido || filtros.ambiente) && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      const nf = { tipo_pedido: '', ambiente: '' };
                      setFiltros(nf);
                      setCurrentPage(1);
                      loadData(1, nf);
                    }}
                  >
                    <i className="bi bi-x-circle me-1" />Restablecer
                  </Button>
                )}
              </Col>
              <Col xs="auto" className="ms-auto d-flex align-items-end">
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                  {totalPedidos} resultado{totalPedidos !== 1 ? 's' : ''}
                </div>
              </Col>
            </Row>

            {!pedidos.length ? (
              <p className="text-center text-muted my-4">
                <i className="bi bi-inbox me-2"></i>No hay pedidos registrados
              </p>
            ) : (() => {
              const totalPages = Math.ceil(totalPedidos / PAGE_SIZE);
              const pagina = pedidos; // ya paginado desde el servidor
              return (
                <>
                  <div className="table-responsive">
                    <Table responsive hover className="align-middle table-pedidos-listado tabla-responsive-cards">
                      <thead>
                        <tr>
                          <th># Pedido</th>
                          <th>Tipo / Lugar</th>
                          <th>Mesa / Cliente</th>
                          <th>Total</th>
                          <th>Estado Pedido</th>
                          <th>Pago / Método</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagina.map((p) => (
                          <tr key={p.id_pedido}>
                            <td data-label="# Pedido" className="fw-bold">{p.num_pedido}</td>
                            <td data-label="Tipo / Lugar">
                              {p.tipo_pedido} / {p.tipo_pedido === 'LLEVAR'
                                ? '-'
                                : p.ambiente === "OFICINA"
                                  ? <Badge bg="primary">Oficina</Badge>
                                  : p.ambiente}
                            </td>
                            <td data-label="Mesa / Cliente">
                              {(p.ambiente === "OFICINA" || p.tipo_pedido === "LLEVAR") ? (p.nombre_cliente || '-') : (p.num_mesa ?? '-')}
                            </td>
                            <td data-label="Total" className="fw-bold"><Money value={p.total} /></td>
                            <td data-label="Estado Pedido">
                              <EstadoBadge estado={p.estado_pedido} />
                            </td>
                            <td data-label="Pago / Método">
                              <EstadoBadge estado={p.estado_pago} />
                              {p.metodo_pago ? ` / ${p.metodo_pago}` : ''}
                            </td>
                            <td data-label="Acciones" className="text-nowrap celda-acciones">
                              {p.estado_pago === "SIN_PAGAR" && (
                                <DropdownButton
                                  size="sm"
                                  variant="success"
                                  title={<><i className="bi bi-cash-coin me-1" />Cobrar</>}
                                  className="d-inline-block me-2"
                                >
                                  <Dropdown.Item onClick={() => handleCobrarRapido(p, "EFECTIVO")}>
                                    <i className="bi bi-cash me-2 text-success" />Efectivo
                                  </Dropdown.Item>
                                  <Dropdown.Item onClick={() => handleCobrarRapido(p, "QR")}>
                                    <i className="bi bi-qr-code me-2 text-primary" />QR
                                  </Dropdown.Item>
                                </DropdownButton>
                              )}
                              <IconButton
                                icon="bi-eye"
                                variant="outline-secondary"
                                className="me-1"
                                title="Ver"
                                onClick={() => abrirModalVer(p)}
                              />
                              <IconButton
                                icon="bi-pencil-square"
                                variant="outline-primary"
                                className="me-1 btn-edit-pedido"
                                title="Editar"
                                onClick={() => abrirModalEditar(p)}
                              />
                              <IconButton
                                icon="bi-trash"
                                variant="outline-danger"
                                className="btn-delete-pedido"
                                title="Eliminar"
                                onClick={() => handleEliminarPedido(p)}
                                disabled={p.estado_pago === "PAGADO"}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                      <small className="text-muted">
                        Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalPedidos)} de {totalPedidos} pedidos
                      </small>
                      <Pagination size="sm" className="mb-0">
                        <Pagination.First onClick={() => { setCurrentPage(1); loadData(1, filtros); }} disabled={currentPage === 1} />
                        <Pagination.Prev onClick={() => { const p = currentPage - 1; setCurrentPage(p); loadData(p, filtros); }} disabled={currentPage === 1} />
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(n => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                          .reduce((acc, n, idx, arr) => {
                            if (idx > 0 && n - arr[idx - 1] > 1) acc.push("...");
                            acc.push(n);
                            return acc;
                          }, [])
                          .map((item, idx) =>
                            item === "..." ? (
                              <Pagination.Ellipsis key={`e-${idx}`} disabled />
                            ) : (
                              <Pagination.Item
                                key={item}
                                active={item === currentPage}
                                onClick={() => { setCurrentPage(item); loadData(item, filtros); }}
                              >
                                {item}
                              </Pagination.Item>
                            )
                          )}
                        <Pagination.Next onClick={() => { const p = currentPage + 1; setCurrentPage(p); loadData(p, filtros); }} disabled={currentPage === totalPages} />
                        <Pagination.Last onClick={() => { setCurrentPage(totalPages); loadData(totalPages, filtros); }} disabled={currentPage === totalPages} />
                      </Pagination>
                    </div>
                  )}
                </>
              );
            })()}
          </Card.Body>
        </Card>
      )}

      {/* MODAL EDITAR */}
      <Modal show={modalEditar.open} onHide={cerrarModal} centered size="xl" backdrop="static">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="text-success fw-bold modal-title-edit">
            <i className="bi bi-pencil-square me-2"></i>
            Editar Pedido #{modalEditar.pedido?.num_pedido}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "75vh", overflowY: "auto" }}>
          {modalEditar.loading ? (
            <div className="py-5 text-center">
              <Spinner animation="border" />
            </div>
          ) : modalEditar.pedido ? (
            <>
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Tipo de Pedido</Form.Label>
                    <Form.Select
                      value={modalEditar.pedido.tipo_pedido}
                      onChange={(e) =>
                        setModalEditar((prev) => ({
                          ...prev,
                          pedido: { ...prev.pedido, tipo_pedido: e.target.value },
                        }))
                      }
                    >
                      <option value="MESA">Mesa</option>
                      <option value="LLEVAR">Llevar</option>
                      <option value="MIXTO">Mixto</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Estado de Pago</Form.Label>
                    <Form.Select
                      value={modalEditar.pedido.estado_pago}
                      onChange={(e) =>
                        setModalEditar((prev) => ({
                          ...prev,
                          pedido: {
                            ...prev.pedido,
                            estado_pago: e.target.value,
                            metodo_pago:
                              e.target.value === "PAGADO"
                                ? prev.pedido.metodo_pago || "EFECTIVO"
                                : null,
                          },
                        }))
                      }
                    >
                      <option value="SIN_PAGAR">Sin pagar</option>
                      <option value="PAGADO">Pagado</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Método de Pago</Form.Label>
                    <Form.Select
                      value={modalEditar.pedido.metodo_pago || ""}
                      onChange={(e) =>
                        setModalEditar((prev) => ({
                          ...prev,
                          pedido: { ...prev.pedido, metodo_pago: e.target.value },
                        }))
                      }
                      disabled={modalEditar.pedido.estado_pago !== "PAGADO"}
                    >
                      <option value="">-</option>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="QR">QR</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* Ambiente / Mesa / Nombre cliente */}
              <Row className="mb-3">
                {(modalEditar.pedido.tipo_pedido === 'MESA' || modalEditar.pedido.tipo_pedido === 'MIXTO') && (
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Ambiente</Form.Label>
                      <Form.Select
                        value={modalEditar.pedido.ambiente ?? "PATIO"}
                        onChange={(e) =>
                          setModalEditar((prev) => ({
                            ...prev,
                            pedido: {
                              ...prev.pedido,
                              ambiente: e.target.value,
                              // Limpiar campos dependientes al cambiar de ambiente
                              num_mesa: e.target.value === "OFICINA" ? "" : prev.pedido.num_mesa,
                              nombre_cliente: e.target.value === "PATIO" ? "" : prev.pedido.nombre_cliente,
                            },
                          }))
                        }
                      >
                        <option value="PATIO">Patio</option>
                        <option value="OFICINA">Oficina</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                )}
                {(modalEditar.pedido.tipo_pedido === 'MESA' || modalEditar.pedido.tipo_pedido === 'MIXTO') &&
                  (modalEditar.pedido.ambiente ?? "PATIO") !== "OFICINA" && (
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Número de Mesa</Form.Label>
                        <Form.Select
                          value={modalEditar.pedido.num_mesa ?? ""}
                          onChange={(e) =>
                            setModalEditar((prev) => ({
                              ...prev,
                              pedido: { ...prev.pedido, num_mesa: e.target.value },
                            }))
                          }
                        >
                          <option value="">-</option>
                          {[1,2,3,4,5,6,7,8].map((n) => (
                            <option key={n} value={n}>Mesa {n}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  )}
                {(modalEditar.pedido.tipo_pedido === 'LLEVAR' ||
                  ((modalEditar.pedido.tipo_pedido === 'MESA' || modalEditar.pedido.tipo_pedido === 'MIXTO') && modalEditar.pedido.ambiente === "OFICINA")) && (
                    <Col md={4} >
                      <Form.Group>
                        <Form.Label>Nombre Cliente</Form.Label>
                        <Form.Control
                          type="text"
                          value={modalEditar.pedido.nombre_cliente ?? ""}
                          onChange={(e) =>
                            setModalEditar((prev) => ({
                              ...prev,
                              pedido: { ...prev.pedido, nombre_cliente: e.target.value },
                            }))
                          }
                        />
                      </Form.Group>
                    </Col>
                  )}
              </Row>
              
              <div className="mb-3">
                <div className="fw-bold text-success">
                  <i className="bi bi-cash-coin me-1"></i>
                  Total provisional: {calcularTotalModal(modalEditar.pedido).toFixed(2)} Bs
                </div>
              </div>

              <div className="d-flex justify-content-end mb-3">
                <Button variant="outline-primary" onClick={irAlMenuParaAnadir}>
                  <i className="bi bi-bag-plus me-1" />
                  Ir al menú para añadir
                </Button>
              </div>

              {/* Platos */}
              <h6 className="fw-bold text-secondary mt-3">
                <i className="bi bi-egg-fried me-1"></i> Platos
              </h6>
              {modalEditar.pedido.items
                .filter((i) => i.producto?.tipo === "PLATO")
                .map((item) => renderItemRow(modalEditar.pedido, item))}

              {/* Bebidas */}
              <h6 className="fw-bold text-secondary mt-3">
                <i className="bi bi-cup-straw me-1"></i> Bebidas
              </h6>
              {modalEditar.pedido.items
                .filter((i) => i.producto?.tipo === "BEBIDA")
                .map((item) => renderItemRow(modalEditar.pedido, item))}

              {/* Extras */}
              {modalEditar.pedido.items.some((i) => i.producto?.tipo === "EXTRA") && (
                <>
                  <h6 className="fw-bold text-secondary mt-3">
                    <i className="bi bi-plus-circle me-1"></i> Extras
                  </h6>
                  {modalEditar.pedido.items
                    .filter((i) => i.producto?.tipo === "EXTRA")
                    .map((item) => renderItemRow(modalEditar.pedido, item))}
                </>
              )}
            </>
          ) : (
            <p className="text-center text-muted">
              <i className="bi bi-hourglass-split me-1"></i> Cargando pedido...
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={handleGuardarEdicion}>
            <i className="bi bi-save2 me-2"></i>Guardar cambios
          </Button>
          <Button variant="danger" onClick={cerrarModal}>
            <i className="bi bi-x-circle me-2"></i>Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
      {/* MODAL VER RESUMEN */}
  <Modal show={modalVer.open} onHide={cerrarModalVer} centered size="lg" backdrop="static">
    <Modal.Header closeButton className="bg-light">
      <Modal.Title className="text-secondary fw-bold">
        <i className="bi bi-eye me-2"></i>
        Resumen Pedido #{modalVer.pedido?.num_pedido}
      </Modal.Title>
    </Modal.Header>
    <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
      {modalVer.loading ? (
        <div className="py-5 text-center"><Spinner animation="border" /></div>
      ) : modalVer.pedido ? (
        <>
          <Row className="mb-3">
            <Col md={4}><strong>Tipo:</strong> {modalVer.pedido.tipo_pedido}</Col>
            <Col md={4}>
              {modalVer.pedido.ambiente === "OFICINA" ? (
                <><strong>Ambiente:</strong> Oficina</>
              ) : (
                <><strong>Mesa:</strong> {modalVer.pedido.num_mesa ?? "-"}</>
              )}
            </Col>
            <Col md={4}>
              <strong>Pago:</strong>{" "}
              <Badge bg={modalVer.pedido.estado_pago === "PAGADO" ? "success" : "danger"}>
                {modalVer.pedido.estado_pago}
              </Badge>
            </Col>
          </Row>
          {(modalVer.pedido.ambiente === "OFICINA" || modalVer.pedido.tipo_pedido === "LLEVAR") && (
            <Row className="mb-3">
              <Col md={8}><strong>Cliente:</strong> {modalVer.pedido.nombre_cliente ?? "-"}</Col>
            </Row>
          )}
          <Row className="mb-3">
            <Col md={4}><strong>Método:</strong> {modalVer.pedido.metodo_pago ?? "-"}</Col>
            <Col md={8}><strong>Estado pedido:</strong> {modalVer.pedido.estado_pedido}</Col>
          </Row>
 
          <div className="table-responsive">
            <Table hover size="sm" className="align-middle">
              <thead>
                <tr>
                  <th className="text-end">Cant.</th>
                  <th>Producto</th>
                  <th>Destino</th>
                 
                  <th className="text-end">P. Unit</th>
                  <th className="text-end">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {modalVer.pedido.items.map((it, idx) => (
                  <tr key={it.id_detalle ?? `${it.id_producto}-${idx}`}>
                    <td className="text-end">{Number(it.cantidad).toFixed(0)}</td>

                    <td>
                     <div className="fw-semibold">{it.nombre}</div>
                      {it.notas ? <div className="small text-muted">Notas: {it.notas}</div> : null}
                    </td>
                    <td>{it.destino ?? (modalVer.pedido.tipo_pedido === "LLEVAR" ? "LLEVAR" : "MESA")}</td>
                    <td className="text-end">{Number(it.precio_unitario).toFixed(2)} Bs</td>
                    <td className="text-end">
                      {(Number(it.precio_unitario) * Number(it.cantidad)).toFixed(2)} Bs
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
 
          <div className="text-end mt-3">
            <h5 className="text-success fw-bold">
              Total:{" "}
              {(
                modalVer.pedido.items.reduce(
                  (acc, it) => acc + Number(it.precio_unitario) * Number(it.cantidad),
                  0
                ) || 0
              ).toFixed(2)}{" "}
              Bs
            </h5>
          </div>
        </>
      ) : (
        <p className="text-center text-muted">No hay datos del pedido.</p>
      )}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={cerrarModalVer}>
        <i className="bi bi-x-circle me-2"></i>Cerrar
      </Button>
    </Modal.Footer>
  </Modal>

    </Container>
  );
}
