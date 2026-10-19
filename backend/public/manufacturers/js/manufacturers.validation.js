export function validarFabricante(payload) {
  if (!payload.trade_name) return 'Informe pelo menos o Nome Comercial.';
  return null;
}
