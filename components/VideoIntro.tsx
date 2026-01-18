import React, { useState, useEffect } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const { config } = useAppConfig();
  const [showSkip, setShowSkip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  
  // Usar nome sem espaços para compatibilidade com Vercel/produção
  const [imageSrc] = useState(() => '/gestao-qualivida-residence.png');

  useEffect(() => {
    // Mostrar botão de pular após 2 segundos
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 2000);

    // Auto-completar após 5 segundos (tempo de exibição da apresentação)
    const autoCompleteTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    // Verificar se a imagem foi carregada com fallback
    const tryLoadImage = (src: string, isRetry = false) => {
      const img = new Image();
      img.onload = () => {
        setIsLoading(false);
        setImageLoaded(true);
        setBackgroundImage(`url(${src})`);
      };
      img.onerror = () => {
        if (!isRetry && src.includes('gestao-qualivida-residence')) {
          // Tentar fallback com espaços
          const fallbackSrc = '/gestão%20Qualivida%20Residence.png';
          console.warn('Imagem sem espaços não encontrada, tentando com espaços');
          tryLoadImage(fallbackSrc, true);
        } else if (!isRetry && src.includes('%20')) {
          // Tentar fallback sem espaços
          const fallbackSrc = '/gestao-qualivida-residence.png';
          console.warn('Imagem com espaços não encontrada, tentando sem espaços');
          tryLoadImage(fallbackSrc, true);
        } else {
          // Ambas tentativas falharam, usar apenas texto
          console.warn('Imagem de apresentação não encontrada, usando apenas texto');
          setIsLoading(false);
          setImageLoaded(false);
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
      className="fixed inset-0 z-[10000] overflow-hidden"
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
      {/* Background com imagem */}
      <div
        className={`splash-background ${imageLoaded ? 'splash-background-loaded' : 'splash-background-loading'}`}
        style={{
          width: '100vw',
          height: '100vh',
          backgroundImage: backgroundImage || 'none',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />

      {/* Overlay escuro para melhor contraste do texto */}
      <div 
        className="splash-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: imageLoaded 
            ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 50%, rgba(0, 0, 0, 0.4) 100%)'
            : 'var(--bg-color)',
          zIndex: 1
        }}
      />

      {/* Container principal da apresentação */}
      <div className="splash-screen-content" style={{ position: 'relative', zIndex: 2 }}>
        <div className="splash-screen-text">
          <h1 className="splash-title-main">
            <span className="splash-word splash-word-1">Gestão</span>
            <span className="splash-word splash-word-2">Qualivida</span>
            <span className="splash-word splash-word-3">Residence</span>
            <span className="splash-word splash-word-4">Club</span>
          </h1>
          <div className="splash-subtitle">
            <p className="splash-subtitle-text">Sistema Premium de Gestão Condominial</p>
          </div>
        </div>
      </div>

      {/* CSS para animações e estilos */}
      <style>{`
        .splash-background {
          transition: opacity 0.8s ease;
          animation: backgroundFadeIn 1.5s ease-out forwards;
        }

        .splash-background-loading {
          opacity: 0;
        }

        .splash-background-loaded {
          opacity: 1;
        }

        @keyframes backgroundFadeIn {
          from {
            opacity: 0;
            filter: blur(10px) brightness(0.8);
          }
          to {
            opacity: 1;
            filter: blur(0px) brightness(1);
          }
        }

        .splash-screen-content {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .splash-screen-text {
          text-align: center;
          padding: 2rem;
          max-width: 90vw;
        }

        .splash-title-main {
          font-size: clamp(2rem, 8vw, 6rem);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .splash-word {
          display: inline-block;
          opacity: 0;
          transform: translateY(30px);
          animation: fadeInUp 0.8s ease-out forwards;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5),
                       0 2px 10px rgba(0, 0, 0, 0.3);
          color: rgba(255, 255, 255, 0.98);
        }

        .splash-word-1 {
          animation-delay: 0.2s;
        }

        .splash-word-2 {
          animation-delay: 0.4s;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 1) 0%, 
            rgba(16, 185, 129, 1) 50%,
            rgba(11, 122, 75, 1) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: none;
          filter: drop-shadow(0 4px 20px rgba(16, 185, 129, 0.4));
        }

        .splash-word-3 {
          animation-delay: 0.6s;
        }

        .splash-word-4 {
          animation-delay: 0.8s;
          font-size: 0.7em;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .splash-subtitle {
          margin-top: 2rem;
          opacity: 0;
          animation: fadeIn 1s ease-out 1.2s forwards;
        }

        .splash-subtitle-text {
          font-size: clamp(0.875rem, 2vw, 1.25rem);
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Animação de pulso sutil no título */
        .splash-title-main {
          animation: titlePulse 3s ease-in-out 2s infinite;
        }

        @keyframes titlePulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        /* Desktop: usar cover para preencher completamente */
        @media (min-width: 1024px) {
          .splash-background {
            background-size: cover !important;
          }
        }

        /* Mobile: usar contain para não cortar conteúdo importante */
        @media (max-width: 1023px) {
          .splash-background {
            background-size: contain !important;
            background-position: center center;
          }
        }

        /* Ajustes específicos para telas muito pequenas */
        @media (max-width: 480px) {
          .splash-background {
            background-size: contain !important;
            background-position: center center;
          }

          .splash-title-main {
            font-size: clamp(1.5rem, 10vw, 3.5rem);
            gap: 0.3rem;
          }

          .splash-subtitle {
            margin-top: 1.5rem;
          }

          .splash-word-4 {
            font-size: 0.65em;
          }
        }

        /* Ajustes para orientação paisagem em mobile */
        @media (orientation: landscape) and (max-height: 500px) {
          .splash-background {
            background-size: contain !important;
            background-position: center center;
          }
        }

        /* Ajustes para orientação retrato em mobile */
        @media (orientation: portrait) and (max-width: 768px) {
          .splash-background {
            background-size: contain !important;
            background-position: center center;
          }
        }

        /* Modo claro - ajustar cores do texto */
        .light-mode .splash-word {
          color: rgba(0, 0, 0, 0.95);
          text-shadow: 0 4px 20px rgba(255, 255, 255, 0.8),
                       0 2px 10px rgba(255, 255, 255, 0.6);
        }

        .light-mode .splash-word-2 {
          background: linear-gradient(135deg, 
            rgba(11, 122, 75, 1) 0%, 
            rgba(16, 185, 129, 1) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 4px 20px rgba(16, 185, 129, 0.3));
        }

        .light-mode .splash-subtitle-text {
          color: rgba(0, 0, 0, 0.8);
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.8);
        }

        .light-mode .splash-overlay {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.3) 100%) !important;
        }
      `}</style>

      {/* Botão de pular */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-4 right-4 md:bottom-8 md:right-8 px-4 py-2 md:px-6 md:py-3 backdrop-blur-md border rounded-full text-xs md:text-sm font-black uppercase tracking-widest hover:scale-105 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 z-30"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.1)', 
            borderColor: 'rgba(255, 255, 255, 0.3)',
            color: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}
        >
          Pular
        </button>
      )}

      {/* Indicador de carregamento */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        >
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              Carregando apresentação...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoIntro;
