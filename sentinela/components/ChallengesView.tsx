
import React, { useState } from 'react';
import { Trophy, Medal, Flame, CheckCircle2, Lock, Share2, Plus, X, Download, Wand2, Trash2 } from 'lucide-react';

interface Challenge {
  id: number | string;
  title: string;
  desc: string;
  reward: string;
  status: 'active' | 'completed' | 'locked';
  progress: number;
  isCustom?: boolean;
}

const ChallengesView: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([
    { id: 1, title: 'Semana Sem Açúcar', desc: 'Evite açúcar processado por 7 dias', reward: '500 XP', status: 'active', progress: 60 },
    { id: 2, title: 'Mestre da Hidratação', desc: 'Beba 3L de água diariamente', reward: 'Medalha Azul', status: 'completed', progress: 100 },
    { id: 3, title: 'Proteína Pura', desc: 'Bata a meta de proteína 5x seguidas', reward: '300 XP', status: 'locked', progress: 0 },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
      title: '',
      desc: '',
      reward: 'Nova Conquista'
  });

  // --- IMAGE GENERATION LOGIC ---
  const generateChallengeImage = async (challenge: Challenge) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Set Canvas Size (Instagram Square/Portrait friendly)
      canvas.width = 1080;
      canvas.height = 1080;

      // 1. Background
      const gradient = ctx.createLinearGradient(0, 0, 0, 1080);
      gradient.addColorStop(0, '#1A4D2E');
      gradient.addColorStop(1, '#143d24');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1080);

      // 2. Decorative Circles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.arc(1080, 0, 400, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 1080, 300, 0, Math.PI * 2);
      ctx.fill();

      // 3. Header Text
      ctx.fillStyle = '#F5F1E8';
      ctx.font = 'bold 40px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DESAFIO NUTRI.AI', 540, 150);

      // 4. Icon Circle
      ctx.fillStyle = '#F5F1E8';
      ctx.beginPath();
      ctx.arc(540, 350, 120, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw Trophy Icon
      ctx.font = '120px serif';
      ctx.fillText('🏆', 540, 390);

      // 5. Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 80px DM Serif Display, serif';
      
      // Text Wrapping for Title
      const words = challenge.title.split(' ');
      let line = '';
      let y = 600;
      const maxWidth = 900;
      const lineHeight = 90;

      for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, 540, y);
          line = words[n] + ' ';
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 540, y);

      // 6. Description
      y += 60;
      ctx.fillStyle = '#A0C4A9';
      ctx.font = '40px Inter, sans-serif';
      ctx.fillText(challenge.desc, 540, y);

      // 7. Status/Reward Badge
      y += 150;
      ctx.fillStyle = '#F59E0B'; // Orange
      ctx.beginPath();
      ctx.roundRect(340, y, 400, 100, 50);
      ctx.fill();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 40px Inter, sans-serif';
      ctx.fillText(challenge.status === 'completed' ? 'CONQUISTADO!' : `RECOMPENSA: ${challenge.reward}`, 540, y + 65);

      // 8. Footer
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '30px Inter, sans-serif';
      ctx.fillText('nutri.ai app', 540, 1020);

      return canvas.toDataURL('image/png');
  };

  const handleShare = async (challenge: Challenge) => {
      try {
          const dataUrl = await generateChallengeImage(challenge);
          if (!dataUrl) return;

          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `desafio-${challenge.id}.png`, { type: 'image/png' });

          // Check if native sharing is supported specifically for files
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                    title: `Desafio Nutri.ai: ${challenge.title}`,
                    text: `Estou participando do desafio "${challenge.title}" no Nutri.ai! Venha conferir.`,
                    files: [file]
                });
              } catch (shareError: any) {
                  // CRITICAL FIX: Ignore AbortError (User cancelled the share menu)
                  if (shareError.name === 'AbortError') {
                      return;
                  }
                  // Re-throw other errors to trigger fallback download
                  throw shareError;
              }
          } else {
              // Browser supports share() but not files, or doesn't support share() at all
              throw new Error("Native file sharing not supported");
          }
      } catch (error) {
          // Fallback: Download the image if sharing fails or isn't supported
          try {
              const dataUrl = await generateChallengeImage(challenge);
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = `desafio-${challenge.title}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } catch (e) {
              console.error("Erro fatal ao gerar imagem:", e);
              alert("Não foi possível gerar a imagem do desafio.");
          }
      }
  };

  const handleCreateChallenge = () => {
      if (!newChallenge.title || !newChallenge.desc) return;
      
      const newId = Date.now();
      const created: Challenge = {
          id: newId,
          title: newChallenge.title,
          desc: newChallenge.desc,
          reward: newChallenge.reward,
          status: 'active',
          progress: 0,
          isCustom: true
      };

      setChallenges([created, ...challenges]);
      setIsModalOpen(false);
      setNewChallenge({ title: '', desc: '', reward: 'Nova Conquista' });
  };

  const handleDeleteChallenge = (id: number | string) => {
    if (window.confirm("Tem certeza que deseja remover este desafio?")) {
        setChallenges(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="p-6 pb-28 max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500 min-h-screen">
      
      {/* Create Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-serif text-2xl text-[#1A4D2E]">Criar Desafio</h3>
                      <button onClick={() => setIsModalOpen(false)}><X /></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-[#4F6F52] uppercase mb-1">Título do Desafio</label>
                          <input 
                              className="w-full bg-[#F5F1E8] p-3 rounded-xl outline-none text-[#1A4D2E] font-medium"
                              placeholder="Ex: 30 dias sem refri"
                              value={newChallenge.title}
                              onChange={e => setNewChallenge({...newChallenge, title: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-[#4F6F52] uppercase mb-1">Descrição / Meta</label>
                          <textarea 
                              className="w-full bg-[#F5F1E8] p-3 rounded-xl outline-none text-[#1A4D2E] h-24 resize-none"
                              placeholder="Ex: Não beber refrigerante durante as refeições por 30 dias..."
                              value={newChallenge.desc}
                              onChange={e => setNewChallenge({...newChallenge, desc: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-[#4F6F52] uppercase mb-1">Recompensa Pessoal</label>
                          <input 
                              className="w-full bg-[#F5F1E8] p-3 rounded-xl outline-none text-[#1A4D2E]"
                              placeholder="Ex: Jantar livre, Cinema..."
                              value={newChallenge.reward}
                              onChange={e => setNewChallenge({...newChallenge, reward: e.target.value})}
                          />
                      </div>

                      <button 
                        onClick={handleCreateChallenge}
                        className="w-full bg-[#1A4D2E] text-white py-4 rounded-2xl font-bold mt-2 shadow-lg hover:bg-[#143d24] transition-colors"
                      >
                          Criar e Começar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
            <h2 className="text-3xl font-serif font-bold text-[#1A4D2E] flex items-center gap-2">
            <Trophy className="text-[#4F6F52]" /> Desafios
            </h2>
            <p className="text-[#4F6F52] text-sm mt-1">Supere seus limites.</p>
        </div>
        
        <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#1A4D2E] text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform"
        >
            <Plus size={24} />
        </button>
      </div>

      <div className="grid gap-4">
        {challenges.map((c) => (
          <div 
            key={c.id} 
            className={`relative p-6 rounded-[2rem] border transition-all ${
                c.status === 'completed' ? 'bg-[#1A4D2E]/5 border-[#1A4D2E]/20' : 
                c.status === 'locked' ? 'bg-white/50 border-gray-200 opacity-60' : 
                'bg-white border-transparent shadow-md'
            }`}
          >
            {/* Custom Badge */}
            {c.isCustom && (
                <div className="absolute top-4 right-4 text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded-full flex items-center gap-1">
                    <Wand2 size={10} /> Personalizado
                </div>
            )}

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-full ${
                        c.status === 'completed' ? 'bg-[#1A4D2E] text-[#F5F1E8]' : 'bg-[#F5F1E8] text-[#4F6F52]'
                    }`}>
                        {c.status === 'completed' ? <CheckCircle2 size={24} /> : c.status === 'locked' ? <Lock size={24} /> : <Medal size={24} />}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-serif font-bold text-[#1A4D2E] text-xl leading-tight mb-1 pr-16">{c.title}</h3>
                        <p className="text-sm text-[#4F6F52] leading-snug">{c.desc}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-end justify-between mt-4">
                <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-bold uppercase text-gray-400">Recompensa</span>
                     <span className="text-xs font-bold bg-[#F59E0B]/10 text-[#B45309] px-3 py-1 rounded-full w-fit">
                        {c.reward}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handleDeleteChallenge(c.id)}
                        className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Remover desafio"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button 
                        onClick={() => handleShare(c)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#F5F1E8] rounded-xl text-[#1A4D2E] font-bold text-xs hover:bg-[#1A4D2E] hover:text-white transition-colors group"
                    >
                        <Share2 size={14} /> Compartilhar
                    </button>
                </div>
            </div>

            {c.status !== 'locked' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-[#4F6F52] mb-2 font-medium">
                        <span>Progresso</span>
                        <span>{c.progress}%</span>
                    </div>
                    <div className="h-2.5 bg-[#F5F1E8] rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${c.status === 'completed' ? 'bg-[#1A4D2E]' : 'bg-[#4F6F52]'}`}
                            style={{ width: `${c.progress}%` }} 
                        />
                    </div>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChallengesView;
