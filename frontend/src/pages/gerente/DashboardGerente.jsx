import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Table, Card, Spinner, Alert, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { useNavigate } from "react-router-dom";

import { cajaService } from '../../services/cajaService';
import { stockService } from '../../services/stockService';
import { gastoService } from '../../services/gastosService';
import { cocinaService } from '../../services/cocinaService';
import { reportesService } from '../../services/reportesService';

import '../../styles/DashboardPage.css';
import PageHeader from "../../components/molecules/PageHeader";

import {
  BsBoxSeam,
  BsCashStack,
  BsWallet2,
  BsClipboardCheck,
  BsCashCoin,
  BsCalendar,
} from 'react-icons/bs';

function ymdLaPaz(d) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d).replace(/\//g, '-');
}
function hoyBolivia() {
  return ymdLaPaz(new Date());
}
function formatFechaVisual(ymd) {
  if (!ymd) return 'N/A';
  const [Y, M, D] = ymd.split('-');
  return `${D}/${M}/${Y}`;
}

const DashboardGerente = () => {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    fechaRef: hoyBolivia(),
    cajaAbierta: null,
    cajeroActual: 'N/A',
    montoApertura: '0.00',
    totalVendido: '0.00',
    totalGastos: '0.00',
    pedidosPendientes: 0,
    stockDetalle: { platos: [], bebidas: [] },
    platosVendidos: 0,
    bebidasVendidas: 0,
  });


  const obtenerFechaReferencia = async () => {
    try {
      // 1) Intentar caja abierta
      const caja = await cajaService.getCajaAbierta().catch(() => null);
      if (caja && caja.id_caja) {
        return {
          fechaRef: hoyBolivia(),
          cajaAbierta: caja,
          cajero: caja.usuario_nombre || 'N/A',
          montoApertura: Number(caja.monto_apertura || 0).toFixed(2),
        };
      }

      // 2) Si no hay caja abierta, tomamos la última caja CERRADA del historial
      const historial = await cajaService.getHistorial({
        cajeroId: '',
        desde: '',
        hasta: '',
      }).catch(() => []);

      const cerradas = (historial || []).filter((h) => h.estado === 'CERRADA');
      if (cerradas.length === 0) {
        // No hay caja abierta ni cerradas -> fechaRef = hoy
        return {
          fechaRef: hoyBolivia(),
          cajaAbierta: null,
          cajero: 'N/A',
          montoApertura: '0.00',
        };
      }

      // Ordenar por fecha_cierre desc y tomar la más reciente
      cerradas.sort((a, b) => new Date(b.fecha_cierre) - new Date(a.fecha_cierre));
      const ultima = cerradas[0];

      // Usamos la fecha de APERTURA de esa caja como día de operación
      const fechaRef = ymdLaPaz(new Date(ultima.fecha_apertura));

      return {
        fechaRef,
        cajaAbierta: null,
        cajero: ultima.usuario_nombre || 'N/A',
        montoApertura: Number(ultima.monto_apertura || 0).toFixed(2),
      };
    } catch (e) {
      console.error('Error determinando fecha de referencia:', e);
      return {
        fechaRef: hoyBolivia(),
        cajaAbierta: null,
        cajero: 'N/A',
        montoApertura: '0.00',
      };
    }
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // A) Fecha y caja
      const cajaInfo = await obtenerFechaReferencia();
      const fechaRef = cajaInfo.fechaRef;
let totalVendido = 0;
try {
  const resumen = await reportesService.getResumen({ desde: fechaRef, hasta: fechaRef });
  totalVendido = Number(resumen?.totales?.venta_total ?? 0);
} catch (err) {
  console.error('Ventas (PAGADOS) error:', err?.response?.data || err);
  totalVendido = 0;
}


      // C) Pedidos pendientes (cocina)
      let pedidosPendientes = 0;
      try {
        const idCaja = cajaInfo.cajaAbierta?.id_caja ?? null;

        if (idCaja) {
          const resp = await cocinaService.getPendientes({ id_caja: idCaja });

          const arr = Array.isArray(resp) ? resp : (resp?.data ?? []);

          
          pedidosPendientes = arr.filter(p => (p.estado_pedido ?? p.estado) === 'PENDIENTE').length || arr.length;
        } else {
          pedidosPendientes = 0;
        }
      } catch (e) {
        console.error('Cocina pendientes error:', e?.response?.data || e);
        pedidosPendientes = 0;
      }

      // D) Gastos del mismo día de referencia
      const gastosResp = await gastoService.getResumen({ desde: fechaRef, hasta: fechaRef });
      const totalGastos = Number(gastosResp?.total_gastos || 0);

      // E) Stock del día de referencia
      const stockResp = await stockService.getDisponible(fechaRef).catch(() => ({ platos: [], bebidas: [] }));
      const platos = stockResp?.platos || [];
      const bebidas = stockResp?.bebidas || [];
      const platosVendidos = platos.reduce((acc, p) => acc + Number(p.vendido || 0), 0);
      const bebidasVendidas = bebidas.reduce((acc, b) => acc + Number(b.vendido || 0), 0);

      setStats({
        fechaRef,
        cajaAbierta: cajaInfo.cajaAbierta,
        cajeroActual: cajaInfo.cajero,
        montoApertura: cajaInfo.montoApertura,
        totalVendido: totalVendido.toFixed(2),
        totalGastos: totalGastos.toFixed(2),
        pedidosPendientes,
        stockDetalle: stockResp,
        platosVendidos,
        bebidasVendidas,
      });
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
      Swal.fire('Error', 'No se pudieron cargar las métricas principales.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const renderCajaStatus = () => {
    if (stats.cajaAbierta) {
      return (
        <Card className="kpi-card kpi-verde-claro h-100">
          <Card.Body>
            <BsCashStack size={40} className="text-success" />
            <span className="kpi-label">CAJA ACTUAL</span>
            <div className="kpi-value kpi-value-verde">ABIERTA</div>
            <p className="small text-muted mb-0">Cajero: {stats.cajeroActual}</p>
            <p className="small text-muted">Apertura: Bs {stats.montoApertura}</p>
          </Card.Body>
        </Card>
      );
    }
    return (
      <Card className="kpi-card kpi-rojo-claro h-100">
        <Card.Body>
          <BsCashStack size={40} className="text-danger" />
          <span className="kpi-label">CAJA ACTUAL</span>
          <div className="kpi-value kpi-value-rojo">CERRADA</div>
          <p className="small text-muted mt-2 mb-0">
            Último día operado: {formatFechaVisual(stats.fechaRef)}
          </p>
        </Card.Body>
      </Card>
    );
  };

  const renderStockTable = () => {
    const platos  = stats.stockDetalle?.platos  || [];
    const bebidas = stats.stockDetalle?.bebidas || [];

    const StockSeccion = ({ items, labelCol, emptyMsg }) => (
      <Table responsive hover size="sm" className="tabla-stock-dashboard tabla-responsive-cards mb-0">
        <thead>
          <tr>
            <th>{labelCol}</th>
            <th className="text-center">Stock Día</th>
            <th className="text-center">Vendidos</th>
            <th className="text-center">Disponible</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((p) => {
              const stockDia  = p.stock_inicial ?? ((p.stock ?? 0) + (p.vendido ?? 0) + (p.merma ?? 0));
              const disponible = p.stock ?? 0;
              return (
                <tr key={p.id_producto}>
                  <td className="fw-bold">{p.nombre}</td>
                  <td className="text-center text-marron">{stockDia}</td>
                  <td className="text-center text-primary">{p.vendido ?? 0}</td>
                  <td className="text-center fw-bold">{disponible}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="4" className="text-center text-muted">{emptyMsg}</td>
            </tr>
          )}
        </tbody>
      </Table>
    );

    return (
      <>
        <p className="text-muted mb-1 fw-bold">
          Platos vendidos: <span className="text-marron">{stats.platosVendidos} uds.</span>
        </p>
        <StockSeccion items={platos} labelCol="Plato" emptyMsg={`Sin stock de platos para ${formatFechaVisual(stats.fechaRef)}.`} />

        {bebidas.length > 0 && (
          <>
            <p className="text-muted mb-1 fw-bold mt-3">
              Bebidas vendidas: <span className="text-marron">{stats.bebidasVendidas} uds.</span>
            </p>
            <StockSeccion items={bebidas} labelCol="Bebida" emptyMsg="" />
          </>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <Container fluid className="text-center p-5">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <div className="dashboard-page">
      {/* HEADER */}
      <PageHeader
        title="Dashboard Gerencial"
        subtitle={`Métricas del día de trabajo (${formatFechaVisual(stats.fechaRef)})`}
      />

      <Container fluid className="px-3">
        <Row className="g-4 mb-5">
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-amarillo h-100">
              <Card.Body>
                <BsWallet2 size={40} className="text-warning" />
                <span className="kpi-label">VENTA TOTAL (PAGADOS)</span>
                <div className="kpi-value kpi-value-marron">Bs {stats.totalVendido}</div>
              </Card.Body>
            </Card>
          </Col>

          {/* Estado de caja */}
          <Col lg={3} md={6}>{renderCajaStatus()}</Col>

          {/* Pedidos pendientes */}
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-marron h-100">
              <Card.Body>
                <BsClipboardCheck size={40} className="text-marron" />
                <span className="kpi-label">PEDIDOS PENDIENTES</span>
                <div className="kpi-value kpi-value-marron">{stats.pedidosPendientes}</div>
                <p className="small text-muted mb-0">En preparación</p>
              </Card.Body>
            </Card>
          </Col>

          {/* Gastos del día */}
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-rojo-claro h-100">
              <Card.Body>
                <BsCashCoin size={40} className="text-danger" />
                <span className="kpi-label">GASTOS DEL DÍA</span>
                <div className="kpi-value kpi-value-rojo">Bs {stats.totalGastos}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* FILA 2: STOCK (sin alertas ni “contexto de costos”) */}
        <Row className="g-4">
          <Col lg={12}>
            <Card className="card-informe-resumen p-4 h-100">
              <h5 className="text-marron fw-bold mb-3">
                <BsBoxSeam className="me-2" /> Disponibilidad y Rendimiento de Stock — {formatFechaVisual(stats.fechaRef)}
              </h5>
              {renderStockTable()}
              <div className="text-end mt-3">
                <Button variant="outline-primary"  >
                  <BsCalendar className="me-2" /> Ver Reportes
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default DashboardGerente;
