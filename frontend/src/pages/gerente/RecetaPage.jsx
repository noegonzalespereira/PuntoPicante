import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Spinner, Modal } from 'react-bootstrap';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Swal from 'sweetalert2';
import { BsPlusLg, BsPencilFill, BsTrashFill, BsX, BsShop, BsCalculatorFill, BsCalendar3, BsBoxSeam } from 'react-icons/bs';
import '../../styles/RecetaPage.css'; // Asegúrate de que este archivo exista y esté linkeado
import PageHeader from "../../components/molecules/PageHeader";
// Importaciones REALES (Asegúrate de que estas rutas sean correctas)
import { recetaService } from '../../services/recetaService'; 
import { productoService } from '../../services/productoService'; 
import { format, isValid } from 'date-fns'; 

// ==========================================================
// COMPONENTE MODAL (GENERAL)
// ==========================================================
const ModalForm = ({ show, handleClose, title, children, buttonText, onSave, loadingSave }) => (
    <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {children}
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleClose} disabled={loadingSave}>
                Cancelar
            </Button>
            <Button variant="success" onClick={onSave} disabled={loadingSave}>
                {loadingSave ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> : null}
                {buttonText}
            </Button>
        </Modal.Footer>
    </Modal>
);

// ==========================================================
// 1. COMPONENTE PRINCIPAL (LÓGICA)
// ==========================================================

