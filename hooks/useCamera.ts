import { useState, useCallback, useRef } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error';

export interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
}

export interface UseCameraReturn {
  stream: MediaStream | null;
  status: CameraStatus;
  error: string | null;
  requestAccess: () => Promise<boolean>;
  stop: () => void;
  clearError: () => void;
}

const DEFAULT_OPTIONS: UseCameraOptions = {
  facingMode: 'environment',
};

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  return (
    protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

function formatCameraError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  const name = e?.name ?? '';
  const msg = e?.message ?? '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Permissão de câmera negada. Habilite o acesso nas configurações do navegador (ou do celular) e recarregue a página.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhuma câmera encontrada neste dispositivo.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Câmera em uso por outro app ou problema de hardware. Feche outros apps que usem a câmera.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Configuração da câmera não suportada. Tente novamente.';
  }
  if (name === 'SecurityError' || msg?.toLowerCase().includes('https')) {
    return 'Câmera exige HTTPS. Use uma conexão segura ou localhost.';
  }
  if (msg) return msg;
  return 'Não foi possível acessar a câmera.';
}

/**
 * Hook reutilizável para acesso à câmera.
 * Deve ser usado SOMENTE em mobile (use isMobile() antes de abrir o modal).
 * Centraliza getUserMedia, permissões e controle do stream.
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setStatus('idle');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const requestAccess = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setError(null);
    setStatus('requesting');

    if (!isSecureContext()) {
      const msg = 'Câmera exige HTTPS. Use conexão segura ou localhost.';
      setError(msg);
      setStatus('error');
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Câmera não disponível neste navegador.');
      setStatus('error');
      return false;
    }

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: opts.facingMode ?? 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStatus('ready');
      setError(null);
      return true;
    } catch (err) {
      const msg = formatCameraError(err);
      setError(msg);
      setStatus('error');
      setStream(null);
      streamRef.current = null;
      return false;
    }
  }, [opts.facingMode]);

  return { stream, status, error, requestAccess, stop, clearError };
}
