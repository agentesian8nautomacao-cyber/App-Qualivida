import React, { useState, useEffect, useRef } from 'react';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Quando o vídeo terminar, completar automaticamente
    const handleVideoEnd = () => {
      onComplete();
    };

    // Quando o vídeo estiver pronto para reproduzir
    const handleCanPlay = () => {
      setIsVideoReady(true);
    };

    // Tentar reproduzir o vídeo
    const playVideo = async () => {
      try {
        video.load(); // Recarregar o vídeo para garantir
        await video.play();
      } catch (error) {
        // Se falhar (autoplay bloqueado), aguardar interação do usuário
        console.log('Autoplay bloqueado, aguardando interação do usuário');
      }
    };

    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', () => {
      playVideo();
    });

    // Tentar reproduzir quando o vídeo estiver carregado
    if (video.readyState >= 2) {
      playVideo();
    }

    return () => {
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [onComplete]);

  // Permitir pular ao toque/clique na tela inteira
  const handleScreenClick = () => {
    onComplete();
  };

  return (
    <div 
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
        justifyContent: 'center'
      }}
    >
      <video
        ref={videoRef}
        src="/Gestão Qualivida.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          opacity: isVideoReady ? 1 : 0,
          transition: 'opacity 0.3s ease-in'
        }}
        onError={(e) => {
          console.error('Erro ao carregar vídeo:', e);
          setHasError(true);
          // Se o vídeo falhar ao carregar, completar após 2 segundos
          setTimeout(() => {
            onComplete();
          }, 2000);
        }}
        onLoadedData={() => {
          setIsVideoReady(true);
        }}
      />
      {hasError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <p>Erro ao carregar vídeo. Continuando...</p>
        </div>
      )}
    </div>
  );
};

export default VideoIntro;
