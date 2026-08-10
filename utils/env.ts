/**
 * Detecção de ambiente (produção web vs rede local).
 * Permite comportamentos diferentes: logs internos, debug, etc.
 */
export const isLocal = import.meta.env.VITE_APP_MODE === "local";

export const isProduction =
  import.meta.env.VITE_APP_MODE === "production" ||
  import.meta.env.MODE === "production";
