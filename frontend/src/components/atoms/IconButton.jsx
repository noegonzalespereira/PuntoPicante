import { Button } from "react-bootstrap";

/**
 * Átomo: botón compacto solo-ícono.
 * Úsalo para acciones en tablas (ver / editar / eliminar) para que no ocupen
 * de más. `icon` es una clase de bootstrap-icons, p. ej. "bi-pencil-square".
 */
export default function IconButton({
  icon,
  variant = "outline-secondary",
  title,
  onClick,
  disabled = false,
  className = "",
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      <i className={`bi ${icon}`}></i>
    </Button>
  );
}
