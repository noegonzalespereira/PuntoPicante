import React, { useEffect, useState, useMemo } from "react";
import {
  Container, Row, Col, Card, Button, Table, Modal, Form, Badge, Spinner, Alert
} from "react-bootstrap";
import Swal from "sweetalert2";
// Servicios
import { pedidoService } from "../../services/pedidosService";
import { productoService } from "../../services/productoService";
import { cajaService } from "../../services/cajaService";
import { stockService } from "../../services/stockService";
import "../../styles/PedidosPage.css";
import {
  BsPlusCircle, BsListCheck
} from "react-icons/bs";

/** Fecha La Paz YYYY-MM-DD */
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
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [stockDisponible, setStockDisponible] = useState({ platos: [], bebidas: [], extras: [] });
  const [appendContext, setAppendContext] = useState(null);
  const [modalEditar, setModalEditar] = useState({ open: false, loading: false, pedido: null });

  const [pedidoActual, setPedidoActual] = useState({
    tipo_pedido: "MESA",
    num_mesa: "",
    estado_pago: "SIN_PAGAR",
    metodo_pago: null,
    items: [],
  });

  
  const esMesaRequerida = (tipo) => tipo === "MESA" || tipo === "MIXTO";
  const mesaValida = (n) => Number.isInteger(n) && n >= 1 && n <= 9;

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

  async function loadData() {
    try {
      setLoading(true);
      const cajaData = await cajaService.getCajaAbierta();
      setCajaAbierta(cajaData || null);

      const prodData = await productoService.getAll({ activo: 1 });
      setProductos(prodData.data ?? prodData ?? []);

      const data = await pedidoService.getAll();
      setPedidos(data.data || []);

      await cargarStockDelDia();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

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
      Swal.fire("⚠️", "Debe abrir una caja primero", "warning");
      return false;
    }
    if (pedidoActual.items.length === 0) {
      Swal.fire("⚠️", "Agregue al menos un producto", "warning");
      return false;
    }
    if (!appendContext && esMesaRequerida(pedidoActual.tipo_pedido)) {
      const nMesa = Number(pedidoActual.num_mesa);
      if (!mesaValida(nMesa)) {
        Swal.fire("⚠️", "Número de mesa inválido (1–9)", "warning");
        return false;
      }
    }
    if (!appendContext && pedidoActual.estado_pago === "PAGADO" && !pedidoActual.metodo_pago) {
      Swal.fire("⚠️", "Seleccione el método de pago (EFECTIVO/QR)", "warning");
      return false;
    }
    if (pedidoActual.tipo_pedido === "MIXTO") {
      const sinDestino = pedidoActual.items.find((i) => !i.destino);
      if (sinDestino) {
        Swal.fire("⚠️", "Cada ítem debe tener destino (MESA o LLEVAR)", "warning");
        return false;
      }
    }
    return true;
  }

  async function handleConfirmPedidoActual() {
    if (!validarAntesDeEnviar()) return;

    const payload = {
      id_caja: cajaAbierta?.id_caja,
      tipo_pedido: pedidoActual.tipo_pedido,
      num_mesa: esMesaRequerida(pedidoActual.tipo_pedido) ? Number(pedidoActual.num_mesa) : null,
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

    if (appendContext) {
      try {
        await pedidoService.addItems(appendContext.id_pedido, payload.items);
        await cargarStockDelDia();
        Swal.fire("", `${payload.items.length} ítem(s) añadidos al pedido #${appendContext.num_pedido}`, "success");
        setPedidoActual({
          tipo_pedido: "MESA",
          num_mesa: "",
          estado_pago: "SIN_PAGAR",
          metodo_pago: null,
          items: [],
        });
        setAppendContext(null);
        setActiveTab("listado");
        loadData();
      } catch (err) {
        Swal.fire("Error", getAxiosMessage(err), "error");
      }
    } else {
      try {
        const res = await pedidoService.create(payload);
        await cargarStockDelDia();
        Swal.fire("", `Pedido #${res.num_pedido} creado correctamente`, "success");
        setPedidoActual({
          tipo_pedido: "MESA",
          num_mesa: "",
          estado_pago: "SIN_PAGAR",
          metodo_pago: null,
          items: [],
        });
        setActiveTab("listado");
        loadData();
      } catch (err) {
        Swal.fire("Error", getAxiosMessage(err), "error");
      }
    }
  }

  
  async function abrirModalEditar(pResumen) {
    if (pResumen.estado_pago === "PAGADO") return; 
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
            estado_item: d.estado_item || 'PENDIENTE',
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
      Swal.fire("", "No se pudo cargar el pedido", "error");
      setModalEditar({ open: false, loading: false, pedido: null });
    }
  }

  const handleGuardarEdicion = async () => {
    const p = modalEditar.pedido;
    if (!p) return;

    const quierePagar = p.estado_pago === "PAGADO" && p.estado_pago_original !== "PAGADO";
    if (quierePagar && !p.metodo_pago) {
      Swal.fire("Falta método de pago", "Selecciona EFECTIVO o QR.", "warning");
      return;
    }

    try {
      setModalEditar((prev) => ({ ...prev, loading: true }));

      const payloadUpdate = {};
      if (p.tipo_pedido) payloadUpdate.tipo_pedido = p.tipo_pedido;
      if (p.tipo_pedido === "MESA" || p.tipo_pedido === "MIXTO") {
        payloadUpdate.num_mesa = Number(p.num_mesa ?? 1);
      }
      await pedidoService.update(p.id_pedido, payloadUpdate);

      const original = p.originalItems || [];
      const edited = p.items || [];

      const byId = (arr) =>
        new Map(arr.filter((i) => i.id_detalle).map((i) => [i.id_detalle, i]));
      const origById = byId(original);
      const editById = byId(edited);

      for (const [id_detalle, itNow] of editById) {
        const itOld = origById.get(id_detalle);
        if (!itOld) continue;
        const patch = {};
        let needssUpdate=false;
        if (+itNow.cantidad !== +itOld.cantidad) {patch.cantidad = +itNow.cantidad;needssUpdate=true;}
        if ((itNow.notas ?? "") !== (itOld.notas ?? "")) patch.notas = itNow.notas || null;needssUpdate=true;
        if ((itNow.destino ?? "") !== (itOld.destino ?? "")) {
            patch.destino = itNow.destino || "MESA";
            needsUpdate = true;
        } else if (p.tipo_pedido === "MIXTO") {
            patch.destino = itNow.destino || "MESA";
        }
        if (itNow.estado_item) {
             patch.estado_item = itNow.estado_item;
        }
        if (needsUpdate || (p.tipo_pedido === "MIXTO" && patch.destino !== undefined)) { // Si hubo algún cambio o requerimos destino
            await pedidoService.updateItem(p.id_pedido, id_detalle, patch); // LLAMA AL PATCH
        }

        if (p.tipo_pedido === "MIXTO" && (itNow.destino ?? "") !== (itOld.destino ?? "")) {
          patch.destino = itNow.destino || "MESA";
        }
        if (Object.keys(patch).length) {
          await pedidoService.updateItem(p.id_pedido, id_detalle, patch);
        }
      }

      for (const old of original) {
        if (old.id_detalle && !editById.has(old.id_detalle)) {
          await pedidoService.deleteItem(p.id_pedido, old.id_detalle);
        }
      }

      const nuevos = edited
        .filter((i) => !i.id_detalle)
        .map((i) => ({
          id_producto: i.id_producto,
          cantidad: Number(i.cantidad),
          notas: i.notas || null,
          destino:
            p.tipo_pedido === "MIXTO"
              ? i.destino || "MESA"
              : p.tipo_pedido === "LLEVAR"
              ? "LLEVAR"
              : "MESA",
        }));
      if (nuevos.length) await pedidoService.addItems(p.id_pedido, nuevos);

      // 3) Pago ahora (endpoint dedicado)
      if (quierePagar) {
        await pedidoService.updatePagoEstado(p.id_pedido, p.metodo_pago);
      }

      Swal.fire(
        "Listo",
        quierePagar
          ? `Pedido #${p.num_pedido} actualizado y marcado como PAGADO.`
          : `Pedido #${p.num_pedido} actualizado.`,
        "success"
      );

      setModalEditar({ open: false, loading: false, pedido: null });
      await cargarStockDelDia();
      await loadData();
    } catch (err) {
      console.error("Editar/pagar pedido ->", err?.response?.data || err);
      setModalEditar((prev) => ({ ...prev, loading: false }));
      Swal.fire("Error", getAxiosMessage(err), "error");
    }
  };

  const calcularTotalModal = (p) =>
    p?.items?.reduce(
      (acc, it) => acc + Number(it.precio_unitario ?? 0) * Number(it.cantidad ?? 0),
      0
    ) || 0;

  const cerrarModal = () => setModalEditar({ open: false, loading: false, pedido: null });

  // *** CORREGIDO: sincroniza tipo_pedido y num_mesa al ir a “Añadir al pedido”
  const irAlMenuParaAnadir = () => {
    const p = modalEditar.pedido;
    if (!p) return;

    // 1) Estado del carrito con los datos reales del pedido
    setPedidoActual({
      tipo_pedido: p.tipo_pedido,
      num_mesa: p.num_mesa ?? "",
      estado_pago: "SIN_PAGAR",
      metodo_pago: null,
      items: [],
    });

    // 2) Contexto extendido (útil para mensajes)
    setAppendContext({
      id_pedido: p.id_pedido,
      num_pedido: p.num_pedido,
      tipo_pedido: p.tipo_pedido,
      num_mesa: p.num_mesa ?? null,
    });

    setActiveTab("nuevo");
    setModalEditar({ open: false, loading: false, pedido: null });
    Swal.fire("", `Ahora estás añadiendo productos al pedido #${p.num_pedido}.`, "info");
  };

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
      Swal.fire("", "Pedido eliminado", "success");
      await cargarStockDelDia();
      await loadData();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", getAxiosMessage(err), "error");
    }
  }

  const renderItemRow = (pedidoRef, item, index) => (
    <Row
      key={`${item.id_producto}-${index}`}
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
                items: prev.pedido.items.map((i, idx) =>
                  idx === index ? { ...i, notas: e.target.value } : i
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
                  items: prev.pedido.items.map((i, idx) =>
                    idx === index ? { ...i, destino: e.target.value } : i
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
                items: prev.pedido.items.map((i, idx) =>
                  idx === index ? { ...i, cantidad: Math.max(1, Number(i.cantidad) - 1) } : i
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
          onClick={() =>
            setModalEditar((prev) => ({
              ...prev,
              pedido: {
                ...prev.pedido,
                items: prev.pedido.items.map((i, idx) =>
                  idx === index ? { ...i, cantidad: Number(i.cantidad) + 1 } : i
                ),
              },
            }))
          }
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
                items: prev.pedido.items.filter((_, idx) => idx !== index),
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
      <div className="modulo-header-pedidos mb-4">
        <div className="header-content">
          <h1 className="page-title-pedidos">Gestión de Pedidos</h1>
          <p className="page-subtitle-pedidos">Toma de órdenes y gestión de ventas</p>
          {cajaAbierta && (
            <Badge bg="success" className="fs-6 px-3 py-2 header-badge-caja">
              <i className="bi bi-cash-stack me-1" />
              Caja: ABIERTA
            </Badge>
          )}
        </div>
      </div>

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
                <i className="bi bi-egg-fried me-2"></i>Menú y Productos
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
                {/* Controles */}
                <Form.Group className="mb-3">
                  <Form.Label>Tipo de Pedido</Form.Label>
                  <Form.Select
                    value={pedidoActual.tipo_pedido}
                    onChange={(e) =>
                      setPedidoActual((prev) => ({
                        ...prev,
                        tipo_pedido: e.target.value,
                        num_mesa: e.target.value === "LLEVAR" ? "" : prev.num_mesa,
                        items: prev.items.map((it) => ({
                          ...it,
                          destino: e.target.value === "LLEVAR" ? "LLEVAR" : "MESA",
                        })),
                      }))
                    }
                    disabled={!!appendContext}
                  >
                    <option value="MESA">Mesa</option>
                    <option value="LLEVAR">Para Llevar</option>
                    <option value="MIXTO">Mixto</option>
                  </Form.Select>
                </Form.Group>

                {/* *** CORREGIDO: mostrar número de mesa también en append (bloqueado) */}
                {esMesaRequerida(pedidoActual.tipo_pedido) && (
                  <Form.Group className="mb-3">
                    <Form.Label>Número de Mesa</Form.Label>
                    <Form.Control
                      type="number"
                      placeholder="1 a 9"
                      value={pedidoActual.num_mesa}
                      onChange={(e) =>
                        setPedidoActual((prev) => ({ ...prev, num_mesa: e.target.value }))
                      }
                      disabled={!!appendContext}
                    />
                    {appendContext && (
                      <Form.Text className="text-muted">
                        Usando la mesa del pedido #{appendContext.num_pedido}.
                      </Form.Text>
                    )}
                  </Form.Group>
                )}

                {!appendContext && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Estado del Pago</Form.Label>
                      <Form.Select
                        value={pedidoActual.estado_pago}
                        onChange={(e) =>
                          setPedidoActual((prev) => ({
                            ...prev,
                            estado_pago: e.target.value,
                            metodo_pago: e.target.value === "PAGADO" ? "EFECTIVO" : null,
                          }))
                        }
                      >
                        <option value="SIN_PAGAR">Sin pagar</option>
                        <option value="PAGADO">Pagado</option>
                      </Form.Select>
                    </Form.Group>

                    {pedidoActual.estado_pago === "PAGADO" && (
                      <Form.Group className="mb-3">
                        <Form.Label>Método de Pago</Form.Label>
                        <Form.Select
                          value={pedidoActual.metodo_pago ?? ""}
                          onChange={(e) =>
                            setPedidoActual((prev) => ({ ...prev, metodo_pago: e.target.value }))
                          }
                        >
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="QR">QR</option>
                        </Form.Select>
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
                                setPedidoActual((prev) => ({
                                  ...prev,
                                  items: prev.items.map((i) =>
                                    i.id_producto === item.id_producto
                                      ? { ...i, cantidad: i.cantidad + 1 }
                                      : i
                                  ),
                                }))
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

                        {(item.notas || pedidoActual.tipo_pedido === "MIXTO") && (
                          <div className="d-flex justify-content-between align-items-center mt-2 small">
                            <span className="text-muted">
                              {item.notas && `Notas: ${item.notas}`}
                            </span>
                            {pedidoActual.tipo_pedido === "MIXTO" && (
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
                            )}
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
                        disabled={!cajaAbierta}
                      >
                        <i className="bi bi-check2-circle me-2"></i>
                        {appendContext ? "Añadir al pedido" : "Crear Pedido"}
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
            {!pedidos.length ? (
              <p className="text-center text-muted my-4">
                <i className="bi bi-inbox me-2"></i>No hay pedidos registrados
              </p>
            ) : (
              <div className="table-responsive">
                <Table responsive hover className="align-middle table-pedidos-listado">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tipo</th>
                      <th>Mesa</th>
                      <th>Total</th>
                      <th>Estado Pedido</th>
                      <th>Pago</th>
                      <th>Método</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr key={p.id_pedido}>
                        <td className="fw-bold">{p.num_pedido}</td>
                        <td>{p.tipo_pedido}</td>
                        <td>{p.num_mesa ?? "-"}</td>
                        <td className="fw-bold">{Number(p.total).toFixed(2)} Bs</td>
                        <td>
                          <Badge
                            bg={p.estado_pedido === "PENDIENTE" ? "warning" : "success"}
                          >
                            {p.estado_pedido}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={p.estado_pago === "PAGADO" ? "success" : "danger"}>
                            {p.estado_pago}
                          </Badge>
                        </td>
                        <td>{p.metodo_pago ?? "-"}</td>
                        <td className="text-nowrap">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-2 btn-edit-pedido"
                            onClick={() => abrirModalEditar(p)}
                            disabled={p.estado_pago === "PAGADO"}  // no editar pedidos pagados
                          >
                            <i className="bi bi-pencil-square"></i>
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleEliminarPedido(p)}
                            disabled={p.estado_pago === "PAGADO"}
                            className="btn-delete-pedido"
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
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
                      disabled={modalEditar.pedido.estado_pago_original === "PAGADO"}
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
                      disabled={modalEditar.pedido.estado_pago_original === "PAGADO"}
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
                      disabled={
                        modalEditar.pedido.estado_pago !== "PAGADO" ||
                        modalEditar.pedido.estado_pago_original === "PAGADO"
                      }
                    >
                      <option value="">-</option>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="QR">QR</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* *** NUEVO: editar mesa cuando aplica */}
              {modalEditar.pedido.tipo_pedido !== "LLEVAR" && (
                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Número de Mesa</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        max={9}
                        value={modalEditar.pedido.num_mesa ?? ""}
                        onChange={(e) =>
                          setModalEditar((prev) => ({
                            ...prev,
                            pedido: { ...prev.pedido, num_mesa: e.target.value },
                          }))
                        }
                        disabled={modalEditar.pedido.estado_pago_original === "PAGADO"}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              )}

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
                .map((item, idx) => renderItemRow(modalEditar.pedido, item, idx))}

              {/* Bebidas */}
              <h6 className="fw-bold text-secondary mt-3">
                <i className="bi bi-cup-straw me-1"></i> Bebidas
              </h6>
              {modalEditar.pedido.items
                .filter((i) => i.producto?.tipo === "BEBIDA")
                .map((item, idx) => renderItemRow(modalEditar.pedido, item, idx))}
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
    </Container>
  );
}
