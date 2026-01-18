import React, { useState, useEffect, useRef } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const { config } = useAppConfig();
  const [showSkip, setShowSkip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  
  const imageSrc = '/gestao-qualivida-residence.png';

  useEffect(() => {
    // Mostrar botão de pular após 3 segundos
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 3000);

    // Auto-completar após 4.5 segundos (tempo de exibição)
    const autoCompleteTimer = setTimeout(() => {
      onComplete();
    }, 4500);

    // Carregar imagem do background
    const tryLoadImage = (src: string, isRetry = false) => {
      const img = new Image();
      img.onload = () => {
        setIsLoading(false);
        setBackgroundImage(`url(${src})`);
      };
      img.onerror = () => {
        if (!isRetry && src.includes('gestao-qualivida-residence')) {
          // Tentar fallback com espaços
          const fallbackSrc = '/gestão%20Qualivida%20Residence.png';
          tryLoadImage(fallbackSrc, true);
        } else if (!isRetry && src.includes('%20')) {
          // Tentar fallback sem espaços
          const fallbackSrc = '/gestao-qualivida-residence.png';
          tryLoadImage(fallbackSrc, true);
        } else {
          // Se não carregar, continuar sem imagem
          setIsLoading(false);
        }
      };
      img.src = src;
    };
    
    tryLoadImage(imageSrc);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(autoCompleteTimer);
    };
  }, [imageSrc, onComplete]);

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] overflow-hidden splash-container"
      style={{ 
        width: '100vw', 
        height: '100vh',
        backgroundColor: 'var(--bg-color)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      {/* Background com imagem do condomínio */}
      {backgroundImage && (
        <div
          className="splash-background"
          style={{
            width: '100vw',
            height: '100vh',
            backgroundImage: backgroundImage,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0
          }}
        />
      )}

      {/* Overlay sutil para melhorar contraste do texto */}
      <div 
        className="splash-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          zIndex: 1
        }}
      />

      {/* Conteúdo central */}
      <div className="splash-content" style={{ position: 'relative', zIndex: 2 }}>
        {/* Logo Qualivida */}
        <div className="splash-logo">
          <img 
            src="/1024.png" 
            alt="Qualivida Club Residence"
            className="splash-logo-image"
            onError={(e) => {
              // Se o logo não carregar, ocultar
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Texto principal */}
        <h1 className="splash-title">
          Bem-vindo ao<br />
          <span className="splash-title-highlight">Qualivida Club Residence</span>
        </h1>

        {/* Texto secundário */}
        <p className="splash-subtitle">
          Gestão simples para o dia a dia do condomínio
        </p>
      </div>

      {/* CSS para estilos e animações */}
      <style>{`
        .splash-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .splash-background {
          opacity: 0;
          animation: backgroundFadeIn 1s ease-out 0.3s forwards;
        }

        @keyframes backgroundFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .splash-content {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          max-width: 90vw;
        }

        .splash-logo {
          margin-bottom: 2.5rem;
          opacity: 0;
          transform: translateY(-20px);
          animation: logoFadeIn 0.8s ease-out 0.5s forwards;
        }

        .splash-logo-image {
          width: 80px;
          height: 80px;
          object-fit: contain;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
        }

        @keyframes logoFadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .splash-title {
          font-size: clamp(1.75rem, 5vw, 3rem);
          font-weight: 300;
          line-height: 1.4;
          letter-spacing: 0.02em;
          margin: 0 0 1rem 0;
          color: rgba(255, 255, 255, 0.98);
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          opacity: 0;
          transform: translateY(20px);
          animation: titleFadeIn 0.8s ease-out 0.8s forwards;
        }

        .splash-title-highlight {
          font-weight: 600;
          display: block;
          margin-top: 0.5rem;
        }

        @keyframes titleFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .splash-subtitle {
          font-size: clamp(0.875rem, 2vw, 1.125rem);
          font-weight: 400;
          line-height: 1.6;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.85);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          margin: 0;
          opacity: 0;
          animation: subtitleFadeIn 0.8s ease-out 1.2s forwards;
          max-width: 600px;
        }

        @keyframes subtitleFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Desktop: permitir cover em telas grandes */
        @media (min-width: 1024px) {
          .splash-background {
            background-size: cover !important;
          }

          .splash-logo-image {
            width: 100px;
            height: 100px;
          }
        }

        /* Mobile: manter contain */
        @media (max-width: 1023px) {
          .splash-background {
            background-size: contain !important;
          }
        }

        /* Ajustes para telas muito pequenas */
        @media (max-width: 480px) {
          .splash-content {
            padding: 1.5rem;
          }

          .splash-logo {
            margin-bottom: 2rem;
          }

          .splash-logo-image {
            width: 60px;
            height: 60px;
          }

          .splash-title {
            line-height: 1.3;
          }
        }

        /* Ajustes para orientação paisagem em mobile */
        @media (orientation: landscape) and (max-height: 500px) {
          .splash-content {
            padding: 1rem;
          }

          .splash-logo {
            margin-bottom: 1rem;
          }

          .splash-logo-image {
            width: 50px;
            height: 50px;
          }
        }

        /* Modo claro - ajustar overlay e cores */
        .light-mode .splash-overlay {
          backgroundColor: rgba(255, 255, 255, 0.25) !important;
        }

        .light-mode .splash-title {
          color: rgba(0, 0, 0, 0.95);
          text-shadow: 0 2px 8px rgba(255, 255, 255, 0.6);
        }

        .light-mode .splash-subtitle {
          color: rgba(0, 0, 0, 0.75);
          text-shadow: 0 1px 4px rgba(255, 255, 255, 0.6);
        }
      `}</style>

      {/* Botão de pular (discreto) */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-6 right-6 px-4 py-2 backdrop-blur-md border rounded-full text-xs font-medium tracking-wide hover:opacity-80 transition-opacity duration-200 z-30"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.15)', 
            borderColor: 'rgba(255, 255, 255, 0.25)',
            color: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(8px)'
          }}
          aria-label="Pular apresentação"
        >
          Pular
        </button>
      )}

      {/* Indicador de carregamento inicial */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-20" 
          style={{ backgroundColor: 'var(--bg-color)' }}
        >
          <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default VideoIntro;