const RecetaPage = () => {
    // ESTADOS
    const [activeKey, setActiveKey] = useState('insumos');
    const [loading, setLoading] = useState(false);
    const [loadingSave, setLoadingSave] = useState(false);
    const [insumos, setInsumos] = useState([]);
    const [insumoSeleccionado, setInsumoSeleccionado] = useState(''); 
    const [costosHistorial, setCostosHistorial] = useState([]);
    const [productosPlato, setProductosPlato] = useState([]); 
    const [recetasGuardadas, setRecetasGuardadas] = useState([]); 
    const [showInsumoModal, setShowInsumoModal] = useState(false);
    const [insumoData, setInsumoData] = useState({ id_insumo: null, nombre: '', unidad_base: '' });
    const [showCostoModal, setShowCostoModal] = useState(false);
    const [costoData, setCostoData] = useState({ id_insumo: '', costo_unitario: 0, vigencia_desde: new Date().toISOString().split('T')[0], nota: '' });
    const [showRecetaModal, setShowRecetaModal] = useState(false);
    const [platoToEdit, setPlatoToEdit] = useState(null); 


    // UTILIDADES (Se mantienen)
    const safeFormatDate = (dateString) => {
        const date = new Date(dateString);
        return dateString && isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
    };
    const handleInsumoChange = (e) => { setInsumoData({ ...insumoData, [e.target.name]: e.target.value }); };
    const handleCostoChange = (e) => { setCostoData({ ...costoData, [e.target.name]: e.target.value }); };
    const handleSelectInsumoCostos = (e) => {
        const id = e.target.value;
        setInsumoSeleccionado(id);
        loadHistorialCostos(Number(id));
    };

    // HANDLERS DE MODALES
    const handleCloseInsumoModal = () => { setShowInsumoModal(false); setInsumoData({ id_insumo: null, nombre: '', unidad_base: '' }); };
    const handleOpenInsumoModal = (insumo = null) => {
        if (insumo) { setInsumoData({ id_insumo: insumo.id_insumo, nombre: insumo.nombre, unidad_base: insumo.unidad_base }); } else { setInsumoData({ id_insumo: null, nombre: '', unidad_base: '' }); }
        setShowInsumoModal(true);
    };
    const handleCloseCostoModal = () => { setShowCostoModal(false); };
    const handleOpenCostoModal = () => { setCostoData({ id_insumo: '', costo_unitario: 0, vigencia_desde: new Date().toISOString().split('T')[0], nota: '' }); setShowCostoModal(true); };
    const handleCloseRecetaModal = () => { setShowRecetaModal(false); setPlatoToEdit(null); };
    const handleOpenRecetaModal = (plato = null) => { setPlatoToEdit(plato); setShowRecetaModal(true); };


    // LLAMADAS A API
    const loadInsumos = useCallback(async () => {
        try {
            setLoading(true);
            const data = await recetaService.listarInsumos();
            setInsumos(data);
        } catch (error) { console.error(error); Swal.fire('Error', error.response?.data?.message || 'No se pudieron cargar los insumos.', 'error'); } finally { setLoading(false); }
    }, []);

    const loadPlatosYRecetas = useCallback(async () => {
        try {
            setLoading(true);
            const platos = await productoService.listarPorTipo('PLATO');
            setProductosPlato(platos);
            const recetas = await recetaService.listarResumenRecetas();
            setRecetasGuardadas(recetas);
        } catch (error) { console.error(error); Swal.fire('Error', error.response?.data?.message || 'No se pudieron cargar los datos de recetas/platos.', 'error'); } finally { setLoading(false); }
    }, []);

    const loadHistorialCostos = async (id_insumo) => {
        setCostosHistorial([]); 
        if (!id_insumo) return;
        setLoading(true);
        try {
            const data = await recetaService.getHistorialCostos(id_insumo);
            setCostosHistorial(data);
        } catch (error) { console.error(error); Swal.fire('Error', error.response?.data?.message || 'No se pudo cargar el historial de costos.', 'error'); } finally { setLoading(false); }
    };

    // Lógica CRUD (Placeholders)
    const handleSaveInsumo = async () => { /* Aquí va la lógica de guardar/editar insumo con recetaService */ handleCloseInsumoModal(); };
    const handleSaveCosto = async () => { /* Aquí va la lógica de setCostoInsumo con recetaService */ handleCloseCostoModal(); };
    const handleEliminarInsumo = async (id) => { /* Aquí va la lógica de eliminar insumo */ };
    const handleViewReceta = async (id_plato) => { /* Aquí va la lógica de ver detalle de receta */ };
    const handleSaveReceta = () => { /* Aquí va la lógica de upsertReceta */ handleCloseRecetaModal(); };


    // EFECTO DE CARGA INICIAL
    useEffect(() => {
        loadInsumos();
        loadPlatosYRecetas();
    }, [loadInsumos, loadPlatosYRecetas]);


    // ==========================================================
    // 2. RENDERIZACIÓN DE PESTAÑAS (JSX)
    // ==========================================================

    const InsumosTabContent = () => (
        <div className='tab-content-inner'>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className='text-marron fw-bold'>Insumos</h4>
                    <p className='text-muted'>Gestión de insumos base para recetas</p>
                </div>
                <Button className="btn-primary-green" onClick={() => handleOpenInsumoModal(null)}>
                    <BsPlusLg className="me-2" /> Nuevo Insumo
                </Button>
            </div>
            
            {loading ? <div className='text-center p-5'><Spinner animation="border" variant="secondary" /></div> : (
                <Table responsive className="table-recetas table-striped">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Unidad Base</th>
                            <th>Fecha Creación</th>
                            <th className="text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {insumos.map((insumo) => (
                            <tr key={insumo.id_insumo}>
                                <td>{insumo.nombre}</td>
                                <td>{insumo.unidad_base}</td>
                                <td>{safeFormatDate(insumo.created_at)}</td>
                                <td className="text-center">
                                    <BsPencilFill className="action-icon edit me-3" title="Editar" onClick={() => handleOpenInsumoModal(insumo)} />
                                    <BsTrashFill className="action-icon delete" title="Eliminar" onClick={() => handleEliminarInsumo(insumo.id_insumo)} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </div>
    );

    const CostosHistoricosTabContent = () => (
        <div className='tab-content-inner'>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className='text-marron fw-bold'>Costos Históricos</h4>
                    <p className='text-muted'>Registro de precios de insumos por fecha</p>
                </div>
                <Button className="btn-warning-yellow" onClick={handleOpenCostoModal}>
                    <BsPlusLg className="me-2" /> Nuevo Costo
                </Button>
            </div>
            
            <Row className="mb-4">
                <Col md={6}>
                    <Form.Group>
                        <Form.Label className='fw-bold'>Seleccione un insumo para ver su historial de costos</Form.Label>
                        <Form.Select value={insumoSeleccionado} onChange={handleSelectInsumoCostos}>
                            <option value="">Seleccione insumo</option>
                            {insumos.map(i => (<option key={i.id_insumo} value={i.id_insumo}>{i.nombre}</option>))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
            
            {insumoSeleccionado && (
                <Card className="mt-4 p-0">
                    <Card.Header className='bg-light d-flex justify-content-between align-items-center'>
                        <h5 className='mb-0 text-marron'>Historial de Costos ({insumos.find(i => i.id_insumo == insumoSeleccionado)?.nombre})</h5>
                        <BsX className='action-icon delete' title='Limpiar' onClick={() => { setInsumoSeleccionado(''); setCostosHistorial([]); }}/>
                    </Card.Header>
                    <Table responsive className="table-recetas m-0">
                        <thead>
                            <tr>
                                <th>Costo Unitario</th>
                                <th>Vigencia Desde</th>
                                <th>Nota</th>
                                <th>Registro Creado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? 
                                <tr><td colSpan="4" className='text-center'><Spinner animation="border" size="sm" /></td></tr> 
                                : costosHistorial.length > 0 ? (
                                costosHistorial.map((costo) => (
                                    <tr key={costo.id_costo}>
                                        <td>${Number(costo.costo_unitario).toFixed(4)} / {costo.insumo.unidad_base}</td>
                                        <td>{safeFormatDate(costo.vigencia_desde)}</td>
                                        <td>{costo.nota || 'N/A'}</td>
                                        <td>{safeFormatDate(costo.created_at)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="4" className='text-center'>No hay historial de costos para este insumo.</td></tr>
                            )}
                        </tbody>
                    </Table>
                </Card>
            )}
        </div>
    );

    const RecetasPorPlatoTabContent = () => (
        <div className='tab-content-inner'>
            <div className="mb-4">
                <h4 className='text-marron fw-bold'>Definición de Recetas</h4>
                <p className='text-muted'>Define ingredientes, merma y calcula el costo teórico del plato</p>
            </div>

            <Row className="mb-5">
                <Col md={6}>
                    <Form.Group>
                        <Form.Label className='fw-bold'>Seleccione un Plato para crear/editar receta</Form.Label>
                        <Form.Select 
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                if (id) { handleOpenRecetaModal(productosPlato.find(p => p.id_producto === id)); }
                            }}
                        >
                            <option value="">Seleccione plato</option>
                            {productosPlato.map(p => (<option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
            
            <h5 className='text-marron fw-bold mt-4'>Recetas Guardadas</h5>
            <p className='text-muted'>Platos con recetas definidas ({recetasGuardadas.length} en total)</p>
            
            <Card className="p-0 mt-3 border-0">
                <Table responsive className="table-recetas m-0 table-striped">
                    <thead>
                        <tr>
                            <th>Plato</th>
                            <th>Ingredientes</th>
                            <th>Costo Teórico</th>
                            <th>Última Actualización</th>
                            <th className="text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recetasGuardadas.length === 0 ? (
                            <tr><td colSpan="5" className='text-center'>Aún no hay recetas definidas.</td></tr>
                        ) : (
                            recetasGuardadas.map((receta) => (
                                <tr key={receta.id_producto}>
                                    <td>{receta.nombre}</td>
                                    <td>{receta.ingredientes_count} ingredientes</td>
                                    <td className="font-weight-bold text-success">${receta.costo_teorico}</td>
                                    <td>{safeFormatDate(receta.ultima_actualizacion)}</td>
                                    <td className="text-center">
                                        <BsCalculatorFill className="action-icon edit me-3" title="Ver Desglose de Costos" onClick={() => handleViewReceta(receta.id_producto)} />
                                        <BsPencilFill className="action-icon edit" title="Editar Receta" onClick={() => handleOpenRecetaModal(receta)} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            </Card>
        </div>
    );

    // ==========================================================
    // 3. ESTRUCTURA PRINCIPAL (Cuerpo de la Página y Modales)
    // ==========================================================

    return (
        <div className="recetas-page-wrapper">
            
            {/* HEADER CON GRADIENTE - Ocupa todo el ancho */}
            <PageHeader title="Gestión de Recetas y Costos" subtitle="Definición de insumos y cálculo de costo teórico" />
            
            <Container fluid className='px-3'> {/* Contenedor fluid para el cuerpo de la página */}
                
                {/* NAVEGACIÓN Y CONTENIDO */}
                <Card className='card-tabs-container'>
                    <Tabs
                        activeKey={activeKey}
                        onSelect={(k) => setActiveKey(k)}
                        id="recetas-tab-system"
                        className="nav-recetas mb-3"
                        justify
                    >
                        <Tab eventKey="insumos" title={<><BsBoxSeam className='me-2'/> Insumos</>}>
                            {InsumosTabContent()}
                        </Tab>
                        <Tab eventKey="costos" title={<><BsCalendar3 className='me-2'/> Costos Históricos</>}>
                            {CostosHistoricosTabContent()}
                        </Tab>
                        <Tab eventKey="recetas" title={<><BsShop className='me-2'/> Recetas por Plato</>}>
                            {RecetasPorPlatoTabContent()}
                        </Tab>
                    </Tabs>
                </Card>
            </Container>
            
            
            {/* --- Modales de funcionalidad --- */}

            <ModalForm show={showInsumoModal} handleClose={handleCloseInsumoModal} title={insumoData.id_insumo ? `Editar Insumo: ${insumoData.nombre}` : "Crear Nuevo Insumo"} buttonText={insumoData.id_insumo ? "Guardar Cambios" : "Crear Insumo"} onSave={handleSaveInsumo} loadingSave={loadingSave}>
                <Form>
                    <Form.Group className="mb-3"><Form.Label>Nombre del Insumo</Form.Label>
                        <Form.Control type="text" name="nombre" value={insumoData.nombre} onChange={handleInsumoChange} placeholder="Ej: Carne de Cerdo" required />
                    </Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Unidad Base (Ej: kg, unidad, ml)</Form.Label>
                        <Form.Control type="text" name="unidad_base" value={insumoData.unidad_base} onChange={handleInsumoChange} placeholder="Ej: kg" required />
                    </Form.Group>
                </Form>
            </ModalForm>

            <ModalForm show={showCostoModal} handleClose={handleCloseCostoModal} title="Registrar Nuevo Costo de Insumo" buttonText="Registrar Costo" onSave={handleSaveCosto} loadingSave={loadingSave}>
                <Form>
                    <Form.Group className="mb-3"><Form.Label>Insumo</Form.Label>
                        <Form.Select name="id_insumo" value={costoData.id_insumo} onChange={handleCostoChange} required>
                            <option value="">Seleccionar Insumo</option>
                            {insumos.map(i => (<option key={i.id_insumo} value={i.id_insumo}>{i.nombre} ({i.unidad_base})</option>))}
                        </Form.Select></Form.Group>
                    <Row><Col><Form.Group className="mb-3"><Form.Label>Costo Unitario</Form.Label>
                        <Form.Control type="number" name="costo_unitario" value={costoData.costo_unitario} onChange={handleCostoChange} placeholder="Ej: 15.50" min="0" step="0.01" required /></Form.Group></Col>
                    <Col><Form.Group className="mb-3"><Form.Label>Vigencia Desde</Form.Label>
                        <Form.Control type="date" name="vigencia_desde" value={costoData.vigencia_desde} onChange={handleCostoChange} required /></Form.Group></Col></Row>
                    <Form.Group className="mb-3"><Form.Label>Nota (Opcional)</Form.Label>
                        <Form.Control as="textarea" rows={2} name="nota" value={costoData.nota} onChange={handleCostoChange} /></Form.Group>
                </Form>
            </ModalForm>
            
            <ModalForm show={showRecetaModal} handleClose={handleCloseRecetaModal} title={`Receta: ${platoToEdit ? platoToEdit.nombre : 'Seleccionar Plato'}`} buttonText="Guardar Receta" onSave={handleSaveReceta} loadingSave={loadingSave}>
                <p className='text-danger'>*Este formulario debe manejar la lista de ingredientes (insumos), cantidad base y merma.*</p>
                <h5 className='text-marron'>Definir Ingredientes para {platoToEdit?.nombre}</h5>
                <Button variant="outline-success" size="sm"><BsPlusLg className="me-1" /> Añadir Insumo</Button>
            </ModalForm>
            
        </div>
    );
};

export default RecetaPage;