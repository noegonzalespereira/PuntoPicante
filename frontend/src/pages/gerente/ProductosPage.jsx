import React, { useEffect, useState, useCallback } from "react";
import { Container, Row, Col, Card, Button, InputGroup, Table, Form, Modal, Spinner, Badge } from "react-bootstrap";
import Swal from "sweetalert2";
import { productoService } from "../../services/productoService";

import "../../styles/ProductosPage.css";
import { BsPlusLg,BsFunnel, BsSearch, BsBoxSeam, BsCheckCircle, BsDashCircle, BsPencilSquare, BsTrash, BsGraphUp, BsWallet, BsImage, BsPeopleFill } from "react-icons/bs";

const ProductoModal = ({ show, handleClose, isEditing, form, setForm, file, setFile, handleSubmit, productToEdit }) => {
    const handleFileChange = (e) => {
        setFile(e.target.files?.[0] || null);
    };

    const modalTitle = isEditing ? `Editar Producto: ${productToEdit.nombre}` : "Registrar Nuevo Producto";
    const submitButtonText = isEditing ? "Guardar Cambios" : "Crear Producto";

    const onSubmit = (e) => {
        e.preventDefault();
        handleSubmit();
    };

    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static">
            <Modal.Header closeButton className="modal-header-custom border-0">
                <Modal.Title className="fw-bold text-marron">
                    {isEditing ? <BsPencilSquare className="me-2" /> : <BsPlusLg className="me-2" />}
                    {modalTitle}
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={onSubmit} noValidate>
                <Modal.Body>
                    <Row className="g-3">
                        <Col md={12}>
                            <Form.Group><Form.Label>Nombre *</Form.Label>
                                <Form.Control
                                    type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    placeholder="Ej: Mondongo" required
                                />
                            </Form.Group>
                        </Col>

                        <Col md={6}><Form.Group><Form.Label>Tipo *</Form.Label>
                            <Form.Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} required>
                                <option value="PLATO">PLATO</option>
                                <option value="BEBIDA">BEBIDA</option>
                            </Form.Select>
                        </Form.Group></Col>

                        <Col md={6}><Form.Group><Form.Label>Precio (Bs) *</Form.Label>
                            <InputGroup>
                                <InputGroup.Text>Bs</InputGroup.Text>
                                <Form.Control
                                    type="number" step="0.01" min="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })}
                                    placeholder="0.00" required
                                />
                            </InputGroup>
                        </Form.Group></Col>
                        
                        {/* IMAGEN */}
                        <Col xs={12}><Form.Group>
                            <Form.Label>{isEditing ? "Nueva imagen (opcional)" : "Imagen del producto *"}</Form.Label>
                            <Form.Control type="file" accept="image/*" onChange={handleFileChange} required={!isEditing && !productToEdit?.img_url && !file} />
                        </Form.Group>
                        {(isEditing && productToEdit?.img_url && !file) && (
                            <div className="image-preview mt-2">
                                <img src={productToEdit.img_url || 'https://res.cloudinary.com/dbur21xsb/image/upload/v1763073517/productos/dwfxgdkzxbjmcjxzrzsq.png'} 
                                    alt={productToEdit.nombre} 
                                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '5px' }} />
                                <small className="text-muted ms-2">Imagen actual</small>

                            </div>
                        )}
                        </Col>

                        {/* ESTADO ACTIVO */}
                        <Col xs={12}>
                            <Form.Check
                                type="checkbox"
                                label="Producto activo (Disponible para la venta)"
                                checked={Number(form.activo) === 1}
                                onChange={(e) => setForm({ ...form, activo: e.target.checked ? 1 : 0 })}
                                id="check-activo"
                            />
                        </Col>
                    </Row>
                </Modal.Body>

                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button variant="danger" type="submit">
                        {submitButtonText}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};



