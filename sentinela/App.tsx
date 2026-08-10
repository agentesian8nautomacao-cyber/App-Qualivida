
import React, { useState } from 'react';
import { UserProfile, UserRole, OccurrenceItem } from './types';
import ChatAssistant from './components/ChatAssistant';
import LiveConversation from './components/LiveConversation';
import SettingsView from './components/SettingsView';

const createInitialProfile = (allowManager: boolean): UserProfile => ({
    name: allowManager ? "Marcos (Síndico)" : "Carlos (Portaria)",
    role: allowManager ? UserRole.Manager : UserRole.Doorman,
    condoName: "Residencial QualiVida",
    aiVoice: 'Puck',

    doormanConfig: {
        assistantName: "Sentinela",
        instructions: "Foco total em segurança e controle de acesso.\n- Entregas: Apenas na portaria.\n- Visitantes: Exigir RG.\n- Tom de voz: Formal, breve e militar.",
        assistantAvatar: undefined
    },

    managerConfig: {
        assistantName: "Conselheiro",
        instructions: "Atue como um gestor administrativo e jurídico.\n- Redija comunicados cultos.\n- Cite leis fictícias do condomínio.\n- Tom de voz: Diplomático e executivo.",
        assistantAvatar: undefined
    }
});

interface SentinelaAppProps {
  /**
   * Quando false (porteiro logado no app principal),
   * o fluxo de "Gestão Administrativa" (Síndico) fica bloqueado.
   */
  allowManager?: boolean;
  /** Chamado para fechar o módulo Sentinela e voltar ao dashboard principal. */
  onExit?: () => void;
  /** Chamado quando o assistente (voz ou chat) regista encomenda, ocorrência ou aviso — persiste no backend e notifica o morador. */
  onPersistVoiceEvent?: (item: OccurrenceItem) => void | Promise<void>;
}

const App: React.FC<SentinelaAppProps> = ({ allowManager = true, onExit, onPersistVoiceEvent }) => {
  const [view, setView] = useState<'chat' | 'live' | 'settings'>('chat');
  const [userProfile, setUserProfile] = useState<UserProfile>(() => createInitialProfile(allowManager));
  const [occurrences, setOccurrences] = useState<OccurrenceItem[]>([]);

  const handleAddOccurrence = (item: OccurrenceItem) => {
      setOccurrences(prev => [item, ...prev]);
      onPersistVoiceEvent?.(item);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
        {view === 'chat' && (
            <ChatAssistant 
                onClose={onExit}
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
