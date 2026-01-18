import React, { useState, useEffect } from 'react';
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
    // Mostrar opção de pular após 3 segundos
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 3000);

    // Auto-completar após 4.5 segundos (duração visual)
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
          const fallbackSrc = '/gestão%20Qualivida%20Residence.png';
          tryLoadImage(fallbackSrc, true);
        } else if (!isRetry && src.includes('%20')) {
          const fallbackSrc = '/gestao-qualivida-residence.png';
          tryLoadImage(fallbackSrc, true);
        } else {
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

  // Permitir pular ao toque/clique na tela inteira
  const handleScreenClick = () => {
    if (showSkip) {
      onComplete();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] overflow-hidden splash-screen"
      onClick={handleScreenClick}
      style={{ 
        width: '100vw', 
        height: '100vh',
        backgroundColor: 'var(--bg-color)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        cursor: showSkip ? 'pointer' : 'default'
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

      {/* Overlay sutil para melhorar leitura do texto */}
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
        {/* Logo Qualivida Club Residence - discreto */}
        <div className="splash-logo">
          <img 
            src="/1024.png" 
            alt="Qualivida Club Residence"
            className="splash-logo-image"
            onError={(e) => {
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

      {/* CSS para estilos e animações suaves */}
      <style>{`
        .splash-screen {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Animação suave de entrada do background */
        .splash-background {
          opacity: 0;
          animation: backgroundFadeIn 1.2s ease-out 0.2s forwards;
        }

        @keyframes backgroundFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Container do conteúdo central */
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

        /* Logo - animação suave de entrada */
        .splash-logo {
          margin-bottom: 2.5rem;
          opacity: 0;
          transform: translateY(-15px);
          animation: logoFadeIn 0.9s ease-out 0.5s forwards;
        }

        .splash-logo-image {
          width: 72px;
          height: 72px;
          object-fit: contain;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
        }

        @keyframes logoFadeIn {
          from {
            opacity: 0;
            transform: translateY(-15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Texto principal - animação suave */
        .splash-title {
          font-size: clamp(1.75rem, 5vw, 2.75rem);
          font-weight: 300;
          line-height: 1.5;
          letter-spacing: 0.01em;
          margin: 0 0 1.25rem 0;
          color: rgba(255, 255, 255, 0.98);
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          opacity: 0;
          transform: translateY(15px);
          animation: titleFadeIn 0.9s ease-out 0.9s forwards;
        }

        .splash-title-highlight {
          font-weight: 500;
          display: block;
          margin-top: 0.5rem;
        }

        @keyframes titleFadeIn {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Texto secundário - animação suave */
        .splash-subtitle {
          font-size: clamp(0.875rem, 2vw, 1rem);
          font-weight: 400;
          line-height: 1.6;
          letter-spacing: 0.03em;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          margin: 0;
          opacity: 0;
          animation: subtitleFadeIn 0.9s ease-out 1.3s forwards;
          max-width: 560px;
        }

        @keyframes subtitleFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Desktop: background-size cover em telas grandes */
        @media (min-width: 1024px) {
          .splash-background {
            background-size: cover !important;
          }

          .splash-logo-image {
            width: 88px;
            height: 88px;
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
            width: 64px;
            height: 64px;
          }

          .splash-title {
            line-height: 1.4;
          }

          .splash-subtitle {
            max-width: 90%;
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
            width: 56px;
            height: 56px;
          }
        }

        /* Modo claro - ajustar overlay e cores do texto */
        .light-mode .splash-overlay {
          background-color: rgba(255, 255, 255, 0.3) !important;
        }

        .light-mode .splash-title {
          color: rgba(0, 0, 0, 0.95);
          text-shadow: 0 2px 6px rgba(255, 255, 255, 0.6);
        }

        .light-mode .splash-subtitle {
          color: rgba(0, 0, 0, 0.8);
          text-shadow: 0 1px 3px rgba(255, 255, 255, 0.6);
        }
      `}</style>

      {/* Botão de pular (discreto e opcional) */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-6 right-6 px-4 py-2 rounded-full text-xs font-normal tracking-wide hover:opacity-70 transition-opacity duration-200 z-30"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.12)', 
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(6px)'
          }}
          aria-label="Pular apresentação"
        >
          Pular
        </button>
      )}

      {/* Indicador de carregamento inicial (mínimo) */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-20" 
          style={{ backgroundColor: 'var(--bg-color)' }}
        >
          <div className="w-6 h-6 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default VideoIntro;
