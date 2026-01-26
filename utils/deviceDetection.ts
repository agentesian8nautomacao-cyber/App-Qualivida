/**
 * Detecta se o dispositivo é mobile (celular/tablet).
 * Usado para habilitar câmera (foto/QR) apenas em celular;
 * em desktop, registro de encomendas é sempre manual.
 * Usa apenas userAgent para evitar que desktop com touch seja tratado como mobile.
 */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(
    navigator.userAgent
  );
}
