import React, { useState, useEffect } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const { config } = useAppConfig();
  const [showSkip, setShowSkip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mostrar botão de pular após 2 segundos
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 2000);

    // Auto-completar após 5 segundos (tempo de exibição da apresentação)
    const autoCompleteTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    // Simular carregamento inicial
    const loadTimer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(autoCompleteTimer);
      clearTimeout(loadTimer);
    };
  }, [onComplete]);

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
      {/* Container principal da apresentação */}
      <div className="splash-screen-content">
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
        .splash-screen-content {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: linear-gradient(135deg, 
            var(--bg-color) 0%, 
            rgba(var(--bg-color-rgb, 5, 5, 5), 0.95) 50%,
            var(--bg-color) 100%
          );
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
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.95) 0%, 
            rgba(255, 255, 255, 0.85) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 4px 20px rgba(255, 255, 255, 0.1);
        }

        .splash-word-1 {
          animation-delay: 0.2s;
        }

        .splash-word-2 {
          animation-delay: 0.4s;
          background: linear-gradient(135deg, 
            rgba(11, 122, 75, 1) 0%, 
            rgba(16, 185, 129, 1) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
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
          color: var(--text-secondary);
          opacity: 0.8;
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
            filter: brightness(1);
          }
          50% {
            transform: scale(1.02);
            filter: brightness(1.05);
          }
        }

        /* Responsividade para mobile */
        @media (max-width: 768px) {
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

        /* Modo claro */
        .light-mode .splash-word {
          background: linear-gradient(135deg, 
            rgba(0, 0, 0, 0.95) 0%, 
            rgba(0, 0, 0, 0.85) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .light-mode .splash-word-2 {
          background: linear-gradient(135deg, 
            rgba(11, 122, 75, 1) 0%, 
            rgba(16, 185, 129, 1) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .light-mode .splash-subtitle-text {
          color: rgba(0, 0, 0, 0.6);
        }

        .light-mode .splash-screen-content {
          background: linear-gradient(135deg, 
            #f9fafb 0%, 
            rgba(249, 250, 251, 0.95) 50%,
            #f9fafb 100%
          );
        }
      `}</style>

      {/* Botão de pular */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-4 right-4 md:bottom-8 md:right-8 px-4 py-2 md:px-6 md:py-3 backdrop-blur-md border rounded-full text-xs md:text-sm font-black uppercase tracking-widest hover:scale-105 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 z-10"
          style={{ 
            backgroundColor: 'var(--glass-bg)', 
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)'
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
