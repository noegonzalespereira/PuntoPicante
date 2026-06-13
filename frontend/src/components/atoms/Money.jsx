/**
 * Átomo: muestra un monto con 2 decimales y la moneda.
 * Evita repetir Number(x).toFixed(2) + "Bs" por toda la app.
 */
export default function Money({ value, currency = "Bs" }) {
  const n = Number(value ?? 0);
  return (
    <>
      {n.toFixed(2)} {currency}
    </>
  );
}