export default function ProductosPage() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, activos: 0, inactivos: 0 });
    const [filters, setFilters] = useState({ search: "", tipo: "", activo: "" });
    const [showModal, setShowModal] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ nombre: "", tipo: "PLATO", precio: "", activo: 1 });
    const [file, setFile] = useState(null);

    const loadProductos = useCallback(async () => {
        try {
            setLoading(true);
            
            const apiFilters = {};
            if (filters.search) apiFilters.search = filters.search;
            if (filters.tipo) apiFilters.tipo = filters.tipo;
            if (filters.activo) apiFilters.activo = filters.activo;
            
            const resp = await productoService.getAll(apiFilters);
            const data = resp.data || resp.data?.data || []; 

            const activos = data.filter((p) => p.activo === 1).length;
            const inactivos = data.filter((p) => p.activo === 0).length;

            setProductos(data);
            setStats({ total: data.length, activos, inactivos });
        } catch (err) {
            console.error("Error cargando productos:", err);
            Swal.fire("Error", "No se pudieron cargar los productos", "error");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadProductos();
    }, [loadProductos]);



    const handleOpenModal = (p = null) => {
        setEditando(p);
        setForm({
            id_producto: p?.id_producto ?? null,
            nombre: p?.nombre || "",
            tipo: p?.tipo || "PLATO",
            precio: p?.precio || "",
            activo: p?.activo ?? 1,
        });
        setFile(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditando(null);
    };

    const handleGuardarProducto = async () => {
        if (!form.nombre || !form.precio ) {
            Swal.fire("Advertencia", "Complete todos los campos e suba una imagen para crear un producto", "warning");
            return;
        }
        if (Number(form.precio) <= 0) {
            Swal.fire("Error", "El precio debe ser mayor a 0", "error");
            return;
        }
        if (!file && !editando) {
                form.img_url = 'https://res.cloudinary.com/dbur21xsb/image/upload/v1763073517/productos/dwfxgdkzxbjmcjxzrzsq.png';
            }
            

        try {
            
            if (editando) {
                await productoService.update(editando.id_producto, form, file);
                Swal.fire(" Actualizado", "Producto actualizado correctamente", "success");
            } else {
                // Crear
                await productoService.create(form, file);
                Swal.fire(" Producto creado", "Se registró correctamente", "success");
            }
            handleCloseModal();
            await loadProductos();
        } catch (err) {
            const msg = err?.response?.data?.message || err?.response?.data?.error || "No se pudo completar la operación.";
            Swal.fire("Error", String(msg), "error");
        }
    };

    const handleEstadoChange = async (p, nuevoEstado) => {
        const accion = nuevoEstado === 0 ? "desactivar" : "activar";
        const endpoint = nuevoEstado === 0 ? productoService.delete : productoService.activar;

        const ok = await Swal.fire({
            title: `¿Seguro de ${accion} "${p.nombre}"?`,
            text: `El producto será ${accion} del menú de ventas.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: `Sí, ${accion}`,
            cancelButtonText: "Cancelar",
        });
        if (!ok.isConfirmed) return;

        try {
            await endpoint(p.id_producto);
            Swal.fire("Hecho", `Producto ${accion}do correctamente`, "success");
            await loadProductos();
        } catch (err) {
            Swal.fire("Error", `No se pudo ${accion} el producto`, "error");
        }
    };



    if (loading) {
        return (
            <Container fluid className="text-center p-5">
                <Spinner animation="border" variant="primary" />
            </Container>
        );
    }

    return (
        <div className="productos-page">
            
            <div className="modulo-header-productos mb-4">
                <div className="header-content container-fluid px-3">
                    <h1 className="page-title-productos">Gestión de Productos</h1>
                    <p className="page-subtitle-productos">Registro, edición y estado de platos y bebidas</p>
                </div>
            </div>

            <Container fluid className="px-3">
                
                {/* ESTADÍSTICAS */}
                <div className="mb-4">
                    <Row className="g-3">
                        <Col md={4} lg={3}>
                            <Card className="kpi-card kpi-marron h-100">
                                <Card.Body>
                                    <BsBoxSeam size={40} className="text-marron" />
                                    <span className="kpi-label">TOTAL PRODUCTOS</span>
                                    <div className="kpi-value">{stats.total}</div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} lg={3}>
                            <Card className="kpi-card kpi-verde h-100">
                                <Card.Body>
                                    <BsCheckCircle size={40} className="text-success" />
                                    <span className="kpi-label">ACTIVOS</span>
                                    <div className="kpi-value kpi-value-verde">{stats.activos}</div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} lg={3}>
                            <Card className="kpi-card kpi-rojo h-100">
                                <Card.Body>
                                    <BsDashCircle size={40} className="text-danger" />
                                    <span className="kpi-label">INACTIVOS</span>
                                    <div className="kpi-value kpi-value-rojo">{stats.inactivos}</div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </div>


                {/* FILTROS */}
                <Card className="shadow-sm border-0 mb-4 filtro-card-modern">
                    <Card.Header className="bg-light fw-bold text-marron">
                        <BsFunnel className="me-2 text-rojo" />Filtros
                    </Card.Header>
                    <Card.Body>
                        <Row className="align-items-end g-3">
                            <Col md={3}>
                                <Form.Label>Buscar por nombre</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text><BsSearch /></InputGroup.Text>
                                    <Form.Control
                                        type="text"
                                        placeholder="Ej: Mondongo"
                                        value={filters.search}
                                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    />
                                </InputGroup>
                            </Col>

                            <Col md={3}>
                                <Form.Label>Tipo</Form.Label>
                                <Form.Select
                                    value={filters.tipo}
                                    onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
                                >
                                    <option value="">Todos los tipos</option>
                                    <option value="PLATO">PLATO</option>
                                    <option value="BEBIDA">BEBIDA</option>
                                </Form.Select>
                            </Col>

                            <Col md={3}>
                                <Form.Label>Estado</Form.Label>
                                <Form.Select
                                    value={filters.activo}
                                    onChange={(e) => setFilters({ ...filters, activo: e.target.value })}
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="1">Activos</option>
                                    <option value="0">Inactivos</option>
                                </Form.Select>
                            </Col>

                            <Col md={3} className="d-flex justify-content-end gap-2">
                                <Button className="btn-modern btn-buscar" onClick={loadProductos}>
                                    <BsSearch className="me-2" /> Aplicar Filtros
                                </Button>
                                <Button className="btn-modern btn-nuevo" onClick={() => handleOpenModal(null)}>
                                    <BsPlusLg className="me-2" /> Nuevo
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* TABLA DE PRODUCTOS */}
                <Card className="shadow-sm border-0">
                    <Card.Body>
                        <div className="table-responsive">
                            <Table responsive hover className="align-middle productos-table-list">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Producto</th>
                                        <th>Tipo</th>
                                        <th className="text-end">Precio</th>
                                        <th className="text-center">Estado</th>
                                        <th className="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.length > 0 ? (
                                        productos.map((p) => (
                                            <tr key={p.id_producto} className={p.activo === 0 ? 'table-row-inactive' : ''}>
                                                <td><img src={p.img_url || 'placeholder.jpg'} alt={p.nombre} className="product-thumb" /></td>
                                                <td>
                                                    <div className="fw-bold text-marron">{p.nombre}</div>
                                                    <small className="text-muted">ID: {p.id_producto}</small>
                                                </td>
                                                <td>
                                                    <Badge bg={p.tipo === 'PLATO' ? 'info' : 'secondary'}>{p.tipo}</Badge>
                                                </td>
                                                <td className="text-end text-success fw-bold">Bs {Number(p.precio).toFixed(2)}</td>
                                                <td className="text-center">
                                                    <Badge bg={p.activo === 1 ? 'success' : 'danger'}>
                                                        {p.activo === 1 ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </td>
                                                <td className="text-center text-nowrap">
                                                    <Button variant="outline-success" size="sm" className="me-2" onClick={() => handleOpenModal(p)}>
                                                        <BsPencilSquare />
                                                    </Button>
                                                    {p.activo === 1 ? (
                                                        <Button variant="outline-danger" size="sm" onClick={() => handleEstadoChange(p, 0)}>
                                                            <BsTrash />
                                                        </Button>
                                                    ) : (
                                                        <Button variant="outline-success" size="sm" onClick={() => handleEstadoChange(p, 1)}>
                                                            <BsCheckCircle />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="6" className="text-center p-4">No hay productos que coincidan con el filtro</td></tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Card.Body>
                </Card>
            </Container>
            
            {/* MODAL (Crear / Editar) */}
            <ProductoModal 
                show={showModal} 
                handleClose={handleCloseModal} 
                isEditing={!!editando} 
                form={form} 
                setForm={setForm} 
                file={file} 
                setFile={setFile} 
                handleSubmit={handleGuardarProducto} 
                productToEdit={editando} 
            />
        </div>
    );
}