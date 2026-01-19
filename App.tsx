
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import Layout from './components/Layout';
import Login from './components/Login';
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

  const [allResidents, setAllResidents] = useState<Resident[]>([
    { id: '1', name: 'João Silva', unit: '102A', email: 'joao@email.com', phone: '5511999999999', whatsapp: '5511999999999' },
    { id: '2', name: 'Maria Santos', unit: '405B', email: 'maria@email.com', phone: '5511888888888', whatsapp: '5511888888888' },
    { id: '3', name: 'Ana Oliveira', unit: '201C', email: 'ana@email.com', phone: '5511777777777', whatsapp: '5511777777777' },
    { id: '4', name: 'Ricardo Almeida', unit: '202', email: 'ricardo@email.com', phone: '5511666666666', whatsapp: '5511666666666' },
  ]);

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

  const handleVisitorCheckOut = (id: string) => setVisitorLogs(prev => prev.map(v => v.id === id ? { ...v, status: 'completed', exitTime: new Date().toISOString() } : v));
  const resetVisitorModal = () => { setIsVisitorModalOpen(false); setNewVisitorStep(1); setNewVisitorData({ unit: '', name: '', doc: '', type: 'Visita', vehicle: '', plate: '', residentName: '' }); setSearchResident(''); };
  const handleRegisterVisitor = () => {
    const newVisitor = { id: Date.now().toString(), residentName: newVisitorData.residentName || 'Desconhecido', unit: newVisitorData.unit, visitorCount: 1, visitorNames: newVisitorData.name, entryTime: new Date().toISOString(), status: 'active', type: newVisitorData.type, doc: newVisitorData.doc, vehicle: newVisitorData.vehicle, plate: newVisitorData.plate };
    setVisitorLogs([newVisitor, ...visitorLogs]); resetVisitorModal();
  };
  const handleAddAccessType = () => { if (newAccessTypeInput.trim()) { setVisitorAccessTypes([...visitorAccessTypes, newAccessTypeInput.trim()]); setNewAccessTypeInput(''); setIsAddingAccessType(false); } };
  const handleRemoveAccessType = (typeToRemove: string) => { if (visitorAccessTypes.length > 1) { setVisitorAccessTypes(visitorAccessTypes.filter(t => t !== typeToRemove)); if (newVisitorData.type === typeToRemove) { setNewVisitorData({...newVisitorData, type: visitorAccessTypes[0]}); } } };
  const handleAddItemRow = () => { setPackageItems([...packageItems, { id: Date.now().toString(), name: '', description: '' }]); setNumItems(prev => prev + 1); };
  const handleRemoveItemRow = (id: string) => { if (packageItems.length <= 1) return; setPackageItems(packageItems.filter(it => it.id !== id)); setNumItems(prev => prev + 1); };
  const updateItem = (id: string, field: 'name' | 'description', value: string) => { setPackageItems(packageItems.map(it => it.id === id ? { ...it, [field]: value } : it)); };
  const resetPackageModal = () => { setIsNewPackageModalOpen(false); setPackageStep(1); setSelectedResident(null); setSearchResident(''); setPackageType('Amazon'); setNumItems(1); setPackageItems([{ id: '1', name: '', description: '' }]); };
  const handleRegisterPackageFinal = (sendNotify: boolean) => {
    if (!selectedResident) return;
    const newPkg: Package = { id: Date.now().toString(), recipient: selectedResident.name, unit: selectedResident.unit, type: packageType, receivedAt: new Date().toISOString(), displayTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), status: 'Pendente', deadlineMinutes: 45, residentPhone: selectedResident.phone, items: packageItems.filter(it => it.name.trim() !== '') };
    setAllPackages([newPkg, ...allPackages]);
    if (sendNotify && selectedResident.whatsapp) { const url = `https://wa.me/${selectedResident.whatsapp}?text=${encodeURIComponent(packageMessage)}`; window.open(url, '_blank'); }
    resetPackageModal(); setActiveTab('dashboard');
  };
  const handleDeliverPackage = (id: string) => { setAllPackages(prev => prev.map(p => p.id === id ? { ...p, status: 'Entregue' } : p)); setSelectedPackageForDetail(null); };
  const handleResolveOccurrence = (id: string) => { setAllOccurrences(prev => prev.map(occ => occ.id === id ? { ...occ, status: 'Resolvido' } : occ)); };
  const handleSaveOccurrenceDetails = () => { if (!selectedOccurrenceForDetail) return; setAllOccurrences(prev => prev.map(o => o.id === selectedOccurrenceForDetail.id ? selectedOccurrenceForDetail : o)); setSelectedOccurrenceForDetail(null); };
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
  const handleSaveResident = () => { if (!residentFormData.name || !residentFormData.unit) return; if (residentFormData.id) { setAllResidents(prev => prev.map(r => r.id === residentFormData.id ? residentFormData : r)); } else { const newResident = { ...residentFormData, id: Date.now().toString() }; setAllResidents(prev => [newResident, ...prev]); } setIsResidentModalOpen(false); };
  const handleDeleteResident = (id: string) => { if (window.confirm("Tem certeza que deseja remover este morador?")) { setAllResidents(prev => prev.filter(r => r.id !== id)); if (selectedResidentProfile?.id === id) setSelectedResidentProfile(null); } };
  const handleImportResidents = (residents: Resident[]) => { setAllResidents(prev => [...residents, ...prev]); };
  const handleImportBoletos = (boletos: Boleto[]) => { setAllBoletos(prev => [...boletos, ...prev]); };
  const handleDeleteBoleto = (boleto: Boleto) => { setAllBoletos(prev => prev.filter(b => b.id !== boleto.id)); };
  const handleCameraScanSuccess = (data: { resident?: Resident; qrData?: string; image?: string }) => {
    if (data.resident) {
      // Se encontrou o morador automaticamente, criar encomenda diretamente
      const newPkg: Package = {
        id: Date.now().toString(),
        recipient: data.resident.name,
        unit: data.resident.unit,
        type: 'QR Code',
        receivedAt: new Date().toISOString(),
        displayTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'Pendente',
        deadlineMinutes: 45,
        residentPhone: data.resident.phone,
        items: data.qrData ? [{ id: '1', name: 'Encomenda via QR Code', description: data.qrData }] : undefined
      };
      setAllPackages([newPkg, ...allPackages]);
      setIsCameraScanModalOpen(false);
      setActiveTab('packages');
    } else if (data.qrData || data.image) {
      // Se não encontrou automaticamente, abrir modal de novo pacote pré-preenchido
      setIsCameraScanModalOpen(false);
      setIsNewPackageModalOpen(true);
      setPackageStep(1);
      // Tentar encontrar morador pelos dados do QR
      if (data.qrData) {
        const foundResident = allResidents.find(r => 
          data.qrData?.includes(r.unit) || 
          data.qrData?.includes(r.name) ||
          r.unit === data.qrData
        );
        if (foundResident) {
          setSelectedResident(foundResident);
          setSearchResident(foundResident.name);
        }
      }
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
          setIsNewPackageModalOpen={setIsNewPackageModalOpen} 
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
          return <PackagesView allPackages={myPackages} packageSearch={packageSearch} setPackageSearch={setPackageSearch} setIsNewPackageModalOpen={setIsNewPackageModalOpen} setSelectedPackageForDetail={setSelectedPackageForDetail} onCameraScan={undefined} />;
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
        return <PackagesView allPackages={allPackages} packageSearch={packageSearch} setPackageSearch={setPackageSearch} setIsNewPackageModalOpen={setIsNewPackageModalOpen} setSelectedPackageForDetail={setSelectedPackageForDetail} onCameraScan={() => setIsCameraScanModalOpen(true)} />;
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
      <NewPackageModal isOpen={isNewPackageModalOpen} onClose={resetPackageModal} step={packageStep} setStep={setPackageStep} searchResident={searchResident} setSearchResident={setSearchResident} selectedResident={selectedResident} setSelectedResident={setSelectedResident} filteredResidents={filteredResidents} packageType={packageType} setPackageType={setPackageType} packageCategories={packageCategories} isAddingPkgCategory={isAddingPkgCategory} setIsAddingPkgCategory={setIsAddingPkgCategory} newPkgCatName={newPkgCatName} setNewPkgCatName={setNewPkgCatName} handleAddPkgCategory={handleAddPkgCategory} numItems={numItems} packageItems={packageItems} handleAddItemRow={handleAddItemRow} handleRemoveItemRow={handleRemoveItemRow} updateItem={updateItem} packageMessage={packageMessage} setPackageMessage={setPackageMessage} onConfirm={handleRegisterPackageFinal} />
      <NewNoteModal isOpen={isNewNoteModalOpen} onClose={() => { setIsNewNoteModalOpen(false); setEditingNoteId(null); setIsAddingCategory(false); setIsManagingCategories(false); }} editingId={editingNoteId} categories={noteCategories} newCategory={newNoteCategory} setNewCategory={setNewNoteCategory} isManaging={isManagingCategories} setIsManaging={setIsManagingCategories} removeCategory={handleRemoveCategory} isAdding={isAddingCategory} setIsAdding={setIsAddingCategory} newCatName={newCatName} setNewCatName={setNewCatName} addCategory={handleAddCategory} content={newNoteContent} setContent={setNewNoteContent} isScheduleOpen={isScheduleOpen} setIsScheduleOpen={setIsScheduleOpen} scheduled={newNoteScheduled} setScheduled={setNewNoteScheduled} allNotes={allNotes} setAllNotes={setAllNotes} onSave={handleSaveNote} />
      <StaffFormModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} data={staffFormData} setData={setStaffFormData} onSave={handleSaveStaff} />

      <ResidentProfileModal resident={selectedResidentProfile} onClose={() => setSelectedResidentProfile(null)} onEdit={() => { handleOpenResidentModal(selectedResidentProfile); setSelectedResidentProfile(null); }} allPackages={allPackages} visitorLogs={visitorLogs} onPackageSelect={setSelectedPackageForDetail} onCheckOutVisitor={handleVisitorCheckOut} />
      <PackageDetailModal pkg={selectedPackageForDetail} onClose={() => setSelectedPackageForDetail(null)} onDeliver={handleDeliverPackage} onNotify={handleSendReminder} calculatePermanence={calculatePermanence} />
      <VisitorDetailModal visitor={selectedVisitorForDetail} onClose={() => setSelectedVisitorForDetail(null)} onCheckout={handleVisitorCheckOut} calculatePermanence={calculatePermanence} />
      <OccurrenceDetailModal occurrence={selectedOccurrenceForDetail} onClose={() => setSelectedOccurrenceForDetail(null)} onSave={handleSaveOccurrenceDetails} setOccurrence={setSelectedOccurrenceForDetail} />
      <ResidentFormModal isOpen={isResidentModalOpen} onClose={() => setIsResidentModalOpen(false)} data={residentFormData} setData={setResidentFormData} onSave={handleSaveResident} />
      <ImportResidentsModal isOpen={isImportResidentsModalOpen} onClose={() => setIsImportResidentsModalOpen(false)} onImport={handleImportResidents} existingResidents={allResidents} />
      <ImportBoletosModal isOpen={isImportBoletosModalOpen} onClose={() => setIsImportBoletosModalOpen(false)} onImport={handleImportBoletos} existingBoletos={allBoletos} allResidents={allResidents} />
      <CameraScanModal isOpen={isCameraScanModalOpen} onClose={() => setIsCameraScanModalOpen(false)} onScanSuccess={handleCameraScanSuccess} allResidents={allResidents} />
      <NewOccurrenceModal isOpen={isOccurrenceModalOpen} onClose={() => setIsOccurrenceModalOpen(false)} description={occurrenceDescription} setDescription={setOccurrenceDescription} onSave={() => setIsOccurrenceModalOpen(false)} />
      <NoticeEditModal notice={selectedNoticeForEdit} onClose={() => setSelectedNoticeForEdit(null)} onChange={setSelectedNoticeForEdit} onSave={handleSaveNoticeChanges} onDelete={handleDeleteNotice} />
    </>
  );
};

export default App;
