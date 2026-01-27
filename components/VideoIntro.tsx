import React, { useEffect, useRef, useCallback } from 'react';

interface VideoIntroProps {
  onComplete: () => void;
}

// Duração esperada do vídeo "Gestão Qualivida.mp4" (~6s) + pequena margem
const FALLBACK_TIMEOUT_MS = 7000;

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isCleanedUp = false;

    const handleVideoEnd = () => {
      if (!isCleanedUp) handleComplete();
    };

    const playVideo = async () => {
      if (isCleanedUp || !video) return;
      try {
        if (video.readyState < 2) video.load();
        await new Promise(r => setTimeout(r, 100));
        if (!isCleanedUp && video) await video.play();
      } catch {
        console.log('Autoplay bloqueado, aguardando interação.');
      }
    };

    const handleCanPlay = () => {
      if (!isCleanedUp) playVideo();
    };

    video.addEventListener('ended', handleVideoEnd, { once: true });
    video.addEventListener('canplay', handleCanPlay, { once: true });
    video.addEventListener('loadeddata', handleCanPlay, { once: true });
    if (video.readyState >= 2) playVideo();

    const fallbackTimer = setTimeout(() => {
      if (!isCleanedUp) {
        console.log('[VideoIntro] Fallback: vídeo não finalizou a tempo.');
        handleComplete();
      }
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      isCleanedUp = true;
      clearTimeout(fallbackTimer);
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleCanPlay);
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
