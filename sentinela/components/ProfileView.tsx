
import React, { useRef, useState } from 'react';
import { UserProfile, Gender, ActivityLevel, Goal } from '../types';
import { ArrowLeft, Camera, User, Upload, Edit2, Save } from 'lucide-react';

interface ProfileViewProps {
  user: UserProfile;
  onUpdate: (profile: UserProfile) => void;
  onBack: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdate, onBack }) => {
  const chefInputRef = useRef<HTMLInputElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile>(user);

  const handleChefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newData = { ...formData, chefAvatar: reader.result as string };
        setFormData(newData);
        onUpdate(newData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newData = { ...formData, avatar: reader.result as string };
        setFormData(newData);
        onUpdate(newData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
      onUpdate(formData);
      setIsEditing(false);
  };

  const handleChange = (field: keyof UserProfile, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const InfoItem = ({ label, field, type = 'text', options }: { label: string, field: keyof UserProfile, type?: string, options?: string[] }) => (
    <div className="bg-white p-4 rounded-2xl border border-[#1A4D2E]/5">
      <div className="text-xs font-bold text-[#4F6F52] uppercase mb-1">{label}</div>
      {isEditing ? (
          options ? (
             <select 
                value={formData[field] as string} 
                onChange={e => handleChange(field, e.target.value)}
                className="w-full bg-[#F5F1E8] p-2 rounded-lg text-[#1A4D2E] outline-none font-serif border border-[#1A4D2E]/10"
             >
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
             </select>
          ) : (
            <input 
                type={type} 
                value={formData[field] as string | number}
                onChange={e => handleChange(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                className="w-full bg-[#F5F1E8] p-2 rounded-lg text-[#1A4D2E] outline-none font-serif border border-[#1A4D2E]/10"
            />
          )
      ) : (
        <div className="text-lg font-serif text-[#1A4D2E]">{formData[field]} {field === 'height' ? 'cm' : field === 'weight' ? 'kg' : ''}</div>
      )}
    </div>
  );

  return (
    <div className="p-6 pb-28 min-h-screen bg-[#F5F1E8] animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 bg-white rounded-full shadow-sm text-[#1A4D2E]">
            <ArrowLeft size={20} />
            </button>
            <h2 className="text-3xl font-serif font-bold text-[#1A4D2E]">Meu Perfil</h2>
        </div>
        <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all ${isEditing ? 'bg-[#1A4D2E] text-white' : 'bg-white text-[#1A4D2E] border border-[#1A4D2E]/10'}`}
        >
            {isEditing ? <><Save size={16}/> Salvar</> : <><Edit2 size={16}/> Editar</>}
        </button>
      </div>

      <div className="space-y-6">
        
        {/* User Avatar Section */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-md border border-[#1A4D2E]/5 relative overflow-hidden">
            <h3 className="font-serif text-xl mb-4 relative z-10 text-[#1A4D2E]">Sua Foto de Perfil</h3>
            <div className="flex items-center gap-6 relative z-10">
                <div className="w-20 h-20 rounded-full border-4 border-[#F5F1E8] overflow-hidden bg-gray-100 relative group cursor-pointer shadow-lg" onClick={() => userInputRef.current?.click()}>
                    <img 
                        src={formData.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"} 
                        alt="User Avatar" 
                        className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={20} />
                    </div>
                </div>
                <div className="flex-1">
                    <p className="text-sm text-[#4F6F52] mb-2">Esta foto aparecerá no dashboard.</p>
                    <button 
                        onClick={() => userInputRef.current?.click()} 
                        className="px-4 py-2 bg-[#1A4D2E] text-white rounded-full text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        <Upload size={14} /> Alterar Foto
                    </button>
                    <input 
                        ref={userInputRef} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleUserImageUpload} 
                    />
                </div>
            </div>
        </div>

        {/* Chef Avatar Section */}
        <div className="bg-[#1A4D2E] text-[#F5F1E8] p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <h3 className="font-serif text-xl mb-4 relative z-10">Avatar do Chef IA</h3>
            <div className="flex items-center gap-6 relative z-10">
                <div className="w-24 h-24 rounded-full border-4 border-[#F5F1E8]/20 overflow-hidden bg-white relative group cursor-pointer" onClick={() => chefInputRef.current?.click()}>
                    <img 
                        src={formData.chefAvatar || "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=200&q=80"} 
                        alt="Chef Avatar" 
                        className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" />
                    </div>
                </div>
                <div className="flex-1">
                    <p className="text-sm opacity-80 mb-3">Personalize a imagem do seu assistente para as chamadas.</p>
                    <button 
                        onClick={() => chefInputRef.current?.click()} 
                        className="px-4 py-2 bg-[#F5F1E8] text-[#1A4D2E] rounded-full text-xs font-bold flex items-center gap-2 hover:bg-white transition-colors"
                    >
                        <Upload size={14} /> Carregar Foto
                    </button>
                    <input 
                        ref={chefInputRef} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleChefImageUpload} 
                    />
                </div>
            </div>
            {/* Decoration */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#4F6F52] rounded-full blur-3xl opacity-50"></div>
        </div>

        {/* User Info */}
        <div className="space-y-4">
            <h3 className="font-serif text-xl text-[#1A4D2E] flex items-center gap-2"><User size={20}/> Dados Pessoais</h3>
            <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Nome" field="name" />
                <InfoItem label="Idade" field="age" type="number" />
                <InfoItem label="Altura" field="height" type="number" />
                <InfoItem label="Peso" field="weight" type="number" />
                <div className="col-span-2">
                    <InfoItem label="Objetivo" field="goal" options={Object.values(Goal)} />
                </div>
                 <div className="col-span-2">
                    <InfoItem label="Nível de Atividade" field="activityLevel" options={Object.values(ActivityLevel)} />
                </div>
            </div>
        </div>

        {/* Preferences */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#1A4D2E]/5">
            <h3 className="font-serif text-xl text-[#1A4D2E] mb-4">Preferências & Restrições</h3>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-[#4F6F52] uppercase mb-1 block">Restrições</label>
                    {isEditing ? (
                        <textarea 
                            value={formData.restrictions} 
                            onChange={e => handleChange('restrictions', e.target.value)}
                            className="w-full bg-[#F5F1E8] p-3 rounded-xl text-[#1A4D2E] outline-none border border-[#1A4D2E]/10"
                            rows={2}
                        />
                     ) : <p className="text-[#1A4D2E]">{formData.restrictions || "Nenhuma"}</p>}
                </div>
                <div>
                    <label className="text-xs font-bold text-[#4F6F52] uppercase mb-1 block">Preferências</label>
                    {isEditing ? (
                        <textarea 
                            value={formData.foodPreferences} 
                            onChange={e => handleChange('foodPreferences', e.target.value)}
                            className="w-full bg-[#F5F1E8] p-3 rounded-xl text-[#1A4D2E] outline-none border border-[#1A4D2E]/10"
                            rows={2}
                        />
                     ) : <p className="text-[#1A4D2E]">{formData.foodPreferences || "Não informado"}</p>}
                </div>
                <div>
                    <label className="text-xs font-bold text-[#4F6F52] uppercase mb-1 block">Histórico Médico</label>
                    {isEditing ? (
                        <textarea 
                            value={formData.medicalHistory} 
                            onChange={e => handleChange('medicalHistory', e.target.value)}
                            className="w-full bg-[#F5F1E8] p-3 rounded-xl text-[#1A4D2E] outline-none border border-[#1A4D2E]/10"
                            rows={2}
                        />
                     ) : <p className="text-[#1A4D2E]">{formData.medicalHistory || "Não informado"}</p>}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
