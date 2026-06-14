import React, { useEffect, useState, useCallback } from "react";
import { Container, Row, Col, Card, Button, InputGroup, FormControl, Table, Form, Modal, Spinner, Badge, Alert } from "react-bootstrap";
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Swal from "sweetalert2";
import { toast } from "sonner";
import { stockService } from "../../services/stockService";
import { productoService } from "../../services/productoService";
import "../../styles/StockPage.css";
import PageHeader from "../../components/molecules/PageHeader";
import { BsCalendar, BsFunnel, BsSearch, BsXCircle, BsPlusLg, BsCashCoin, BsClipboardData, BsReceipt, BsListNested, BsBagPlus, BsBoxSeam, BsEye, BsTable, BsCalendar3, BsFillTrashFill, BsPencilSquare, BsCashStack, BsCupStraw, BsEggFried } from "react-icons/bs";

function hoyLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseFechaLocal(fechaStr) {
    if (!fechaStr || typeof fechaStr !== 'string') return undefined;
    const parts = fechaStr.split('-');
    if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return undefined;
}


const BebidaModal = ({ show, handleClose, bebidasBase, cantidad, setCantidad, bebida, setBebida, onSave }) => (
    <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton className="modal-header-custom">
            <Modal.Title className="text-marron fw-bold"><BsBagPlus className="me-2" /> Registrar Ingreso de Bebida</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form.Group className="mb-3"><Form.Label>Bebida</Form.Label>
                <Form.Select value={bebida} onChange={(e) => setBebida(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {bebidasBase.map((b) => (<option key={b.id_producto} value={b.id_producto}>{b.nombre}</option>))}
                </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3"><Form.Label>Cantidad a ingresar</Form.Label>
                <Form.Control type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
            </Form.Group>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button variant="success" onClick={onSave}><i className="bi bi-save me-2"></i> Guardar Ingreso</Button>
        </Modal.Footer>
    </Modal>
);

const MermaModal = ({ show, handleClose, data, mermaState, setMermaState, onSave }) => {
    const productosFiltrados = mermaState.tipoMerma === "PLATO" ? data.platos : data.bebidas;
    
    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton className="modal-header-custom">
                <Modal.Title className="text-rojo fw-bold"><BsFillTrashFill className="me-2" /> Registrar Merma</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group className="mb-3"><Form.Label>Tipo</Form.Label>
                        <Form.Select value={mermaState.tipoMerma} onChange={(e) => setMermaState({ ...mermaState, tipoMerma: e.target.value, productoMerma: "" })}>
                            <option value="PLATO">Plato</option><option value="BEBIDA">Bebida</option>
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Fecha</Form.Label>
                        <Form.Control type="date" value={mermaState.fechaMerma} onChange={(e) => setMermaState({ ...mermaState, fechaMerma: e.target.value })} />
                    </Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Producto</Form.Label>
                        <Form.Select value={mermaState.productoMerma} onChange={(e) => setMermaState({ ...mermaState, productoMerma: e.target.value })}>
                            <option value="">Seleccionar</option>
                            {productosFiltrados.map((p) => (<option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>))}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Cantidad</Form.Label>
                        <Form.Control type="number" min="1" value={mermaState.cantidadMerma} onChange={(e) => setMermaState({ ...mermaState, cantidadMerma: e.target.value })} placeholder="0" />
                    </Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Motivo</Form.Label>
                        <Form.Control type="text" value={mermaState.motivoMerma} onChange={(e) => setMermaState({ ...mermaState, motivoMerma: e.target.value })} placeholder="Ej: Plato quemado" />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                <Button variant="danger" onClick={onSave}><BsFillTrashFill className="me-2" /> Registrar Merma</Button>
            </Modal.Footer>
        </Modal>
    );
};



export default function StockPage() {
    const [activeTab, setActiveTab] = useState("disponibilidad");
    const [fecha_disponibilidad, setFecha_Disponibilidad] = useState(hoyLocal);
    const [fecha_apertura, setFecha_Apertura] = useState(hoyLocal);
    const [data, setData] = useState({ platos: [], bebidas: [], extras: [] });
    const [resumen, setResumen] = useState({ platos: 0, bebidas: 0, vendidos: 0 });
    const [platos, setPlatos] = useState([]);
    const [cantidades, setCantidades] = useState({});   // unidades a AÑADIR (incremental)
    const [infoPlatos, setInfoPlatos] = useState({});   // { [id]: { stock_inicial, disponible, vendido, merma } }
    const [bebidasBase, setBebidasBase] = useState([]);
    const [extrasBase, setExtrasBase] = useState([]);

    // Modal Extras
    const [showModalExtra, setShowModalExtra] = useState(false);
    const [extraSeleccionado, setExtraSeleccionado] = useState("");
    const [cantidadExtra, setCantidadExtra] = useState("");
    const [mermas, setMermas] = useState([]);
    const [loadingGeneral, setLoadingGeneral] = useState(false);

    // Modal Bebidas
    const [showModalBebida, setShowModalBebida] = useState(false);
    const [bebidaSeleccionada, setBebidaSeleccionada] = useState("");
    const [cantidadBebida, setCantidadBebida] = useState("");

    // Modal Mermas
    const [showModalMerma, setShowModalMerma] = useState(false);
    const [mermaState, setMermaState] = useState({
        tipoMerma: "PLATO",
        fechaMerma: hoyLocal(),
        productoMerma: "",
        cantidadMerma: "",
        motivoMerma: "",
    });

    const esFechaPasadaHandler = (fecha) => {
        const hoy = new Date();
        const seleccionada = parseFechaLocal(fecha);
        
        if (!seleccionada) return false; 
        
        hoy.setHours(0, 0, 0, 0);
        seleccionada.setHours(0, 0, 0, 0);
        return seleccionada.getTime() < hoy.getTime();
    };

    const cargarMermas = async () => { 
        try {
            const data = await stockService.getMermas(); 
            setMermas(data);
        } catch (error) { console.error("Error al cargar mermas:", error); }
    };
    
    const cargarDisponibilidad = useCallback(async () => { 
        setLoadingGeneral(true);
        try {
            const info = await stockService.getDisponible(fecha_disponibilidad);
            
            const totalPlatos = info.platos.reduce((acc, p) => acc + (p.stock ?? 0), 0);
            const totalBebidas = info.bebidas.reduce((acc, b) => acc + (b.stock ?? 0), 0);
            const vendidos = info.platos.reduce((acc, p) => acc + (p.vendido ?? 0), 0);
            
            setData({ platos: info.platos || [], bebidas: info.bebidas || [], extras: info.extras || [] });
            setResumen({ platos: totalPlatos, bebidas: totalBebidas, vendidos });
        } catch (error) { console.error("Error al cargar disponibilidad:", error); }
        finally { setLoadingGeneral(false); }
    }, [fecha_disponibilidad]);

    const cargarPlatosBase = async () => { 
        try {
            const { data: base } = await productoService.getAll({ tipo: "PLATO", activo: 1 });
            setPlatos(base || []);
        } catch (error) { console.error("Error al cargar productos base:", error); }
    };

    const cargarBebidasBase = async () => {
        try {
            const { data } = await productoService.getAll({ tipo: "BEBIDA", activo: 1 });
            setBebidasBase(data || []);
        } catch (error) { console.error("Error al cargar bebidas base:", error); }
    };

    const cargarExtrasBase = async () => {
        try {
            const { data } = await productoService.getAll({ tipo: "EXTRA", activo: 1 });
            setExtrasBase(data || []);
        } catch (error) { console.error("Error al cargar extras base:", error); }
    };

    const registrarIngresoExtra = async () => {
        try {
            if (!extraSeleccionado || Number(cantidadExtra) <= 0) {
                toast.warning("Selecciona un producto extra y una cantidad válida");
                return;
            }
            await stockService.ingresoExtra({
                id_producto: Number(extraSeleccionado),
                cantidad: Number(cantidadExtra),
            });
            toast.success("Ingreso de extra registrado correctamente");
            setShowModalExtra(false);
            setExtraSeleccionado("");
            setCantidadExtra("");
            cargarDisponibilidad();
            cargarExtrasBase();
        } catch (error) {
            toast.error("Error al registrar ingreso extra");
        }
    };

    const cargarAperturaExistente = async () => {
        try {
            const info = await stockService.getDisponible(fecha_apertura);

            // Guardamos info completa por producto para calcular nueva cantidad_inicial al guardar
            const mapInfo = {};
            info.platos.forEach((p) => {
                mapInfo[p.id_producto] = {
                    stock_inicial: p.stock_inicial ?? 0,
                    disponible:   p.stock       ?? 0,
                    vendido:      p.vendido     ?? 0,
                    merma:        p.merma       ?? 0,
                };
            });

            const { data: base } = await productoService.getAll({ tipo: "PLATO", activo: 1 });
            setPlatos(base || []);
            setInfoPlatos(mapInfo);
            setCantidades({}); // campo "a añadir" empieza vacío
        } catch (error) { console.error("Error al cargar apertura existente:", error); }
    };

    const guardarApertura = async () => {
        try {
            const items = Object.entries(cantidades)
                .filter(([_, cant]) => cant !== "" && Number(cant) > 0)
                .map(([id_producto, adicional]) => {
                    const info = infoPlatos[id_producto] ?? { stock_inicial: 0 };
                    return {
                        id_producto: Number(id_producto),
                        // nueva cantidad_inicial = lo que había + lo que se añade ahora
                        cantidad_inicial: info.stock_inicial + Number(adicional),
                    };
                });

            if (items.length === 0) {
                toast.warning("Ingresa al menos una cantidad a añadir mayor a cero.");
                return;
            }

            await stockService.registrarApertura({ fecha: fecha_apertura, items });
            toast.success("Stock actualizado correctamente");
            await cargarAperturaExistente(); // refresca disponibles
            cargarDisponibilidad();
        } catch (error) {
            toast.error("Error al registrar la apertura");
        }
    };

    const registrarIngresoBebida = async () => { 
        try {
            if (!bebidaSeleccionada || Number(cantidadBebida) <= 0) {
                toast.warning("Selecciona una bebida y cantidad válida");
                return;
            }
            await stockService.ingresoBebida({
                id_producto: Number(bebidaSeleccionada),
                cantidad: Number(cantidadBebida),
            });
            toast.success("Ingreso de bebida registrado correctamente");
            setShowModalBebida(false);
            setBebidaSeleccionada("");
            setCantidadBebida("");
            cargarDisponibilidad();
            cargarBebidasBase();
        } catch (error) {
            toast.error("Error al registrar ingreso");
        }
    };

    const registrarMerma = async () => { 
        try {
            if (!mermaState.productoMerma || Number(mermaState.cantidadMerma) <= 0) {
                toast.warning("Completa producto y cantidad válida");
                return;
            }

            await stockService.registrarMerma({
                sobre: mermaState.tipoMerma,
                id_producto: Number(mermaState.productoMerma),
                cantidad: Number(mermaState.cantidadMerma),
                motivo: mermaState.motivoMerma,
                fecha: mermaState.fechaMerma,
            });

            toast.success("Merma registrada correctamente");
            setShowModalMerma(false);
            setMermaState({ ...mermaState, cantidadMerma: "", motivoMerma: "", productoMerma: "" });
            cargarDisponibilidad();
            cargarMermas();
        } catch (error) {
            toast.error("Error al registrar merma");
        }
    };

    useEffect(() => { cargarDisponibilidad(); }, [fecha_disponibilidad, activeTab, cargarDisponibilidad]); 
    useEffect(() => { if (activeTab === "apertura") { cargarPlatosBase(); cargarAperturaExistente(); } }, [activeTab, fecha_apertura]);
    useEffect(() => { if (activeTab === "bebidas") { cargarBebidasBase(); } }, [activeTab]);
    useEffect(() => { if (activeTab === "extras") { cargarExtrasBase(); cargarDisponibilidad(); } }, [activeTab]);
    useEffect(() => { if (activeTab === "mermas") { cargarMermas(); } }, [activeTab]);




    const TabDisponibilidad = () => (
        <Card className="stock-card-content">
            <Card.Body>
                <h4 className="titulo-seccion-card fw-bold"><BsEye className="me-2" /> Stock Actual por Categoría</h4>
                <Row className="mb-4 align-items-end g-3">
                    <Col md={4}>
                        <Form.Label className="fw-bold">Fecha de Consulta</Form.Label>
                        <InputGroup>
                            <InputGroup.Text><BsCalendar3 /></InputGroup.Text>
                            <Form.Control
                                type="date"
                                value={fecha_disponibilidad}
                                onChange={(e) => setFecha_Disponibilidad(e.target.value)}
                            />
                        </InputGroup>
                    </Col>
                </Row>

                {/* Bloques de Stock */}
                <Row className="g-4">
                    {/* Platos */}
                    <Col lg={6}>
                        <h5 className="mt-3 text-marron fw-bold"><BsBoxSeam className="me-2" /> Platos (Fecha: {fecha_disponibilidad})</h5>
                        <Table responsive className="tabla-stock tabla-responsive-cards">
                            <thead>
                                <tr><th>Producto</th><th>Stock Día</th><th>Vendido</th><th>Disponible</th></tr>
                            </thead>
                            <tbody>
                                {data.platos?.length > 0 ? data.platos.map((p) => {
                                    // Tres números independientes que vienen del kardex del backend:
                                    const stockDia = p.stock_inicial ?? 0;  // lo que se abrió (fijo)
                                    const vendido = p.vendido ?? 0;          // venta neta del día
                                    const disponible = p.stock ?? 0;         // lo que queda = inicial - vendido - merma

                                    return (
                                        <tr key={p.id_producto}>
                                            <td data-label="Producto">{p.nombre}</td>
                                            <td data-label="Stock Día" className="text-center text-marron">{stockDia}</td>
                                            <td data-label="Vendido" className="text-center text-primary">{vendido}</td>
                                            <td data-label="Disponible" className="text-center fw-bold">
                                                <Badge bg={disponible > 0 ? 'success' : 'danger'}>
                                                    {disponible}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan="4" className="text-center text-muted">No hay platos registrados.</td></tr>
                                )}
                            </tbody>
                        </Table>
                    </Col>
                    
                    {/* Bebidas */}
                    <Col lg={6}>
                        <h5 className="mt-3 text-marron fw-bold"><BsCashStack className="me-2" /> Bebidas (Stock Global)</h5>
                        <Table responsive className="tabla-stock tabla-responsive-cards">
                            <thead>
                                <tr><th>Producto</th><th>Ingresado</th><th>Vendido</th><th>Disponible</th></tr>
                            </thead>
                            <tbody>
                                {data.bebidas?.length > 0 ? data.bebidas.map((b) => (
                                    <tr key={b.id_producto}>
                                        <td data-label="Producto">{b.nombre}</td>
                                        <td data-label="Ingresado" className="text-center text-marron">{b.stock_inicial ?? 0}</td>
                                        <td data-label="Vendido" className="text-center text-primary">{b.vendido ?? 0}</td>
                                        <td data-label="Disponible" className="text-center fw-bold">
                                            <Badge bg={(b.stock ?? 0) > 0 ? 'success' : 'danger'}>{b.stock ?? 0}</Badge>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="4" className="text-center text-muted">No hay bebidas con stock.</td></tr>
                                )}
                            </tbody>
                        </Table>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );

    const TabApertura = () => (
        <Card className="stock-card-content">
            <Card.Body>
                <h4 className="titulo-seccion-card fw-bold">Apertura de Platos del Día</h4>
                <Row className="mb-4 align-items-end g-3">
                    <Col md={4}>
                        <Form.Label className="fw-bold">Seleccionar Fecha de Apertura</Form.Label>
                        <InputGroup>
                            <InputGroup.Text><BsCalendar3 /></InputGroup.Text>
                            <Form.Control
                                type="date"
                                value={fecha_apertura}
                                onChange={(e) => setFecha_Apertura(e.target.value)}
                                disabled={esFechaPasadaHandler(fecha_apertura)}
                            />
                        </InputGroup>
                    </Col>
                </Row>
                
                {esFechaPasadaHandler(fecha_apertura) && (
                    <Alert variant="warning" className='fw-bold'>
                        Esta fecha es pasada. No puede modificar las cantidades.
                    </Alert>
                )}
                
                {/* Estructura de Grilla para los Platos */}
                <Row className="lista-platos g-3 mt-3">
                    {platos.length > 0 ? (
                        platos.map((p) => (
                            <Col md={3} sm={4} xs={6} key={p.id_producto}>
                                <Card className='plato-apertura-card'>
                                    <Card.Body className='d-flex justify-content-between align-items-center p-2'>
                                        <span className='fw-bold'>{p.nombre}</span>
                                        <FormControl
                                            type="number"
                                            min="0"
                                            placeholder="Cant."
                                            className="input-stock-cant"
                                            value={cantidades[p.id_producto] || ""}
                                            disabled={esFechaPasadaHandler(fecha_apertura)}
                                            onChange={(e) => {
                                                if(esFechaPasadaHandler(fecha_apertura)) return;
                                                setCantidades({
                                                    ...cantidades,
                                                    [p.id_producto]: e.target.value,
                                                });
                                            }}
                                        />
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))
                    ) : (
                        <Col xs={12}><p className="text-center text-muted">No hay platos activos registrados.</p></Col>
                    )}
                </Row>

                <div className="text-center mt-5">
                    <Button
                        variant="success"
                        className="btn-guardar"
                        onClick={guardarApertura}
                        disabled={esFechaPasadaHandler(fecha_apertura)}
                    >
                        <i className="bi bi-save me-2"></i>
                        Guardar Apertura
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );

    const TabBebidas = () => (
        <Card className="stock-card-content">
            <Card.Body>
                <h4 className="titulo-seccion-card fw-bold"><BsCashStack className="me-2" /> Registro de Ingreso de Stock de Bebidas</h4>
                <p className="text-muted">Utilice esta sección para registrar la compra y el ingreso de botellas o unidades de bebidas al inventario.</p>
                <Button className="btn-bebida mb-4" onClick={() => setShowModalBebida(true)}>
                    <BsBagPlus className="me-2" /> Ingresar Nueva Bebida
                </Button>

                <h5 className="mt-4 mb-3 fw-bold text-dark-gray"><BsTable className="me-2" /> Bebidas Registradas </h5>
                <Table responsive hover size="sm" className="tabla-stock tabla-responsive-cards">
                    <thead>
                        <tr>
                            <th>Nombre de la Bebida</th>
                            <th>Stock Global</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bebidasBase.length > 0 ? bebidasBase.map((b) => {
                            // El stock real vive en el inventario (data.bebidas), no en el catálogo de productos.
                            const inv = data.bebidas?.find((x) => x.id_producto === b.id_producto);
                            const disponible = inv?.stock ?? 0;
                            return (
                                <tr key={b.id_producto}>
                                    <td data-label="Nombre">{b.nombre}</td>
                                    <td data-label="Stock Global">
                                        <Badge bg={disponible > 0 ? 'success' : 'danger'}>{disponible}</Badge>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan="3" className="text-center text-muted">No hay bebidas base activas.</td></tr>
                        )}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );

    const TabMermas = () => (
        <Card className="stock-card-content">
            <Card.Body>
                <h4 className="titulo-seccion-card fw-bold"><BsFillTrashFill className="me-2" /> Registro de Mermas</h4>
                <p className="text-muted">Registre aquí las pérdidas de stock (platos, bebidas) por mala preparación, caducidad u otros motivos.</p>
                
                <div className="text-center my-5">
                    <Button variant="danger" className="btn-lg" onClick={() => setShowModalMerma(true)}>
                        <BsFillTrashFill className='me-2' /> Registrar Merma de Stock
                    </Button>
                </div>

                <h5 className="mt-5 mb-3 fw-bold text-dark-gray"><BsListNested className="me-2" /> Historial de Mermas (Últimos 7 días)</h5>
                <Table responsive hover size="sm" className="tabla-stock tabla-responsive-cards">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Producto</th>
                            <th className="text-center">Cantidad</th>
                            <th>Motivo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mermas.length > 0 ? mermas.map((m, index) => (
                            <tr key={index}>
                                <td data-label="Fecha">{m.fecha}</td>
                                <td data-label="Tipo"><Badge bg={m.tipo === 'PLATO' ? 'secondary' : 'warning'}>{m.tipo}</Badge></td>
                                <td data-label="Producto">{m.producto_nombre}</td>
                                <td data-label="Cantidad" className="text-center text-danger fw-bold">{m.cantidad}</td>
                                <td data-label="Motivo">{m.motivo}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5" className="text-center text-muted">No hay mermas registradas recientemente.</td></tr>
                        )}
                    </tbody>
                </Table>
                
            </Card.Body>
        </Card>
    );

    const TabExtras = () => (
        <Card className="stock-card-content">
            <Card.Body>
                <h4 className="titulo-seccion-card fw-bold">
                    <i className="bi bi-bag-heart me-2"></i> Ingreso de Stock — Extras (Bolos / Postres)
                </h4>
                <p className="text-muted">
                    Registra aquí las unidades de bolos, postres u otros extras que ingresas para vender.
                    El stock es global (no diario). Las ventas se registran automáticamente cuando se cobra el pedido.
                </p>
                <Button className="btn-bebida mb-4" onClick={() => setShowModalExtra(true)}>
                    <BsBagPlus className="me-2" /> Ingresar Unidades Extra
                </Button>

                <h5 className="mt-4 mb-3 fw-bold text-dark-gray"><BsTable className="me-2" /> Extras Registrados</h5>
                <Table responsive hover size="sm" className="tabla-stock tabla-responsive-cards">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Total Ingresado</th>
                            <th>Vendido</th>
                            <th>Disponible</th>
                        </tr>
                    </thead>
                    <tbody>
                        {extrasBase.length > 0 ? extrasBase.map((e) => {
                            const inv = data.extras?.find((x) => x.id_producto === e.id_producto);
                            const disponible = inv?.stock ?? 0;
                            const ingresado = inv?.stock_inicial ?? 0;
                            const vendido = inv?.vendido ?? 0;
                            return (
                                <tr key={e.id_producto}>
                                    <td data-label="Producto">{e.nombre}</td>
                                    <td data-label="Total Ingresado" className="text-center text-marron">{ingresado}</td>
                                    <td data-label="Vendido" className="text-center text-primary">{vendido}</td>
                                    <td data-label="Disponible" className="text-center fw-bold">
                                        <Badge bg={disponible > 0 ? 'warning' : 'danger'} text={disponible > 0 ? 'dark' : undefined}>
                                            {disponible}
                                        </Badge>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan="4" className="text-center text-muted">No hay productos de tipo EXTRA activos.</td></tr>
                        )}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );

    // ==========================================================
    // 5. ESTRUCTURA PRINCIPAL (JSX)
    // ==========================================================

    return (
        <div className="stock-page">
            
            {/* HEADER CON GRADIENTE */}
            <PageHeader title="Stock Operativo" subtitle="Gestión de disponibilidad diaria e inventario" />

            <Container fluid className="px-3">
                
                {/* RESUMEN SUPERIOR */}
                <Row className="cards-resumen mb-4 g-3">
                    <Col xs={12} md={4}>
                        <Card className="card-kpi kpi-verde">
                            <Card.Body>
                                <h5 className="kpi-label">Platos Disponibles</h5>
                                <h3 className="kpi-value">{resumen.platos}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col xs={12} md={4}>
                        <Card className="card-kpi kpi-amarillo">
                            <Card.Body>
                                <h5 className="kpi-label">Bebidas Disponibles</h5>
                                <h3 className="kpi-value">{resumen.bebidas}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col xs={12} md={4}>
                        <Card className="card-kpi kpi-rojo">
                            <Card.Body>
                                <h5 className="kpi-label">Platos Vendidos Hoy</h5>
                                <h3 className="kpi-value">{resumen.vendidos}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
                
                {/* PESTAÑAS */}
                <Card className='card-tabs-container p-3'>
                    <Tabs
                        activeKey={activeTab}
                        onSelect={(k) => setActiveTab(k)}
                        id="stock-tab-system"
                        className="nav-recetas mb-3"
                    >
                        <Tab eventKey="disponibilidad" title={<><BsEye className='me-2'/> Disponibilidad</>}>
                            {TabDisponibilidad()}
                        </Tab>
                        <Tab eventKey="apertura" title={<><BsBoxSeam className='me-2'/> Apertura de Platos</>}>
                            {TabApertura()}
                        </Tab>
                        <Tab eventKey="bebidas" title={<><BsCashStack className='me-2'/> Ingreso de Bebidas</>}>
                            {TabBebidas()}
                        </Tab>
                        <Tab eventKey="extras" title={<><i className="bi bi-bag-heart me-2"/>Extras</>}>
                            {TabExtras()}
                        </Tab>
                        <Tab eventKey="mermas" title={<><BsFillTrashFill className='me-2'/> Mermas</>}>
                            {TabMermas()}
                        </Tab>
                    </Tabs>
                </Card>
            </Container>

            {/* MODALES */}
            <BebidaModal
                show={showModalBebida} handleClose={() => setShowModalBebida(false)} bebidasBase={bebidasBase}
                cantidad={cantidadBebida} setCantidad={setCantidadBebida} bebida={bebidaSeleccionada} setBebida={setBebidaSeleccionada} onSave={registrarIngresoBebida}
            />

            {/* Modal Extras */}
            <Modal show={showModalExtra} onHide={() => setShowModalExtra(false)} centered>
                <Modal.Header closeButton className="modal-header-custom">
                    <Modal.Title className="fw-bold"><BsBagPlus className="me-2" /> Registrar Ingreso de Extra</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label>Producto Extra (bolo, postre…)</Form.Label>
                        <Form.Select value={extraSeleccionado} onChange={(e) => setExtraSeleccionado(e.target.value)}>
                            <option value="">Seleccionar</option>
                            {extrasBase.map((e) => (
                                <option key={e.id_producto} value={e.id_producto}>{e.nombre}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Cantidad a ingresar</Form.Label>
                        <Form.Control type="number" min="1" value={cantidadExtra} onChange={(e) => setCantidadExtra(e.target.value)} placeholder="0" />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModalExtra(false)}>Cancelar</Button>
                    <Button variant="warning" onClick={registrarIngresoExtra}><i className="bi bi-save me-2"></i> Guardar Ingreso</Button>
                </Modal.Footer>
            </Modal>
            <MermaModal 
                show={showModalMerma} handleClose={() => setShowModalMerma(false)} data={data} mermaState={mermaState}
                setMermaState={setMermaState} onSave={registrarMerma}
            />

        </div>
    );
}