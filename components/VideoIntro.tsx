import React, { useEffect, useRef, useCallback } from 'react';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Callback estável para completar
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isCleanedUp = false;

    // Quando o vídeo terminar, completar automaticamente
    const handleVideoEnd = () => {
      if (!isCleanedUp) {
        handleComplete();
      }
    };

    // Tentar reproduzir o vídeo
    const playVideo = async () => {
      if (isCleanedUp || !video) return;
      
      try {
        // Não recarregar se já estiver carregado
        if (video.readyState < 2) {
          video.load();
        }
        
        // Aguardar um pouco antes de tentar reproduzir
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isCleanedUp && video) {
          await video.play();
        }
      } catch (error) {
        // Se falhar (autoplay bloqueado), aguardar interação do usuário
        console.log('Autoplay bloqueado, aguardando interação do usuário');
      }
    };

    // Adicionar listeners
    video.addEventListener('ended', handleVideoEnd, { once: true });
    
    // Tentar reproduzir quando o vídeo estiver pronto
    const handleCanPlay = () => {
      if (!isCleanedUp) {
        playVideo();
      }
    };
    
    video.addEventListener('canplay', handleCanPlay, { once: true });
    video.addEventListener('loadeddata', handleCanPlay, { once: true });

    // Se o vídeo já estiver pronto, tentar reproduzir imediatamente
    if (video.readyState >= 2) {
      playVideo();
    }

    return () => {
      isCleanedUp = true;
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleCanPlay);
    };
  }, [handleComplete]);

  // Permitir pular ao toque/clique na tela inteira
  const handleScreenClick = useCallback(() => {
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
        src="/Gestão Qualivida.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        className="video-intro-responsive"
        style={{
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
        }}
        onError={(e) => {
          console.error('Erro ao carregar vídeo:', e);
          // Se o vídeo falhar ao carregar, completar após 2 segundos
          setTimeout(() => {
            handleComplete();
          }, 2000);
        }}
      />
    </div>
  );
};

export default VideoIntro;
