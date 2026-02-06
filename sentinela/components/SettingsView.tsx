
import React, { useState, useRef, useEffect } from 'react';
import { Save, AudioLines, FileText, Upload, Trash2, ArrowLeft, Shield, User, Camera, Bot, MessageSquare } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface SettingsViewProps {
    onBack: () => void;
    userProfile: UserProfile;
    onUpdateProfile: (p: UserProfile) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onBack, userProfile, onUpdateProfile }) => {
  // The role currently being EDITED in settings (toggle switch)
  // We initialize this to the user's active role, but changing it here doesn't change the active role immediately until save.
  const [editingRole, setEditingRole] = useState<UserRole>(userProfile.role || UserRole.Doorman);
  
  // Form State
  const [assistantName, setAssistantName] = useState('');
  const [assistantAvatar, setAssistantAvatar] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  
  const [aiVoice, setAiVoice] = useState(userProfile.aiVoice || 'Puck');
  const [isSaved, setIsSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Load data when switching tabs
  useEffect(() => {
      if (editingRole === UserRole.Manager) {
          setAssistantName(userProfile.managerConfig.assistantName);
          setAssistantAvatar(userProfile.managerConfig.assistantAvatar || null);
          setInstructions(userProfile.managerConfig.instructions);
      } else {
          setAssistantName(userProfile.doormanConfig.assistantName);
          setAssistantAvatar(userProfile.doormanConfig.assistantAvatar || null);
          setInstructions(userProfile.doormanConfig.instructions);
      }
  }, [editingRole, userProfile]);

  const saveSettings = () => {
      const newProfile = { ...userProfile };
      
      // Update Global Settings
      newProfile.role = editingRole; // Set the active role to whatever we are editing
      newProfile.aiVoice = aiVoice;

      // Update Specific Role Config
      const newConfig = {
          assistantName: assistantName,
          assistantAvatar: assistantAvatar || undefined,
          instructions: instructions
      };

      if (editingRole === UserRole.Manager) {
          newProfile.managerConfig = newConfig;
      } else {
          newProfile.doormanConfig = newConfig;
      }

      onUpdateProfile(newProfile);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
  };

  const handleKnowledgeBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const base64String = event.target?.result as string;
              const base64Data = base64String.split(',')[1];
              
              onUpdateProfile({
                  ...userProfile,
                  knowledgeBase: {
                      name: file.name,
                      mimeType: file.type,
                      data: base64Data
                  }
              });
              setIsSaved(true);
              setTimeout(() => setIsSaved(false), 3000);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              setAssistantAvatar(event.target?.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const removeFile = () => {
      const updated = { ...userProfile };
      delete updated.knowledgeBase;
      onUpdateProfile(updated);
  };

  const voices = [
      { id: 'Puck', label: 'Puck (Seguro)' },
      { id: 'Charon', label: 'Charon (Grave)' },
      { id: 'Fenrir', label: 'Fenrir (Forte)' },
      { id: 'Kore', label: 'Kore (Calma)' },
      { id: 'Zephyr', label: 'Zephyr (Suave)' }
  ];

  const isManagerEditing = editingRole === UserRole.Manager;

  return (
    <div className="fixed inset-0 bg-[#09090b] z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#09090b]/90 backdrop-blur-xl p-6 border-b border-white/5 flex items-center justify-between z-10 shadow-lg">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-serif text-white tracking-wide">Configurações</h2>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isManagerEditing ? 'border-amber-500/30 text-amber-500' : 'border-zinc-500/30 text-zinc-400'}`}>
                {isManagerEditing ? 'Modo Síndico' : 'Modo Porteiro'}
            </div>
        </div>

        <div className="p-6 max-w-xl mx-auto space-y-8 pb-32">
            
            {/* Role Switcher */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Perfil Ativo</label>
                <div className="flex bg-[#18181b] p-1.5 rounded-2xl border border-white/5">
                    <button 
                        onClick={() => setEditingRole(UserRole.Doorman)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${!isManagerEditing ? 'bg-zinc-100 text-black shadow-lg scale-[1.02]' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <User size={16} /> Porteiro
                    </button>
                    <button 
                        onClick={() => setEditingRole(UserRole.Manager)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${isManagerEditing ? 'bg-amber-500 text-black shadow-lg scale-[1.02]' : 'text-zinc-500 hover:text-amber-500'}`}
                    >
                        <Shield size={16} /> Síndico
                    </button>
                </div>
            </div>

            {/* Assistant Identity */}
            <div className={`p-6 rounded-[2rem] border transition-colors duration-500 relative overflow-hidden ${isManagerEditing ? 'bg-[#18181b] border-amber-500/20' : 'bg-[#18181b] border-white/5'}`}>
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider mb-6 relative z-10">
                    <Bot size={14} /> Identidade do Assistente ({isManagerEditing ? 'Síndico' : 'Porteiro'})
                </div>
                
                <div className="flex items-center gap-6 relative z-10">
                    {/* Avatar */}
                    <div 
                        onClick={() => avatarInputRef.current?.click()}
                        className={`w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center relative overflow-hidden group cursor-pointer transition-colors ${isManagerEditing ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-600 bg-zinc-800'}`}
                    >
                        {assistantAvatar ? (
                            <img src={assistantAvatar} className="w-full h-full object-cover" alt="Assistant" />
                        ) : (
                            <Bot size={32} className={isManagerEditing ? "text-amber-500" : "text-zinc-500"} />
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={20} className="text-white"/>
                        </div>
                        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload}/>
                    </div>

                    {/* Name */}
                    <div className="flex-1 space-y-2">
                        <label className="text-xs text-zinc-400 font-bold ml-1">Nome de Exibição</label>
                        <input 
                            value={assistantName}
                            onChange={(e) => setAssistantName(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-white/30 font-medium placeholder:text-zinc-700"
                            placeholder={isManagerEditing ? "Ex: Conselheiro..." : "Ex: Sentinela..."}
                        />
                    </div>
                </div>

                {/* Decoration */}
                {isManagerEditing && <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl"></div>}
            </div>

            {/* Instructions */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider pl-1">
                    <MessageSquare size={14} /> Cérebro & Regras
                </div>
                <div className={`p-1 rounded-[1.5rem] border transition-colors ${isManagerEditing ? 'bg-[#18181b] border-amber-500/30 focus-within:border-amber-500/50' : 'bg-[#18181b] border-white/10 focus-within:border-white/30'}`}>
                    <textarea 
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder={isManagerEditing 
                            ? "Ex: Use tom formal jurídico. Cite sempre o Artigo 5 do regimento..." 
                            : "Ex: Entregas sobem até o apto? Horário de silêncio é 22h?..."}
                        className="w-full h-40 bg-transparent rounded-[1.2rem] p-5 text-white placeholder:text-zinc-700 outline-none resize-none text-base leading-relaxed"
                    />
                </div>
            </div>

            {/* Voice & Shared Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider pl-1">
                        <AudioLines size={14} /> Voz (Global)
                    </div>
                    <div className="bg-[#18181b] p-2 rounded-2xl border border-white/5 grid grid-cols-2 gap-2">
                        {voices.slice(0,4).map(v => (
                            <button
                                key={v.id}
                                onClick={() => setAiVoice(v.id)}
                                className={`px-2 py-3 rounded-xl text-xs font-medium transition-all text-center ${
                                    aiVoice === v.id 
                                    ? 'bg-zinc-100 text-black shadow-sm' 
                                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {v.label.split(' ')[0]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider pl-1">
                        <FileText size={14} /> Regimento (Global)
                    </div>
                    
                    {userProfile.knowledgeBase ? (
                        <div className="flex items-center justify-between bg-[#18181b] border border-white/10 p-3 rounded-2xl h-[108px]">
                                <div className="flex flex-col min-w-0 px-2">
                                    <span className="text-xs font-bold text-white truncate max-w-[100px]">{userProfile.knowledgeBase.name}</span>
                                    <span className="text-[10px] text-green-400 mt-1">Ativo</span>
                                </div>
                                <button onClick={removeFile} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border border-dashed border-zinc-700 hover:border-zinc-500 bg-[#18181b]/50 hover:bg-[#18181b] rounded-2xl h-[108px] flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                        >
                            <Upload size={16} className="text-zinc-500 group-hover:text-white mb-2" />
                            <p className="text-[10px] text-zinc-500">Enviar PDF</p>
                            <input ref={fileInputRef} type="file" accept=".pdf, .txt, image/*" className="hidden" onChange={handleKnowledgeBaseUpload} />
                        </div>
                    )}
                </div>
            </div>

            {/* Save Button */}
            <div className="fixed bottom-6 left-6 right-6 max-w-xl mx-auto">
                <button 
                    onClick={saveSettings}
                    className={`w-full py-4 rounded-[1.5rem] font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${
                        isSaved 
                        ? 'bg-green-500 text-black scale-95' 
                        : isManagerEditing 
                            ? 'bg-amber-500 text-black hover:bg-amber-400 hover:scale-[1.02]' 
                            : 'bg-white text-black hover:scale-[1.02]'
                    }`}
                >
                    {isSaved ? 'Salvo com Sucesso!' : <><Save size={20}/> Salvar {isManagerEditing ? 'Síndico' : 'Porteiro'}</>}
                </button>
            </div>

        </div>
    </div>
  );
};
export default SettingsView;
