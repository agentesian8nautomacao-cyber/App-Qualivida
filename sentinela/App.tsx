
import React, { useState } from 'react';
import { UserProfile, UserRole, OccurrenceItem } from './types';
import LandingPage from './components/LandingPage';
import ChatAssistant from './components/ChatAssistant';
import LiveConversation from './components/LiveConversation';
import SettingsView from './components/SettingsView';

// Default "Concierge" Profile
const INITIAL_PROFILE: UserProfile = {
    name: "Carlos (Portaria)",
    role: UserRole.Doorman,
    condoName: "Residencial QualiVida",
    aiVoice: 'Puck', // Male voice default for authority/calm
    
    // Configuração Distinta para o PORTEIRO
    doormanConfig: {
        assistantName: "Sentinela",
        instructions: "Foco total em segurança e controle de acesso.\n- Entregas: Apenas na portaria.\n- Visitantes: Exigir RG.\n- Tom de voz: Formal, breve e militar.",
        assistantAvatar: undefined // Uses default icon
    },

    // Configuração Distinta para o SÍNDICO
    managerConfig: {
        assistantName: "Conselheiro",
        instructions: "Atue como um gestor administrativo e jurídico.\n- Redija comunicados cultos.\n- Cite leis fictícias do condomínio.\n- Tom de voz: Diplomático e executivo.",
        assistantAvatar: undefined // Uses default icon
    }
};

interface SentinelaAppProps {
  /** 
   * Quando false (porteiro logado no app principal),
   * o fluxo de "Gestão Administrativa" (Síndico) fica bloqueado.
   */
  allowManager?: boolean;
  /** Chamado para fechar o módulo Sentinela e voltar ao dashboard principal. */
  onExit?: () => void;
}

const App: React.FC<SentinelaAppProps> = ({ allowManager = true, onExit }) => {
  const [view, setView] = useState<'landing' | 'chat' | 'live' | 'settings'>('landing');
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [occurrences, setOccurrences] = useState<OccurrenceItem[]>([]);

  const handleEnterApp = (role: UserRole) => {
      // Update profile with the selected role for this session
      const effectiveRole = !allowManager && role === UserRole.Manager ? UserRole.Doorman : role;
      setUserProfile(prev => ({
          ...prev,
          role: effectiveRole,
          // Update name purely for display purposes in logs if needed
          name: effectiveRole === UserRole.Manager ? "Marcos (Síndico)" : "Carlos (Portaria)"
      }));
      setView('chat');
  };

  const handleAddOccurrence = (item: OccurrenceItem) => {
      setOccurrences(prev => [item, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
        {view === 'landing' && (
            <LandingPage 
              onGetStarted={handleEnterApp} 
              allowManager={allowManager}
            />
        )}
        
        {view === 'chat' && (
            <ChatAssistant 
                onClose={() => setView('landing')}
                onExitApp={onExit}
                onLiveCall={() => setView('live')}
                onSettings={() => setView('settings')}
                userProfile={userProfile}
                occurrences={occurrences}
                onAddOccurrence={handleAddOccurrence}
                isFullScreen={true}
            />
        )}

        {view === 'live' && (
            <LiveConversation 
                onClose={() => setView('chat')}
                userProfile={userProfile}
                onAddOccurrence={handleAddOccurrence}
            />
        )}

        {view === 'settings' && (
            <SettingsView 
                onBack={() => setView('chat')}
                userProfile={userProfile}
              onUpdateProfile={setUserProfile}
              canEditManager={allowManager}
            />
        )}
    </div>
  );
};

export default App;
