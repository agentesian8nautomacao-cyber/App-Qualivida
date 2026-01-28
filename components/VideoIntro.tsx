import React, { useEffect, useRef, useCallback, useState } from 'react';

interface VideoIntroProps {
  onComplete: () => void;
}

// Duração esperada do vídeo "GestaoQualivida.mp4" (~6s) + pequena margem
const FALLBACK_TIMEOUT_MS = 8000;

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const playAttemptedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // Detectar tamanho de tela para ajustar proporção em telas grandes
  useEffect(() => {
    const updateSize = () => {
      if (typeof window === 'undefined') return;
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      console.warn('[VideoIntro] Referência do vídeo não encontrada');
      return;
    }
    
    if (playAttemptedRef.current) {
      console.log('[VideoIntro] Reprodução já foi tentada');
      return;
    }

    console.log('[VideoIntro] Inicializando vídeo...', {
      src: video.src,
      readyState: video.readyState,
      networkState: video.networkState
    });

    let isCleanedUp = false;
    let playTimeout: NodeJS.Timeout | null = null;

    const handleVideoEnd = () => {
      if (!isCleanedUp && !completedRef.current) {
        console.log('[VideoIntro] Vídeo finalizado');
        if (video) {
          video.pause();
          video.currentTime = video.duration;
        }
        handleComplete();
      }
    };

    const playVideo = async (forceMuted = false) => {
      if (isCleanedUp || !video || playAttemptedRef.current) return;
      
      playAttemptedRef.current = true;
      
      try {
        // Garantir que o vídeo está carregado
        if (video.readyState < 2) {
          console.log('[VideoIntro] Carregando vídeo...');
          video.load();
          // Aguardar um pouco mais para o vídeo carregar
          await new Promise(r => setTimeout(r, 300));
        }

        if (isCleanedUp || !video) return;

        // Tentar reproduzir
        if (forceMuted) {
          video.muted = true;
        } else {
          video.muted = false;
        }

        console.log('[VideoIntro] Tentando reproduzir vídeo...', { 
          readyState: video.readyState, 
          muted: video.muted 
        });

        await video.play();
        
        console.log('[VideoIntro] ✅ Vídeo reproduzindo com sucesso');
        
        // Se estava muted, tentar habilitar áudio após um tempo
        if (forceMuted) {
          setTimeout(() => {
            if (!isCleanedUp && video) {
              try {
                video.muted = false;
                console.log('[VideoIntro] Áudio habilitado');
              } catch (e) {
                console.log('[VideoIntro] Não foi possível habilitar áudio:', e);
              }
            }
          }, 500);
        }
      } catch (error: any) {
        console.log('[VideoIntro] Erro ao reproduzir:', error?.name || error);
        
        // Se não foi tentado com muted, tentar agora
        if (!forceMuted) {
          console.log('[VideoIntro] Tentando com muted...');
          playAttemptedRef.current = false;
          setTimeout(() => playVideo(true), 200);
        } else {
          // Se já tentou com muted e falhou, aguardar interação do usuário
          console.log('[VideoIntro] Aguardando interação do usuário...');
          playAttemptedRef.current = false;
          
          // Adicionar listener para quando o usuário interagir
          const handleUserInteraction = async () => {
            if (video && !isCleanedUp && !completedRef.current) {
              try {
                video.muted = false;
                await video.play();
                console.log('[VideoIntro] ✅ Vídeo reproduzindo após interação');
                document.removeEventListener('click', handleUserInteraction);
                document.removeEventListener('touchstart', handleUserInteraction);
              } catch (e) {
                console.log('[VideoIntro] Ainda não foi possível reproduzir:', e);
              }
            }
          };
          
          document.addEventListener('click', handleUserInteraction, { once: true });
          document.addEventListener('touchstart', handleUserInteraction, { once: true });
        }
      }
    };

    const handleCanPlay = () => {
      if (!isCleanedUp && !playAttemptedRef.current) {
        console.log('[VideoIntro] Vídeo pronto para reprodução');
        playVideo();
      }
    };

    const handleLoadedData = () => {
      if (!isCleanedUp && !playAttemptedRef.current) {
        console.log('[VideoIntro] Dados do vídeo carregados');
        playVideo();
      }
    };

    const handleLoadedMetadata = () => {
      if (!isCleanedUp && !playAttemptedRef.current) {
        console.log('[VideoIntro] Metadados do vídeo carregados');
        // Tentar reproduzir se já tiver dados suficientes
        if (video.readyState >= 2) {
          playVideo();
        }
      }
    };

    const handleError = (e: Event) => {
      const videoElement = e.target as HTMLVideoElement;
      const error = videoElement?.error;
      console.error('[VideoIntro] Erro ao carregar vídeo:', {
        error,
        code: error?.code,
        message: error?.message,
        networkState: videoElement?.networkState,
        readyState: videoElement?.readyState,
        src: videoElement?.src
      });
      setVideoError(true);
      // Aguardar um pouco antes de completar para dar chance de recuperar
      setTimeout(() => {
        if (!isCleanedUp) {
          console.log('[VideoIntro] Completando após erro (pulando vídeo)');
          handleComplete();
        }
      }, 1000);
    };

    // Adicionar todos os listeners
    video.addEventListener('ended', handleVideoEnd, { once: true });
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    // Tentar reproduzir imediatamente se o vídeo já estiver pronto
    if (video.readyState >= 3) {
      console.log('[VideoIntro] Vídeo já está pronto, reproduzindo imediatamente');
      playVideo();
    } else if (video.readyState >= 2) {
      console.log('[VideoIntro] Vídeo parcialmente carregado, aguardando...');
      playTimeout = setTimeout(() => playVideo(), 500);
    } else {
      // Forçar carregamento
      console.log('[VideoIntro] Forçando carregamento do vídeo...');
      video.load();
    }

    // Fallback timer
    const fallbackTimer = setTimeout(() => {
      if (!isCleanedUp && !completedRef.current) {
        console.log('[VideoIntro] Fallback: vídeo não finalizou a tempo.');
        handleComplete();
      }
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      isCleanedUp = true;
      if (playTimeout) clearTimeout(playTimeout);
      clearTimeout(fallbackTimer);
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [handleComplete]);

  const handleScreenClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-skip-btn]')) return;
    handleComplete();
  }, [handleComplete]);

  return (
    <div
      ref={containerRef}
      className="video-intro-container"
      onClick={handleScreenClick}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        cursor: 'pointer',
        overflow: 'hidden',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        willChange: 'contents',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden'
      }}
    >
      <video
        ref={videoRef}
        src="/GestaoQualivida.mp4"
        autoPlay
        playsInline
        preload="auto"
        loop={false}
        muted={false}
        className="video-intro-responsive"
        crossOrigin="anonymous"
        onError={(e) => {
          const video = e.currentTarget;
          console.error('[VideoIntro] Erro no elemento video:', {
            error: video.error,
            code: video.error?.code,
            message: video.error?.message,
            networkState: video.networkState,
            readyState: video.readyState,
            src: video.src,
            currentSrc: video.currentSrc
          });
        }}
        onLoadStart={() => console.log('[VideoIntro] Vídeo iniciando carregamento...')}
        onLoadedMetadata={() => console.log('[VideoIntro] Metadados carregados')}
        onLoadedData={() => console.log('[VideoIntro] Dados carregados')}
        onCanPlay={() => console.log('[VideoIntro] Vídeo pode ser reproduzido')}
        onCanPlayThrough={() => console.log('[VideoIntro] Vídeo pode ser reproduzido completamente')}
        onPlaying={() => console.log('[VideoIntro] ✅ Vídeo está reproduzindo')}
        onPlay={() => console.log('[VideoIntro] Evento play disparado')}
        onPause={() => console.log('[VideoIntro] Vídeo pausado')}
        onWaiting={() => console.log('[VideoIntro] Vídeo aguardando buffer...')}
        onStalled={() => console.log('[VideoIntro] Vídeo travado (stalled)')}
        onSuspend={() => console.log('[VideoIntro] Carregamento suspenso')}
        style={
          isLargeScreen
            ? {
                width: '70vw',
                maxWidth: '960px',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain',
                objectPosition: 'center',
                borderRadius: '24px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
                pointerEvents: 'none',
                willChange: 'auto',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                WebkitTransform: 'translateZ(0)'
              }
            : {
                width: '100vw',
                height: '100vh',
                minWidth: '100%',
                minHeight: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                pointerEvents: 'none',
                willChange: 'auto',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                WebkitTransform: 'translateZ(0)'
              }
        }
        onError={() => {
          console.error('Erro ao carregar vídeo.');
          setTimeout(handleComplete, 500);
        }}
      />
      <button
        data-skip-btn
        type="button"
        onClick={(e) => { e.stopPropagation(); handleComplete(); }}
        className="absolute top-6 right-6 z-10 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-widest border border-white/20 transition-all cursor-pointer"
      >
        Pular
      </button>
    </div>
  );
};

export default VideoIntro;
