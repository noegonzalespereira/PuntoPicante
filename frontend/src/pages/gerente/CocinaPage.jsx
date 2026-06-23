import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Container, Row, Col, Card, Spinner, Badge, Alert } from 'react-bootstrap';
import { toast } from 'sonner';
import { cocinaService } from '../../services/cocinaService';
import { cajaService } from '../../services/cajaService';
import { socketService } from '../../services/socketService';
import '../../styles/CocinaPage.css';
import { BsClipboardCheck, BsCheckLg, BsEye } from 'react-icons/bs';
import PageHeader from "../../components/molecules/PageHeader";

function playBeep(ctx) {
  if (!ctx || ctx.state !== 'running') return;
  [[880, 0], [660, 0.18]].forEach(([freq, start]) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.18);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + 0.18);
  });
}

const CocinaPage = () => {
  const [caja, setCaja] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [resumen, setResumen] = useState({ pendientes: 0, listos: 0 });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('PENDIENTE');
  const pollingRef     = useRef(null);
  const prevPendientes = useRef(null);
  const audioCtxRef    = useRef(null); // AudioContext reutilizable

  const cargarCajaYDatos = useCallback(async () => {
    try {
      setLoading(true);

      // 1) Caja abierta (si no hay, limpiamos datos)
      const cajaAbierta = await cajaService.getCajaAbierta().catch(() => null);
      setCaja(cajaAbierta ?? null);

      if (!cajaAbierta) {
        setPedidos([]);
        setResumen({ pendientes: 0, listos: 0 });
        prevPendientes.current = null;
        return;
      }

      const id_caja = cajaAbierta.id_caja;

      const data =
        tab === 'PENDIENTE'
          ? await cocinaService.getPendientes({ id_caja })
          : await cocinaService.getListos({ id_caja });

      setPedidos(Array.isArray(data) ? data : []);

      const r = await cocinaService.getResumen({ id_caja }).catch(() => ({ pendientes: 0, listos: 0 }));
      const nuevoPendientes = Number(r?.pendientes ?? 0);

      if (prevPendientes.current !== null && nuevoPendientes > prevPendientes.current) {
        playBeep(audioCtxRef.current);
        toast.info(`🍳 Nuevo pedido en cocina (${nuevoPendientes} pendientes)`, { duration: 4000 });
      }
      prevPendientes.current = nuevoPendientes;

      setResumen({
        pendientes: nuevoPendientes,
        listos: Number(r?.listos ?? 0),
      });
    } catch (error) {
      console.error('Error al cargar datos de cocina:', error);
      toast.error('No se pudo cargar la información de cocina');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const marcarItemComoListo = async (id_pedido, id_detalle_pedido) => {
    // Actualización optimista: cambia el estado local sin spinner
    setPedidos(prev => prev.map(p => {
      if (p.id_pedido !== id_pedido) return p;
      const newItems = (p.items ?? []).map(it =>
        it.id_detalle_pedido === id_detalle_pedido ? { ...it, estado_item: 'LISTO' } : it
      );
      const allListo = newItems.every(it => it.estado_item === 'LISTO');
      return { ...p, items: newItems, estado_pedido: allListo ? 'LISTO' : p.estado_pedido };
    }));

    // Si este era el último ítem pendiente del pedido, actualiza el resumen
    const pedido = pedidos.find(p => p.id_pedido === id_pedido);
    if (pedido) {
      const otrosPendientes = (pedido.items ?? []).filter(
        it => it.id_detalle_pedido !== id_detalle_pedido && it.estado_item === 'PENDIENTE'
      );
      const estabaListoElItem = (pedido.items ?? []).find(it => it.id_detalle_pedido === id_detalle_pedido)?.estado_item === 'PENDIENTE';
      if (estabaListoElItem && otrosPendientes.length === 0 && pedido.estado_pedido === 'PENDIENTE') {
        setResumen(r => ({ pendientes: Math.max(0, r.pendientes - 1), listos: r.listos + 1 }));
      }
    }

    try {
      await cocinaService.marcarItemDespachado(id_pedido, id_detalle_pedido);
    } catch (error) {
      console.error('Error al marcar el plato como listo:', error);
      toast.error('No se pudo marcar el plato como listo');
      cargarCajaYDatos(); // revertir si falla
    }
  };

  // Inicializa (o desbloquea) el AudioContext en el primer gesto del usuario.
  // Los navegadores solo permiten audio después de una interacción humana.
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    document.addEventListener('click',      unlock);
    document.addEventListener('touchstart', unlock);
    return () => {
      document.removeEventListener('click',      unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Polling de respaldo cada 30 s
  useEffect(() => {
    cargarCajaYDatos();
    pollingRef.current = setInterval(() => {
      cargarCajaYDatos();
    }, 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [cargarCajaYDatos]);

  // WebSockets — actualización en tiempo real
  useEffect(() => {
    const socket = socketService.connect();

    socket.on('pedido:nuevo',       () => cargarCajaYDatos());
    socket.on('pedido:actualizado', () => cargarCajaYDatos());
    socket.on('item:listo', ({ id_pedido, id_detalle }) => {
      // Actualización optimista: evitar esperar al polling
      setPedidos(prev => prev.map(p => {
        if (p.id_pedido !== id_pedido) return p;
        const newItems = (p.items ?? []).map(it =>
          it.id_detalle_pedido === id_detalle ? { ...it, estado_item: 'LISTO' } : it
        );
        const allListo = newItems.every(it => it.estado_item === 'LISTO');
        return { ...p, items: newItems, estado_pedido: allListo ? 'LISTO' : p.estado_pedido };
      }));
    });
    socket.on('pedido:entregado', () => cargarCajaYDatos());

    return () => {
      socket.off('pedido:nuevo');
      socket.off('pedido:actualizado');
      socket.off('item:listo');
      socket.off('pedido:entregado');
    };
  }, [cargarCajaYDatos]);

  // Ítems pendientes dentro de un pedido (con botón "Listo") — solo PLATOS
  const renderPedidoItemsPendientes = (items, pedido, id_pedido) => {
    const itemsPendientes = (items ?? []).filter(
      (it) => it.estado_item === 'PENDIENTE' && it.producto?.tipo === 'PLATO'
    );

    if (!itemsPendientes.length) {
      return (
        <div className="text-center p-3">
          <p className="text-success fw-bold">Todos los ítems están listos.</p>
        </div>
      );
    }

    return itemsPendientes.map((item, index) => (
      <div key={item.id_detalle_pedido} className="mb-3 item-detail">
        <div className="d-flex justify-content-between align-items-center">
          {/* Producto y Notas */}
          <div className="flex-grow-1">
            <strong className="text-marron d-block">{item.producto?.nombre ?? `#${item.id_producto}`}</strong>

            <div className="d-flex align-items-center mt-1">
              {item.destino === 'MESA' ? (
                pedido.ambiente === 'OFICINA' ? (
                  <Badge bg="primary" className="destino-badge me-2">Oficina</Badge>
                ) : (
                  <Badge bg="info" className="destino-badge me-2">Mesa {pedido.num_mesa}</Badge>
                )
              ) : (
                <Badge bg="secondary" className="destino-badge me-2">
                  {item.destino}
                </Badge>
              )}
              {item.notas && <small className="text-rojo fw-bold">Notas: {item.notas}</small>}
            </div>
          </div>

          {/* Cantidad y Botón de Listo */}
          <span className="text-verde fw-bold ms-3">{item.cantidad} x</span>

          <Button
            variant="success"
            size="sm"
            onClick={() => marcarItemComoListo(id_pedido, item.id_detalle_pedido)}
            className="ms-3 btn-marcar-individual"
            title={`Marcar ${item.producto?.nombre ?? ''} como Listo`}
          >
            <BsCheckLg />
          </Button>
        </div>

        {index < itemsPendientes.length - 1 && <hr className="my-2 dashed-divider" />}
      </div>
    ));
  };

  // Tarjetas de pedidos PENDIENTES
  const mostrarPedidosPendientes = () => {
    const pendientes = (pedidos ?? []).filter((p) =>
      p.estado_pedido === 'PENDIENTE' &&
      (p.items ?? []).some(
        it => it.producto?.tipo === 'PLATO' && it.estado_item === 'PENDIENTE'
      )
    );

    if (!pendientes.length) {
      return (
        <Col xs={12}>
          <p className="lead text-center p-5 text-verde">¡No hay pedidos pendientes!</p>
        </Col>
      );
    }

    return pendientes.map((pedido) => (
      <Col xs={12} sm={6} md={4} key={pedido.id_pedido} className="mb-4 d-flex align-items-stretch">
        <Card className="shadow-sm border-0 p-3 card-pedido-individual card-pendiente h-100">
          <Card.Body className="d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="card-title text-marron mb-0">
                {pedido.ambiente === 'OFICINA' ? 'Oficina' : `Mesa ${pedido.num_mesa}`}
              </h5>
              <span className="tag-pendiente">
                <BsEye className="me-1" /> Pendiente
              </span>
            </div>
            {pedido.ambiente === 'OFICINA' && (
              <div className="mb-1">
                <span className="fw-semibold text-primary">{pedido.nombre_cliente || '—'}</span>
              </div>
            )}

            <hr className="my-2" />

            {/* Ítems pendientes del pedido */}
            <div className="pedido-items-list flex-grow-1">
              {renderPedidoItemsPendientes(pedido.items, pedido, pedido.id_pedido)}
            </div>
          </Card.Body>
        </Card>
      </Col>
    ));
  };

  // Tarjetas de pedidos LISTOS (solo mostrar detalle; sin botón)
  const mostrarPedidosListos = () => {
    const listos = (pedidos ?? []).filter((p) => p.estado_pedido === 'LISTO');

    if (!listos.length) {
      return (
        <Col xs={12}>
          <p className="lead text-center p-5 text-success">No hay pedidos listos.</p>
        </Col>
      );
    }

    return listos.map((pedido) => {
      const platosDelPedido = (pedido.items ?? []).filter(
        it => it.producto?.tipo === 'PLATO'
      );
      return (
        <Col xs={12} sm={6} md={4} key={pedido.id_pedido} className="mb-4 d-flex align-items-stretch">
          <Card className="shadow-sm border-0 p-3 card-pedido-individual card-listo h-100">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title text-success mb-0">
                  {pedido.ambiente === 'OFICINA' ? 'Oficina' : `Mesa ${pedido.num_mesa}`}
                </h5>
                <span className="tag-listo">
                  <BsCheckLg className="me-1" /> Listo
                </span>
              </div>
              {pedido.ambiente === 'OFICINA' && (
                <div className="mb-1">
                  <span className="fw-semibold text-primary">{pedido.nombre_cliente || '—'}</span>
                </div>
              )}

              <hr className="my-2" />

              <div className="pedido-items-list flex-grow-1">
                {platosDelPedido.map((item, index) => (
                  <div key={item.id_detalle_pedido} className="mb-3 item-detail">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="flex-grow-1">
                        <strong className="d-block">{item.producto?.nombre ?? `#${item.id_producto}`}</strong>
                        <div className="d-flex align-items-center mt-1">
                          {item.destino === 'MESA' ? (
                            pedido.ambiente === 'OFICINA' ? (
                              <Badge bg="primary" className="destino-badge me-2">Oficina</Badge>
                            ) : (
                              <Badge bg="info" className="destino-badge me-2">Mesa {pedido.num_mesa}</Badge>
                            )
                          ) : (
                            <Badge bg="secondary" className="destino-badge me-2">
                              {item.destino}
                            </Badge>
                          )}
                          {item.notas && <small className="text-muted ms-2">Notas: {item.notas}</small>}
                        </div>
                      </div>
                      <span className="fw-bold">{item.cantidad} x</span>
                    </div>
                    {index < platosDelPedido.length - 1 && <hr className="my-2 dashed-divider" />}
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      );
    });
  };

  return (
    <Container fluid className="container-fluid-cocina pt-0">
      {/* HEADER */}
      <PageHeader title="Cocina" subtitle="Gestión y preparación de pedidos" />

      {/* ALERTA: Caja Cerrada */}
      {!caja && (
        <Row className="px-3">
          <Col>
            <Alert variant="danger" className="fw-semibold">
              No hay una caja abierta. Abre una caja para comenzar el día de venta.
            </Alert>
          </Col>
        </Row>
      )}

      {/* RESUMEN */}
      <Row className="mb-3 g-3 px-3">
        <Col xs={12} md={6} lg={4}>
          <Card className="shadow-sm rounded card-resumen card-pendiente-resumen h-100">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="text-marron">Pedidos Pendientes</h5>
                <h3 className="text-marron">{resumen.pendientes}</h3>
              </div>
              <BsClipboardCheck size={40} className="text-marron" />
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={6} lg={4}>
          <Card className="shadow-sm rounded card-resumen card-listo-resumen h-100">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="text-verde">Pedidos Listos</h5>
                <h3 className="text-verde">{resumen.listos}</h3>
              </div>
              <BsCheckLg size={40} className="text-verde" />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabs Pendientes | Listos */}
      <Row className="px-3 mb-2">
        <Col className="d-flex gap-2">
          <Button
            variant={tab === 'PENDIENTE' ? 'primary' : 'outline-primary'}
            onClick={() => setTab('PENDIENTE')}
            size="sm"
          >
            Pendientes ({resumen.pendientes})
          </Button>
          <Button
            variant={tab === 'LISTO' ? 'success' : 'outline-success'}
            onClick={() => setTab('LISTO')}
            size="sm"
          >
            Listos ({resumen.listos})
          </Button>
        </Col>
      </Row>

      <hr className="my-3 mx-3" />

      {/* LISTA segun TAB */}
      <Row className="mt-3 mb-5 px-3">
        <Col md={12}>
          <div className="d-flex justify-content-between align-items-end mb-4">
            <h3 className="text-marron fw-bold">
              {tab === 'PENDIENTE'
                ? `Pedidos en Preparación (${resumen.pendientes})`
                : `Pedidos Listos (${resumen.listos})`}
            </h3>
            <h6 className="text-muted fw-semibold">Actualización automática cada 30 segundos</h6>
          </div>

          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-marron">Cargando pedidos...</p>
            </div>
          ) : (
            <Row className="g-4">
              {tab === 'PENDIENTE' ? mostrarPedidosPendientes() : mostrarPedidosListos()}
            </Row>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default CocinaPage;
