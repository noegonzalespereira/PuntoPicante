import React, { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button, InputGroup, FormControl, Table, Form, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import { gastoService } from "../../services/gastosService";
import { BsCalendar, BsFunnel, BsSearch, BsXCircle, BsPlusLg, BsCashCoin, BsClipboardData, BsReceipt, BsListNested,BsPencilSquare, BsFillTrashFill } from "react-icons/bs";
import "../../styles/GastosPage.css"; 
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
            Swal.fire("", "Error al cargar los gastos", "error");
        } finally {
            setLoading(false);
        }
    }

    async function aplicarFiltros() {
        if (!filtros.desde && !filtros.hasta) {
            return Swal.fire("", "Seleccione al menos una fecha para filtrar.", "warning");
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
            Swal.fire("","Gasto registrado correctamente", "success");
            await cargarGastos(filtros);
        } catch (error) {
            console.error(error);
            Swal.fire("","Error al registrar el gasto", "error");
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
    Swal.fire("", "Gasto actualizado", "success");
    await cargarGastos(filtros); 
  } catch (err) {
    console.error(err);
    const msg = err?.response?.data?.message || "Error al actualizar";
    Swal.fire("", String(msg), "error");
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
    Swal.fire("", "Gasto eliminado", "success");
    await cargarGastos(filtros); 
  } catch (err) {
    console.error(err);
    const msg = err?.response?.data?.message || "Error al eliminar (¿tienes rol GERENTE?)";
    Swal.fire("", String(msg), "error");
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
            
            <div className="modulo-header-gastos mb-4">
                <div className="header-content">
                    <h1 className="page-title-gastos">Gestión de Gastos</h1>
                    <p className="page-subtitle-gastos">Registro y consulta de egresos del negocio</p>
                </div>
            </div>

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

            
        </Container>
    );
}