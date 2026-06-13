import React, { useEffect, useState, useCallback } from "react";
import { Container, Row, Col, Card, Table, Button, Form, InputGroup, Spinner, Modal, Badge } from "react-bootstrap";
import Swal from "sweetalert2";
import { usuarioService } from "../../services/usuariosService";
import "../../styles/UsuariosPage.css";
import { BsCalendar, BsFunnel, BsSearch, BsPencil, BsTrash, BsPeopleFill, BsPersonPlusFill, BsPersonLinesFill, BsCheckCircle, BsXCircle, BsLock, BsListNested } from "react-icons/bs";
import PageHeader from "../../components/molecules/PageHeader";


const UsuarioModal = ({ show, handleClose, isEditing, form, setForm, handleSubmit }) => (
    <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton className="modal-header-custom border-0">
            <Modal.Title className="fw-bold text-marron">
                <BsPersonLinesFill className="me-2" />
                {isEditing ? "Editar Usuario" : "Nuevo Usuario"}
            </Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <p className="text-muted mb-3">
                Completa los datos para {isEditing ? "actualizar" : "crear"} un usuario.
            </p>
            <Form>
                <Form.Group className="mb-3"><Form.Label className="fw-semibold">Nombre completo *</Form.Label>
                    <Form.Control name="nombre" placeholder="Ej: Juan Pérez" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                </Form.Group>

                <Form.Group className="mb-3"><Form.Label className="fw-semibold">Email *</Form.Label>
                    <Form.Control type="email" name="email" placeholder="usuario@elpuntopicante.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Contraseña {isEditing ? "(Dejar vacío para no cambiar)" : "*"}</Form.Label>
                    <Form.Control type="password" name="password" placeholder="********" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!isEditing} />
                </Form.Group>
                
                <Row className="g-3">
                    <Col md={12}>
                        <Form.Label className="fw-semibold">Rol *</Form.Label>
                        <Form.Select name="rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                            <option value="GERENTE">Gerente</option>
                            <option value="CAJERO">Cajero</option>
                            <option value="COCINA">Cocina</option>
                        </Form.Select>
                    </Col>
                </Row>
            </Form>
        </Modal.Body>
        <Modal.Footer className="border-0">
            <Button variant="outline-secondary" onClick={handleClose}>Cancelar</Button>
            <Button variant="danger" className="px-4 btn-guardar-modal" onClick={handleSubmit}>
                {isEditing ? "Guardar Cambios" : "Crear Usuario"}
            </Button>
        </Modal.Footer>
    </Modal>
);



export default function UsuariosPage() {
    // ESTADOS
    const [usuarios, setUsuarios] = useState([]);
    const [filtro, setFiltro] = useState({ nombre: "", rol: "Todos" });
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({
        id_usuario: null,
        nombre: "",
        email: "",
        password: "",
        rol: "CAJERO",
    });
    const [stats, setStats] = useState({ total: 0, cajeros: 0, cocina: 0 });

    // 3. LÓGICA DE CARGA Y FILTRO
    const cargarUsuarios = useCallback(async () => {
        try {
            setLoading(true);
            const resp = await usuarioService.getAll(filtro);
            
            // CORRECCIÓN CLAVE: Si NestJS devuelve el array directamente, usamos 'resp'. 
            // Si lo envuelve en 'data', usamos 'resp.data'.
            const dataArray = Array.isArray(resp) ? resp : (resp.data || []); 

            const total = dataArray.length;
            const cajeros = dataArray.filter((u) => u.rol === "CAJERO").length;
            const cocina = dataArray.filter((u) => u.rol === "COCINA").length;

            setUsuarios(dataArray); 
            setStats({ total, cajeros, cocina });
        } catch (error) {
            Swal.fire("Error", "No se pudieron cargar los usuarios", "error");
        } finally {
            setLoading(false);
        }
    }, [filtro]);

    useEffect(() => {
        cargarUsuarios();
    }, [cargarUsuarios]);


    // 4. HANDLERS CRUD
    
    const handleCloseModal = () => setShowModal(false);

    const abrirNuevo = () => {
        setEditMode(false);
        setForm({ nombre: "", email: "", password: "", rol: "CAJERO", id_usuario: null });
        setShowModal(true);
    };

    const abrirEditar = (user) => {
        setEditMode(true);
        setForm({
            id_usuario: user.id_usuario,
            nombre: user.nombre,
            email: user.email,
            password: "", 
            rol: user.rol,
        });
        setShowModal(true);
    };

    const handleGuardarUsuarioSubmit = async () => {
        if (!form.nombre || !form.email || (!editMode && !form.password) || !form.rol) {
            Swal.fire("Advertencia", "Completa todos los campos obligatorios", "warning");
            return;
        }

        try {
            const userData = { ...form };

            if (editMode) {
                if (!form.password) delete userData.password;
                await usuarioService.update(form.id_usuario, userData);
                Swal.fire("Éxito", "Usuario actualizado correctamente", "success");
            } else {
                delete userData.id_usuario; 
                await usuarioService.create(userData);
                Swal.fire("Éxito", "Usuario creado correctamente", "success");
            }

            handleCloseModal();
            await cargarUsuarios(); // Recargar la lista
        } catch (error) {
            Swal.fire("Error", error.response?.data?.message || "Error al guardar el usuario", "error");
        }
    };

    async function eliminarUsuario(id) {
        const confirm = await Swal.fire({
            title: "¿Eliminar usuario?",
            text: "Esta acción no se puede deshacer.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
        });
        if (!confirm.isConfirmed) return;

        try {
            await usuarioService.remove(id);
            Swal.fire("Éxito", "Usuario eliminado", "success");
            await cargarUsuarios();
        } catch {
            Swal.fire("Error", "Error al eliminar", "error");
        }
    }

    // 5. Utilidades de Renderizado
    const getBadgeColor = (rol) => {
        switch (rol) {
            case "GERENTE": return "danger";
            case "CAJERO": return "warning";
            case "COCINA": return "success";
            default: return "secondary";
        }
    };

    const listaFiltradaAplicada = usuarios.filter(
        (u) =>
            (filtro.rol === "Todos" || u.rol === filtro.rol) &&
            (u.nombre.toLowerCase().includes(filtro.nombre.toLowerCase()) ||
             u.email.toLowerCase().includes(filtro.nombre.toLowerCase()))
    );

    // 6. RENDERIZACIÓN DE VISTA (JSX)

    if (loading)
        return (
            <Container fluid className="text-center p-5">
                <Spinner animation="border" variant="primary" />
            </Container>
        );

    return (
        <div className="usuarios-page">
            
            {/* HEADER CON GRADIENTE */}
            <PageHeader title="Gestión de Usuarios" subtitle="Administración y roles del personal del sistema" />

            <Container fluid className="px-3">
                
                {/* BOTÓN Y ESTADÍSTICAS */}
                <Row className="g-3 mb-4 align-items-center">
                    <Col xs={12} lg={4}>
                        <Button variant="danger" className="btn-modern btn-nuevo-usuario" onClick={abrirNuevo}>
                            <BsPersonPlusFill className="me-2" /> Registrar Nuevo Usuario
                        </Button>
                    </Col>

                    {/* CARDS RESUMEN */}
                    <Col xs={12} lg={8}>
                        <Row className="g-3">
                            <Col sm={4} md={4}>
                                <Card className="kpi-card kpi-marron h-100">
                                    <Card.Body>
                                        <h6 className="text-muted mb-1">Total Usuarios</h6>
                                        <h3 className="fw-bold text-marron">{stats.total}</h3>
                                    </Card.Body>
                                </Card>
                            </Col>

                            <Col sm={4} md={4}>
                                <Card className="kpi-card kpi-amarillo h-100">
                                    <Card.Body>
                                        <h6 className="text-muted mb-1">Cajeros</h6>
                                        <h3 className="fw-bold text-warning">{stats.cajeros}</h3>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col sm={4} md={4}>
                                <Card className="kpi-card kpi-verde h-100">
                                    <Card.Body>
                                        <h6 className="text-muted mb-1">Personal de Cocina</h6>
                                        <h3 className="fw-bold text-success">{stats.cocina}</h3>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    </Col>
                </Row>

                {/* FILTROS Y LISTADO */}
                <Row className="g-3">
                    <Col xs={12}>
                        {/* FILTROS */}
                        <Card className="shadow-sm border-0 mb-4 filtro-card-modern">
                            <Card.Header className="bg-light fw-bold text-marron">
                                <BsFunnel className="me-2 text-rojo" />Filtros
                            </Card.Header>
                            <Card.Body>
                                <Row className="align-items-end g-3">
                                    <Col md={8} lg={6}>
                                        <Form.Label className="fw-bold">Buscar por nombre o email</Form.Label>
                                        <InputGroup>
                                            <InputGroup.Text><BsSearch /></InputGroup.Text>
                                            <Form.Control
                                                type="text"
                                                placeholder="Ingrese texto para buscar"
                                                value={filtro.nombre}
                                                onChange={(e) => setFiltro({ ...filtro, nombre: e.target.value })}
                                            />
                                        </InputGroup>
                                    </Col>
                                    <Col md={4} lg={3}>
                                        <Form.Label className="fw-bold">Rol</Form.Label>
                                        <Form.Select
                                            value={filtro.rol}
                                            onChange={(e) => setFiltro({ ...filtro, rol: e.target.value })}
                                        >
                                            <option>Todos</option>
                                            <option value="GERENTE">Gerente</option>
                                            <option value="CAJERO">Cajero</option>
                                            <option value="COCINA">Cocina</option>
                                        </Form.Select>
                                    </Col>
                                    <Col md={4} lg={3} className="d-flex justify-content-end gap-2">
                                        <Button className="btn-modern btn-buscar" onClick={cargarUsuarios}>
                                            <BsSearch className="me-2" /> Aplicar Filtros
                                        </Button>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>

                        {/* LISTADO */}
                        <Card className="shadow-sm border-0">
                            <Card.Header className="bg-marron text-light fw-bold d-flex align-items-center header-listado">
                                <BsListNested className="me-2" />Listado de Usuarios ({listaFiltradaAplicada.length})
                            </Card.Header>
                            <Card.Body className="p-0">
                                {!listaFiltradaAplicada.length ? (
                                    <p className="text-center text-muted my-4">
                                        <i className="bi bi-inbox me-2"></i>No hay usuarios registrados
                                    </p>
                                ) : (
                                    <Table responsive hover className="align-middle mb-0 usuarios-table tabla-responsive-cards">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Email</th>
                                                <th>Rol</th>
                                                <th>Fecha Creación</th>
                                                <th className="text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {listaFiltradaAplicada.map((u) => (
                                                <tr key={u.id_usuario}>
                                                    <td data-label="Nombre" className="fw-semibold text-marron">{u.nombre}</td>
                                                    <td data-label="Email" className="text-muted">{u.email}</td>
                                                    <td data-label="Rol">
                                                        <Badge bg={getBadgeColor(u.rol)} pill>
                                                            {u.rol}
                                                        </Badge>
                                                    </td>
                                                    <td data-label="Creado">{new Date(u.created_at).toLocaleDateString("es-BO")}</td>
                                                    <td data-label="Acciones" className="text-center text-nowrap celda-acciones">
                                                        <Button variant="outline-success" size="sm" className="me-2" onClick={() => abrirEditar(u)}>
                                                            <BsPencil />
                                                        </Button>
                                                        <Button variant="outline-danger" size="sm" onClick={() => eliminarUsuario(u.id_usuario)}>
                                                            <BsTrash />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>

            {/* MODAL CREAR / EDITAR */}
            <UsuarioModal 
                show={showModal} 
                handleClose={handleCloseModal} 
                isEditing={editMode} 
                form={form} 
                setForm={setForm} 
                handleSubmit={handleGuardarUsuarioSubmit} 
            />
        </div>
    );
}