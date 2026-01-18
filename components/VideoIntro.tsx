import React, { useState, useEffect } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const { config } = useAppConfig();
  const [showSkip, setShowSkip] = useState(false);
  const [hasError, setHasError] = useState(false);
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

    // Auto-completar após 5 segundos (tempo de exibição da imagem)
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
          // Ambas tentativas falharam, pular apresentação automaticamente
          console.warn('Imagem de apresentação não encontrada, pulando...');
          setHasError(false);
          setIsLoading(false);
          // Auto-completar após pequeno delay
          setTimeout(() => onComplete(), 1000);
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

  // Se houver erro, mostrar mensagem e permitir pular
  if (hasError) {
    return (
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden"
        style={{ 
          width: '100vw', 
          height: '100vh',
          backgroundColor: 'var(--bg-color)'
        }}
      >
        <div className="text-center space-y-6 px-8">
          <div className="w-20 h-20 border-4 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto" />
          <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {config.condominiumName}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Carregando sistema...
          </p>
          <button
            onClick={handleSkip}
            className="px-6 py-3 backdrop-blur-md border rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 transition-all"
            style={{ 
              backgroundColor: 'var(--glass-bg)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

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
      {/* Container com background-image para ocupar 100% da tela */}
      <div
        className={`splash-screen-container ${imageLoaded ? 'splash-screen-loaded' : 'splash-screen-loading'}`}
        style={{
          width: '100vw',
          height: '100vh',
          backgroundImage: backgroundImage || 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />

      {/* CSS para responsividade e animações */}
      <style>{`
        .splash-screen-container {
          transition: opacity 0.3s ease;
          animation: imageTextReveal 2s ease-out forwards, imageTextPulse 4s ease-in-out 2s infinite;
        }

        .splash-screen-loading {
          opacity: 0;
        }

        .splash-screen-loaded {
          opacity: 1;
        }

        @keyframes imageTextReveal {
          0% {
            opacity: 0;
            filter: blur(15px) brightness(0.7) contrast(0.8);
          }
          100% {
            opacity: 1;
            filter: blur(0px) brightness(1) contrast(1);
          }
        }

        @keyframes imageTextPulse {
          0%, 100% {
            filter: brightness(1) contrast(1) saturate(1);
          }
          25% {
            filter: brightness(1.08) contrast(1.08) saturate(1.1);
          }
          50% {
            filter: brightness(1.15) contrast(1.15) saturate(1.2);
          }
          75% {
            filter: brightness(1.08) contrast(1.08) saturate(1.1);
          }
        }

        /* Todas as telas: usar cover para preencher completamente sem faixas pretas */
        .splash-screen-container {
          background-size: cover !important;
        }

        /* Garantir que sempre preencha toda a área em desktop */
        @media (min-width: 1024px) {
          .splash-screen-container {
            background-size: cover !important;
          }
        }

        /* Garantir que sempre preencha toda a área em mobile */
        @media (max-width: 1023px) {
          .splash-screen-container {
            background-size: cover !important;
          }
        }

        /* Ajustes específicos para telas muito pequenas */
        @media (max-width: 480px) {
          .splash-screen-container {
            background-size: cover !important;
            background-position: center center;
          }
        }

        /* Ajustes para orientação paisagem em mobile */
        @media (orientation: landscape) and (max-height: 500px) {
          .splash-screen-container {
            background-size: cover !important;
            background-position: center center;
          }
        }

        /* Ajustes para orientação retrato em mobile */
        @media (orientation: portrait) and (max-width: 768px) {
          .splash-screen-container {
            background-size: cover !important;
            background-position: center center;
          }
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
