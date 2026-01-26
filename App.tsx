
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import Layout from './components/Layout';
import Login from './components/Login';
import LogoSplash from './components/LogoSplash';
import ResidentRegister from './components/ResidentRegister';
import ScreenSaver from './components/ScreenSaver';
import VideoIntro from './components/VideoIntro';
import { UserRole, Package, Resident, Note, VisitorLog, PackageItem, Occurrence, Notice, ChatMessage, QuickViewCategory, Staff, Boleto } from './types';

// Components
import RecentEventsBar from './components/RecentEventsBar';
import QuickViewModal from './components/QuickViewModal';
import DraggableFab from './components/DraggableFab';

// Views
import DashboardView from './components/views/DashboardView';
import SindicoDashboardView from './components/views/SindicoDashboardView'; // Nova Importação
import NoticesView from './components/views/NoticesView';
import ReservationsView from './components/views/ReservationsView';
import VisitorsView from './components/views/VisitorsView';
import PackagesView from './components/views/PackagesView';
import ResidentsView from './components/views/ResidentsView';
import OccurrencesView from './components/views/OccurrencesView';
import NotesView from './components/views/NotesView';
import AiView from './components/views/AiView';
import StaffView from './components/views/StaffView';
import AiReportsView from './components/views/AiReportsView';
import SettingsView from './components/views/SettingsView';
import BoletosView from './components/views/BoletosView';
import MoradorDashboardView from './components/views/MoradorDashboardView';

// Contexts
import { useAppConfig } from './contexts/AppConfigContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Utils
import { normalizeUnit, compareUnits } from './utils/unitFormatter';

// Services
import { getResidents, savePackage, updatePackage, saveResident, deleteResident, saveVisitor, updateVisitor, saveOccurrence, updateOccurrence, saveBoleto, updateBoleto, deleteBoleto } from './services/dataService';

// Modals
import { NewReservationModal, NewVisitorModal, NewPackageModal, NewNoteModal, StaffFormModal } from './components/modals/ActionModals';
import { ResidentProfileModal, PackageDetailModal, VisitorDetailModal, OccurrenceDetailModal, ResidentFormModal, NewOccurrenceModal, NoticeEditModal } from './components/modals/DetailModals';
import ImportResidentsModal from './components/modals/ImportResidentsModal';
import ImportBoletosModal from './components/modals/ImportBoletosModal';
import CameraScanModal from './components/modals/CameraScanModal';

// Services
import { registerResident, loginResident } from './services/residentAuth';

