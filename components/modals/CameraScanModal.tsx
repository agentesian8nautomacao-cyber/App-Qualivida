import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, QrCode, Image as ImageIcon, CheckCircle2, AlertCircle, RotateCcw, RotateCw, Upload, RefreshCw } from 'lucide-react';
import { Resident } from '../../types';

interface CameraScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: { resident?: Resident; qrData?: string; image?: string }) => void;
  allResidents: Resident[];
}

// Função para carregar jsQR dinamicamente
const loadJSQR = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).jsQR) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Erro ao carregar jsQR'));
    document.head.appendChild(script);
  });
};

// Função para detectar QR code usando jsQR
const detectQRCode = async (imageData: ImageData): Promise<string | null> => {
  try {
    await loadJSQR();
    const code = (window as any).jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    return code ? code.data : null;
  } catch (error) {
    console.error('Erro ao detectar QR code:', error);
    return null;
  }
};

const CameraScanModal: React.FC<CameraScanModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  allResidents
}) => {
  const [mode, setMode] = useState<'qr' | 'photo'>('qr');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isRetrying, setIsRetrying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && (mode === 'qr' || mode === 'photo')) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, facingMode]);

  const startCamera = async () => {
    try {
      setError(null);
      
      // Verificar HTTPS (exceto localhost)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError('Acesso à câmera requer HTTPS. Por favor, use uma conexão segura.');
        return;
      }
      
      // Verificar se a API está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Câmera não disponível neste navegador. Use um navegador moderno com suporte a câmera.');
        return;
      }

      // Verificar se há dispositivos de vídeo disponíveis
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          setError('Nenhuma câmera detectada neste dispositivo.');
          return;
        }
      } catch (enumError) {
        // Se falhar ao enumerar, continuar mesmo assim - alguns navegadores precisam de permissão primeiro
        console.warn('Não foi possível enumerar dispositivos:', enumError);
      }

      // Verificar permissões antes de solicitar
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permissionStatus.state === 'denied') {
          setError('Permissão de câmera negada. Por favor, permita o acesso nas configurações do navegador.');
          return;
        }
      } catch (permError) {
        // Alguns navegadores não suportam navigator.permissions.query, continuar normalmente
        console.warn('Não foi possível verificar permissões de câmera:', permError);
      }

      // Tentar com constraints flexíveis primeiro
      let mediaStream: MediaStream | null = null;
      const constraints = [
        // Tentativa 1: Constraint específica com facingMode
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Tentativa 2: Constraint mais simples com facingMode
        {
          video: {
            facingMode: facingMode
          }
        },
        // Tentativa 3: Qualquer câmera disponível
        {
          video: true
        }
      ];

      for (const constraint of constraints) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch (err) {
          console.warn('Tentativa falhou, tentando próximo constraint:', err);
          continue;
        }
      }

      if (!mediaStream) {
        // Tentar verificar novamente se há dispositivos
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          
          if (videoDevices.length === 0) {
            throw new Error('Nenhuma câmera detectada neste dispositivo. Verifique se há uma câmera conectada.');
          } else {
            throw new Error('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
          }
        } catch (enumError: any) {
          throw new Error(enumError.message || 'Não foi possível acessar nenhuma câmera disponível.');
        }
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      if (mode === 'qr') {
        startQRScanning();
      }
    } catch (err: any) {
      console.error('Erro ao acessar câmera:', err);
      
      let errorMessage = 'Não foi possível acessar a câmera.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador e recarregue a página.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada neste dispositivo. Verifique se há uma câmera conectada e funcionando.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'A câmera está sendo usada por outro aplicativo ou há um problema de hardware. Feche outros aplicativos que estejam usando a câmera.';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'As configurações solicitadas da câmera não são suportadas. Tente novamente ou use o botão de retry.';
      } else if (err.name === 'SecurityError' || err.message?.includes('HTTPS')) {
        errorMessage = 'Acesso à câmera requer HTTPS. Por favor, use uma conexão segura (https://) ou localhost.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const startQRScanning = () => {
    setIsScanning(true);
    scanIntervalRef.current = window.setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          detectQRCode(imageData).then((qrData) => {
            if (qrData) {
              setScannedData(qrData);
              setIsScanning(false);
              stopCamera();
              
              // Tentar encontrar morador pelo QR code
              const resident = findResidentByQR(qrData);
              if (resident) {
                handleSuccess({ resident, qrData });
              } else {
                handleSuccess({ qrData });
              }
            }
          });
        }
      }
    }, 300);
  };

  const findResidentByQR = (qrData: string): Resident | undefined => {
    // Formato esperado: JSON com dados do morador ou simplesmente unidade/nome
    try {
      const data = JSON.parse(qrData);
      if (data.unit) {
        return allResidents.find(r => r.unit === data.unit || r.id === data.id);
      }
    } catch {
      // Se não for JSON, tentar buscar por unidade direto no QR code
      const resident = allResidents.find(r => 
        qrData.includes(r.unit) || 
        qrData.includes(r.name) ||
        r.unit === qrData
      );
      return resident;
    }
    return undefined;
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageDataUrl);
        stopCamera();

        // Tentar detectar QR code na foto capturada
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        detectQRCode(imageData).then((qrData) => {
          if (qrData) {
            setScannedData(qrData);
            const resident = findResidentByQR(qrData);
            if (resident) {
              handleSuccess({ resident, qrData, image: imageDataUrl });
            } else {
              handleSuccess({ qrData, image: imageDataUrl });
            }
          }
        });
      }
    }
  };

  const handleSuccess = (data: { resident?: Resident; qrData?: string; image?: string }) => {
    onScanSuccess(data);
    resetModal();
  };

  const resetModal = () => {
    stopCamera();
    setCapturedImage(null);
    setScannedData(null);
    setError(null);
    setMode('qr');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    stopCamera();
    await new Promise(resolve => setTimeout(resolve, 500));
    await startCamera();
    setIsRetrying(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageDataUrl = e.target?.result as string;
      setCapturedImage(imageDataUrl);
      
      // Tentar detectar QR code na imagem
      const img = new Image();
      img.onload = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        canvas.width = img.width;
        canvas.height = img.height;
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(img, 0, 0);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const qrData = await detectQRCode(imageData);
          if (qrData) {
            setScannedData(qrData);
            const resident = findResidentByQR(qrData);
            if (resident) {
              handleSuccess({ resident, qrData, image: imageDataUrl });
            } else {
              handleSuccess({ qrData, image: imageDataUrl });
            }
          }
        }
      };
      img.src = imageDataUrl;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-2xl" 
        onClick={handleClose}
      />
      <div className="relative w-full max-w-full sm:max-w-2xl md:max-w-4xl max-h-[95vh] bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-[32px] sm:rounded-[40px] md:rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 my-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
              {mode === 'qr' ? 'Escanear QR Code' : 'Capturar Foto'}
            </h3>
            <p className="text-xs opacity-40 mt-1" style={{ color: 'var(--text-secondary)' }}>
              {mode === 'qr' ? 'Aponte a câmera para o QR code da encomenda' : 'Tire uma foto da encomenda'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-3 rounded-2xl hover:bg-[var(--border-color)] transition-all"
            style={{ color: 'var(--text-primary)' }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {/* Modos */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                setMode('qr');
                setCapturedImage(null);
              }}
              className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase transition-all border ${
                mode === 'qr'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-color)]'
              }`}
              style={mode !== 'qr' ? { color: 'var(--text-primary)' } : {}}
            >
              <QrCode className="w-4 h-4 inline mr-2" />
              QR Code
            </button>
            <button
              onClick={() => {
                setMode('photo');
                setScannedData(null);
              }}
              className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase transition-all border ${
                mode === 'photo'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-color)]'
              }`}
              style={mode !== 'photo' ? { color: 'var(--text-primary)' } : {}}
            >
              <ImageIcon className="w-4 h-4 inline mr-2" />
              Foto
            </button>
          </div>

          {/* Erro */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs font-bold text-red-400">{error}</p>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 disabled:opacity-50"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              </div>
              {/* Opção alternativa: upload de arquivo */}
              <div className="mt-4 pt-4 border-t border-red-500/20">
                <label className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:bg-[var(--border-color)] transition-all">
                  <Upload className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                  <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
                    Ou fazer upload de uma imagem
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Área da câmera/foto */}
          <div className="relative bg-black rounded-xl sm:rounded-2xl overflow-hidden" style={{ minHeight: '250px', maxHeight: 'calc(95vh - 300px)' }}>
            {capturedImage ? (
              // Foto capturada
              <div className="relative">
                <img 
                  src={capturedImage} 
                  alt="Foto capturada" 
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: 'calc(95vh - 300px)' }}
                />
                {scannedData && (
                  <div className="absolute top-4 left-4 right-4 p-4 bg-green-500/90 backdrop-blur-md rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <p className="text-sm font-black text-white">QR Code detectado: {scannedData.substring(0, 50)}...</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 flex gap-3">
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      startCamera();
                    }}
                    className="flex-1 px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl text-xs font-black uppercase"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <RotateCcw className="w-4 h-4 inline mr-2" />
                    Tirar Outra
                  </button>
                  <button
                    onClick={() => handleSuccess({ image: capturedImage, qrData: scannedData || undefined })}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl text-xs font-black uppercase"
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Confirmar
                  </button>
                </div>
              </div>
            ) : (
              // Câmera ao vivo
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: 'calc(95vh - 300px)' }}
                />
                {isScanning && mode === 'qr' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-green-500 rounded-2xl animate-pulse" />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-xl">
                      <p className="text-xs font-black text-white uppercase">Buscando QR Code...</p>
                    </div>
                  </div>
                )}
                {scannedData && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
                    <div className="bg-green-500/90 backdrop-blur-md p-8 rounded-2xl text-center">
                      <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-4" />
                      <p className="text-lg font-black text-white mb-2">QR Code Detectado!</p>
                      <p className="text-xs text-white/80">{scannedData.substring(0, 50)}...</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Canvas oculto para processamento */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controles */}
          {!capturedImage && !scannedData && (
            <div className="mt-6 flex justify-center gap-4">
              {mode === 'photo' && (
                <button
                  onClick={capturePhoto}
                  className="px-8 py-4 bg-white text-black rounded-full text-sm font-black uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capturar Foto
                </button>
              )}
              <button
                onClick={toggleCamera}
                className="px-6 py-4 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-full text-xs font-black uppercase hover:bg-[var(--border-color)] transition-all"
                style={{ color: 'var(--text-primary)' }}
              >
                <RotateCw className="w-4 h-4 inline mr-2" />
                {facingMode === 'user' ? 'Câmera Frontal' : 'Câmera Traseira'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraScanModal;