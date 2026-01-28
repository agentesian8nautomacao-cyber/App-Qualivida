import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface LogoSplashProps {
  onComplete: () => void;
  /** Duração em ms antes de chamar onComplete. Toque/clique pula antes. */
  durationMs?: number;
}

const LogoSplash: React.FC<LogoSplashProps> = ({ onComplete, durationMs = 4000 }) => {
  const { config } = useAppConfig();
  const [hidden, setHidden] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const durationMsRef = useRef(durationMs);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  // Verificar se está no cliente (evita problemas de SSR)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  // Atualizar refs quando props mudarem
  useEffect(() => {
    onCompleteRef.current = onComplete;
    durationMsRef.current = durationMs;
  }, [onComplete, durationMs]);

  // Marcar como montado após renderização completa
  useEffect(() => {
    // Usar requestAnimationFrame para garantir que o componente está totalmente renderizado
    const rafId = requestAnimationFrame(() => {
      // Adicionar um pequeno delay adicional para garantir que está no DOM
      setTimeout(() => {
        setIsMounted(true);
        mountedRef.current = true;
        console.log('[LogoSplash] Componente montado e pronto');
      }, 50);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleComplete = useCallback(() => {
    if (completedRef.current) {
      console.log('[LogoSplash] handleComplete chamado mas já estava completo');
      return;
    }
    
    completedRef.current = true;
    
    // Limpar timer se ainda estiver ativo
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    console.log('[LogoSplash] Completando após', elapsed, 'ms');
    
    setHidden(true);
    
    // Pequeno delay antes de chamar onComplete para garantir que a animação de fade tenha tempo
    setTimeout(() => {
      onCompleteRef.current();
    }, 100);
  }, []);

  // Iniciar timer apenas após o componente estar montado
  useEffect(() => {
    // Só iniciar se estiver montado e não tiver sido completado
    if (!isMounted || completedRef.current || timerRef.current) {
      if (!isMounted) {
        console.log('[LogoSplash] Aguardando montagem do componente...');
      }
      return;
    }
    
    const duration = durationMsRef.current;
    startTimeRef.current = Date.now();
    
    console.log('[LogoSplash] Iniciando timer de', duration, 'ms');
    
    timerRef.current = setTimeout(() => {
      if (completedRef.current || !mountedRef.current) {
        console.log('[LogoSplash] Timer disparou mas componente já estava completo ou desmontado');
        return;
      }
      
      const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      console.log('[LogoSplash] Timer completado após', elapsed, 'ms (esperado:', duration, 'ms)');
      
      handleComplete();
    }, duration);
    
    return () => {
      if (timerRef.current) {
        console.log('[LogoSplash] Limpando timer (componente desmontado)');
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isMounted, handleComplete]); // Depender de isMounted

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (completedRef.current) {
      console.log('[LogoSplash] Clique ignorado - já completo');
      return;
    }
    
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    console.log('[LogoSplash] Clique detectado após', elapsed, 'ms - pulando splash');
    handleComplete();
  }, [handleComplete]);

  // Não renderizar nada até estar no cliente e montado (evita problemas de SSR/hydration)
  if (!isClient || (!isMounted && typeof window !== 'undefined')) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'var(--bg-color, #0a0a0a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleComplete(); }}
      aria-label="Pular e ir para login"
      className="logoSplash-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        background: 'var(--bg-color, #0a0a0a)',
        cursor: 'pointer',
        transition: 'opacity 0.4s ease-out',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
        }}
        
      >
        <img
          src="/1024.png"
          alt={`Logo ${config.condominiumName}`}
          style={{
            width: 'min(200px, 50vw)',
            height: 'auto',
            maxHeight: '40vh',
            objectFit: 'contain',
          }}
        />
        <p
          style={{
            fontSize: 'clamp(1rem, 3.2vw, 1.3rem)',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-primary, #ffffff)',
            textAlign: 'center',
          }}
        >
          Bem vido ao Gestão Qualivida
        </p>
      </div>
    </div>
  );
};

export default LogoSplash;
