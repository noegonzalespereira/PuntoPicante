import React, { useState, useEffect, useCallback } from "react";
import { cajaService } from "../../services/cajaService";
import { useAuth } from "../../context/AuthContext";
import { Container, Row, Col, Card, Button, InputGroup, FormControl, Spinner, Table, Form, Badge } from "react-bootstrap";
import { BsCalendar, BsFillLockFill, BsFillUnlockFill, BsSearch, BsPersonCircle, BsCashStack, BsGraphUp } from "react-icons/bs"; 
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import "../../styles/CajaPage.css";
import PageHeader from "../../components/molecules/PageHeader";

export default function CajaPage() {
  const { user } = useAuth();
  const [caja, setCaja] = useState(null);
  const [montoApertura, setMontoApertura] = useState("");
  const [historial, setHistorial] = useState([]);
  const [filters, setFilters] = useState({ desde: "", hasta: "" });
  const [loading, setLoading] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const loadHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const data = await cajaService.getHistorial({
        cajeroId: "",
        desde: filters.desde || "", 
        hasta: filters.hasta || ""  
      });
      setHistorial(data || []);
    } catch (err) {
      console.error("Error al cargar historial:", err);
    } finally {
      setLoadingHistorial(false);
    }
  }, [filters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const cajaData = await cajaService.getCajaAbierta();
        setCaja(cajaData);
      } catch {
        setCaja(null);
      }
      await loadHistorial();
    } catch (err) {
      console.error("Error cargando datos:", err);
      toast.error("Error inicial al cargar la página.");
    } finally {
      setLoading(false);
    }
  }, [loadHistorial]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApertura = async () => {
    if (!montoApertura || Number(montoApertura) <= 0) {
      toast.warning("Ingrese un monto inicial de apertura válido.");
      return;
    }
    try {
      await cajaService.abrirCaja(montoApertura);
      toast.success("Caja abierta correctamente");
      setMontoApertura("");
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error al abrir caja");
    }
  };

  const handleCerrarCaja = async () => {
    if (!caja) return;
    const { value: monto } = await Swal.fire({
      title: `Cerrar Caja #${caja.id_caja}`,
      input: 'number',
      inputLabel: 'Ingrese el monto contado físicamente (Bs):',
      inputPlaceholder: 'Monto real en efectivo',
      showCancelButton: true,
      confirmButtonText: 'Cerrar y Registrar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value || isNaN(value) || Number(value) < 0) {
          return 'Debe ingresar un monto válido.';
        }
      }
    });

    if (monto) {
      try {
        await cajaService.cerrarCaja(caja.id_caja, monto);
        toast.success("Caja cerrada y registrada con éxito.");
        setCaja(null);
        await loadData();
      } catch (err) {
        toast.error(err?.response?.data?.message || "Error al cerrar caja");
      }
    }
  };

  const getIniciales = (nombre) => {
    if (!nombre || typeof nombre !== 'string') return "?";
    return nombre.charAt(0).toUpperCase();
  };

  const cajasActivas = historial.filter(h => h.estado === "ABIERTA");
  
  if (loading) {
    return (
      <Container fluid className="mt-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="text-muted mt-2">Cargando datos de caja...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="caja-container-fluid pt-0">
      <PageHeader title="Gestión de Caja" subtitle="Apertura y cierre de caja diaria" />

      <Row className="g-4 px-3 mb-4">
        <Col lg={caja ? 6 : 12} md={12}>
          <Card className={`caja-status-card ${caja ? 'caja-open' : 'caja-closed'}`}>
            <Card.Body>
              {!caja ? (
                <>
                  <div className="status-box-closed">
                      <div className="status-info-left">
                          <BsFillLockFill size={24} className="status-icon-sm me-2" />
                          <div>
                              <h3 className="status-title-red mb-0">No Tienes Caja Abierta</h3>
                              <p className="status-description mb-0">Abre una caja para comenzar a operar</p>
                          </div>
                      </div>
                      <Badge bg="danger" className="badge-cerrada">CERRADA</Badge>
                  </div>
                  <Form.Group className="mt-4">
                      <Form.Label className="input-label">Monto de Apertura</Form.Label>
                      <InputGroup>
                          <FormControl
                              type="number"
                              value={montoApertura}
                              onChange={(e) => setMontoApertura(e.target.value)}
                              placeholder="500.00"
                              min="0"
                              className="input-monto"
                          />
                      </InputGroup>
                  </Form.Group>
                  <Button variant="success" onClick={handleApertura} className="w-100 mt-3 btn-abrir-caja">
                      <BsFillUnlockFill className="me-2" /> Abrir Caja
                  </Button>
                </>
              ) : (
                <div className="caja-details-open">
                  <div className="status-header">
                      <div className="status-icon-lg text-success"><BsFillUnlockFill size={30} /></div>
                      <div>
                          <h3 className={`status-title text-success`}>Caja Abierta</h3>
                          <span className="status-badge badge-success">ACTIVA</span>
                      </div>
                  </div>
                  <div className="caja-details-open mt-4">
                      <p className="monto-label">CAJERO: {caja.usuario_nombre || user?.nombre || 'N/A'}</p>
                      <hr/>
                      <div className="d-flex justify-content-between align-items-center">
                          <div className="monto-display">
                              <p className="monto-label">Monto Inicial:</p>
                              <h4 className="monto-value">
                                  {caja.monto_apertura ? `${parseFloat(caja.monto_apertura).toFixed(2)} Bs` : "0.00 Bs"}
                              </h4>
                          </div>
                          <Button variant="danger" onClick={handleCerrarCaja} className="btn-caja">
                              <BsFillLockFill className="me-2" /> Cerrar Caja
                          </Button>
                      </div>
                      <p className="caja-fecha mt-2">
                          Abierta desde: {caja.fecha_apertura ? new Date(caja.fecha_apertura).toLocaleString() : ""}
                      </p>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {caja && (
          <Col lg={6} md={12}>
            <Card className="caja-historico-card h-100">
              <Card.Header className="caja-header-secondary">
                <BsPersonCircle className="me-2" /> Cajas Activas ({cajasActivas.length})
              </Card.Header>
              <Card.Body className="cajas-activas-body">
                <div className="cajas-activas-list">
                  {cajasActivas.length > 0 ? (
                    cajasActivas.map((c) => (
                      <div key={c.id_caja} className="caja-activa-item">
                        <div className="cajero-avatar me-2">
                           {/* Avatar del cajero */}
                        </div>
                        <div className="cajero-info">
                          <p className="monto-label mb-0 fw-bold">{c.usuario_nombre || c.cajero || 'N/A'}</p>
                          <p className="caja-id mb-0">Caja #{c.id_caja}</p>
                        </div>
                        <div className="caja-monto-activa">
                          <p className="monto-label mb-0">Monto:</p>
                          <span className="monto-value-activa">
                            Bs. {c.monto_apertura ? `${parseFloat(c.monto_apertura).toFixed(2)}` : "0.00"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                      <p className="text-center text-muted p-3">No hay otras cajas activas.</p>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      <Row className="g-4 px-3 mb-4">
        <Col xs={12}>
          <Card className="caja-historico-card">
            <Card.Header className="caja-header-secondary">
              <BsSearch className="me-2" /> Buscar Historial
            </Card.Header>
            <Card.Body>
              <Form>
                <Row className="g-3 align-items-end">
                  <Col lg={4} md={3}>
                    <Form.Group controlId="formDesde">
                      <Form.Label>Desde (Apertura)</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><BsCalendar /></InputGroup.Text>
                        <Form.Control
                          type="date"
                          value={filters.desde}
                          onChange={(e) => setFilters({ ...filters, desde: e.target.value })}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col lg={4} md={3}>
                    <Form.Group controlId="formHasta">
                      <Form.Label>Hasta (Cierre)</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><BsCalendar /></InputGroup.Text>
                        <Form.Control
                          type="date"
                          value={filters.hasta}
                          onChange={(e) => setFilters({ ...filters, hasta: e.target.value })}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col lg={4} xs={3} className="text-end text-lg-start">
                    <Button variant="primary" onClick={loadHistorial} disabled={loadingHistorial} className="btn-caja-filtro">
                      {loadingHistorial ? <Spinner as="span" animation="border" size="sm" className="me-2" /> : <BsSearch className="me-2" />}
                      Buscar Historial
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-4 px-3">
        <Col xs={12}>
          <Card className="caja-historico-card p-3">
            <h5 className="mb-3 text-marron fw-bold">Historial de Cajas Registradas</h5>
            <div className="table-responsive">
              <Table striped bordered hover size="sm" className="caja-historial-table tabla-responsive-cards">
                <thead>
                  <tr>
                    <th>ID Caja</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Apertura</th>
                    <th>Cierre</th>
                    <th className="text-end">Monto Apertura</th>
                    <th className="text-end">Monto Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length > 0 ? (
                    historial.map((h) => (
                      <tr key={h.id_caja}>
                        <td data-label="ID Caja" className="td-bold">{h.id_caja}</td>
                        <td data-label="Usuario">{h.usuario_nombre || h.cajero || "Sin nombre"}</td>
                        <td data-label="Estado">
                          <Badge bg={h.estado === 'ABIERTA' ? 'success' : 'secondary'} className="estado-badge">
                            {h.estado || "N/A"}
                          </Badge>
                        </td>
                        <td data-label="Apertura">{new Date(h.fecha_apertura).toLocaleString()}</td>
                        <td data-label="Cierre">{h.fecha_cierre ? new Date(h.fecha_cierre).toLocaleString() : "N/A"}</td>
                        <td data-label="Monto Apertura" className="text-end td-monto">{parseFloat(h.monto_apertura).toFixed(2)} Bs.</td>
                        <td data-label="Monto Cierre" className="text-end td-monto">{h.monto_cierre ? `${parseFloat(h.monto_cierre).toFixed(2)} Bs.` : "N/A"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center">No hay registros de historial de cajas que coincidan con los filtros.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
