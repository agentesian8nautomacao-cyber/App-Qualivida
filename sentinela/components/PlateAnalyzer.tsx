
import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Sparkles, CheckCircle2, Plus, Image as ImageIcon, History } from 'lucide-react';
import { analyzeFoodImage } from '../services/geminiService';
import { MealItem, ScanHistoryItem } from '../types';

interface PlateAnalyzerProps {
  onClose: () => void;
  onAddFood: (item: MealItem, scannedImage: string) => void;
  history?: ScanHistoryItem[];
}

const PlateAnalyzer: React.FC<PlateAnalyzerProps> = ({ onClose, onAddFood, history = [] }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MealItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<string>("Lunch");
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); 
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const analyzeImage = async (base64Image: string) => {
    setIsAnalyzing(true);
    setError(null);
    const base64Data = base64Image.split(',')[1];
    try {
      const analysis = await analyzeFoodImage(base64Data);
      if (analysis) setResult(analysis); else setError("Não identifiquei o alimento.");
    } catch (error) { setError("Falha ao analisar."); } finally { setIsAnalyzing(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resizedImage = await resizeImage(file);
        setImage(resizedImage);
        // Auto-start analysis
        analyzeImage(resizedImage);
      } catch (err) { setError("Erro ao processar imagem."); }
    }
  };

  const handleAdd = () => {
      if(result && image) {
          onAddFood({...result, description: result.description + ` (${mealType})`, image: image }, image);
      }
  };

  // --- MODAL SELECTION STATE (No Image) ---
  if (!image) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
             <div className="bg-white w-full max-w-md rounded-[2rem] p-8 text-center relative shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                 <button 
                   onClick={onClose} 
                   className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                 >
                   <X size={20} />
                 </button>
                 
                 <h2 className="font-serif text-2xl text-[#1A4D2E] mb-8">Adicionar Alimento</h2>
                 
                 <div className="grid grid-cols-2 gap-4 mb-8">
                     <button 
                       onClick={() => cameraInputRef.current?.click()}
                       className="flex flex-col items-center justify-center gap-3 p-6 rounded-[1.5rem] bg-[#F5F1E8] text-[#1A4D2E] hover:bg-[#1A4D2E] hover:text-[#F5F1E8] transition-all duration-300 group"
                     >
                         <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                             <Camera size={28} className="text-[#1A4D2E]" />
                         </div>
                         <span className="font-bold font-serif">Câmera</span>
                     </button>
                     
                     <button 
                       onClick={() => galleryInputRef.current?.click()}
                       className="flex flex-col items-center justify-center gap-3 p-6 rounded-[1.5rem] bg-[#F5F1E8] text-[#1A4D2E] hover:bg-[#1A4D2E] hover:text-[#F5F1E8] transition-all duration-300 group"
                     >
                         <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                             <ImageIcon size={28} className="text-[#1A4D2E]" />
                         </div>
                         <span className="font-bold font-serif">Galeria</span>
                     </button>
                 </div>

                 {/* Recent History */}
                 {history.length > 0 && (
                     <div className="flex-1 overflow-hidden flex flex-col">
                         <div className="flex items-center gap-2 mb-3 text-[#4F6F52]">
                             <History size={16} />
                             <span className="text-xs font-bold uppercase">Histórico de Scans</span>
                         </div>
                         <div className="overflow-y-auto space-y-3 no-scrollbar flex-1">
                             {history.map((item) => (
                                 <div key={item.id} className="flex items-center gap-3 bg-[#F5F1E8]/50 p-3 rounded-2xl">
                                     <img src={item.image} className="w-12 h-12 rounded-xl object-cover border border-white" />
                                     <div className="text-left">
                                         <div className="font-bold text-[#1A4D2E] text-sm">{item.resultName || "Alimento Scan"}</div>
                                         <div className="text-xs text-[#4F6F52]">{new Date(item.date).toLocaleDateString()}</div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                 {/* Hidden Inputs */}
                 <input 
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                 />
                 <input 
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                 />
             </div>
        </div>
      );
  }

  // --- ANALYSIS STATE (Image Selected) ---
  return (
    <div className="fixed inset-0 bg-[#F5F1E8] z-50 flex flex-col animate-in fade-in duration-300">
        <style>{` @keyframes bounce-apple { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } } .animate-apple { animation: bounce-apple 1s infinite ease-in-out; } `}</style>
        
        {/* Header */}
        <div className="p-6 flex justify-between items-center bg-white rounded-b-[2rem] shadow-sm relative z-20">
            <h3 className="font-serif text-2xl text-[#1A4D2E] flex items-center gap-2"><Camera className="text-[#1A4D2E]" /> Análise</h3>
            <button onClick={onClose} className="p-3 bg-[#F5F1E8] rounded-full text-[#1A4D2E] hover:bg-[#1A4D2E] hover:text-white transition-colors"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
            <div className="relative rounded-[2.5rem] overflow-hidden h-96 bg-black shadow-2xl border-4 border-white group mx-auto max-w-md w-full">
               <img src={image} className={`w-full h-full object-cover transition-all duration-500 ${isAnalyzing ? 'blur-sm opacity-50' : ''}`} />
               
               {/* Bouncing Apple Overlay */}
               {isAnalyzing && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm"><div className="text-8xl animate-apple drop-shadow-2xl">🍎</div><div className="mt-4 text-white font-serif text-xl tracking-wide drop-shadow-md bg-black/30 px-6 py-2 rounded-full backdrop-blur-md border border-white/10">Analisando...</div></div>}
               
               {!isAnalyzing && !result && <button onClick={() => setImage(null)} className="absolute top-4 right-4 bg-white/80 text-[#1A4D2E] p-3 rounded-full hover:bg-white backdrop-blur-md shadow-lg z-20"><X size={20} /></button>}
            </div>
            
            {error && <div className="bg-red-50 p-4 rounded-2xl text-red-600 text-center font-medium border border-red-100">{error} <button onClick={() => setImage(null)} className="underline ml-2">Tentar novamente</button></div>}
            
            {result && (
            <div className="bg-white p-6 rounded-[2.5rem] border border-[#1A4D2E]/5 animate-in slide-in-from-bottom duration-500 shadow-xl max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-[#1A4D2E]/10 rounded-full"><CheckCircle2 size={24} className="text-[#1A4D2E]" /></div><h4 className="font-serif text-2xl text-[#1A4D2E]">{result.name}</h4></div>
              <div className="grid grid-cols-3 gap-2 mb-6">{[{l:'Calorias',v:result.calories},{l:'Prot',v:result.macros.protein+'g'},{l:'Gord',v:result.macros.fats+'g'}].map(m=><div key={m.l} className="bg-[#F5F1E8] p-3 rounded-2xl text-center"><div className="text-xs uppercase font-bold text-[#4F6F52]">{m.l}</div><div className="text-xl font-serif text-[#1A4D2E]">{m.v}</div></div>)}</div>
              <div className="mb-4">
                  <label className="block text-xs font-bold text-[#4F6F52] uppercase mb-2">Tipo de Refeição</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(t => (
                          <button key={t} onClick={() => setMealType(t)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${mealType === t ? 'bg-[#1A4D2E] text-white' : 'bg-[#F5F1E8] text-[#4F6F52]'}`}>{t === 'Breakfast' ? 'Café' : t === 'Lunch' ? 'Almoço' : t === 'Dinner' ? 'Jantar' : 'Lanche'}</button>
                      ))}
                  </div>
              </div>
              <button onClick={handleAdd} className="w-full py-4 bg-[#1A4D2E] text-[#F5F1E8] rounded-[2rem] font-serif text-lg flex items-center justify-center gap-2 hover:bg-[#4F6F52] transition-colors"><Plus size={20} /> Registrar no Diário</button>
            </div>
            )}
        </div>
    </div>
  );
};
export default PlateAnalyzer;
