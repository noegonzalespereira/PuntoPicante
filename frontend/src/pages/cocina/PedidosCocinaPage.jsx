import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Container, Row, Col, Card, Spinner, Badge, Alert } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { cocinaService } from '../../services/cocinaService';
import { cajaService } from '../../services/cajaService';
import '../../styles/CocinaPage.css';
import { BsClipboardCheck, BsCheckLg, BsEye } from 'react-icons/bs';

const CocinaPage = () => {
  const [caja, setCaja] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [resumen, setResumen] = useState({ pendientes: 0, listos: 0 });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('PENDIENTE'); // 'PENDIENTE' | 'LISTO'
  const pollingRef = useRef(null);

  const cargarCajaYDatos = useCallback(async () => {
    try {
      setLoading(true);

      // 1) Caja abierta (si no hay, limpiamos datos)
      const cajaAbierta = await cajaService.getCajaAbierta().catch(() => null);
      setCaja(cajaAbierta ?? null);

      if (!cajaAbierta) {
        setPedidos([]);
        setResumen({ pendientes: 0, listos: 0 });
        return;
      }

      const id_caja = cajaAbierta.id_caja;

      // 2) Pedidos por TAB (día actual = caja abierta)
      const data =
        tab === 'PENDIENTE'
          ? await cocinaService.getPendientes({ id_caja })
          : await cocinaService.getListos({ id_caja });

      setPedidos(Array.isArray(data) ? data : []);

      // 3) Resumen de ESTA caja
      const r = await cocinaService.getResumen({ id_caja }).catch(() => ({ pendientes: 0, listos: 0 }));
      setResumen({
        pendientes: Number(r?.pendientes ?? 0),
        listos: Number(r?.listos ?? 0),
      });
    } catch (error) {
      console.error('Error al cargar datos de cocina:', error);
      Swal.fire('Error', 'No se pudo cargar la información de cocina.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const marcarItemComoListo = async (id_pedido, id_detalle_pedido) => {
    try {
      await cocinaService.marcarItemDespachado(id_pedido, id_detalle_pedido);
      Swal.fire('Éxito', 'Plato marcado como listo', 'success');
      await cargarCajaYDatos();
    } catch (error) {
      console.error('Error al marcar el plato como listo:', error);
      Swal.fire('Error', 'Error al marcar el plato como listo', 'error');
    }
  };

  useEffect(() => {
    cargarCajaYDatos();
    pollingRef.current = setInterval(() => {
      cargarCajaYDatos();
    }, 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [cargarCajaYDatos]);

  // Ítems pendientes dentro de un pedido (con botón "Listo")
  const renderPedidoItemsPendientes = (items, num_mesa, id_pedido) => {
    const itemsPendientes = (items ?? []).filter((it) => it.estado_item === 'PENDIENTE');

    if (!itemsPendientes.length) {
      return (
        <div className="text-center p-3">
          <p className="text-success fw-bold">✅ Todos los platos están listos.</p>
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
                <Badge bg="info" className="destino-badge me-2">
                  Mesa {num_mesa}
                </Badge>
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
    const pendientes = (pedidos ?? []).filter((p) => p.estado_pedido === 'PENDIENTE');

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
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="card-title text-marron">Pedido #{pedido.num_pedido || pedido.id_pedido}</h5>
              <span className="tag-pendiente">
                <BsEye className="me-1" /> Pendiente
              </span>
            </div>

            <hr className="my-3" />

            {/* Ítems pendientes del pedido */}
            <div className="pedido-items-list flex-grow-1">
              {renderPedidoItemsPendientes(pedido.items, pedido.num_mesa, pedido.id_pedido)}
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

    return listos.map((pedido) => (
      <Col xs={12} sm={6} md={4} key={pedido.id_pedido} className="mb-4 d-flex align-items-stretch">
        <Card className="shadow-sm border-0 p-3 card-pedido-individual card-listo h-100">
          <Card.Body className="d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="card-title text-success">Pedido #{pedido.num_pedido || pedido.id_pedido}</h5>
              <span className="tag-listo">
                <BsCheckLg className="me-1" /> Listo
              </span>
            </div>

            <hr className="my-3" />

            <div className="pedido-items-list flex-grow-1">
              {(pedido.items ?? []).map((item, index) => (
                <div key={item.id_detalle_pedido} className="mb-3 item-detail">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="flex-grow-1">
                      <strong className="d-block">{item.producto?.nombre ?? `#${item.id_producto}`}</strong>
                      <div className="d-flex align-items-center mt-1">
                        {item.destino === 'MESA' ? (
                          <Badge bg="info" className="destino-badge me-2">
                            Mesa {pedido.num_mesa ?? '-'}
                          </Badge>
                        ) : (
                          <Badge bg="secondary" className="destino-badge me-2">
                            {item.destino}
                          </Badge>
                        )}
                        <Badge
                          bg={item.estado_item === 'LISTO' ? 'success' : 'warning'}
                          className="ms-2"
                          title="Estado del ítem"
                        >
                          {item.estado_item}
                        </Badge>
                        {item.notas && <small className="text-muted ms-2">Notas: {item.notas}</small>}
                      </div>
                    </div>
                    <span className="fw-bold">{item.cantidad} x</span>
                  </div>
                  {index < (pedido.items?.length ?? 1) - 1 && <hr className="my-2 dashed-divider" />}
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      </Col>
    ));
  };

  return (
    <Container fluid className="container-fluid-cocina pt-0">
      {/* HEADER */}
      <div className="modulo-header-cocina mb-4">
        <div className="header-content container-fluid px-3">
          <h1 className="page-title-cocina">Cocina</h1>
          <p className="page-subtitle-cocina">Gestión y preparación de pedidos</p>
        </div>
      </div>

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
