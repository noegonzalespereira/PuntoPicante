import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Container, Row, Col, Card, Spinner, Badge, Alert } from 'react-bootstrap';
import { toast } from 'sonner';
import { meseroService } from '../../services/meseroService';
import { cajaService } from '../../services/cajaService';
import { socketService } from '../../services/socketService';
import { BsClipboardCheck, BsCheckLg, BsCheck2Circle } from 'react-icons/bs';
import '../../styles/CocinaPage.css';

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.15]].forEach(([freq, start]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.15);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.15);
    });
  } catch (_) {}
}

export default function PedidosMeseroPage() {
  const [caja, setCaja]         = useState(null);
  const [pedidos, setPedidos]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const pollingRef    = useRef(null);
  const prevTotal     = useRef(null);
  // IDs marcados como atendidos localmente; evita que re-fetches los traigan de vuelta
  const dismissedRef  = useRef(new Set());

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);

      const cajaAbierta = await cajaService.getCajaAbierta().catch(() => null);
      setCaja(cajaAbierta ?? null);

      if (!cajaAbierta) {
        setPedidos([]);
        dismissedRef.current.clear();
        prevTotal.current = null;
        return;
      }

      const data = await meseroService.getTodosActivos({ id_caja: cajaAbierta.id_caja });
      const lista = Array.isArray(data) ? data : [];
      const visibles = lista.filter(
        p => p.tipo_pedido !== 'LLEVAR'
          && p.estado_pedido !== 'ENTREGADO'
          && !dismissedRef.current.has(p.id_pedido)
      );
      setPedidos(visibles);

      // Limpiar dismissed que ya no están en la lista (el backend los eliminó)
      const idsActivos = new Set(lista.map(p => p.id_pedido));
      for (const id of dismissedRef.current) {
        if (!idsActivos.has(id)) dismissedRef.current.delete(id);
      }

      const total = visibles.length;
      if (prevTotal.current !== null && total > prevTotal.current) {
        playBeep();
        toast.info(`Nuevo pedido recibido (${total} en total)`, { duration: 4000 });
      }
      prevTotal.current = total;
    } catch (err) {
      console.error('Error mesero:', err);
      toast.error('No se pudo cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  async function marcarAtendido(id_pedido) {
    // Marcar inmediatamente como descartado para que re-fetches no lo traigan de vuelta
    dismissedRef.current.add(id_pedido);
    setPedidos(prev => prev.filter(p => p.id_pedido !== id_pedido));
    try {
      await meseroService.entregar(id_pedido);
      toast.success('Mesa atendida');
    } catch (_) {
      // El backend lo rechazó — revertir
      dismissedRef.current.delete(id_pedido);
      await cargarDatos();
      toast.error('No se pudo marcar como atendida');
    }
  }

  // Polling de respaldo cada 30 s
  useEffect(() => {
    cargarDatos();
    pollingRef.current = setInterval(cargarDatos, 30000);
    return () => clearInterval(pollingRef.current);
  }, [cargarDatos]);

  // WebSockets — actualización en tiempo real
  useEffect(() => {
    const socket = socketService.connect();

    socket.on('pedido:nuevo',        () => cargarDatos());
    socket.on('pedido:actualizado',  () => cargarDatos());
    socket.on('item:listo',          () => cargarDatos());
    socket.on('pedido:entregado', ({ id_pedido }) => {
      setPedidos(prev => prev.filter(p => p.id_pedido !== id_pedido));
    });

    return () => {
      socket.off('pedido:nuevo');
      socket.off('pedido:actualizado');
      socket.off('item:listo');
      socket.off('pedido:entregado');
    };
  }, [cargarDatos]);

  const pendientes = pedidos.filter(p => p.estado_pedido === 'PENDIENTE');
  const listos     = pedidos.filter(p => p.estado_pedido === 'LISTO');

  const renderTarjeta = (pedido) => (
    <Col xs={12} sm={6} md={4} key={pedido.id_pedido} className="mb-4 d-flex align-items-stretch">
      <Card
        className={`shadow-sm border-0 p-3 card-pedido-individual h-100 ${
          pedido.estado_pedido === 'LISTO' ? 'card-listo' : 'card-pendiente'
        }`}
      >
        <Card.Body className="d-flex flex-column">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className={`card-title mb-0 d-flex align-items-center gap-2 ${pedido.estado_pedido === 'LISTO' ? 'text-success' : 'text-marron'}`}>
              {pedido.ambiente === 'OFICINA' ? 'Oficina' : `Mesa ${pedido.num_mesa}`}
              <Badge bg="dark" style={{ fontSize: '0.7rem', fontWeight: 600 }}>#{pedido.num_pedido}</Badge>
            </h5>
            {pedido.estado_pedido === 'LISTO'
              ? <span className="tag-listo"><BsCheckLg className="me-1" /> Listo en cocina</span>
              : <span className="tag-pendiente">En preparación</span>
            }
          </div>

          {pedido.ambiente === 'OFICINA' && (
            <div className="mb-2">
              <span className="fw-semibold text-primary">{pedido.nombre_cliente || '—'}</span>
            </div>
          )}
          <hr className="my-2" />

          <div className="pedido-items-list flex-grow-1">
            {(pedido.items ?? []).map((item, idx) => (
              <div key={item.id_detalle_pedido}>
                <div className="d-flex justify-content-between align-items-center py-1">
                  <div>
                    <strong>{item.producto?.nombre ?? `#${item.id_producto}`}</strong>
                    <Badge
                      bg={item.producto?.tipo === 'PLATO' ? 'info' : item.producto?.tipo === 'BEBIDA' ? 'primary' : 'warning'}
                      text={item.producto?.tipo === 'EXTRA' ? 'dark' : undefined}
                      className="ms-2"
                      style={{ fontSize: '0.65rem' }}
                    >
                      {item.producto?.tipo}
                    </Badge>
                    {item.notas && <div><small className="text-danger">Notas: {item.notas}</small></div>}
                  </div>
                  <span className="fw-bold text-muted">{item.cantidad}x</span>
                </div>
                {idx < (pedido.items?.length ?? 1) - 1 && <hr className="my-1 dashed-divider" />}
              </div>
            ))}
          </div>

          <Button
            variant={pedido.estado_pedido === 'LISTO' ? 'success' : 'outline-secondary'}
            className="mt-3 w-100 fw-semibold"
            onClick={() => marcarAtendido(pedido.id_pedido)}
          >
            <BsCheck2Circle className="me-2" />
            {pedido.estado_pedido === 'LISTO' ? 'Entregar y marcar atendido' : 'Marcar mesa atendida'}
          </Button>
        </Card.Body>
      </Card>
    </Col>
  );

  return (
    <Container fluid className="container-fluid-cocina pt-0">
      <div className="modulo-header-cocina mb-4">
        <div className="header-content container-fluid px-3">
          <h1 className="page-title-cocina">Vista Mesero</h1>
          <p className="page-subtitle-cocina">Pedidos activos — todos los productos</p>
        </div>
      </div>

      {!caja && (
        <Row className="px-3">
          <Col>
            <Alert variant="danger" className="fw-semibold">
              No hay caja abierta. Espera a que el cajero abra la caja.
            </Alert>
          </Col>
        </Row>
      )}

      <Row className="mb-3 g-3 px-3">
        <Col xs={12} md={6} lg={4}>
          <Card className="shadow-sm rounded card-resumen card-pendiente-resumen h-100">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="text-marron">En Preparación</h5>
                <h3 className="text-marron">{pendientes.length}</h3>
              </div>
              <BsClipboardCheck size={40} className="text-marron" />
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Card className="shadow-sm rounded card-resumen card-listo-resumen h-100">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="text-verde">Listos en Cocina</h5>
                <h3 className="text-verde">{listos.length}</h3>
              </div>
              <BsCheckLg size={40} className="text-verde" />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <hr className="my-3 mx-3" />

      <Row className="mt-3 mb-5 px-3">
        <Col md={12}>
          <div className="d-flex justify-content-between align-items-end mb-4">
            <h3 className="text-marron fw-bold">
              Pedidos por Atender ({pedidos.length})
            </h3>
            <h6 className="text-muted fw-semibold">Actualización en tiempo real</h6>
          </div>

          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" variant="success" />
              <p className="mt-2 text-muted">Cargando pedidos...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <p className="lead text-center p-5 text-muted">No hay pedidos pendientes de atención</p>
          ) : (
            <Row className="g-4">
              {[...listos, ...pendientes].map(renderTarjeta)}
            </Row>
          )}
        </Col>
      </Row>
    </Container>
  );
}