// Helper para calcular permanência
const calculatePermanence = (receivedAt: string) => {
  const start = new Date(receivedAt).getTime();
  const now = new Date().getTime();
  const diff = now - start;
  
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  
  if (hours < 24) return `${hours}h ${remainingMins}min`;
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

const App: React.FC = () => {
  const { config } = useAppConfig();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole>('PORTEIRO');
  const [currentResident, setCurrentResident] = useState<Resident | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isScreenSaverActive, setIsScreenSaverActive] = useState(false);
  const [showResidentRegister, setShowResidentRegister] = useState(false);
  const [showLogoSplash, setShowLogoSplash] = useState(true);
  const [showVideoIntro, setShowVideoIntro] = useState(() => {
    const hasSeenIntro = sessionStorage.getItem('hasSeenVideoIntro');
    return hasSeenIntro !== 'true';
  });
  
  // Verificar se deve mostrar cadastro de morador baseado na URL ou query param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isResidentLink = urlParams.get('resident') === 'true' || urlParams.get('morador') === 'true';
    if (isResidentLink) {
      setShowResidentRegister(true);
    }
  }, []);

  // Carregar moradores do Supabase quando staff estiver autenticado
  useEffect(() => {
    if (!isAuthenticated) return;
    getResidents().then((list) => setAllResidents(list));
  }, [isAuthenticated]);

  // Atalhos de teclado
  useKeyboardShortcuts({ onNavigate: setActiveTab });
  
  const [quickViewCategory, setQuickViewCategory] = useState<QuickViewCategory>(null);

  // Visitors Specific State
  const [visitorTab, setVisitorTab] = useState<'active' | 'history' | 'service'>('active');
  const [visitorSearch, setVisitorSearch] = useState('');
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [newVisitorStep, setNewVisitorStep] = useState(1);
  const [visitorAccessTypes, setVisitorAccessTypes] = useState(['Visita', 'Prestador', 'Delivery']);
  const [isAddingAccessType, setIsAddingAccessType] = useState(false);
  const [newAccessTypeInput, setNewAccessTypeInput] = useState('');
  
  const [selectedVisitorForDetail, setSelectedVisitorForDetail] = useState<any | null>(null);
  
  const [newVisitorData, setNewVisitorData] = useState({
    unit: '',
    name: '',
    doc: '',
    type: 'Visita',
    vehicle: '',
    plate: '',
    residentName: ''
  });

  const [allResidents, setAllResidents] = useState<Resident[]>([]);

  const [allPackages, setAllPackages] = useState<Package[]>([
    { id: '1', recipient: 'João Silva', unit: '102A', type: 'Amazon', receivedAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(), displayTime: '08:30', status: 'Pendente', deadlineMinutes: 60, residentPhone: '5511999999999' },
    { id: '2', recipient: 'Maria Santos', unit: '405B', type: 'Mercado Livre', receivedAt: new Date().toISOString(), displayTime: '11:15', status: 'Entregue', deadlineMinutes: 120, residentPhone: '5511888888888' },
    { id: '3', recipient: 'João Silva', unit: '102A', type: 'Correios', receivedAt: new Date().toISOString(), displayTime: '14:20', status: 'Pendente', deadlineMinutes: 30, residentPhone: '5511999999999' },
  ]);

  const [allOccurrences, setAllOccurrences] = useState<Occurrence[]>([
    { id: '1', residentName: 'Ana Oliveira', unit: '201C', description: 'Reclamou de vazamento no corredor do 2º andar.', status: 'Resolvido', date: '25/05/2024 10:00', reportedBy: 'Portaria' },
    { id: '2', residentName: 'João Silva', unit: '102A', description: 'Morador informou que o portão da garagem está fazendo barulho excessivo.', status: 'Aberto', date: '26/05/2024 14:20', reportedBy: 'Portaria' },
  ]);

  const [visitorLogs, setVisitorLogs] = useState<any[]>([
    { id: '1', residentName: 'Ricardo Almeida', unit: '202', visitorCount: 1, visitorNames: 'Carlos (Técnico)', entryTime: new Date(Date.now() - 1000 * 60 * 135).toISOString(), status: 'active', type: 'Prestador' },
    { id: '2', residentName: 'Maria Fernanda', unit: '101', visitorCount: 2, visitorNames: 'Pais', entryTime: '2024-05-25T14:00:00', exitTime: '2024-05-25T16:30:00', status: 'completed', type: 'Visita' },
    { id: '3', residentName: 'João Silva', unit: '102A', visitorCount: 1, visitorNames: 'Pedro (Entregador)', entryTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(), status: 'active', type: 'Delivery' }
  ]);

  const [allNotes, setAllNotes] = useState<Note[]>([
    { id: '1', content: 'Verificar lâmpada do bloco B que está piscando.', date: new Date().toISOString(), completed: false, category: 'Manutenção' },
    { id: '2', content: 'Aviso de mudança agendada para unidade 303 no sábado.', date: '27/05/2024 09:30', completed: true, category: 'Agenda' }
  ]);

  const [allNotices, setAllNotices] = useState<Notice[]>([
    { id: '1', title: 'Manutenção Preventiva', content: 'Elevador Bloco A ficará parado amanhã das 08h às 12h para manutenção.', author: 'Síndico', authorRole: 'SINDICO', date: new Date().toISOString(), category: 'Manutenção', priority: 'high', pinned: true, read: false },
    { id: '2', title: 'Portão da Garagem', content: 'O motor do portão principal está fazendo ruído. Técnico acionado.', author: 'Zelador', authorRole: 'PORTEIRO', date: new Date(Date.now() - 86400000).toISOString(), category: 'Urgente', priority: 'high', pinned: false, read: false },
    { id: '3', title: 'Festa Julina', content: 'A festa do condomínio será dia 25/07. Avisar moradores sobre barulho.', author: 'Comissão', authorRole: 'SINDICO', date: new Date(Date.now() - 172800000).toISOString(), category: 'Social', priority: 'normal', pinned: false, read: true },
    { id: '4', title: 'Mudança Unidade 404', content: 'Agendada para hoje à tarde. Liberar entrada do caminhão.', author: 'Portaria 1', authorRole: 'PORTEIRO', date: new Date().toISOString(), category: 'Institucional', priority: 'normal', pinned: false, read: false },
  ]);

  const [allBoletos, setAllBoletos] = useState<Boleto[]>([
    { 
      id: '1', 
      residentName: 'João Silva', 
      unit: '102A', 
      referenceMonth: '01/2025', 
      dueDate: '2025-01-10', 
      amount: 450.00, 
      status: 'Pendente',
      barcode: '34191090000012345678901234567890123456789012',
      description: 'Taxa de condomínio - Janeiro/2025'
    },
    { 
      id: '2', 
      residentName: 'Maria Santos', 
      unit: '405B', 
      referenceMonth: '01/2025', 
      dueDate: '2025-01-10', 
      amount: 450.00, 
      status: 'Pago',
      paidDate: '2025-01-05',
      description: 'Taxa de condomínio - Janeiro/2025'
    },
    { 
      id: '3', 
      residentName: 'Ana Oliveira', 
      unit: '201C', 
      referenceMonth: '12/2024', 
      dueDate: '2024-12-10', 
      amount: 450.00, 
      status: 'Vencido',
      barcode: '34191090000012345678901234567890123456789013',
      description: 'Taxa de condomínio - Dezembro/2024'
    },
    { 
      id: '4', 
      residentName: 'Ricardo Almeida', 
      unit: '202', 
      referenceMonth: '01/2025', 
      dueDate: '2025-01-10', 
      amount: 450.00, 
      status: 'Pendente',
      barcode: '34191090000012345678901234567890123456789014',
      description: 'Taxa de condomínio - Janeiro/2025'
    },
  ]);
  const [boletoSearch, setBoletoSearch] = useState('');

  const [allStaff, setAllStaff] = useState<Staff[]>([
    { id: '1', name: 'José Carlos', role: 'Zelador', status: 'Ativo', shift: 'Comercial', phone: '11999991234', email: 'zelador@qualivida.com' },
    { id: '2', name: 'Marcos Souza', role: 'Porteiro', status: 'Ativo', shift: 'Noite', phone: '11999995678' },
    { id: '3', name: 'Ana Pereira', role: 'Faxineira', status: 'Férias', shift: 'Manhã', phone: '11999994321' },
    { id: '4', name: 'Pedro Lima', role: 'Segurança', status: 'Ativo', shift: 'Madrugada', phone: '11999998765' }
  ]);
  const [staffSearch, setStaffSearch] = useState('');
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffFormData, setStaffFormData] = useState<Partial<Staff>>({});

  const [noticeFilter, setNoticeFilter] = useState<'all' | 'urgent' | 'unread'>('all');
  const [activeNoticeTab, setActiveNoticeTab] = useState<'wall' | 'chat'>('wall'); // Para Mobile
  const [isChatOpen, setIsChatOpen] = useState(false); // Mobile Bottom Sheet State

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', text: 'Boa tarde, alguma novidade na portaria?', senderRole: 'SINDICO', timestamp: new Date(Date.now() - 3600000).toISOString(), read: true },
    { id: '2', text: 'Tudo tranquilo por aqui, Sr. Síndico. Apenas uma entrega grande para o 402.', senderRole: 'PORTEIRO', timestamp: new Date(Date.now() - 3500000).toISOString(), read: true },
    { id: '3', text: 'Perfeito. Avise-me se chegar correspondência da Receita.', senderRole: 'SINDICO', timestamp: new Date(Date.now() - 3400000).toISOString(), read: true },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'notices' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isChatOpen]);

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg: ChatMessage = { id: Date.now().toString(), text: chatInput, senderRole: role, timestamp: new Date().toISOString(), read: false };
    setChatMessages([...chatMessages, newMsg]);
    setChatInput('');
  };

  const [areasStatus, setAreasStatus] = useState([
    { id: '1', name: 'SALÃO DE FESTAS CRYSTAL', capacity: 80, today: '1 HOJE', rules: 'Fechar às 23h • Proibido som externo' },
    { id: '2', name: 'ESPAÇO GOURMET', capacity: 30, today: '0 HOJE', rules: 'Limpeza inclusa na taxa' },
  ]);

  const [dayReservations, setDayReservations] = useState([
    { id: 'r1', resident: 'RICARDO ALMEIDA', unit: '202', area: 'SALÃO DE FESTAS CRYSTAL', time: '18:00 - 22:00', status: 'scheduled', date: 'JAN 9' }
  ]);

  const [reservationFilter, setReservationFilter] = useState<'all' | 'today' | 'pending'>('today');
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [reservationSearchQuery, setReservationSearchQuery] = useState('');
  const [showResSuggestions, setShowResSuggestions] = useState(false);
  const [newReservationData, setNewReservationData] = useState({ area: 'SALÃO DE FESTAS CRYSTAL', resident: '', unit: '', date: '', startTime: '', endTime: '' });

  const hasTimeConflict = useMemo(() => {
    if (!newReservationData.date || !newReservationData.startTime || !newReservationData.endTime || !newReservationData.area) return false;
    const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = toMins(newReservationData.startTime);
    const newEnd = toMins(newReservationData.endTime);
    const dateObj = new Date(newReservationData.date);
    const month = dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const day = dateObj.getDate();
    const formattedDate = `${month} ${day}`;
    return dayReservations.some(r => {
        if (r.area !== newReservationData.area || r.date !== formattedDate) return false;
        const [startStr, endStr] = r.time.split(' - ');
        const rStart = toMins(startStr);
        const rEnd = toMins(endStr);
        return (newStart < rEnd && newEnd > rStart);
    });
  }, [newReservationData, dayReservations]);

  const handleReservationAction = (id: string) => {
    setDayReservations(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (r.status === 'scheduled') return { ...r, status: 'active' };
      if (r.status === 'active') return { ...r, status: 'completed' };
      return r;
    }));
  };

  const handleCreateReservation = () => {
    if(!newReservationData.resident || !newReservationData.date || hasTimeConflict) return;
    const dateObj = new Date(newReservationData.date);
    const month = dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const day = dateObj.getDate();
    const formattedDate = `${month} ${day}`;
    const newRes = { id: Date.now().toString(), resident: newReservationData.resident, unit: newReservationData.unit, area: newReservationData.area, time: `${newReservationData.startTime} - ${newReservationData.endTime}`, status: 'scheduled', date: formattedDate };
    setDayReservations([newRes, ...dayReservations]);
    setIsReservationModalOpen(false);
    setNewReservationData({ area: 'SALÃO DE FESTAS CRYSTAL', resident: '', unit: '', date: '', startTime: '', endTime: '' });
    setReservationSearchQuery('');
    setShowResSuggestions(false);
  };

  const filteredResForReservation = useMemo(() => {
    if (!reservationSearchQuery) return [];
    return allResidents.filter(r => r.name.toLowerCase().includes(reservationSearchQuery.toLowerCase()) || r.unit.includes(reservationSearchQuery)).slice(0, 3);
  }, [reservationSearchQuery, allResidents]);

  const [selectedNoticeForEdit, setSelectedNoticeForEdit] = useState<Notice | null>(null);

  const eventStates = useMemo(() => {
    const now = new Date();
    const isWithin = (iso: string, mins: number) => { if (!iso) return false; const d = new Date(iso); return (now.getTime() - d.getTime()) < mins * 60 * 1000; };
    const today = new Date().toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }).toUpperCase().replace('.', '');
    return {
      hasNewPackage: allPackages.some(p => p.status === 'Pendente'),
      hasActiveVisitor: visitorLogs.some(v => v.status === 'active'),
      hasOpenOccurrences: allOccurrences.some(o => o.status === 'Aberto'),
      hasUpcomingReservation: dayReservations.some(r => r.date === today && (r.status === 'scheduled' || r.status === 'active')),
      hasActiveNote: allNotes.some(n => !n.completed),
      hasNewNotice: allNotices.some(n => isWithin(n.date, 1440))
    };
  }, [allPackages, visitorLogs, allOccurrences, allNotes, allNotices, dayReservations]);

  const quickViewData = useMemo(() => {
    if (!quickViewCategory) return [];
    switch (quickViewCategory) {
      case 'packages': return allPackages.filter(p => p.status === 'Pendente');
      case 'visitors': return visitorLogs.filter(v => v.status === 'active');
      case 'occurrences': return allOccurrences.filter(o => o.status === 'Aberto');
      case 'reservations': return [{ area: 'Salão de Festas', unit: '102A', time: '18:00' }];
      case 'notes': return allNotes.filter(n => !n.completed);
      case 'notices': return allNotices.slice(0, 3);
      default: return [];
    }
  }, [quickViewCategory, allPackages, visitorLogs, allOccurrences, allNotes, allNotices]);

  const [isNewPackageModalOpen, setIsNewPackageModalOpen] = useState(false);
  const [packageStep, setPackageStep] = useState(1);
  const [searchResident, setSearchResident] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [packageType, setPackageType] = useState('Amazon');
  const [packageCategories, setPackageCategories] = useState(['Amazon', 'Mercado Livre', 'iFood', 'Farmácia', 'Documentos', 'Correios', 'Outros']);
  const [isAddingPkgCategory, setIsAddingPkgCategory] = useState(false);
  const [newPkgCatName, setNewPkgCatName] = useState('');
  const [numItems, setNumItems] = useState(1);
  const [packageItems, setPackageItems] = useState<PackageItem[]>([{ id: '1', name: '', description: '' }]);
  const [packageMessage, setPackageMessage] = useState('');
  
  const [packageSearch, setPackageSearch] = useState('');
  const [occurrenceSearch, setOccurrenceSearch] = useState('');
  const [residentSearch, setResidentSearch] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const [selectedPackageForDetail, setSelectedPackageForDetail] = useState<Package | null>(null);
  const [selectedOccurrenceForDetail, setSelectedOccurrenceForDetail] = useState<Occurrence | null>(null);
  const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
  const [isImportResidentsModalOpen, setIsImportResidentsModalOpen] = useState(false);
  const [isImportBoletosModalOpen, setIsImportBoletosModalOpen] = useState(false);
  const [isCameraScanModalOpen, setIsCameraScanModalOpen] = useState(false);
  const [pendingPackageImage, setPendingPackageImage] = useState<string | null>(null);
  const [pendingPackageQrData, setPendingPackageQrData] = useState<string | null>(null);
  const [residentFormData, setResidentFormData] = useState({ id: '', name: '', unit: '', email: '', phone: '', whatsapp: '' });
  const [selectedResidentProfile, setSelectedResidentProfile] = useState<Resident | null>(null);

  const filteredResidents = useMemo(() => {
    if (!searchResident) return [];
    return allResidents.filter(r => r.name.toLowerCase().includes(searchResident.toLowerCase()) || r.unit.toLowerCase().includes(searchResident.toLowerCase())).slice(0, 4);
  }, [searchResident, allResidents]);

  const globalResults = useMemo(() => {
    if (!globalSearchQuery || globalSearchQuery.length < 2) return null;
    const q = globalSearchQuery.toLowerCase();
    return {
      residents: allResidents.filter(r => r.name.toLowerCase().includes(q) || r.unit.toLowerCase().includes(q)).slice(0, 4),
      packages: allPackages.filter(p => p.recipient.toLowerCase().includes(q) || p.unit.toLowerCase().includes(q) || p.type.toLowerCase().includes(q) || p.status.toLowerCase().includes(q) || p.displayTime.toLowerCase().includes(q)).slice(0, 4),
      visitors: visitorLogs.filter(v => (v.visitorNames?.toLowerCase().includes(q) || v.unit.toLowerCase().includes(q) || v.residentName.toLowerCase().includes(q) || v.status.toLowerCase().includes(q)) && v.status === 'active').slice(0, 4),
      occurrences: allOccurrences.filter(o => o.description.toLowerCase().includes(q) || o.unit.toLowerCase().includes(q) || o.residentName.toLowerCase().includes(q) || o.status.toLowerCase().includes(q)).slice(0, 4),
      notes: allNotes.filter(n => n.content.toLowerCase().includes(q) || (n.category && n.category.toLowerCase().includes(q))).slice(0, 4)
    };
  }, [globalSearchQuery, allResidents, allPackages, visitorLogs, allOccurrences, allNotes]);

  const hasAnyGlobalResult = useMemo(() => {
    if (!globalResults) return false;
    return (globalResults.residents.length > 0 || globalResults.packages.length > 0 || globalResults.visitors.length > 0 || globalResults.occurrences.length > 0 || globalResults.notes.length > 0);
  }, [globalResults]);

  useEffect(() => {
    if (packageStep === 3 && selectedResident) {
      const itemList = packageItems.map(it => it.name).filter(Boolean).join(', ');
      const template = config.whatsappTemplates.packageReceived
        .replace('{residentName}', selectedResident.name)
        .replace('{packageType}', packageType)
        .replace('{condominiumName}', config.condominiumName);
      setPackageMessage(itemList ? `${template} ${itemList ? `Itens inclusos: ${itemList}.` : ''}` : template);
    }
  }, [packageStep, selectedResident, packageType, packageItems]);

  const handleVisitorCheckOut = async (id: string) => {
    const visitor = visitorLogs.find(v => v.id === id);
    if (!visitor) return;
    
    const updatedVisitor = { ...visitor, status: 'completed' as const, exitTime: new Date().toISOString() };
    const result = await updateVisitor(updatedVisitor);
    
    if (result.success) {
      setVisitorLogs(prev => prev.map(v => v.id === id ? updatedVisitor : v));
    } else {
      console.error('Erro ao atualizar visitante:', result.error);
      alert('Erro ao fazer checkout: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const resetVisitorModal = () => { setIsVisitorModalOpen(false); setNewVisitorStep(1); setNewVisitorData({ unit: '', name: '', doc: '', type: 'Visita', vehicle: '', plate: '', residentName: '' }); setSearchResident(''); };
  const handleRegisterVisitor = async () => {
    const newVisitor: VisitorLog = { id: `temp-${Date.now()}`, residentName: newVisitorData.residentName || 'Desconhecido', unit: newVisitorData.unit, visitorCount: 1, visitorNames: newVisitorData.name, entryTime: new Date().toISOString(), status: 'active' };
    
    // Salvar no Supabase
    const result = await saveVisitor(newVisitor);
    if (result.success && result.id) {
      newVisitor.id = result.id;
      setVisitorLogs([newVisitor, ...visitorLogs]);
      resetVisitorModal();
    } else {
      console.error('Erro ao salvar visitante:', result.error);
      alert('Erro ao registrar visitante: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleAddAccessType = () => { if (newAccessTypeInput.trim()) { setVisitorAccessTypes([...visitorAccessTypes, newAccessTypeInput.trim()]); setNewAccessTypeInput(''); setIsAddingAccessType(false); } };
  const handleRemoveAccessType = (typeToRemove: string) => { if (visitorAccessTypes.length > 1) { setVisitorAccessTypes(visitorAccessTypes.filter(t => t !== typeToRemove)); if (newVisitorData.type === typeToRemove) { setNewVisitorData({...newVisitorData, type: visitorAccessTypes[0]}); } } };
  const handleAddItemRow = () => { setPackageItems([...packageItems, { id: Date.now().toString(), name: '', description: '' }]); setNumItems(prev => prev + 1); };
  const handleRemoveItemRow = (id: string) => { if (packageItems.length <= 1) return; setPackageItems(packageItems.filter(it => it.id !== id)); setNumItems(prev => prev + 1); };
  const updateItem = (id: string, field: 'name' | 'description', value: string) => { setPackageItems(packageItems.map(it => it.id === id ? { ...it, [field]: value } : it)); };
  const resetPackageModal = () => {
    setIsNewPackageModalOpen(false);
    setPackageStep(1);
    setSelectedResident(null);
    setSearchResident('');
    setPackageType('Amazon');
    setNumItems(1);
    setPackageItems([{ id: '1', name: '', description: '' }]);
    setPendingPackageImage(null);
    setPendingPackageQrData(null);
  };
  const handleOpenNewPackageModal = () => {
    setPackageStep(1);
    setSelectedResident(null);
    setSearchResident('');
    setPackageType('Amazon');
    setNumItems(1);
    setPackageItems([{ id: '1', name: '', description: '' }]);
    setPendingPackageImage(null);
    setPendingPackageQrData(null);
    setIsNewPackageModalOpen(true);
  };
  const handleRegisterPackageFinal = async (sendNotify: boolean) => {
    if (!selectedResident) return;
    const newPkg: Package = { id: `temp-${Date.now()}`, recipient: selectedResident.name, unit: selectedResident.unit, type: packageType, receivedAt: new Date().toISOString(), displayTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), status: 'Pendente', deadlineMinutes: 45, residentPhone: selectedResident.phone, items: packageItems.filter(it => it.name.trim() !== '') };
    
    // Salvar no Supabase
    const result = await savePackage(newPkg);
    if (result.success && result.id) {
      // Atualizar com o ID real do Supabase
      newPkg.id = result.id;
      setAllPackages([newPkg, ...allPackages]);
    } else {
      console.error('Erro ao salvar pacote:', result.error);
      alert('Erro ao salvar encomenda: ' + (result.error || 'Erro desconhecido'));
      return;
    }
    
    if (sendNotify && selectedResident.whatsapp) { const url = `https://wa.me/${selectedResident.whatsapp}?text=${encodeURIComponent(packageMessage)}`; window.open(url, '_blank'); }
    resetPackageModal(); setActiveTab('dashboard');
  };
  const handleDeliverPackage = async (id: string) => {
    const pkg = allPackages.find(p => p.id === id);
    if (!pkg) return;
    
    const updatedPkg = { ...pkg, status: 'Entregue' as const };
    const result = await updatePackage(updatedPkg);
    
    if (result.success) {
      setAllPackages(prev => prev.map(p => p.id === id ? updatedPkg : p));
      setSelectedPackageForDetail(null);
    } else {
      console.error('Erro ao atualizar pacote:', result.error);
      alert('Erro ao marcar como entregue: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleResolveOccurrence = async (id: string) => {
    const occurrence = allOccurrences.find(occ => occ.id === id);
    if (!occurrence) return;
    
    const updatedOccurrence = { ...occurrence, status: 'Resolvido' as const };
    const result = await updateOccurrence(updatedOccurrence);
    
    if (result.success) {
      setAllOccurrences(prev => prev.map(occ => occ.id === id ? updatedOccurrence : occ));
    } else {
      console.error('Erro ao resolver ocorrência:', result.error);
      alert('Erro ao resolver ocorrência: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleSaveOccurrenceDetails = async () => {
    if (!selectedOccurrenceForDetail) return;
    
    const result = await updateOccurrence(selectedOccurrenceForDetail);
    if (result.success) {
      setAllOccurrences(prev => prev.map(o => o.id === selectedOccurrenceForDetail.id ? selectedOccurrenceForDetail : o));
      setSelectedOccurrenceForDetail(null);
    } else {
      console.error('Erro ao salvar ocorrência:', result.error);
      alert('Erro ao salvar ocorrência: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleSendReminder = (pkg: Package) => {
    const resident = allResidents.find(r => r.name === pkg.recipient);
    if (resident && resident.whatsapp) { 
      const permanence = calculatePermanence(pkg.receivedAt); 
      const message = config.whatsappTemplates.packageReminder
        .replace('{residentName}', resident.name)
        .replace('{packageType}', pkg.type)
        .replace('{condominiumName}', config.condominiumName)
        .replace('{permanence}', permanence);
      const url = `https://wa.me/${resident.whatsapp}?text=${encodeURIComponent(message)}`; 
      window.open(url, '_blank'); 
    }
  };
  const handleAddPkgCategory = () => { if (!newPkgCatName.trim()) return; setPackageCategories([...packageCategories, newPkgCatName.trim()]); setPackageType(newPkgCatName.trim()); setNewPkgCatName(''); setIsAddingPkgCategory(false); };
  const handleAcknowledgeNotice = (id: string) => { setAllNotices(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); };
  const handleOpenResidentModal = (resident?: Resident) => { if (resident) { setResidentFormData(resident); } else { setResidentFormData({ id: '', name: '', unit: '', email: '', phone: '', whatsapp: '' }); } setIsResidentModalOpen(true); };
  const handleSaveResident = async () => { 
    if (!residentFormData.name || !residentFormData.unit) return; 
    // Normalizar unidade antes de salvar
    const normalizedData = { ...residentFormData, unit: normalizeUnit(residentFormData.unit) };
    
    // Criar objeto Resident completo
    const resident: Resident = {
      id: normalizedData.id || `temp-${Date.now()}`,
      name: normalizedData.name,
      unit: normalizedData.unit,
      email: normalizedData.email || '',
      phone: normalizedData.phone || '',
      whatsapp: normalizedData.whatsapp || ''
    };
    
    const isNew = resident.id.startsWith('temp-');
    
    // Salvar no Supabase
    const result = await saveResident(resident);
    if (result.success) {
      if (result.id) {
        resident.id = result.id;
      }
      if (isNew) {
        // Novo morador: adicionar à lista
        setAllResidents(prev => [resident, ...prev]);
      } else {
        // Morador existente: atualizar na lista
        setAllResidents(prev => prev.map(r => r.id === resident.id ? resident : r));
      }
      setIsResidentModalOpen(false);
    } else {
      console.error('Erro ao salvar morador:', result.error);
      alert('Erro ao salvar morador: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleDeleteResident = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover este morador?")) return;
    
    const result = await deleteResident(id);
    if (result.success) {
      setAllResidents(prev => prev.filter(r => r.id !== id));
      if (selectedResidentProfile?.id === id) setSelectedResidentProfile(null);
    } else {
      console.error('Erro ao deletar morador:', result.error);
      alert('Erro ao remover morador: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleImportResidents = (residents: Resident[]) => { setAllResidents(prev => [...residents, ...prev]); };
  const handleImportBoletos = (boletos: Boleto[]) => { setAllBoletos(prev => [...boletos, ...prev]); };
  const handleDeleteBoleto = async (boleto: Boleto) => {
    const result = await deleteBoleto(boleto.id);
    if (result.success) {
      setAllBoletos(prev => prev.filter(b => b.id !== boleto.id));
    } else {
      console.error('Erro ao deletar boleto:', result.error);
      alert('Erro ao remover boleto: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const findResidentByQRData = (qrData: string): Resident | undefined => {
    const raw = (qrData || '').trim();
    if (!raw) return undefined;
    const qrNorm = normalizeUnit(raw);
    try {
      const parsed = JSON.parse(raw) as { unit?: string; id?: string };
      if (parsed.unit) {
        const u = normalizeUnit(parsed.unit);
        const byUnit = allResidents.find((r) => compareUnits(r.unit, u));
        if (byUnit) return byUnit;
        if (parsed.id) {
          const byId = allResidents.find((r) => r.id === parsed.id);
          if (byId) return byId;
        }
      }
    } catch {
      /* não é JSON */
    }
    return allResidents.find((r) => {
      if (compareUnits(r.unit, raw) || compareUnits(r.unit, qrNorm)) return true;
      if (r.unit === raw || r.unit === qrNorm) return true;
      if (raw.includes(r.unit) || qrNorm.includes(normalizeUnit(r.unit))) return true;
      if (r.name && raw.toLowerCase().includes(r.name.toLowerCase())) return true;
      return false;
    });
  };

  const handleCameraScanSuccess = async (data: { resident?: Resident; qrData?: string; image?: string; fromMode?: 'qr' | 'photo' }) => {
    const fromPhoto = data.fromMode === 'photo';
    const pkgType = fromPhoto ? 'Foto' : 'QR Code';
    const itemName = fromPhoto ? 'Encomenda via foto' : 'Encomenda via QR Code';

    let resident = data.resident;
    if (!resident && data.qrData) {
      resident = findResidentByQRData(data.qrData);
    }

    if (resident) {
      const newPkg: Package = {
        id: `temp-${Date.now()}`,
        recipient: resident.name,
        unit: resident.unit,
        type: pkgType,
        receivedAt: new Date().toISOString(),
        displayTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'Pendente',
        deadlineMinutes: 45,
        residentPhone: resident.phone,
        items: data.qrData
          ? [{ id: '1', name: itemName, description: data.qrData }]
          : [{ id: '1', name: itemName, description: fromPhoto ? 'Registro por foto' : 'Registro por QR' }]
      };

      const result = await savePackage(newPkg);
      if (result.success && result.id) {
        newPkg.id = result.id;
        setAllPackages([newPkg, ...allPackages]);
        setIsCameraScanModalOpen(false);
        setActiveTab('packages');
      } else {
        console.error('Erro ao salvar pacote:', result.error);
        alert('Erro ao salvar encomenda: ' + (result.error || 'Erro desconhecido'));
      }
      return;
    }

    if (data.qrData || data.image) {
      setIsCameraScanModalOpen(false);
      setPackageStep(1);
      setSelectedResident(null);
      setSearchResident('');
      setPackageType(pkgType);
      setNumItems(1);
      setPackageItems([{ id: '1', name: '', description: '' }]);
      setPendingPackageImage(data.image ?? null);
      setPendingPackageQrData(data.qrData ?? null);
      if (data.qrData) {
        const found = findResidentByQRData(data.qrData);
        if (found) {
          setSelectedResident(found);
          setSearchResident(found.name);
        }
      }
      setActiveTab('packages');
      setIsNewPackageModalOpen(true);
    }
  };
  const handleSaveNoticeChanges = () => { if (!selectedNoticeForEdit) return; setAllNotices(prev => prev.map(n => n.id === selectedNoticeForEdit.id ? selectedNoticeForEdit : n)); setSelectedNoticeForEdit(null); };
  const handleDeleteNotice = () => { if (!selectedNoticeForEdit) return; setAllNotices(prev => prev.filter(n => n.id !== selectedNoticeForEdit.id)); setSelectedNoticeForEdit(null); };

  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteCategories, setNoteCategories] = useState([ { name: 'Geral', color: 'bg-zinc-100' }, { name: 'Manutenção', color: 'bg-amber-100' }, { name: 'Segurança', color: 'bg-red-100' }, { name: 'Entrega', color: 'bg-blue-100' } ]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('Geral');
  const [newNoteScheduled, setNewNoteScheduled] = useState('');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);
  const [occurrenceDescription, setOccurrenceDescription] = useState('');

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  
  // Função para registrar morador (já cadastrado no Supabase pelo ResidentRegister)
  const handleResidentRegister = (resident: Resident, password: string) => {
    // Morador já foi cadastrado no Supabase pelo componente ResidentRegister
    // Apenas atualizar estado local e adicionar à lista se não existir
    if (!allResidents.find(r => r.id === resident.id || r.unit === resident.unit)) {
      setAllResidents(prev => [...prev, resident]);
    }
    
    // Salvar sessão
    sessionStorage.setItem('currentResident', JSON.stringify(resident));
    sessionStorage.setItem('residentRole', 'MORADOR');
    
    setCurrentResident(resident);
    setRole('MORADOR');
    setIsAuthenticated(true);
    setShowResidentRegister(false);
    setActiveTab('dashboard');
  };

  // Função para login de morador (autenticação via Supabase)
  const handleResidentLogin = async (unit: string, password: string) => {
    try {
      const result = await loginResident(unit, password);
      
      if (!result.success || !result.resident) {
        throw new Error(result.error || 'Unidade ou senha incorretos');
      }

      // Atualizar lista de moradores
      const existingIndex = allResidents.findIndex(r => r.id === result.resident!.id);
      if (existingIndex >= 0) {
        setAllResidents(prev => prev.map((r, idx) => idx === existingIndex ? result.resident! : r));
      } else {
        setAllResidents(prev => [...prev, result.resident!]);
      }

      // Salvar sessão
      sessionStorage.setItem('currentResident', JSON.stringify(result.resident));
      sessionStorage.setItem('residentRole', 'MORADOR');
      
      setCurrentResident(result.resident);
      setRole('MORADOR');
      setIsAuthenticated(true);
      setShowResidentRegister(false);
      setActiveTab('dashboard');
    } catch (error: any) {
      throw error;
    }
  };

  const handleLogin = (selectedRole: UserRole) => { 
    // Se for morador e está no modo registro, não fazer nada (o ResidentRegister cuida disso)
    if (selectedRole === 'MORADOR' && showResidentRegister) {
      return;
    }
    
    setRole(selectedRole);
    // Se for morador via login antigo (deprecated)
    if (selectedRole === 'MORADOR') {
      // Redirecionar para cadastro/registro
      setShowResidentRegister(true);
      return;
    } else {
      setCurrentResident(null);
    }
    setIsAuthenticated(true);
    setActiveTab('dashboard');
  };
  
  const handleLogout = () => { 
    setIsAuthenticated(false); 
    setCurrentResident(null);
    setShowResidentRegister(false);
    setShowLogoSplash(true);
    setActiveTab('dashboard');
    // Limpar dados do morador da sessão
    sessionStorage.removeItem('currentResident');
    sessionStorage.removeItem('residentRole');
    // Limpar dados do usuário da sessão
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('userRole');
  };

  const handleSaveNote = () => {
    if (!newNoteContent.trim()) return;
    if (editingNoteId) { setAllNotes(allNotes.map(n => n.id === editingNoteId ? { ...n, content: newNoteContent, category: newNoteCategory, scheduled: newNoteScheduled } : n)); } 
    else { const newNote: Note = { id: Date.now().toString(), content: newNoteContent, date: new Date().toISOString(), completed: false, category: newNoteCategory, scheduled: newNoteScheduled }; setAllNotes([newNote, ...allNotes]); }
    setNewNoteContent(''); setNewNoteCategory('Geral'); setNewNoteScheduled(''); setIsScheduleOpen(false); setEditingNoteId(null); setIsNewNoteModalOpen(false);
  };
  const handleAddCategory = () => { if (!newCatName.trim()) return; const colors = ['bg-zinc-100', 'bg-amber-100', 'bg-red-100', 'bg-blue-100', 'bg-purple-100', 'bg-green-100']; const randomColor = colors[Math.floor(Math.random() * colors.length)]; setNoteCategories([...noteCategories, { name: newCatName.trim(), color: randomColor }]); setNewCatName(''); setIsAddingCategory(false); };
  const handleRemoveCategory = (name: string) => { if (name === 'Geral') return; setNoteCategories(noteCategories.filter(cat => cat.name !== name)); if (newNoteCategory === name) setNewNoteCategory('Geral'); };

  // Handlers de Funcionários (Staff)
  const handleSaveStaff = () => {
    if (!staffFormData.name || !staffFormData.role) return;
    if (staffFormData.id) {
       setAllStaff(prev => prev.map(s => s.id === staffFormData.id ? { ...s, ...staffFormData } as Staff : s));
    } else {
       const newStaff: Staff = { 
          id: Date.now().toString(), 
          name: staffFormData.name!, 
          role: staffFormData.role!,
          status: staffFormData.status || 'Ativo',
          shift: staffFormData.shift || 'Comercial',
          phone: staffFormData.phone,
          email: staffFormData.email
       };
       setAllStaff(prev => [newStaff, ...prev]);
    }
    setIsStaffModalOpen(false);
    setStaffFormData({});
  };

  const handleDeleteStaff = (id: string) => {
     if(window.confirm("Deseja desligar este colaborador do sistema?")) {
        setAllStaff(prev => prev.filter(s => s.id !== id));
     }
  };

  const renderContent = () => {
    // RENDERIZAÇÃO DO DASHBOARD BASEADA NO CARGO
    if (activeTab === 'dashboard') {
      if (role === 'SINDICO') {
        return (
          <SindicoDashboardView 
            allPackages={allPackages}
            visitorLogs={visitorLogs}
            allOccurrences={allOccurrences}
            allResidents={allResidents}
            setActiveTab={setActiveTab}
            setActiveNoticeTab={setActiveNoticeTab}
          />
        );
      }
      // Dashboard do Porteiro (Original)
      return (
        <DashboardView 
          globalSearchQuery={globalSearchQuery} 
          setGlobalSearchQuery={setGlobalSearchQuery} 
          hasAnyGlobalResult={hasAnyGlobalResult} 
          globalResults={globalResults} 
          setActiveTab={setActiveTab} 
          setResidentSearch={setResidentSearch} 
          eventStates={eventStates} 
          setQuickViewCategory={setQuickViewCategory} 
          setIsNewPackageModalOpen={handleOpenNewPackageModal} 
        />
      );
    }

    switch (activeTab) {
      case 'notices': const filteredNotices = allNotices.filter(n => { if (noticeFilter === 'urgent') return n.category === 'Urgente'; if (noticeFilter === 'unread') return !n.read; return true; }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); return <NoticesView filteredNotices={filteredNotices} setNoticeFilter={setNoticeFilter} noticeFilter={noticeFilter} activeNoticeTab={activeNoticeTab} setActiveNoticeTab={setActiveNoticeTab} isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} chatMessages={chatMessages} role={role} chatInput={chatInput} setChatInput={setChatInput} handleSendChatMessage={handleSendChatMessage} chatEndRef={chatEndRef} handleAcknowledgeNotice={handleAcknowledgeNotice} />;
      case 'reservations': return <ReservationsView dayReservations={dayReservations} reservationFilter={reservationFilter} setReservationFilter={setReservationFilter} setIsReservationModalOpen={setIsReservationModalOpen} areasStatus={areasStatus} handleReservationAction={handleReservationAction} />;
      case 'residents': 
        if (role === 'MORADOR') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Porteiro e Síndico.
              </p>
            </div>
          );
        }
        return <ResidentsView allResidents={allResidents} residentSearch={residentSearch} setResidentSearch={setResidentSearch} handleOpenResidentModal={handleOpenResidentModal} setSelectedResidentProfile={setSelectedResidentProfile} handleDeleteResident={handleDeleteResident} allPackages={allPackages} visitorLogs={visitorLogs} onImportClick={() => setIsImportResidentsModalOpen(true)} />;
      case 'boletos': 
        if (role === 'MORADOR' && currentResident) {
          const myBoletos = allBoletos.filter(b => b.unit === currentResident.unit);
          return <BoletosView allBoletos={myBoletos} boletoSearch={boletoSearch} setBoletoSearch={setBoletoSearch} allResidents={[currentResident]} onViewBoleto={(boleto) => { if (boleto.pdfUrl) window.open(boleto.pdfUrl, '_blank'); }} onDownloadBoleto={(boleto) => { if (boleto.pdfUrl) { const link = document.createElement('a'); link.href = boleto.pdfUrl; link.download = `boleto-${boleto.unit}-${boleto.referenceMonth}.pdf`; link.click(); } }} showImportButton={false} />;
        }
        return <BoletosView allBoletos={allBoletos} boletoSearch={boletoSearch} setBoletoSearch={setBoletoSearch} allResidents={allResidents} onViewBoleto={(boleto) => { if (boleto.pdfUrl) window.open(boleto.pdfUrl, '_blank'); }} onDownloadBoleto={(boleto) => { if (boleto.pdfUrl) { const link = document.createElement('a'); link.href = boleto.pdfUrl; link.download = `boleto-${boleto.unit}-${boleto.referenceMonth}.pdf`; link.click(); } }} onDeleteBoleto={handleDeleteBoleto} onImportClick={() => setIsImportBoletosModalOpen(true)} showImportButton={true} />;
      case 'visitors': 
        if (role === 'MORADOR') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Porteiro.
              </p>
            </div>
          );
        }
        return <VisitorsView visitorLogs={visitorLogs} visitorSearch={visitorSearch} setVisitorSearch={setVisitorSearch} setIsVisitorModalOpen={setIsVisitorModalOpen} visitorTab={visitorTab} setVisitorTab={setVisitorTab} handleVisitorCheckOut={handleVisitorCheckOut} calculatePermanence={calculatePermanence} />;
      case 'packages': 
        if (role === 'MORADOR' && currentResident) {
          const myPackages = allPackages.filter(p => p.unit === currentResident.unit);
          return <PackagesView allPackages={myPackages} allResidents={[]} packageSearch={packageSearch} setPackageSearch={setPackageSearch} setIsNewPackageModalOpen={handleOpenNewPackageModal} setSelectedPackageForDetail={setSelectedPackageForDetail} onCameraScan={undefined} />;
        }
        if (role === 'SINDICO') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Porteiro. O síndico não possui permissão para acessar o módulo de Encomendas.
              </p>
            </div>
          );
        }
        return <PackagesView allPackages={allPackages} allResidents={allResidents} packageSearch={packageSearch} setPackageSearch={setPackageSearch} setIsNewPackageModalOpen={handleOpenNewPackageModal} setSelectedPackageForDetail={setSelectedPackageForDetail} onCameraScan={() => setIsCameraScanModalOpen(true)} />;
      case 'settings': 
        if (role === 'MORADOR') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Porteiro e Síndico.
              </p>
            </div>
          );
        }
        return <SettingsView />;
      case 'occurrences': 
        if (role === 'MORADOR') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Porteiro e Síndico.
              </p>
            </div>
          );
        }
        return <OccurrencesView allOccurrences={allOccurrences} occurrenceSearch={occurrenceSearch} setOccurrenceSearch={setOccurrenceSearch} setIsOccurrenceModalOpen={setIsOccurrenceModalOpen} handleResolveOccurrence={handleResolveOccurrence} />;
      case 'notes': 
        if (role === 'MORADOR') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Porteiro.
              </p>
            </div>
          );
        }
        return <NotesView allNotes={allNotes} setEditingNoteId={setEditingNoteId} setNewNoteContent={setNewNoteContent} setIsNewNoteModalOpen={setIsNewNoteModalOpen} setAllNotes={setAllNotes} />;
      case 'ai': 
        // ASSISTENTE IA: Acesso exclusivo para PORTEIRO e SINDICO - Moradores NÃO têm acesso
        if (role === 'MORADOR') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Porteiro e Síndico.
              </p>
            </div>
          );
        }
        return (
          <AiView 
            allPackages={allPackages} 
            visitorLogs={visitorLogs} 
            allOccurrences={allOccurrences} 
            allNotes={allNotes}
            allResidents={allResidents}
            dayReservations={dayReservations}
            allNotices={allNotices}
            chatMessages={chatMessages}
          />
        );
      case 'staff':
        if (role === 'MORADOR' || role === 'PORTEIRO') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Síndico.
              </p>
            </div>
          );
        }
        return (
           <StaffView 
              allStaff={allStaff}
              staffSearch={staffSearch}
              setStaffSearch={setStaffSearch}
              onAddStaff={() => { setStaffFormData({}); setIsStaffModalOpen(true); }}
              onEditStaff={(staff) => { setStaffFormData(staff); setIsStaffModalOpen(true); }}
              onDeleteStaff={handleDeleteStaff}
           />
        );
      case 'reports':
        if (role === 'MORADOR' || role === 'PORTEIRO') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                Esta página é de acesso exclusivo do Síndico.
              </p>
            </div>
          );
        }
        return (
          <AiReportsView 
            allPackages={allPackages} 
            visitorLogs={visitorLogs} 
            allOccurrences={allOccurrences} 
            allNotes={allNotes} 
            dayReservations={dayReservations} 
          />
        );
      default: return <div className="p-10 text-center opacity-40 font-black uppercase">{activeTab}</div>;
    }
  };

  if (isScreenSaverActive) return <ScreenSaver onExit={() => setIsScreenSaverActive(false)} theme={theme} />;
  
  // Mostrar tela de apresentação apenas no primeiro acesso
  if (!isAuthenticated && showLogoSplash) {
    return (
      <LogoSplash
        onComplete={() => setShowLogoSplash(false)}
        durationMs={2200}
      />
    );
  }

  if (showVideoIntro) {
    return (
      <VideoIntro 
        onComplete={() => {
          sessionStorage.setItem('hasSeenVideoIntro', 'true');
          setShowVideoIntro(false);
        }} 
      />
    );
  }
  
  // Se for link de morador ou modo registro, mostrar cadastro/login de morador
  if (!isAuthenticated && showResidentRegister) {
    return (
      <ResidentRegister 
        onRegister={handleResidentRegister}
        onLogin={handleResidentLogin}
        theme={theme}
        toggleTheme={toggleTheme}
        existingResidents={allResidents}
      />
    );
  }
  
  if (!isAuthenticated) return <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />;

  return (
    <>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={role} setRole={setRole} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme}>
        {renderContent()}
      </Layout>
      {role === 'PORTEIRO' && <DraggableFab onClick={() => { setEditingNoteId(null); setNewNoteContent(''); setIsNewNoteModalOpen(true); }} />}
      <QuickViewModal 
        category={quickViewCategory} data={quickViewData} onClose={() => setQuickViewCategory(null)} onGoToPage={(tab) => setActiveTab(tab)}
        onMarkAsDone={(note) => { setAllNotes(prev => prev.map(n => n.id === note.id ? { ...n, completed: true } : n)); }}
        onAddNew={() => { if (quickViewCategory === 'visitors') { setQuickViewCategory(null); resetVisitorModal(); setIsVisitorModalOpen(true); } }}
        onSelectItem={(item) => { 
          if (quickViewCategory === 'packages') { setSelectedPackageForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'visitors') { setSelectedVisitorForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'occurrences') { setSelectedOccurrenceForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'notes') { setEditingNoteId(item.id); setNewNoteContent(item.content); setNewNoteCategory(item.category || 'Geral'); setNewNoteScheduled(item.scheduled || ''); setIsNewNoteModalOpen(true); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'notices') { setSelectedNoticeForEdit(item); setQuickViewCategory(null); }
        }}
      />
      
      {/* MODALS */}
      <NewReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} data={newReservationData} setData={setNewReservationData} areasStatus={areasStatus} searchQuery={reservationSearchQuery} setSearchQuery={setReservationSearchQuery} showSuggestions={showResSuggestions} setShowSuggestions={setShowResSuggestions} filteredResidents={filteredResForReservation} hasConflict={hasTimeConflict} onConfirm={handleCreateReservation} />
      <NewVisitorModal isOpen={isVisitorModalOpen} onClose={resetVisitorModal} step={newVisitorStep} setStep={setNewVisitorStep} data={newVisitorData} setData={setNewVisitorData} searchResident={searchResident} setSearchResident={setSearchResident} filteredResidents={filteredResidents} accessTypes={visitorAccessTypes} handleRemoveAccessType={handleRemoveAccessType} isAddingAccessType={isAddingAccessType} setIsAddingAccessType={setIsAddingAccessType} newAccessTypeInput={newAccessTypeInput} setNewAccessTypeInput={setNewAccessTypeInput} handleAddAccessType={handleAddAccessType} onConfirm={handleRegisterVisitor} />
      <NewPackageModal isOpen={isNewPackageModalOpen} onClose={resetPackageModal} step={packageStep} setStep={setPackageStep} searchResident={searchResident} setSearchResident={setSearchResident} selectedResident={selectedResident} setSelectedResident={setSelectedResident} filteredResidents={filteredResidents} allResidents={allResidents} pendingImage={pendingPackageImage} pendingQrData={pendingPackageQrData} packageType={packageType} setPackageType={setPackageType} packageCategories={packageCategories} isAddingPkgCategory={isAddingPkgCategory} setIsAddingPkgCategory={setIsAddingPkgCategory} newPkgCatName={newPkgCatName} setNewPkgCatName={setNewPkgCatName} handleAddPkgCategory={handleAddPkgCategory} numItems={numItems} packageItems={packageItems} handleAddItemRow={handleAddItemRow} handleRemoveItemRow={handleRemoveItemRow} updateItem={updateItem} packageMessage={packageMessage} setPackageMessage={setPackageMessage} onConfirm={handleRegisterPackageFinal} />
      <NewNoteModal isOpen={isNewNoteModalOpen} onClose={() => { setIsNewNoteModalOpen(false); setEditingNoteId(null); setIsAddingCategory(false); setIsManagingCategories(false); }} editingId={editingNoteId} categories={noteCategories} newCategory={newNoteCategory} setNewCategory={setNewNoteCategory} isManaging={isManagingCategories} setIsManaging={setIsManagingCategories} removeCategory={handleRemoveCategory} isAdding={isAddingCategory} setIsAdding={setIsAddingCategory} newCatName={newCatName} setNewCatName={setNewCatName} addCategory={handleAddCategory} content={newNoteContent} setContent={setNewNoteContent} isScheduleOpen={isScheduleOpen} setIsScheduleOpen={setIsScheduleOpen} scheduled={newNoteScheduled} setScheduled={setNewNoteScheduled} allNotes={allNotes} setAllNotes={setAllNotes} onSave={handleSaveNote} />
      <StaffFormModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} data={staffFormData} setData={setStaffFormData} onSave={handleSaveStaff} />

      <ResidentProfileModal resident={selectedResidentProfile} onClose={() => setSelectedResidentProfile(null)} onEdit={() => { handleOpenResidentModal(selectedResidentProfile); setSelectedResidentProfile(null); }} onDelete={selectedResidentProfile ? () => handleDeleteResident(selectedResidentProfile.id) : undefined} allPackages={allPackages} visitorLogs={visitorLogs} onPackageSelect={setSelectedPackageForDetail} onCheckOutVisitor={handleVisitorCheckOut} />
      <PackageDetailModal pkg={selectedPackageForDetail} onClose={() => setSelectedPackageForDetail(null)} onDeliver={handleDeliverPackage} onNotify={handleSendReminder} calculatePermanence={calculatePermanence} />
      <VisitorDetailModal visitor={selectedVisitorForDetail} onClose={() => setSelectedVisitorForDetail(null)} onCheckout={handleVisitorCheckOut} calculatePermanence={calculatePermanence} />
      <OccurrenceDetailModal occurrence={selectedOccurrenceForDetail} onClose={() => setSelectedOccurrenceForDetail(null)} onSave={handleSaveOccurrenceDetails} setOccurrence={setSelectedOccurrenceForDetail} />
      <ResidentFormModal isOpen={isResidentModalOpen} onClose={() => setIsResidentModalOpen(false)} data={residentFormData} setData={setResidentFormData} onSave={handleSaveResident} />
      <ImportResidentsModal isOpen={isImportResidentsModalOpen} onClose={() => setIsImportResidentsModalOpen(false)} onImport={handleImportResidents} existingResidents={allResidents} />
      <ImportBoletosModal isOpen={isImportBoletosModalOpen} onClose={() => setIsImportBoletosModalOpen(false)} onImport={handleImportBoletos} existingBoletos={allBoletos} allResidents={allResidents} />
      <CameraScanModal isOpen={isCameraScanModalOpen} onClose={() => setIsCameraScanModalOpen(false)} onScanSuccess={handleCameraScanSuccess} allResidents={allResidents} />
      <NewOccurrenceModal isOpen={isOccurrenceModalOpen} onClose={() => setIsOccurrenceModalOpen(false)} description={occurrenceDescription} setDescription={setOccurrenceDescription} onSave={async () => {
        if (!occurrenceDescription.trim()) {
          alert('Por favor, descreva a ocorrência');
          return;
        }
        
        const newOccurrence: Occurrence = {
          id: `temp-${Date.now()}`,
          residentName: 'Sistema',
          unit: 'N/A',
          description: occurrenceDescription,
          status: 'Aberto',
          date: new Date().toISOString(),
          reportedBy: role === 'PORTEIRO' ? 'Porteiro' : role === 'SINDICO' ? 'Síndico' : 'Sistema'
        };
        
        const result = await saveOccurrence(newOccurrence);
        if (result.success && result.id) {
          newOccurrence.id = result.id;
          setAllOccurrences(prev => [newOccurrence, ...prev]);
          setOccurrenceDescription('');
          setIsOccurrenceModalOpen(false);
        } else {
          console.error('Erro ao salvar ocorrência:', result.error);
          alert('Erro ao registrar ocorrência: ' + (result.error || 'Erro desconhecido'));
        }
      }} />
      <NoticeEditModal notice={selectedNoticeForEdit} onClose={() => setSelectedNoticeForEdit(null)} onChange={setSelectedNoticeForEdit} onSave={handleSaveNoticeChanges} onDelete={handleDeleteNotice} />
    </>
  );
};

export default App;
