import React, { useEffect, useMemo, useState, useCallback, useRef} from "react";
import {
  Container, Row, Col, Card, Button, Form, Table, Nav, Spinner, Alert
} from "react-bootstrap";
import {
  BsCalendar, BsCashCoin,BsFileEarmarkPdf, BsQrCode, BsReceipt, BsGraphUp, BsWallet,
  BsArrowRepeat, BsBoxSeam
} from "react-icons/bs";

import jsPDF from "jspdf";
import { reportesService } from "../../services/reportesService";
import { gastoService } from "../../services/gastosService";
import { cajaService } from "../../services/cajaService";
import { stockService } from "../../services/stockService";
import logoPuntoPicante from "../../assets/logo.jpg";
import "../../styles/ReportePage.css";
import PageHeader from "../../components/molecules/PageHeader";


const TZ = "America/La_Paz";
function ymdLaPaz(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(date).replace(/\//g, "-"); // YYYY-MM-DD
}
function clampYMD(v) {
  return (v || "").toString().substring(0, 10);
}

function fromYMD(str) {
  const [Y, M, D] = (str || "").split("-").map(Number);
  return new Date(Y, (M || 1) - 1, (D || 1));
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function formatFechaVisual(ymd) {
  if (!ymd) return "N/A";
  const [y, m, d] = clampYMD(ymd).split("-");
  return `${d}/${m}/${y}`;
}



function asArray(resp) {
  if (Array.isArray(resp)) return resp;
  
  if (resp?.data && Array.isArray(resp.data)) return resp.data;
  
  if (resp?.data?.data && Array.isArray(resp.data.data)) return resp.data.data;
  return [];
}


async function obtenerFechaReferenciaDashboardLike() {
  try {
    // caja abierta
    const caja = await cajaService.getCajaAbierta().catch(() => null);
    if (caja && caja.id_caja) {
    
      return {
        fechaRef: ymdLaPaz(new Date()), 
        cajaAbierta: caja,
      };
    }

    //Si no hay caja abierta -> última caja cerrada
    const historial = await cajaService
      .getHistorial({ cajeroId: "", desde: "", hasta: "" })
      .catch(() => []);

    const cerradas = (historial || []).filter(h => h.estado === "CERRADA");
    if (cerradas.length === 0) {
      
      return {
        fechaRef: ymdLaPaz(new Date()),
        cajaAbierta: null,
      };
    }

    cerradas.sort(
      (a, b) => new Date(b.fecha_cierre) - new Date(a.fecha_cierre)
    );
    const ultima = cerradas[0];

    return {
      
      fechaRef: ymdLaPaz(new Date(ultima.fecha_apertura)),
      cajaAbierta: null,
      ultimaCaja: ultima,
    };
  } catch (e) {
    console.error("Error determinando fecha de referencia (reportes):", e);
    return {
      fechaRef: ymdLaPaz(new Date()),
      cajaAbierta: null,
    };
  }
}

export default function ReportePage() {

  // Filtros por rango
const [fechaDesde, setFechaDesde] = useState(ymdLaPaz());
const [fechaHasta, setFechaHasta] = useState(ymdLaPaz());
const reportRef = useRef(null);
const rango = useMemo(() => {
  const d = clampYMD(fechaDesde);
  const h = clampYMD(fechaHasta);
  if (d && h && d > h) {
    return { desde: h, hasta: d }; // corrige si el usuario los invierte
  }
  return { desde: d, hasta: h };
}, [fechaDesde, fechaHasta]);


  // Estado UI
  const [activeTab, setActiveTab] = useState("financiero");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // KPIs
  const [kpis, setKpis] = useState({
    ventaTotal: 0,
    gananciaNeta: 0,
    pedidosDespachados: 0,
    gastosTotales: 0
  });

  // Datos por tab
  const [caja, setCaja] = useState({
    apertura: 0,
    cierre: 0,
    cajero: "N/A",
    efectivo: 0,
    qr: 0,
    totalIngresos: 0
  });
  const [cajaHistorial, setCajaHistorial] = useState([]);

  const [gastosDetalle, setGastosDetalle] = useState([]); 
  const [inventario, setInventario] = useState({
    comer: 0,
    llevar: 0,
    mixtos: 0,
    platosMesa: 0,
    platosLlevar: 0,
    mermasUnidades: 0,
    mermasCosto: 0,
    vendidosDetalle: []
  });

  
  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");

    // Usamos el rango elegido
    let { desde, hasta } = rango;
    if (desde && hasta && desde === hasta) {
    const ref = await obtenerFechaReferenciaDashboardLike();
    if (ref?.fechaRef) {
      desde = ref.fechaRef;
      hasta = ref.fechaRef;
    }
  }
    

    try {
      // 1) Resumen de ventas: TODO agregado en el backend (sin tope de 100 pedidos).
      const resumen = await reportesService.getResumen({ desde, hasta });

      // 2) Gastos (detalle + resumen)
      const [gResumen, gListado] = await Promise.all([
        gastoService.getResumen({ desde, hasta }),
        gastoService.getAll({ desde, hasta })
      ]);

      const gastosTotales = Number(gResumen?.total_gastos || 0);
      const gastosRows = asArray(gListado).map(g => ({
        descripcion: g.nombre_producto ?? g.descripcion ?? "(sin descripción)",
        monto: Number(g.precio || g.monto || 0) * Number(g.cantidad || 1),
        fecha: g.fecha || g.created_at || null,
      }));

      // Caja 
      const hist = await cajaService
        .getHistorial({ desde, hasta })
        .catch(() => []);
      const rows = asArray(hist).sort(
        (a, b) => new Date(b.fecha_apertura) - new Date(a.fecha_apertura)
      );
      const row = rows[0] || null;
      setCajaHistorial(rows);

      // 4) Mermas dentro del rango
      let mermasUnidades = 0,
        mermasCosto = 0;
      try {
        const mermasResp = await stockService.getMermas();
        const mm = asArray(mermasResp);
        mm.forEach(m => {
          const f = m.fecha ? String(m.fecha).substring(0, 10) : null;
          const dentro =
            f && f >= String(desde).substring(0, 10) && f <= String(hasta).substring(0, 10);
          if (!m.fecha || dentro) {
            mermasUnidades += Number(m.cantidad || 0);
            mermasCosto += Number(m.costo || 0);
          }
        });
      } catch {
      }

      // Todos estos valores ya vienen calculados (en SQL) desde /reportes/resumen.
      const ventaTotal = Number(resumen?.totales?.venta_total ?? 0);
      const efectivo = Number(resumen?.metodos_pago?.efectivo?.monto ?? 0);
      const qr = Number(resumen?.metodos_pago?.qr?.monto ?? 0);

      // Conteo de pedidos por tipo (MESA = "para comer")
      const comer = Number(resumen?.pedidos_por_tipo?.MESA ?? 0);
      const llevar = Number(resumen?.pedidos_por_tipo?.LLEVAR ?? 0);
      const mixtos = Number(resumen?.pedidos_por_tipo?.MIXTO ?? 0);

      // Cantidad de PLATOS (ítems) por destino: un pedido mixto reparte sus ítems
      const platosMesa = Number(resumen?.items_por_destino?.mesa ?? 0);
      const platosLlevar = Number(resumen?.items_por_destino?.llevar ?? 0);

      // Productos vendidos: unidades y Bs por producto, ya ordenados
      const vendidosDetalle = (resumen?.productos ?? []).map(p => ({
        nombre: p.nombre,
        cantidad: Number(p.unidades ?? 0),
        ventas: Number(p.ventas ?? 0),
        tipo: p.tipo,
      }));

      const pedidosDespachados = Number(resumen?.totales?.pedidos_despachados ?? 0);

      // Caja compactada para mostrar en la tarjeta
      const cajaView = {
        apertura: row ? Number(row.monto_apertura || 0) : 0,
        cierre: row ? Number(row.monto_cierre || 0) : 0,
        cajero: row?.usuario_nombre || row?.cajero || "N/A",
        efectivo,
        qr,
        totalIngresos: ventaTotal
      };

      // KPIs
      const gananciaNeta = ventaTotal - gastosTotales;
      setKpis({
        ventaTotal: Number(ventaTotal.toFixed(2)),
        gananciaNeta: Number(gananciaNeta.toFixed(2)),
        pedidosDespachados,
        gastosTotales: Number(gastosTotales.toFixed(2))
      });

      setCaja(cajaView);
      setGastosDetalle(gastosRows);
      setInventario({
        comer,
        llevar,
        mixtos,
        platosMesa,
        platosLlevar,
        mermasUnidades,
        mermasCosto,
        vendidosDetalle
      });
    } catch (err) {
      console.error("Error al cargar reportes:", err);
      const msg =
        err?.response?.status === 401
          ? "Sesión expirada o sin autorización (401). Inicia sesión nuevamente."
          : "No se pudieron cargar los datos del reporte.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [rango]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  
  const handleExportPDF = () => {
  const { desde, hasta } = rango;
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const centerX = pageWidth / 2;

  const isSingleDay = !!(desde && hasta && desde === hasta);

  // Paleta basada en el logo
  const rojo = [198, 40, 40];      // acento
  const verde = [46, 125, 50];
  const negro = [40, 40, 40];
  const gris = [120, 120, 120];
  const crema = [255, 249, 230];
  const bordeSuave = [220, 220, 220];

  let y = 10;

  /* ===== HEADER CON BANDA Y LOGO ===== */
  doc.setFillColor(...crema);
  doc.rect(0, 0, pageWidth, 30, "F");

  // Logo
  try {
    doc.addImage(logoPuntoPicante, "JPEG", margin, 6, 24, 20);
  } catch (e) {
    console.warn("No se pudo cargar el logo en el PDF:", e);
  }

  // Marca + título centrados
  doc.setTextColor(...rojo);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("El Punto Picante", centerX, 13, { align: "center" });

  doc.setTextColor(...negro);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Reporte Gerencial", centerX, 19, { align: "center" });

  doc.setTextColor(...gris);
  doc.setFontSize(9);
  doc.text(
    `Rango: ${formatFechaVisual(desde)} — ${formatFechaVisual(hasta)}`,
    centerX,
    24,
    { align: "center" }
  );
  doc.text(
    `Tipo: ${isSingleDay ? "Reporte diario" : "Reporte por rango"}`,
    centerX,
    28,
    { align: "center" }
  );

  y = 36;

  // Helper: card / sección
  const drawCard = (x, y0, w, title, accentColor = rojo) => {
    const padding = 4;
    const hHeader = 7;

    // Fondo card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...bordeSuave);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y0, w, 0, 3, 3, "S"); // altura se ajusta luego con líneas

    // Encabezado
    doc.setFillColor(...accentColor);
    doc.roundedRect(x, y0, w, hHeader, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title, x + padding, y0 + 4.6);

    // Contenido
    doc.setTextColor(...negro);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    return {
      y: y0 + hHeader + padding,
      padding,
      x,
      w,
      close: (yContentMax) => {
        // dibujar borde final ajustando altura
        const finalH = Math.max(hHeader + padding + (yContentMax - (y0 + hHeader + padding)) + padding, hHeader + 10);
        doc.setDrawColor(...bordeSuave);
        doc.roundedRect(x, y0, w, finalH, 3, 3, "S");
        return y0 + finalH + 4;
      }
    };
  };

  const ensureSpace = (needed) => {
    if (y + needed > 285) {
      doc.addPage();
      y = 15;
    }
  };

  /* ===== FILA 1: Resumen financiero + Métodos de pago ===== */
  const colW = (contentWidth - 4) / 2;

  ensureSpace(40);
  // Card Resumen financiero
  let card1 = drawCard(margin, y, colW, "Resumen financiero", rojo);
  doc.text(
    `Venta total (PAGADOS):`,
    card1.x + card1.padding,
    card1.y
  );
  doc.setTextColor(...verde);
  doc.text(
    `Bs ${kpis.ventaTotal.toFixed(2)}`,
    card1.x + card1.padding,
    card1.y + 4
  );
  doc.setTextColor(...negro);
  doc.text(
    `Ganancia neta: Bs ${kpis.gananciaNeta.toFixed(2)}`,
    card1.x + card1.padding,
    card1.y + 9
  );
  doc.text(
    `Gastos: Bs ${kpis.gastosTotales.toFixed(2)}`,
    card1.x + card1.padding,
    card1.y + 14
  );
  const nextY1 = card1.close(card1.y + 16);

  // Card Métodos de pago
  let card2 = drawCard(margin + colW + 4, y, colW, "Métodos de pago", rojo);
  doc.text(
    `Efectivo: Bs ${caja.efectivo.toFixed(2)}`,
    card2.x + card2.padding,
    card2.y
  );
  doc.text(
    `QR / Transf.: Bs ${caja.qr.toFixed(2)}`,
    card2.x + card2.padding,
    card2.y + 5
  );
  const nextY2 = card2.close(card2.y + 9);

  y = Math.max(nextY1, nextY2);

  /* ===== FILA 2: Caja + Resumen operacional ===== */
  ensureSpace(40);

  // Card Caja
  card1 = drawCard(margin, y, colW, "Caja", rojo);
  doc.text(
    `Apertura: Bs ${caja.apertura.toFixed(2)}`,
    card1.x + card1.padding,
    card1.y
  );
  doc.text(
    `Cierre físico: Bs ${caja.cierre.toFixed(2)}`,
    card1.x + card1.padding,
    card1.y + 5
  );
  doc.text(
    `Responsable: ${caja.cajero}`,
    card1.x + card1.padding,
    card1.y + 10
  );
  const nextY3 = card1.close(card1.y + 14);

  // Card Resumen operacional
  const totalPlatosVendidos = inventario.vendidosDetalle.reduce(
    (sum, item) => sum + Number(item.cantidad || 0),
    0
  );
  card2 = drawCard(margin + colW + 4, y, colW, "Resumen operacional", rojo);
  doc.text(
    `Pedidos despachados: ${kpis.pedidosDespachados}`,
    card2.x + card2.padding,
    card2.y
  );
  doc.text(
    `Platos vendidos: ${totalPlatosVendidos} uds.`,
    card2.x + card2.padding,
    card2.y + 5
  );
  doc.text(
    `Comer: ${inventario.comer}  ·  Llevar: ${inventario.llevar}`,
    card2.x + card2.padding,
    card2.y + 10
  );
  doc.text(
    `Mixtos: ${inventario.mixtos}`,
    card2.x + card2.padding,
    card2.y + 15
  );
  doc.text(
    `Mermas: ${inventario.mermasUnidades} uds. · Bs ${Number(
      inventario.mermasCosto
    ).toFixed(2)}`,
    card2.x + card2.padding,
    card2.y + 20
  );
  const nextY4 = card2.close(card2.y + 24);

  y = Math.max(nextY3, nextY4) + 2;

  /* ===== TOP PRODUCTOS VENDIDOS ===== */
  if (inventario.vendidosDetalle.length > 0) {
    ensureSpace(40);
    const card = drawCard(margin, y, contentWidth, "Top productos vendidos", rojo);

    let yy = card.y;
    doc.setFontSize(8);
    doc.setTextColor(...gris);
    doc.text("Producto", card.x + card.padding, yy);
    doc.text("Cant.", card.x + card.w - card.padding, yy, { align: "right" });
    yy += 3;
    doc.setDrawColor(...bordeSuave);
    doc.line(card.x + card.padding, yy, card.x + card.w - card.padding, yy);
    yy += 3;

    doc.setFontSize(9);
    doc.setTextColor(...negro);
    inventario.vendidosDetalle.slice(0, 12).forEach(item => {
      if (yy > 280) {
        const nextPageY = card.close(yy);
        doc.addPage();
        y = 15;
        // nuevo card continuación
        const cardCont = drawCard(margin, y, contentWidth, "Top productos vendidos (cont.)", rojo);
        yy = cardCont.y;
        doc.setFontSize(8);
        doc.setTextColor(...gris);
        doc.text("Producto", cardCont.x + cardCont.padding, yy);
        doc.text("Cant.", cardCont.x + cardCont.w - cardCont.padding, yy, { align: "right" });
        yy += 3;
        doc.line(cardCont.x + cardCont.padding, yy, cardCont.x + cardCont.w - cardCont.padding, yy);
        yy += 3;
        doc.setFontSize(9);
        doc.setTextColor(...negro);
        card.close = cardCont.close; // redirigimos close al nuevo
      }
      const nombre = (item.nombre || "").toString().slice(0, 60);
      const cant = String(item.cantidad || 0);
      doc.text(nombre, card.x + card.padding, yy);
      doc.text(cant, card.x + card.w - card.padding, yy, {
        align: "right",
      });
      yy += 4;
    });

    y = card.close(yy);
  }

  /* ===== DETALLE DE GASTOS ===== */
  if (gastosDetalle.length > 0) {
    ensureSpace(50);
    const card = drawCard(margin, y, contentWidth, "Detalle de gastos", rojo);

    let yy = card.y;
    doc.setFontSize(8);
    doc.setTextColor(...gris);
    doc.text("Fecha", card.x + card.padding, yy);
    doc.text("Descripción", card.x + 28, yy);
    doc.text("Monto (Bs)", card.x + card.w - card.padding, yy, {
      align: "right",
    });
    yy += 3;
    doc.setDrawColor(...bordeSuave);
    doc.line(card.x + card.padding, yy, card.x + card.w - card.padding, yy);
    yy += 3;

    doc.setFontSize(8.5);
    doc.setTextColor(...negro);

    gastosDetalle.slice(0, 30).forEach(g => {
      if (yy > 280) {
        const nextPageY = card.close(yy);
        doc.addPage();
        y = 15;
        const cardCont = drawCard(margin, y, contentWidth, "Detalle de gastos (cont.)", rojo);
        yy = cardCont.y;
        doc.setFontSize(8);
        doc.setTextColor(...gris);
        doc.text("Fecha", cardCont.x + cardCont.padding, yy);
        doc.text("Descripción", cardCont.x + 28, yy);
        doc.text("Monto (Bs)", cardCont.x + cardCont.w - cardCont.padding, yy, {
          align: "right",
        });
        yy += 3;
        doc.line(cardCont.x + cardCont.padding, yy, cardCont.x + cardCont.w - cardCont.padding, yy);
        yy += 3;
        doc.setFontSize(8.5);
        doc.setTextColor(...negro);
        card.close = cardCont.close;
      }

      const fecha = g.fecha ? formatFechaVisual(g.fecha) : "-";
      const desc = (g.descripcion || "").toString().slice(0, 60);
      const monto = Number(g.monto || 0).toFixed(2);

      doc.text(fecha, card.x + card.padding, yy);
      doc.text(desc, card.x + 28, yy);
      doc.text(monto, card.x + card.w - card.padding, yy, {
        align: "right",
      });
      yy += 4;
    });

    y = card.close(yy);
  }

  /* ===== FOOTER GLOBAL ===== */
  const fileDesde = desde || "sin-desde";
  const fileHasta = hasta || "sin-hasta";
  const pages = doc.getNumberOfPages();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...gris);
    doc.text(
      `El Punto Picante · Reporte ${fileDesde} — ${fileHasta} · Página ${i} de ${pages}`,
      centerX,
      292,
      { align: "center" }
    );
  }

  doc.save(`reporte_punto_picante_${fileDesde}_${fileHasta}.pdf`);
};




  /* =========================
     Tabs (financiero + operacional)
     ========================= */
  const TabFinanciero = () => (
    <>
      <div className="report-section">
        <h4 className="section-title-large">
          Desglose de Ingresos y Control de Caja
        </h4>
        <Row className="g-4">
          {/* Pagos */}
          {/* <Col lg={6}> */}
            <div className="section-header">
              <BsWallet className="section-icon" />
              <h5 className="section-title">Pagos Recibidos</h5>
            </div>
            <Card className="modern-card card-ingresos">
              <Card.Body className="p-0">
                <div className="ingreso-item">
                  <div className="ingreso-icon">
                    <BsCashCoin size={22} />
                  </div>
                  <div className="ingreso-info">
                    <span className="ingreso-label">Efectivo</span>
                    <span className="ingreso-monto">
                      Bs {caja.efectivo.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="ingreso-item">
                  <div className="ingreso-icon">
                    <BsQrCode size={22} />
                  </div>
                  <div className="ingreso-info">
                    <span className="ingreso-label">QR / Transf.</span>
                    <span className="ingreso-monto">
                      Bs {caja.qr.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="ingreso-total">
                  <span className="total-label">TOTAL INGRESOS</span>
                  <span className="total-monto">
                    Bs {caja.totalIngresos.toFixed(2)}
                  </span>
                </div>
              </Card.Body>
            </Card>
          {/* </Col> */}
          </Row>
          <hr />
          <Row className="g-4">
          {/* Caja */}
          <Col lg={6}>
            <div className="section-header">
              <BsCashCoin className="section-icon" />
              <h5 className="section-title">Caja del Período</h5>
            </div>
            <Card className="modern-card card-control h-100">
              <Card.Body className="py-4">
                <Row className="control-grid">
                  <Col xs={6} className="border-end border-marron">
                    <div className="control-item">
                      <span className="control-label">APERTURA</span>
                      <span className="control-value">
                        Bs {caja.apertura.toFixed(2)}
                      </span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="control-item">
                      <span className="control-label">CIERRE FÍSICO</span>
                      <span className="control-value">
                        Bs {caja.cierre.toFixed(2)}
                      </span>
                    </div>
                  </Col>
                </Row>
                <div className="control-diferencia">
                  <span className="diferencia-label">RESPONSABLE</span>
                  <span className="diferencia-value">
                    {caja.cajero}
                  </span>
                </div>
                {cajaHistorial.length > 0 && (
              <div className="report-section mt-3">
                <h6 className="section-title">
                  Historial de Cajas del Período
                </h6>
                <Card className="modern-card">
                  <Card.Body className="p-0">
                    <Table className="info-table mb-0" responsive>
                      <thead>
                        <tr>
                          <th>Fecha Apertura</th>
                          <th>Fecha Cierre</th>
                          <th>Cajero</th>
                          <th className="text-end">Apertura (Bs)</th>
                          <th className="text-end">Cierre (Bs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cajaHistorial.map((c, i) => (
                          <tr key={i}>
                            <td>
                              {c.fecha_apertura
                                ? formatFechaVisual(c.fecha_apertura)
                                : "-"}
                            </td>
                            <td>
                              {c.fecha_cierre
                                ? formatFechaVisual(c.fecha_cierre)
                                : "-"}
                            </td>
                            <td>
                              {c.usuario_nombre || c.cajero || "N/A"}
                            </td>
                            <td className="text-end">
                              {Number(
                                c.monto_apertura || 0
                              ).toFixed(2)}
                            </td>
                            <td className="text-end">
                              {Number(
                                c.monto_cierre || 0
                              ).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </div>
            )}
              </Card.Body>
            </Card>

            
          </Col>
          <Col lg={6}>
          {/* Gastos */}
      <div className="report-section mt-4">
        <div className="section-header">
          <BsArrowRepeat className="section-icon" />
          <h5 className="section-title">Detalle de Gastos</h5>
        </div>
        <Card className="modern-card">
          <Card.Body className="p-0">
            <Table className="gastos-table mb-0" responsive>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th className="text-end">Monto</th>
                </tr>
              </thead>
              <tbody>
                {gastosDetalle.map((g, i) => (
                  <tr key={i}>
                    <td>
                      {g.fecha
                        ? formatFechaVisual(g.fecha)
                        : "-"}
                    </td>
                    <td>{g.descripcion}</td>
                    <td className="text-end">
                      Bs {Number(g.monto).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-gastos">
                  <td colSpan={2}>
                    <strong>TOTAL GASTOS</strong>
                  </td>
                  <td className="text-end">
                    <strong>
                      Bs {kpis.gastosTotales.toFixed(2)}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </Table>
          </Card.Body>
        </Card>
      </div>
          </Col>
          </Row>
        {/* </Row> */}
      </div>

      
    </>
  );

  const TabOperacional = () => (
    <Row className="g-4">
      <Col lg={6}>
        <div className="report-section">
          <div className="section-header">
            <BsBoxSeam className="section-icon" />
            <h5 className="section-title">Desglose Operacional</h5>
          </div>
          <Card className="modern-card p-4">
            <h6 className="text-muted mb-2">Pedidos por tipo</h6>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-value">
                  {inventario.comer}
                </span>
                <span className="stat-label">Para Comer</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {inventario.llevar}
                </span>
                <span className="stat-label">Para Llevar</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {inventario.mixtos}
                </span>
                <span className="stat-label">Mixtos</span>
              </div>
            </div>
            <hr />
            <h6 className="text-muted mb-2">Platos por destino (unidades)</h6>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-value">{inventario.platosMesa}</span>
                <span className="stat-label">A Mesa</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{inventario.platosLlevar}</span>
                <span className="stat-label">Para Llevar</span>
              </div>
            </div>
          </Card>
        </div>
      </Col>

      <Col lg={6}>
        <div className="report-section">
          <div className="section-header">
            <BsReceipt className="section-icon" />
            <h5 className="section-title">
              Detalle de Productos Vendidos
            </h5>
          </div>
          <Card className="modern-card">
            <Card.Body className="p-0">
              <Table className="info-table mb-0" responsive>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-end">Cantidad</th>
                    <th className="text-end">Ventas (Bs)</th>
                  </tr>
                </thead>
                <tbody>
                  {inventario.vendidosDetalle.map((p, idx) => (
                    <tr key={idx}>
                      <td>{p.nombre}</td>
                      <td className="text-end">
                        {p.cantidad}x
                      </td>
                      <td className="text-end">
                        {Number(p.ventas ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <div className="report-section mt-3">
            <Card className="modern-card">
              <Card.Body className="p-0">
                <Table className="info-table mb-0" responsive>
                  <tbody>
                    <tr>
                      <td>Mermas (Unidades)</td>
                      <td className="text-end fw-bold">
                        {inventario.mermasUnidades} uds.
                      </td>
                    </tr>
                    <tr>
                      <td>Mermas (Costo Total)</td>
                      <td className="text-end text-danger fw-bold">
                        -Bs{" "}
                        {Number(
                          inventario.mermasCosto
                        ).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </div>
        </div>
      </Col>
    </Row>
  );

  /* =========================
     Render
     ========================= */
  return (
    <div className="reportes-page">
      {/* Header con degradé */}
      <PageHeader title="Reportes Gerenciales" subtitle="Análisis financiero y operacional" />
      <div ref={reportRef}>
      <Container fluid>
        {/* Filtros */}
        <Card className="mb-4 filtro-card">
          <Card.Body>
            <Row className="align-items-center g-3">
  <Col md={5}>
    <Form.Group>
      <Form.Label className="filtro-label">
        <BsCalendar className="me-2" /> Rango del Reporte
      </Form.Label>
      <div className="d-flex gap-2">
        <Form.Control
          type="date"
          value={fechaDesde}
          onChange={e => setFechaDesde(e.target.value)}
          className="form-control-custom"
        />
        <Form.Control
          type="date"
          value={fechaHasta}
          onChange={e => setFechaHasta(e.target.value)}
          className="form-control-custom"
        />
      </div>
    </Form.Group>
  </Col>

  <Col md={4} className="text-center">
    <span className="fecha-label">Rango seleccionado</span>
    <h6 className="fecha-valor">
      {formatFechaVisual(rango.desde)} — {formatFechaVisual(rango.hasta)}
    </h6>
  </Col>

  <Col md={3} className="text-end d-flex flex-column align-items-end gap-2">
    <Button
      className="btn-export"
      onClick={cargar}
      disabled={loading}
    >
      {loading ? (
        <Spinner
          size="sm"
          animation="border"
          className="me-2"
        />
      ) : (
        <BsArrowRepeat className="me-2" />
      )}
      Actualizar
    </Button>
    <Button
  variant="outline-secondary"
  size="sm"
  onClick={handleExportPDF}
  disabled={loading}
>
  <BsFileEarmarkPdf className="me-2" />
  Descargar PDF
</Button>

  </Col>
</Row>

          </Card.Body>
        </Card>

        {errorMsg && (
          <Alert
            variant="danger"
            className="mb-3"
          >
            {errorMsg}
          </Alert>
        )}

        {/* KPIs */}
        <Row className="g-3 mb-4">
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-amarillo">
              <Card.Body>
                <div className="kpi-icon">
                  <BsWallet size={50} />
                </div>
                <span className="kpi-label">
                  VENTA TOTAL (PAGADOS)
                </span>
                <div className="kpi-value">
                  Bs {kpis.ventaTotal.toFixed(2)}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-verde">
              <Card.Body>
                <div className="kpi-icon">
                  <BsGraphUp size={50} />
                </div>
                <span className="kpi-label">
                  GANANCIA NETA
                </span>
                <div className="kpi-value kpi-value-verde">
                  Bs {kpis.gananciaNeta.toFixed(2)}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-marron">
              <Card.Body>
                <div className="kpi-icon">
                  <BsReceipt size={50} />
                </div>
                <span className="kpi-label">
                  PEDIDOS DESPACHADOS
                </span>
                <div className="kpi-value">
                  {kpis.pedidosDespachados}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-rojo">
              <Card.Body>
                <div className="kpi-icon">
                  <BsArrowRepeat size={50} />
                </div>
                <span className="kpi-label">
                  GASTOS
                </span>
                <div className="kpi-value kpi-value-rojo">
                  Bs {kpis.gastosTotales.toFixed(2)}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Tabs */}
        <Card className="tabs-card">
          <Nav variant="tabs" className="custom-tabs">
            <Nav.Item>
              <Nav.Link
                active={activeTab === "financiero"}
                onClick={() =>
                  setActiveTab("financiero")
                }
              >
                💰 Caja e Ingresos
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={activeTab === "operacional"}
                onClick={() =>
                  setActiveTab("operacional")
                }
              >
                📦 Inventario y Operación
              </Nav.Link>
            </Nav.Item>
          </Nav>
          <Card.Body className="tab-content-body">
            {loading ? (
              <div className="text-center p-5">
                <Spinner animation="border" />
              </div>
            ) : (
              <>
                {activeTab === "financiero" && (
                  <TabFinanciero />
                )}
                {activeTab === "operacional" && (
                  <TabOperacional />
                )}
              </>
            )}
          </Card.Body>
        </Card>
      </Container>
    </div>
    </div>
  );
}
