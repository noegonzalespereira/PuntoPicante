/**
 * Molécula: cabecera de módulo reutilizable (banda con degradado + título).
 * Reemplaza el bloque repetido en cada página (modulo-header-*).
 * `children` permite agregar badges o botones a la derecha del título.
 */
export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="app-page-header">
      <div className="app-page-header__content">
        <div>
          <h1 className="page-title app-page-header__title">{title}</h1>
          {subtitle && <p className="page-subtitle app-page-header__subtitle">{subtitle}</p>}
        </div>
        {children && <div className="app-page-header__actions">{children}</div>}
      </div>
    </div>
  );
}
