import { Badge } from "react-bootstrap";

/**
 * Átomo: badge de estado con color automático.
 * Sirve para estado del pedido (PENDIENTE/LISTO) y de pago (PAGADO/SIN_PAGAR).
 */
const COLORES = {
  PENDIENTE: "warning",
  LISTO: "success",
  PAGADO: "success",
  SIN_PAGAR: "danger",
};

export default function EstadoBadge({ estado }) {
  return <Badge bg={COLORES[estado] ?? "secondary"}>{estado}</Badge>;
}
