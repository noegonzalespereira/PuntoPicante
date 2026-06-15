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
  const [activeTab, setActiveTab] = useState("operacional");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // KPIs
  const [kpis, setKpis] = useState({
    ventaTotal: 0,
    ventaExtras: 0,
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
      const ventaTotalBackend = Number(resumen?.totales?.venta_total ?? 0);
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

      // Separar totales por tipo de producto
      const totalPlatosBs  = vendidosDetalle.filter(p => p.tipo === 'PLATO').reduce((s, p) => s + Number(p.ventas ?? 0), 0);
      const totalBebidasBs = vendidosDetalle.filter(p => p.tipo === 'BEBIDA').reduce((s, p) => s + Number(p.ventas ?? 0), 0);
      const totalExtrasBs  = vendidosDetalle.filter(p => p.tipo === 'EXTRA').reduce((s, p) => s + Number(p.ventas ?? 0), 0);
      const ventaTotalRestaurante = totalPlatosBs + totalBebidasBs;

      // Caja compactada para mostrar en la tarjeta
      const cajaView = {
        apertura: row ? Number(row.monto_apertura || 0) : 0,
        cierre: row ? Number(row.monto_cierre || 0) : 0,
        cajero: row?.usuario_nombre || row?.cajero || "N/A",
        efectivo,
        qr,
        totalIngresos: ventaTotalBackend
      };

      // KPIs
      const gananciaNeta = ventaTotalRestaurante - gastosTotales;
      setKpis({
        ventaTotal: Number(ventaTotalRestaurante.toFixed(2)),
        ventaExtras: Number(totalExtrasBs.toFixed(2)),
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
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const M      = 13;                     // margen izquierdo/derecho
    const CW     = pageW - M * 2;         // ancho de contenido

    // ── Paleta ──────────────────────────────────────────────────
    const C = {
      marron:     [74,  43,  19],
      verde:      [46, 125,  50],
      rojo:       [198, 40,  40],
      ambar:      [180,120,   0],
      azul:       [30, 100, 180],
      oscuro:     [40,  40,  40],
      medio:      [100,100, 100],
      claro:      [230,230, 230],
      muyClaro:   [246,246, 246],
      crema:      [254,249, 230],
      blanco:     [255,255, 255],
      verdeClaro: [232,245, 233],
      rojoClaro:  [255,243, 243],
      azulClaro:  [232,240, 255],
    };

    let y = 0;

    // ── Helpers ─────────────────────────────────────────────────
    const newPage = () => { doc.addPage(); y = 15; };
    const guard   = (h) => { if (y + h > pageH - 14) newPage(); };

    const fill  = (c) => doc.setFillColor(...c);
    const stroke= (c) => doc.setDrawColor(...c);
    const color = (c) => doc.setTextColor(...c);
    const font  = (w, s) => { doc.setFont("helvetica", w); doc.setFontSize(s); };

    const rect  = (x, ry, w, h, style = "F") => doc.rect(x, ry, w, h, style);
    const txt   = (t, x, ry, opts = {}) => doc.text(String(t), x, ry, opts);

    const hline = (ry, c = C.claro) => {
      stroke(c); doc.setLineWidth(0.2);
      doc.line(M, ry, M + CW, ry);
    };

    // Encabezado de sección con banda de color
    const seccion = (titulo, colorBanda = C.marron) => {
      guard(10);
      fill(colorBanda); rect(M, y, CW, 7);
      color(C.blanco); font("bold", 8.5);
      txt(titulo.toUpperCase(), M + 3, y + 5);
      y += 10;
    };

    // Fila de tabla: colDefs = [{text, w, align?}]
    const fila = (colDefs, bg = null, textColor = C.oscuro, negrita = false) => {
      guard(6);
      if (bg) { fill(bg); rect(M, y, CW, 6); }
      font(negrita ? "bold" : "normal", 8);
      color(textColor);
      let x = M + 2;
      colDefs.forEach(({ text, w, align = "left" }) => {
        if (align === "right") {
          txt(String(text ?? ""), x + w - 2, y + 4.2, { align: "right" });
        } else {
          txt(String(text ?? "").slice(0, 55), x, y + 4.2);
        }
        x += w;
      });
      y += 6;
    };

    const filaHeader = (colDefs) => fila(colDefs, C.claro, C.medio, true);
    const filaTotal  = (colDefs) => {
      guard(7);
      fill(C.verdeClaro); rect(M, y, CW, 7);
      font("bold", 8.5); color(C.verde);
      let x = M + 2;
      colDefs.forEach(({ text, w, align = "left" }) => {
        if (align === "right") {
          txt(String(text ?? ""), x + w - 2, y + 5, { align: "right" });
        } else {
          txt(String(text ?? ""), x, y + 5);
        }
        x += w;
      });
      y += 9;
    };

    // Tabla de productos por categoría
    const tablaProductos = (filas, titulo, colorBanda, totalUds, totalBs) => {
      if (!filas.length) return;
      seccion(titulo, colorBanda);
      const W = [CW - 28, 14, 14];
      filaHeader([
        { text: "Producto",   w: W[0] },
        { text: "Uds.",       w: W[1], align: "right" },
        { text: "Bs",         w: W[2], align: "right" },
      ]);
      filas.forEach((p, i) => {
        fila([
          { text: p.nombre,                        w: W[0] },
          { text: `${p.cantidad}x`,                w: W[1], align: "right" },
          { text: Number(p.ventas??0).toFixed(2),  w: W[2], align: "right" },
        ], i % 2 === 0 ? C.muyClaro : null);
      });
      hline(y); y += 1;
      filaTotal([
        { text: `TOTAL: ${totalUds} unidades vendidas`, w: W[0] },
        { text: "",                                      w: W[1] },
        { text: `Bs ${totalBs.toFixed(2)}`,             w: W[2], align: "right" },
      ]);
      y += 2;
    };

    // ── ENCABEZADO ───────────────────────────────────────────────
    fill(C.crema);  rect(0, 0, pageW, 30);
    fill(C.marron); rect(0, 30, pageW, 1.5);

    try { doc.addImage(logoPuntoPicante, "JPEG", M, 4, 22, 22); } catch {}

    color(C.marron); font("bold", 17);
    txt("El Punto Picante", M + 26, 14);
    color(C.oscuro); font("normal", 9);
    txt("Sistema POS  —  Reporte Gerencial", M + 26, 20);

    const rangoTxt = desde === hasta
      ? `Fecha: ${formatFechaVisual(desde)}`
      : `Período: ${formatFechaVisual(desde)} al ${formatFechaVisual(hasta)}`;
    color(C.medio); font("normal", 8);
    txt(rangoTxt,                               pageW - M, 13, { align: "right" });
    txt(`Generado: ${formatFechaVisual(ymdLaPaz())}`, pageW - M, 19, { align: "right" });

    y = 36;

    // ── KPI BOXES ────────────────────────────────────────────────
    const kpiData = [
      { label: "VENTA TOTAL",    val: `Bs ${kpis.ventaTotal.toFixed(2)}`,    sub: "Platos + Bebidas",  c: C.marron },
      { label: "VENTA EXTRAS",   val: `Bs ${kpis.ventaExtras.toFixed(2)}`,   sub: "Emprendimiento",    c: C.ambar  },
      { label: "GANANCIA NETA",  val: `Bs ${kpis.gananciaNeta.toFixed(2)}`,  sub: "Sin extras",        c: C.verde  },
      { label: "GASTOS",         val: `Bs ${kpis.gastosTotales.toFixed(2)}`, sub: "Total del período", c: C.rojo   },
    ];
    const bw = (CW - 9) / 4;
    const bh = 22;
    kpiData.forEach((k, i) => {
      const bx = M + i * (bw + 3);
      fill([248, 248, 248]); stroke(k.c); doc.setLineWidth(0.4);
      rect(bx, y, bw, bh, "FD");
      fill(k.c); rect(bx, y, bw, 3);
      color(C.medio); font("bold", 6.5);
      txt(k.label, bx + bw / 2, y + 8.5, { align: "center" });
      color(k.c); font("bold", 9.5);
      txt(k.val,   bx + bw / 2, y + 15,  { align: "center" });
      color(C.medio); font("normal", 6);
      txt(k.sub,   bx + bw / 2, y + 20,  { align: "center" });
    });
    y += bh + 8;

    // ── PRODUCTOS POR CATEGORÍA ───────────────────────────────────
    const platos  = inventario.vendidosDetalle.filter(p => p.tipo === "PLATO");
    const bebidas = inventario.vendidosDetalle.filter(p => p.tipo === "BEBIDA");
    const extras  = inventario.vendidosDetalle.filter(p => p.tipo === "EXTRA");

    const sumUds = (arr) => arr.reduce((s, p) => s + Number(p.cantidad ?? 0), 0);
    const sumBs  = (arr) => arr.reduce((s, p) => s + Number(p.ventas   ?? 0), 0);

    const totalPlatosUds  = sumUds(platos);
    const totalBebidasUds = sumUds(bebidas);
    const totalExtrasUds  = sumUds(extras);
    const totalPlatosBs   = sumBs(platos);
    const totalBebidasBs  = sumBs(bebidas);
    const totalExtrasBs   = sumBs(extras);

    tablaProductos(platos,  "Platos",                    C.marron, totalPlatosUds,  totalPlatosBs);
    tablaProductos(bebidas, "Bebidas",                   C.azul,   totalBebidasUds, totalBebidasBs);
    tablaProductos(extras,  "Extras  —  Emprendimiento", C.ambar,  totalExtrasUds,  totalExtrasBs);

    // Banner Total Restaurante
    guard(14);
    fill(C.verde); rect(M, y, CW, 13);
    color(C.blanco); font("bold", 10);
    txt("TOTAL RESTAURANTE  (Platos + Bebidas)", M + 4, y + 6);
    font("normal", 8);
    txt(`${totalPlatosUds + totalBebidasUds} unidades vendidas`, M + 4, y + 11);
    font("bold", 13);
    txt(`Bs ${(totalPlatosBs + totalBebidasBs).toFixed(2)}`, M + CW - 2, y + 9, { align: "right" });
    y += 17;

    // ── PEDIDOS POR TIPO ─────────────────────────────────────────
    seccion("Pedidos por Tipo", [60, 60, 60]);
    guard(18);
    const pedItems = [
      { label: "Para Comer",  val: inventario.comer,  bg: C.muyClaro, tc: C.marron },
      { label: "Para Llevar", val: inventario.llevar, bg: C.muyClaro, tc: C.marron },
      { label: "Mixtos",      val: inventario.mixtos, bg: C.muyClaro, tc: C.marron },
      { label: "Total Despachados", val: kpis.pedidosDespachados, bg: C.verdeClaro, tc: C.verde },
    ];
    const pw = CW / 4;
    pedItems.forEach(({ label, val, bg, tc }, i) => {
      fill(bg); rect(M + i * pw + (i > 0 ? 1 : 0), y, pw - (i > 0 ? 1 : 0), 16);
      color(tc); font("bold", 14);
      txt(String(val), M + i * pw + pw / 2, y + 9,  { align: "center" });
      color(C.medio); font("normal", 6.5);
      txt(label,       M + i * pw + pw / 2, y + 14, { align: "center" });
    });
    y += 20;
    color(C.medio); font("normal", 7.5);
    txt(`Ítems a mesa: ${inventario.platosMesa}    ·    Ítems para llevar: ${inventario.platosLlevar}`, M, y);
    y += 8;

    // ── MÉTODOS DE PAGO ──────────────────────────────────────────
    seccion("Métodos de Pago", C.azul);
    guard(16);
    const mw = (CW - 4) / 2;
    [
      { label: "Efectivo", val: caja.efectivo, bg: C.azulClaro },
      { label: "QR / Transferencia", val: caja.qr, bg: C.azulClaro },
    ].forEach(({ label, val, bg }, i) => {
      const mx = M + i * (mw + 4);
      fill(bg); rect(mx, y, mw, 14);
      color(C.medio); font("normal", 7.5);
      txt(label, mx + 4, y + 6);
      color(C.oscuro); font("bold", 11);
      txt(`Bs ${val.toFixed(2)}`, mx + 4, y + 12);
    });
    y += 18;

    // ── CAJA ─────────────────────────────────────────────────────
    seccion("Caja del Período", C.marron);
    guard(10);
    const cajaItems = [
      { label: "Apertura",      val: `Bs ${caja.apertura.toFixed(2)}` },
      { label: "Cierre Físico", val: `Bs ${caja.cierre.toFixed(2)}` },
      { label: "Responsable",   val: caja.cajero },
    ];
    color(C.oscuro); font("normal", 8.5);
    cajaItems.forEach(({ label, val }, i) => {
      txt(`${label}: `, M + i * (CW / 3) + 2, y + 4);
      font("bold", 8.5);
      txt(val, M + i * (CW / 3) + 2 + doc.getTextWidth(`${label}: `), y + 4);
      font("normal", 8.5);
    });
    y += 10;

    // ── MERMAS ───────────────────────────────────────────────────
    if (inventario.mermasUnidades > 0 || inventario.mermasCosto > 0) {
      seccion("Mermas", C.rojo);
      guard(10);
      color(C.oscuro); font("normal", 8.5);
      txt(`Unidades: ${inventario.mermasUnidades} uds.`, M + 2, y + 4);
      color(C.rojo); font("bold", 8.5);
      txt(`Costo estimado: -Bs ${Number(inventario.mermasCosto).toFixed(2)}`, M + 70, y + 4);
      y += 10;
    }

    // ── GASTOS ───────────────────────────────────────────────────
    if (gastosDetalle.length > 0) {
      seccion("Detalle de Gastos", C.rojo);
      const GW = [22, CW - 44, 22];
      filaHeader([
        { text: "Fecha",      w: GW[0] },
        { text: "Descripción",w: GW[1] },
        { text: "Monto (Bs)", w: GW[2], align: "right" },
      ]);
      gastosDetalle.forEach((g, i) => {
        fila([
          { text: g.fecha ? formatFechaVisual(g.fecha) : "-", w: GW[0] },
          { text: g.descripcion || "-",                        w: GW[1] },
          { text: Number(g.monto||0).toFixed(2),               w: GW[2], align: "right" },
        ], i % 2 === 0 ? C.rojoClaro : null);
      });
      hline(y); y += 1;
      filaTotal([
        { text: "TOTAL GASTOS", w: GW[0] + GW[1] },
        { text: `Bs ${kpis.gastosTotales.toFixed(2)}`, w: GW[2], align: "right" },
      ]);
    }

    // ── FOOTER en todas las páginas ───────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      fill(C.marron); rect(0, pageH - 9, pageW, 9);
      color(C.blanco); font("normal", 6.5);
      txt(
        `El Punto Picante · Sistema POS · ${rangoTxt} · Pág. ${i} de ${totalPages}`,
        pageW / 2, pageH - 3.5, { align: "center" }
      );
    }

    doc.save(`reporte_${desde}_${hasta}.pdf`);
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
                    <Table className="info-table mb-0 tabla-responsive-cards" responsive>
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
                            <td data-label="Fecha Apertura">
                              {c.fecha_apertura
                                ? formatFechaVisual(c.fecha_apertura)
                                : "-"}
                            </td>
                            <td data-label="Fecha Cierre">
                              {c.fecha_cierre
                                ? formatFechaVisual(c.fecha_cierre)
                                : "-"}
                            </td>
                            <td data-label="Cajero">
                              {c.usuario_nombre || c.cajero || "N/A"}
                            </td>
                            <td data-label="Apertura (Bs)" className="text-end">
                              {Number(
                                c.monto_apertura || 0
                              ).toFixed(2)}
                            </td>
                            <td data-label="Cierre (Bs)" className="text-end">
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
            <Table className="gastos-table mb-0 tabla-responsive-cards" responsive>
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
                    <td data-label="Fecha">
                      {g.fecha
                        ? formatFechaVisual(g.fecha)
                        : "-"}
                    </td>
                    <td data-label="Descripción">{g.descripcion}</td>
                    <td data-label="Monto" className="text-end">
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

  const TabOperacional = () => {
    const platos  = inventario.vendidosDetalle.filter(p => p.tipo === 'PLATO');
    const bebidas = inventario.vendidosDetalle.filter(p => p.tipo === 'BEBIDA');
    const extras  = inventario.vendidosDetalle.filter(p => p.tipo === 'EXTRA');

    const totalPlatos  = platos.reduce((s, p)  => s + Number(p.ventas ?? 0), 0);
    const totalBebidas = bebidas.reduce((s, p) => s + Number(p.ventas ?? 0), 0);
    const totalExtras  = extras.reduce((s, p)  => s + Number(p.ventas ?? 0), 0);
    const totalRestaurante = totalPlatos + totalBebidas;

    const TablaVentas = ({ filas, emptyMsg }) => (
      <Table className="info-table mb-0 tabla-responsive-cards" responsive size="sm">
        <thead>
          <tr>
            <th>Producto</th>
            <th className="text-end">Uds.</th>
            <th className="text-end">Bs</th>
          </tr>
        </thead>
        <tbody>
          {filas.length ? filas.map((p, idx) => (
            <tr key={idx}>
              <td data-label="Producto">{p.nombre}</td>
              <td data-label="Uds." className="text-end">{p.cantidad}x</td>
              <td data-label="Bs" className="text-end">{Number(p.ventas ?? 0).toFixed(2)}</td>
            </tr>
          )) : (
            <tr><td colSpan={3} className="text-center text-muted py-2">{emptyMsg}</td></tr>
          )}
        </tbody>
      </Table>
    );

    return (
    <div>
      {/* Pedidos por destino */}
      <Row className="g-3 mb-4">
        <Col lg={12}>
          <Card className="modern-card p-3">
            <h6 className="text-muted mb-2">Pedidos por tipo</h6>
            <div className="stat-grid">
              <div className="stat-item"><span className="stat-value">{inventario.comer}</span><span className="stat-label">Para Comer</span></div>
              <div className="stat-item"><span className="stat-value">{inventario.llevar}</span><span className="stat-label">Para Llevar</span></div>
              <div className="stat-item"><span className="stat-value">{inventario.mixtos}</span><span className="stat-label">Mixtos</span></div>
              <div className="stat-item"><span className="stat-value">{inventario.platosMesa}</span><span className="stat-label">Ítems a Mesa</span></div>
              <div className="stat-item"><span className="stat-value">{inventario.platosLlevar}</span><span className="stat-label">Ítems Llevar</span></div>
              <div className="stat-item"><span className="stat-value" style={{color:'#2e7d32'}}>{kpis.pedidosDespachados}</span><span className="stat-label">Total Despachados</span></div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Desglose por tipo de producto */}
      <Row className="g-4">
        {/* PLATOS */}
        <Col lg={4}>
          <div className="section-header">
            <BsReceipt className="section-icon" />
            <h5 className="section-title">Platos</h5>
          </div>
          <Card className="modern-card">
            <Card.Body className="p-0">
              <TablaVentas filas={platos} emptyMsg="Sin platos vendidos" />
            </Card.Body>
            <Card.Footer className="text-end fw-bold text-success">
              Total platos: Bs {totalPlatos.toFixed(2)}
            </Card.Footer>
          </Card>
        </Col>

        {/* BEBIDAS */}
        <Col lg={4}>
          <div className="section-header">
            <BsBoxSeam className="section-icon" />
            <h5 className="section-title">Bebidas</h5>
          </div>
          <Card className="modern-card">
            <Card.Body className="p-0">
              <TablaVentas filas={bebidas} emptyMsg="Sin bebidas vendidas" />
            </Card.Body>
            <Card.Footer className="text-end fw-bold text-success">
              Total bebidas: Bs {totalBebidas.toFixed(2)}
            </Card.Footer>
          </Card>
        </Col>

        {/* EXTRAS */}
        <Col lg={4}>
          <div className="section-header">
            <BsReceipt className="section-icon" style={{ color: '#f59e0b' }} />
            <h5 className="section-title" style={{ color: '#92400e' }}>
              Extras <small className="fs-6 text-muted">(emprendimiento)</small>
            </h5>
          </div>
          <Card className="modern-card" style={{ border: '1.5px dashed #f59e0b' }}>
            <Card.Body className="p-0">
              <TablaVentas filas={extras} emptyMsg="Sin extras vendidos" />
            </Card.Body>
            <Card.Footer className="text-end fw-bold text-warning">
              Ref. extras: Bs {totalExtras.toFixed(2)}
              <div className="small text-muted fw-normal">No se incluye en el total del restaurante</div>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      {/* TOTAL RESTAURANTE */}
      <Row className="mt-4">
        <Col xs={12}>
          <Card className="modern-card" style={{ background: 'linear-gradient(to right, #1b5e20, #2e7d32)', color: '#fff' }}>
            <Card.Body className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-3 px-4">
              <div>
                <div className="fw-bold fs-5">TOTAL RESTAURANTE</div>
                <div className="small opacity-75">Platos + Bebidas (sin extras)</div>
              </div>
              <div className="fw-bold fs-3">Bs {totalRestaurante.toFixed(2)}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Mermas */}
      <Row className="mt-3">
        <Col xs={12}>
          <Card className="modern-card">
            <Card.Body className="p-0">
              <Table className="info-table mb-0" responsive size="sm">
                <tbody>
                  <tr>
                    <td>Mermas (Unidades)</td>
                    <td className="text-end fw-bold">{inventario.mermasUnidades} uds.</td>
                  </tr>
                  <tr>
                    <td>Mermas (Costo estimado)</td>
                    <td className="text-end text-danger fw-bold">-Bs {Number(inventario.mermasCosto).toFixed(2)}</td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
    );
  };

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
      <div className="d-flex flex-column flex-sm-row gap-2">
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

  <Col md={4} className="text-center d-none d-md-block">
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
                  VENTA TOTAL
                </span>
                <div className="kpi-value">
                  Bs {kpis.ventaTotal.toFixed(2)}
                </div>
                <small className="text-muted">Platos + Bebidas</small>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="kpi-card kpi-marron">
              <Card.Body>
                <div className="kpi-icon">
                  <BsBoxSeam size={50} />
                </div>
                <span className="kpi-label">
                  VENTA TOTAL EXTRAS
                </span>
                <div className="kpi-value">
                  Bs {kpis.ventaExtras.toFixed(2)}
                </div>
                <small className="text-muted">Emprendimiento</small>
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
                active={activeTab === "operacional"}
                onClick={() => setActiveTab("operacional")}
              >
                📦 Inventario y Operación
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={activeTab === "financiero"}
                onClick={() => setActiveTab("financiero")}
              >
                💰 Caja e Ingresos
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
