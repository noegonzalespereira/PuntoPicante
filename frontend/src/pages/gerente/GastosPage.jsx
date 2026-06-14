import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button, InputGroup, FormControl, Table, Form, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { gastoService } from "../../services/gastosService";
import { BsCalendar, BsFunnel, BsSearch, BsXCircle, BsPlusLg, BsCashCoin, BsClipboardData, BsReceipt, BsListNested,BsPencilSquare, BsFillTrashFill } from "react-icons/bs";
import "../../styles/GastosPage.css";
import PageHeader from "../../components/molecules/PageHeader";
export default function GastosPage() {
    const [gastos, setGastos] = useState([]);
    const [resumen, setResumen] = useState({ total_gastos: "0.00", num_gastos: 0 });
    const [filtros, setFiltros] = useState({ desde: "", hasta: ""});
    const [loading, setLoading] = useState(false);

    const hoyLocal = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
        };
    const toInputDate = (ymd) => {
    if (!ymd) return hoyLocal();
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    const d = new Date(ymd);
    if (isNaN(d)) return hoyLocal();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
    };
    // Función principal para cargar gastos y resumen
    async function cargarGastos(filtrosQuery = {}) {
        try {
            setLoading(true);
            const data = await gastoService.getAll(filtrosQuery);
            setGastos(data.data ?? []);

            const resumenData = await gastoService.getResumen(filtrosQuery);
            setResumen(resumenData);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar los gastos");
        } finally {
            setLoading(false);
        }
    }

    async function aplicarFiltros() {
        if (!filtros.desde && !filtros.hasta) {
            return toast.warning("Seleccione al menos una fecha para filtrar.");
        }
        await cargarGastos(filtros);
    }

    async function limpiarFiltros() {
        setFiltros({ desde: "", hasta: "" });
        await cargarGastos();
    }

    async function nuevoGasto() {
        const { value: formValues } = await Swal.fire({
        title: "Registrar nuevo gasto",
        html: `
            <input id="nombre" class="swal2-input" placeholder="Nombre del gasto">
            <input id="descripcion" class="swal2-input" placeholder="Descripción (opcional)">
            <input id="cantidad" type="number" min="1" class="swal2-input" placeholder="Cantidad">
            <input id="precio" type="number" min="0" step="0.01" class="swal2-input" placeholder="Precio">
            <input id="fecha" type="date" class="swal2-input" value="${hoyLocal()}">
        `,
        confirmButtonText: "Guardar",
        cancelButtonText: "Cancelar",
        showCancelButton: true,
        focusConfirm: false,
        preConfirm: () => ({
            nombre_producto: document.getElementById("nombre").value,
            descripcion: document.getElementById("descripcion").value,
            cantidad: Number(document.getElementById("cantidad").value),
            precio: document.getElementById("precio").value,
            fecha: document.getElementById("fecha").value || hoyLocal(),
        }),
        });
        


        if (!formValues) return;

        try {
            await gastoService.create(formValues);
            toast.success("Gasto registrado correctamente");
            await cargarGastos(filtros);
        } catch (error) {
            console.error(error);
            toast.error("Error al registrar el gasto");
        }
    }

    // Utilidades
    const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    // Esperamos 'YYYY-MM-DD'
    const [y, m, d] = String(dateStr).split('-');
    if (!y || !m || !d) return dateStr; 
    return `${d}/${m}/${y}`;
    };
    
    // Efecto de carga inicial
    useEffect(() => {
        cargarGastos(filtros);
    }, []);

    // Cálculos de resumen
    const ultimoGasto = gastos.length > 0 ? gastos[0] : null;
    const montoUltimo = ultimoGasto ? (ultimoGasto.cantidad * Number(ultimoGasto.precio)).toFixed(2) : "0.00";
    const totalGastosBs = Number(resumen.total_gastos).toFixed(2);

    async function editarGasto(g) {
  const nombre = (g.nombre_producto ?? '').replace(/"/g, '&quot;');
  const descripcion = (g.descripcion ?? '').replace(/"/g, '&quot;');
  const cantidad = Number(g.cantidad ?? 1);
  const precio = Number(g.precio ?? 0).toFixed(2);
  const fecha = toInputDate(g.fecha);

  const { value: formValues } = await Swal.fire({
    title: "Editar gasto",
    html: `
      <input id="nombre" class="swal2-input" placeholder="Nombre del gasto" value="${nombre}">
      <input id="descripcion" class="swal2-input" placeholder="Descripción (opcional)" value="${descripcion}">
      <input id="cantidad" type="number" min="1" class="swal2-input" placeholder="Cantidad" value="${cantidad}">
      <input id="precio" type="number" min="0" step="0.01" class="swal2-input" placeholder="Precio" value="${precio}">
      <input id="fecha" type="date" class="swal2-input" value="${fecha}">
    `,
    confirmButtonText: "Guardar cambios",
    cancelButtonText: "Cancelar",
    showCancelButton: true,
    focusConfirm: false,
    preConfirm: () => ({
      nombre_producto: document.getElementById("nombre").value.trim(),
      descripcion: document.getElementById("descripcion").value.trim(),
      cantidad: Number(document.getElementById("cantidad").value),
      precio: document.getElementById("precio").value,
      fecha: document.getElementById("fecha").value || hoyLocal(),
    }),
  });

  if (!formValues) return;

  try {
    await gastoService.update(g.id_gasto, formValues);
    toast.success("Gasto actualizado");
    await cargarGastos(filtros);
  } catch (err) {
    console.error(err);
    const msg = err?.response?.data?.message || "Error al actualizar";
    toast.error(String(msg));
  }
}

async function eliminarGasto(g) {
  const confirm = await Swal.fire({
    title: "Eliminar gasto",
    html: `<p>¿Seguro que deseas eliminar <b>${(g.nombre_producto ?? '').replace(/</g,'&lt;')}</b>?</p>
           <small class="text-muted">Esta acción no se puede deshacer.</small>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  });
  if (!confirm.isConfirmed) return;

  try {
    await gastoService.delete(g.id_gasto);
    toast.success("Gasto eliminado");
    await cargarGastos(filtros);
  } catch (err) {
    console.error(err);
    const msg = err?.response?.data?.message || "Error al eliminar (¿tienes rol GERENTE?)";
    toast.error(String(msg));
  }
}


    if (loading)
        return (
            <Container fluid className="text-center p-5">
                <Spinner animation="border" variant="danger" />
            </Container>
        );

    return (
        <Container fluid className="py-0 gastos-page">
            
            <PageHeader title="Gestión de Gastos" subtitle="Registro y consulta de egresos del negocio" />

            <Row className="mb-4 px-3 g-3">
                
                <Col lg={4} md={6}>
                    <Card className="kpi-card border-danger shadow-sm h-100">
                        <Card.Body>
                            <h5 className="text-rojo fw-bold"><BsCashCoin className="me-2" /> Total Gastado</h5>
                            <h3 className="fw-bold text-rojo">Bs {totalGastosBs}</h3>
                            <small className="text-muted">Total de gastos registrados en el filtro</small>
                        </Card.Body>
                    </Card>
                </Col>
                
                <Col lg={4} md={6}>
                    <Card className="kpi-card border-warning shadow-sm h-100">
                        <Card.Body>
                            <h5 className="text-warning fw-bold"><BsReceipt className="me-2" /> Cantidad de Registros</h5>
                            <h3 className="fw-bold text-warning">{resumen.num_gastos}</h3>
                            <small className="text-muted">Gastos registrados en total o filtrados</small>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={4} md={12} className="d-flex align-items-center">
                    <Button variant="danger" onClick={
                        nuevoGasto} className="btn-modern w-100 btn-lg btn-nuevo-gasto">
                        <BsPlusLg className="me-2" /> Registrar Nuevo Gasto
                    </Button>
                </Col>
            </Row>

            <Card className="shadow-sm border-0 mb-4 mx-3">
                <Card.Header className="bg-light fw-bold text-marron">
                    <BsFunnel className="me-2 text-rojo" />Filtros de Búsqueda
                </Card.Header>
                <Card.Body>
                    <Row className="align-items-end g-3">
                        <Col md={4}>
                            <Form.Label className="fw-bold">Desde</Form.Label>
                            <InputGroup>
                                <InputGroup.Text><BsCalendar /></InputGroup.Text>
                                <Form.Control
                                    type="date"
                                    value={filtros.desde}
                                    onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
                                />
                            </InputGroup>
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-bold">Hasta</Form.Label>
                            <InputGroup>
                                <InputGroup.Text><BsCalendar /></InputGroup.Text>
                                <Form.Control
                                    type="date"
                                    value={filtros.hasta}
                                    onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
                                />
                            </InputGroup>
                        </Col>
                        <Col md={4} className="d-flex justify-content-end gap-2">
                            <Button variant="primary" className="btn-modern" onClick={aplicarFiltros}>
                                <BsSearch className="me-1" /> Aplicar
                            </Button>
                            <Button variant="outline-danger" className="btn-modern" onClick={limpiarFiltros}>
                                <BsXCircle className="me-1" /> Limpiar
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Card className="shadow-sm border-0 mx-3">
                <Card.Header className="bg-verde text-light fw-bold">
                    <BsClipboardData className="me-2" /> Listado Detallado de Gastos
                </Card.Header>
                <Card.Body>
                    {!gastos.length ? (
                        <p className="text-center text-muted my-4">
                            <BsListNested className="me-2" /> No hay gastos registrados
                        </p>
                    ) : (
                        <div className="table-responsive">
                            <Table responsive hover className="align-middle gastos-table-modern tabla-responsive-cards">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Nombre</th>
                                        <th>Descripción</th>
                                        <th className="text-end">Cantidad</th>
                                        <th className="text-end">P. Unitario</th>
                                        <th className="text-end">Total</th>
                                        <th className="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastos.map((g) => (
                                        <tr key={g.id_gasto}>
                                            <td data-label="Fecha">{formatDate(g.fecha)}</td>
                                            <td data-label="Nombre" className="fw-bold">{g.nombre_producto}</td>
                                            <td data-label="Descripción">{g.descripcion || "-"}</td>
                                            <td data-label="Cantidad" className="text-end">{g.cantidad}</td>
                                            <td data-label="P. Unitario" className="text-end text-rojo">
                                                Bs {Number(g.precio).toFixed(2)}
                                            </td>
                                            <td data-label="Total" className="text-end text-rojo fw-bold">
                                                Bs {(g.cantidad * Number(g.precio)).toFixed(2)}
                                            </td>
                                            <td data-label="Acciones" className="text-center celda-acciones">
                                                <div className="d-flex justify-content-center gap-2">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    onClick={() => editarGasto(g)}
                                                    title="Editar"
                                                >
                                                    <BsPencilSquare />
                                                </Button>
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    onClick={() => eliminarGasto(g)}
                                                    title="Eliminar"
                                                >
                                                    <BsFillTrashFill />
                                                </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}