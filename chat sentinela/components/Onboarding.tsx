
import React, { useState } from 'react';
import { UserProfile, Gender, ActivityLevel, Goal } from '../types';
import { ChevronLeft, Check, ClipboardList } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1); 
  const totalSteps = 9; // Added step 9 for detailed anamnesis

  const [profile, setProfile] = useState<Partial<UserProfile>>({
    name: '',
    age: 30,
    gender: Gender.Female,
    height: 170,
    weight: 70,
    activityLevel: ActivityLevel.Moderate,
    goal: Goal.LoseWeight,
    restrictions: '',
    mealsPerDay: 3,
    medicalHistory: '',
    routineDescription: '',
    foodPreferences: '',
    streak: 1,
    lastActiveDate: new Date().toISOString()
  });

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
    else onComplete(profile as UserProfile);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleChange = (field: keyof UserProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Form Steps Styles
  const stepContent = () => {
    switch(step) {
      case 1: // Gender
        return (
          <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Sexo Biológico</h2>
            
            <div className="space-y-4">
               {[
                 { label: 'Masculino', value: Gender.Male },
                 { label: 'Feminino', value: Gender.Female },
                 { label: 'Outro', value: Gender.Other }
               ].map((opt) => (
                 <button 
                   key={opt.label}
                   onClick={() => handleChange('gender', opt.value)}
                   className={`w-full p-6 rounded-[2rem] flex items-center justify-between transition-all border-2 ${
                     profile.gender === opt.value 
                       ? 'bg-[#1A4D2E] border-[#1A4D2E] text-[#F5F1E8]' 
                       : 'bg-white border-transparent text-[#1A4D2E] hover:border-[#1A4D2E]/20'
                   }`}
                 >
                   <span className="font-serif text-2xl">{opt.label}</span>
                   {profile.gender === opt.value && <div className="bg-[#F5F1E8] text-[#1A4D2E] rounded-full p-1"><Check size={16}/></div>}
                 </button>
               ))}
            </div>
          </div>
        );
      case 2: // Name
        return (
           <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Qual seu nome?</h2>
            <input 
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Digite seu nome..."
              className="w-full bg-white border-2 border-transparent rounded-[2rem] p-6 text-[#1A4D2E] placeholder:text-[#1A4D2E]/40 focus:border-[#1A4D2E] focus:outline-none text-xl font-serif"
            />
          </div>
        );
      case 3: // Age
        return (
           <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Sua Idade</h2>
            <div className="flex items-center justify-center py-12">
               <div className="relative w-full max-w-[200px]">
                  <input 
                    type="number"
                    value={profile.age}
                    onChange={(e) => handleChange('age', parseInt(e.target.value))}
                    className="w-full bg-transparent border-b-2 border-[#1A4D2E] p-4 text-center text-7xl font-serif text-[#1A4D2E] focus:outline-none"
                  />
               </div>
            </div>
          </div>
        );
      case 4: // Height
        return (
           <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Altura</h2>
            <div className="px-4 py-8 bg-white rounded-[3rem]">
               <div className="text-center mb-12">
                 <span className="text-7xl font-serif text-[#1A4D2E]">{profile.height}</span>
                 <span className="text-[#4F6F52] text-xl ml-2 font-medium">cm</span>
               </div>
               <input 
                  type="range" 
                  min="120" max="220" 
                  value={profile.height}
                  onChange={(e) => handleChange('height', parseInt(e.target.value))}
                  className="w-full h-3 bg-[#F5F1E8] rounded-full appearance-none cursor-pointer accent-[#1A4D2E]"
                />
            </div>
          </div>
        );
      case 5: // Weight
        return (
           <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Peso</h2>
            <div className="px-4 py-8 bg-white rounded-[3rem]">
               <div className="text-center mb-12">
                 <span className="text-7xl font-serif text-[#1A4D2E]">{profile.weight}</span>
                 <span className="text-[#4F6F52] text-xl ml-2 font-medium">kg</span>
               </div>
               <input 
                  type="range" 
                  min="40" max="150" 
                  value={profile.weight}
                  onChange={(e) => handleChange('weight', parseInt(e.target.value))}
                  className="w-full h-3 bg-[#F5F1E8] rounded-full appearance-none cursor-pointer accent-[#1A4D2E]"
                />
            </div>
          </div>
        );
      case 6: // Activity
        return (
           <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Nível de Atividade</h2>
            <div className="space-y-3">
              {[
                  { val: ActivityLevel.Sedentary, label: 'Sedentário' },
                  { val: ActivityLevel.Light, label: 'Leve' },
                  { val: ActivityLevel.Moderate, label: 'Moderado' },
                  { val: ActivityLevel.Active, label: 'Ativo' },
                  { val: ActivityLevel.VeryActive, label: 'Muito Ativo' },
              ].map((level) => (
                <button 
                  key={level.val}
                  onClick={() => handleChange('activityLevel', level.val)}
                  className={`w-full p-5 rounded-[2rem] border-2 text-left transition-all ${
                    profile.activityLevel === level.val 
                      ? 'bg-[#1A4D2E] border-[#1A4D2E] text-[#F5F1E8]' 
                      : 'bg-white border-transparent text-[#1A4D2E] hover:border-[#1A4D2E]/20'
                  }`}
                >
                  <div className="font-serif text-lg">{level.label}</div>
                </button>
              ))}
            </div>
          </div>
        );
      case 7: // Goal
        return (
           <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Seu Objetivo</h2>
            <div className="space-y-3">
              {[
                  { val: Goal.LoseWeight, label: 'Perder Peso' },
                  { val: Goal.Maintain, label: 'Manter Peso' },
                  { val: Goal.GainMuscle, label: 'Ganhar Músculos' },
                  { val: Goal.ImproveHealth, label: 'Saúde Geral' },
              ].map((g) => (
                <button 
                  key={g.val}
                  onClick={() => handleChange('goal', g.val)}
                  className={`w-full p-5 rounded-[2rem] border-2 text-left flex items-center justify-between transition-all ${
                    profile.goal === g.val 
                      ? 'bg-[#1A4D2E] border-[#1A4D2E] text-[#F5F1E8]' 
                      : 'bg-white border-transparent text-[#1A4D2E] hover:border-[#1A4D2E]/20'
                  }`}
                >
                  <span className="font-serif text-lg">{g.label}</span>
                  {profile.goal === g.val && <Check size={20} />}
                </button>
              ))}
            </div>
          </div>
        );
      case 8: // Basic Details
        return (
           <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <h2 className="text-4xl font-serif text-[#1A4D2E]">Preferências</h2>
            <div className="mt-4">
               <label className="block text-sm font-medium text-[#4F6F52] mb-2 ml-2">Restrições Alimentares</label>
               <textarea 
                  value={profile.restrictions}
                  onChange={(e) => handleChange('restrictions', e.target.value)}
                  placeholder="ex: Sem glúten, Vegano..."
                  className="w-full bg-white border-2 border-transparent rounded-[2rem] p-6 text-[#1A4D2E] placeholder:text-[#1A4D2E]/40 focus:border-[#1A4D2E] focus:outline-none h-24 resize-none text-lg"
               />
            </div>
            <div className="mt-6">
               <label className="block text-sm font-medium text-[#4F6F52] mb-3 ml-2">Refeições por dia</label>
                <div className="flex gap-3">
                  {[3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      onClick={() => handleChange('mealsPerDay', n)}
                      className={`flex-1 py-4 rounded-2xl font-serif text-xl border-2 ${
                        profile.mealsPerDay === n 
                        ? 'bg-[#1A4D2E] border-[#1A4D2E] text-[#F5F1E8]' 
                        : 'bg-white border-transparent text-[#1A4D2E]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
            </div>
          </div>
        );
      case 9: // Detailed Anamnesis (New Step)
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-10">
              <h2 className="text-3xl font-serif text-[#1A4D2E]">Análise Completa</h2>
              <p className="text-[#4F6F52] text-sm">Para um plano de classe mundial, preciso de detalhes.</p>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-[#1A4D2E] mb-2 ml-2 uppercase tracking-wider">
                    <ClipboardList size={16} /> Histórico de Saúde
                </label>
                <textarea 
                    value={profile.medicalHistory}
                    onChange={(e) => handleChange('medicalHistory', e.target.value)}
                    placeholder="Doenças, alergias, medicamentos, cirurgias recentes..."
                    className="w-full bg-white border border-[#1A4D2E]/10 rounded-[1.5rem] p-4 text-[#1A4D2E] h-24 focus:border-[#1A4D2E] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-[#1A4D2E] mb-2 ml-2 uppercase tracking-wider">Rotina & Estilo de Vida</label>
                <textarea 
                    value={profile.routineDescription}
                    onChange={(e) => handleChange('routineDescription', e.target.value)}
                    placeholder="Horários de trabalho, sono, treino, habilidades na cozinha..."
                    className="w-full bg-white border border-[#1A4D2E]/10 rounded-[1.5rem] p-4 text-[#1A4D2E] h-24 focus:border-[#1A4D2E] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-[#1A4D2E] mb-2 ml-2 uppercase tracking-wider">Gostos & Preferências</label>
                <textarea 
                    value={profile.foodPreferences}
                    onChange={(e) => handleChange('foodPreferences', e.target.value)}
                    placeholder="O que você ama comer? O que detesta?"
                    className="w-full bg-white border border-[#1A4D2E]/10 rounded-[1.5rem] p-4 text-[#1A4D2E] h-24 focus:border-[#1A4D2E] focus:outline-none"
                />
              </div>
            </div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F1E8] text-[#1A4D2E] px-6 py-6">
      {/* Header */}
      <div className="flex items-center mb-6 pt-4 justify-between">
        {step > 1 ? (
            <button 
            onClick={handleBack} 
            className="p-3 rounded-full bg-white text-[#1A4D2E] shadow-sm hover:bg-[#1A4D2E] hover:text-white transition-colors"
            >
            <ChevronLeft size={24} />
            </button>
        ) : <div className="w-12" />}
        
        <div className="font-serif text-xl">Passo {step} de {totalSteps}</div>
        <div className="w-12" />
      </div>

      {/* Progress Bar */}
      <div className="mb-8 px-2">
        <div className="h-1.5 bg-[#1A4D2E]/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#1A4D2E] transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          {stepContent()}
        </div>

        {/* Footer Actions */}
        <div className="pt-6 pb-8 mt-auto z-10 bg-[#F5F1E8]">
          <button 
            onClick={handleNext}
            className="w-full py-5 bg-[#1A4D2E] text-[#F5F1E8] font-serif text-xl rounded-[2rem] hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            {step === totalSteps ? 'Gerar Plano Completo' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
