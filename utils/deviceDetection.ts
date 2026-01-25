/**
 * Detecta se o dispositivo é mobile.
 * Usado para habilitar câmera (foto/QR) apenas em celular;
 * em desktop, registro de encomendas é sempre manual.
 */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(
    navigator.userAgent
  );
  if (ua) return true;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(pointer: coarse)').matches;
  }
  return false;
}
