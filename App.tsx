
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import Layout from './components/Layout';
import Login from './components/Login';
import LogoSplash from './components/LogoSplash';
import ResidentRegister from './components/ResidentRegister';
import ScreenSaver from './components/ScreenSaver';
import VideoIntro from './components/VideoIntro';
import { UserRole, Package, Resident, Note, VisitorLog, PackageItem, Occurrence, Notice, ChatMessage, QuickViewCategory, Staff, Boleto, Notification } from './types';

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
import NotificationsView from './components/views/NotificationsView';

// Contexts
import { useAppConfig } from './contexts/AppConfigContext';
import { useToast } from './contexts/ToastContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Utils
import { normalizeUnit, compareUnits } from './utils/unitFormatter';
import { openWhatsApp } from './utils/phoneNormalizer';

// Services
import {
  getResidents, getPackages, savePackage, updatePackage, deletePackage,
  saveResident, deleteResident,
  getVisitors, saveVisitor, updateVisitor,
  getOccurrences, saveOccurrence, updateOccurrence,
  getBoletos, saveBoleto, updateBoleto, deleteBoleto,
  getNotes, saveNote, updateNote, deleteNote,
  getNotices, saveNotice, updateNotice, deleteNotice,
  getChatMessages, saveChatMessage,
  getStaff, saveStaff, deleteStaff,
  getAreas, getReservations, saveReservation, updateReservation
} from './services/dataService';
import { getNotifications, countUnreadNotifications } from './services/notificationService';
import { supabase, isSupabasePlaceholder } from './services/supabase';

// Modals
import { NewReservationModal, NewVisitorModal, NewPackageModal, NewNoteModal, StaffFormModal } from './components/modals/ActionModals';
import { ResidentProfileModal, PackageDetailModal, VisitorDetailModal, OccurrenceDetailModal, ResidentFormModal, NewOccurrenceModal, NoticeEditModal } from './components/modals/DetailModals';
import ImportResidentsModal from './components/modals/ImportResidentsModal';
import ImportBoletosModal from './components/modals/ImportBoletosModal';
import CameraScanModal from './components/modals/CameraScanModal';
import ImportStaffModal from './components/modals/ImportStaffModal';

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
  const toast = useToast();
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
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [residentsError, setResidentsError] = useState<string | null>(null);

  const fetchResidents = useCallback(async (silent = false) => {
    if (!silent) {
      setResidentsLoading(true);
      setResidentsError(null);
    }
    const res = await getResidents();
    setAllResidents(res.data);
    setResidentsError(res.error ?? null);
    if (!silent) setResidentsLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setResidentsLoading(true);
    setResidentsError(null);
    getResidents().then((res) => {
      if (cancelled) return;
      setAllResidents(res.data);
      setResidentsError(res.error ?? null);
      setResidentsLoading(false);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Carregar pacotes do banco de dados
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setPackagesLoading(true);
    getPackages().then((res) => {
      if (cancelled) return;
      if (res.data) setAllPackages(res.data);
      setPackagesLoading(false);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Carregar visitantes, ocorrências e boletos do Supabase
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getVisitors().then((res) => { if (!cancelled && res.data) setVisitorLogs(res.data); });
    getOccurrences().then((res) => { if (!cancelled && res.data) setAllOccurrences(res.data); });
    getBoletos().then((res) => { if (!cancelled && res.data) setAllBoletos(res.data); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Carregar notas, avisos, chat, staff do Supabase
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getNotes().then((res) => { if (!cancelled && res.data) setAllNotes(res.data); });
    getNotices().then((res) => { if (!cancelled && res.data) setAllNotices(res.data); });
    getChatMessages().then((res) => { if (!cancelled && res.data) setChatMessages(res.data); });
    getStaff().then((res) => { if (!cancelled && res.data) setAllStaff(res.data); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const [allOccurrences, setAllOccurrences] = useState<Occurrence[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [allBoletos, setAllBoletos] = useState<Boleto[]>([]);
  const [boletoSearch, setBoletoSearch] = useState('');

  // Estado de notificações
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffFormData, setStaffFormData] = useState<Partial<Staff>>({});
  const [isImportStaffModalOpen, setIsImportStaffModalOpen] = useState(false);

  const [noticeFilter, setNoticeFilter] = useState<'all' | 'urgent' | 'unread'>('all');
  const [activeNoticeTab, setActiveNoticeTab] = useState<'wall' | 'chat'>('wall');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'notices' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isChatOpen]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    const newMsg: ChatMessage = { id: `temp-${Date.now()}`, text, senderRole: role, timestamp: new Date().toISOString(), read: false };
    const res = await saveChatMessage(newMsg);
    if (res.success) {
      const { data } = await getChatMessages();
      if (data) setChatMessages(data);
    } else {
      setChatInput(text);
      console.error('Erro ao enviar mensagem:', res.error);
    }
  };

  const [areasData, setAreasData] = useState<{ id: string; name: string; capacity: number; rules: string | null }[]>([]);
  const [reservationsData, setReservationsData] = useState<{ id: string; areaId: string; areaName: string; residentId: string; residentName: string; unit: string; date: string; startTime: string; endTime: string; status: string }[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getAreas().then((a) => { if (!cancelled && a.data) setAreasData(a.data); });
    getReservations().then((r) => { if (!cancelled && r.data) setReservationsData(r.data); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const todayYMD = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const areasStatus = useMemo(() => {
    const reservable = areasData.filter((a) => {
      const n = a.name.toLowerCase();
      return n.includes('gourmet') || n.includes('salão') || n.includes('festas');
    });
    // Evitar áreas em duplicidade (por nome), como salão de festas duplicado
    const uniqueByName = reservable.filter((area, index, self) =>
      self.findIndex(a => a.name.toLowerCase() === area.name.toLowerCase()) === index
    );
    return uniqueByName.map((a) => {
      const todayCount = reservationsData.filter(
        (r) => r.areaId === a.id && r.date === todayYMD && (r.status === 'scheduled' || r.status === 'active')
      ).length;
      return { id: a.id, name: a.name, capacity: a.capacity, today: `${todayCount} HOJE`, rules: a.rules || '' };
    });
  }, [areasData, reservationsData, todayYMD]);

  const dayReservations = useMemo(() => {
    return reservationsData.map((r) => {
      const d = new Date(r.date + 'T12:00:00');
      const month = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
      const day = d.getDate();
      return {
        id: r.id,
        resident: r.residentName,
        unit: r.unit,
        area: r.areaName,
        time: `${r.startTime} - ${r.endTime}`,
        status: r.status,
        date: `${month} ${day}`
      };
    });
  }, [reservationsData]);

  const fetchReservations = useCallback(() => {
    getReservations().then((r) => { if (r.data) setReservationsData(r.data); });
  }, []);

  const [reservationFilter, setReservationFilter] = useState<'all' | 'today' | 'pending'>('today');
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [reservationSearchQuery, setReservationSearchQuery] = useState('');
  const [showResSuggestions, setShowResSuggestions] = useState(false);
  const [newReservationData, setNewReservationData] = useState({ area: '', areaId: '', resident: '', unit: '', residentId: '', date: '', startTime: '', endTime: '' });

  const hasTimeConflict = useMemo(() => {
    if (!newReservationData.date || !newReservationData.startTime || !newReservationData.endTime || !newReservationData.area) return false;
    const toMins = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
    const newStart = toMins(newReservationData.startTime);
    const newEnd = toMins(newReservationData.endTime);
    const dateObj = new Date(newReservationData.date + 'T12:00:00');
    const month = dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const day = dateObj.getDate();
    const formattedDate = `${month} ${day}`;
    return dayReservations.some((r) => {
      if (r.area !== newReservationData.area || r.date !== formattedDate) return false;
      const [startStr, endStr] = r.time.split(' - ');
      const rStart = toMins(startStr);
      const rEnd = toMins(endStr);
      return newStart < rEnd && newEnd > rStart;
    });
  }, [newReservationData, dayReservations]);

  const handleReservationAction = async (id: string) => {
    const r = reservationsData.find((x) => x.id === id);
    if (!r) return;
    const next = r.status === 'scheduled' ? 'active' : r.status === 'active' ? 'completed' : r.status;
    if (next === r.status) return;
    const res = await updateReservation(id, { status: next });
    if (res.success) fetchReservations();
  };

  const handleCreateReservation = async () => {
    if (!newReservationData.resident || !newReservationData.date || !newReservationData.areaId || !newReservationData.residentId || hasTimeConflict) return;
    const res = await saveReservation({
      areaId: newReservationData.areaId,
      residentId: newReservationData.residentId,
      residentName: newReservationData.resident,
      unit: newReservationData.unit,
      date: newReservationData.date,
      startTime: newReservationData.startTime,
      endTime: newReservationData.endTime,
      status: 'scheduled'
    });
    if (res.success) {
      fetchReservations();
      setIsReservationModalOpen(false);
      setNewReservationData({ area: '', areaId: '', resident: '', unit: '', residentId: '', date: '', startTime: '', endTime: '' });
      setReservationSearchQuery('');
      setShowResSuggestions(false);
    } else {
      toast.error('Erro ao criar reserva: ' + (res.error || 'Erro desconhecido'));
    }
  };

  const filteredResForReservation = useMemo(() => {
    if (!reservationSearchQuery) return [];
    return allResidents.filter(r => r.name.toLowerCase().includes(reservationSearchQuery.toLowerCase()) || r.unit.includes(reservationSearchQuery)).slice(0, 3);
  }, [reservationSearchQuery, allResidents]);

  const [selectedNoticeForEdit, setSelectedNoticeForEdit] = useState<Notice | null>(null);

  const eventStates = useMemo(() => {
    const now = new Date();
    const isWithin = (iso: string, mins: number) => { if (!iso) return false; const d = new Date(iso); return (now.getTime() - d.getTime()) < mins * 60 * 1000; };
    const d = new Date();
    const month = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const today = `${month} ${d.getDate()}`;
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
      case 'reservations': {
        const d = new Date();
        const month = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
        const today = `${month} ${d.getDate()}`;
        return dayReservations
          .filter(r => r.date === today && (r.status === 'scheduled' || r.status === 'active'))
          .map(r => ({ id: r.id, area: r.area, unit: r.unit, time: r.time, residentName: r.resident, date: r.date }));
      }
      case 'notes': return allNotes.filter(n => !n.completed);
      case 'notices': return allNotices.slice(0, 3);
      default: return [];
    }
  }, [quickViewCategory, allPackages, visitorLogs, allOccurrences, allNotes, allNotices, dayReservations]);

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
  const [packageSaving, setPackageSaving] = useState(false);
  const [residentFormData, setResidentFormData] = useState({ id: '', name: '', unit: '', email: '', phone: '', whatsapp: '' });
  const [selectedResidentProfile, setSelectedResidentProfile] = useState<Resident | null>(null);
  const [residentPassword, setResidentPassword] = useState<string | null>(null);

  // Mesma lógica da página Moradores: busca por nome ou unidade; sem busca = todos.
  const filteredResidents = useMemo(() => {
    const q = (searchResident || '').trim().toLowerCase();
    if (!q) return allResidents;
    return allResidents.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.unit.toLowerCase().includes(q)
    );
  }, [searchResident, allResidents]);

  const globalResults = useMemo(() => {
    if (!globalSearchQuery || globalSearchQuery.length < 2) return null;
    const q = globalSearchQuery.toLowerCase();
    const resFilter = (r: { resident?: string; unit?: string; area?: string; time?: string; date?: string }) =>
      (r.resident?.toLowerCase().includes(q)) || (r.unit?.toLowerCase().includes(q)) || (r.area?.toLowerCase().includes(q)) || (r.time?.toLowerCase().includes(q)) || (r.date?.toLowerCase().includes(q));
    return {
      residents: allResidents.filter(r => r.name.toLowerCase().includes(q) || r.unit.toLowerCase().includes(q)).slice(0, 4),
      packages: allPackages.filter(p => p.recipient.toLowerCase().includes(q) || p.unit.toLowerCase().includes(q) || p.type.toLowerCase().includes(q) || p.status.toLowerCase().includes(q) || (p.displayTime && p.displayTime.toLowerCase().includes(q))).slice(0, 4),
      visitors: visitorLogs.filter(v => (v.visitorNames?.toLowerCase().includes(q) || v.unit.toLowerCase().includes(q) || v.residentName.toLowerCase().includes(q) || v.status.toLowerCase().includes(q)) && v.status === 'active').slice(0, 4),
      occurrences: allOccurrences.filter(o => o.description.toLowerCase().includes(q) || o.unit.toLowerCase().includes(q) || o.residentName.toLowerCase().includes(q) || o.status.toLowerCase().includes(q)).slice(0, 4),
      notes: allNotes.filter(n => n.content.toLowerCase().includes(q) || (n.category && n.category.toLowerCase().includes(q))).slice(0, 4),
      reservations: dayReservations.filter(r => resFilter(r)).slice(0, 4)
    };
  }, [globalSearchQuery, allResidents, allPackages, visitorLogs, allOccurrences, allNotes, dayReservations]);

  const hasAnyGlobalResult = useMemo(() => {
    if (!globalResults) return false;
    return (globalResults.residents.length > 0 || globalResults.packages.length > 0 || globalResults.visitors.length > 0 || globalResults.occurrences.length > 0 || globalResults.notes.length > 0 || globalResults.reservations.length > 0);
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

  useEffect(() => {
    if (!isNewPackageModalOpen || !isAuthenticated) return;
    fetchResidents(true);
  }, [isNewPackageModalOpen, isAuthenticated, fetchResidents]);

  // Recarregar pacotes quando morador acessa a aba de notificações para garantir que imagens estejam atualizadas
  useEffect(() => {
    if (!isAuthenticated || role !== 'MORADOR' || activeTab !== 'notifications') return;
    
    const loadPackages = async () => {
      const result = await getPackages();
      if (result.data) {
        setAllPackages(result.data);
      }
    };
    loadPackages();
  }, [isAuthenticated, role, activeTab]);

  // Carregar notificações quando morador estiver autenticado
  useEffect(() => {
    if (!isAuthenticated || role !== 'MORADOR' || !currentResident) return;

    const loadNotifications = async () => {
      const result = await getNotifications(currentResident.id);
      if (result.data) {
        setAllNotifications(result.data);
        setUnreadNotificationCount(result.data.filter(n => !n.read).length);
      }
    };

    loadNotifications();

    // Recarregar pacotes quando morador acessa notificações para garantir que imagens estejam atualizadas
    const loadPackages = async () => {
      const result = await getPackages();
      if (result.data) {
        setAllPackages(result.data);
      }
    };
    loadPackages();

    // Configurar Realtime listener para notificações
    console.log('[Realtime] Configurando listener para morador:', currentResident.id);
    
    const channel = supabase
      .channel(`notifications-${currentResident.id}`) // Canal único por morador
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `morador_id=eq.${currentResident.id}`
        },
        (payload) => {
          console.log('[Realtime] ✅ Nova notificação recebida via Realtime:', payload);
          
          const newNotification: Notification = {
            id: payload.new.id,
            morador_id: payload.new.morador_id,
            title: payload.new.title,
            message: payload.new.message,
            type: payload.new.type || 'package',
            related_id: payload.new.related_id || undefined,
            read: payload.new.read || false,
            created_at: payload.new.created_at
          };
          
          // Adicionar nova notificação no início da lista
          setAllNotifications(prev => {
            // Evitar duplicatas
            const exists = prev.find(n => n.id === newNotification.id);
            if (exists) {
              console.log('[Realtime] Notificação já existe, ignorando duplicata');
              return prev;
            }
            return [newNotification, ...prev];
          });
          setUnreadNotificationCount(prev => prev + 1);
          
          // Exibir alerta visual (opcional - pode ser um toast)
          console.log('[Realtime] ✅ Notificação adicionada à lista:', newNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `morador_id=eq.${currentResident.id}`
        },
        (payload) => {
          // Atualizar notificação se foi marcada como lida
          setAllNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? {
              ...n,
              read: payload.new.read || false
            } : n)
          );
          setUnreadNotificationCount(prev => 
            payload.new.read ? Math.max(0, prev - 1) : prev
          );
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status da conexão:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Conectado ao Realtime com sucesso');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] ❌ Erro ao conectar ao Realtime');
        }
      });

    return () => {
      console.log('[Realtime] Removendo listener de notificações');
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, role, currentResident]);

  const handleVisitorCheckOut = async (id: string) => {
    const visitor = visitorLogs.find((v) => v.id === id);
    if (!visitor) return;
    const updatedVisitor = { ...visitor, status: 'completed' as const, exitTime: new Date().toISOString() };
    const result = await updateVisitor(updatedVisitor);
    if (result.success) {
      const { data } = await getVisitors();
      if (data) setVisitorLogs(data);
    } else {
      console.error('Erro ao atualizar visitante:', result.error);
      toast.error('Erro ao fazer checkout: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const resetVisitorModal = () => { setIsVisitorModalOpen(false); setNewVisitorStep(1); setNewVisitorData({ unit: '', name: '', doc: '', type: 'Visita', vehicle: '', plate: '', residentName: '' }); setSearchResident(''); };
  const handleRegisterVisitor = async () => {
    const newVisitor: VisitorLog = {
      id: `temp-${Date.now()}`,
      residentName: newVisitorData.residentName || 'Desconhecido',
      unit: newVisitorData.unit,
      visitorCount: 1,
      visitorNames: newVisitorData.name,
      entryTime: new Date().toISOString(),
      status: 'active',
      type: newVisitorData.type || 'Visita',
      doc: newVisitorData.doc || undefined,
      vehicle: newVisitorData.vehicle || undefined,
      plate: newVisitorData.plate || undefined
    };
    const result = await saveVisitor(newVisitor);
    if (result.success) {
      const { data } = await getVisitors();
      if (data) setVisitorLogs(data);
      resetVisitorModal();
    } else {
      console.error('Erro ao salvar visitante:', result.error);
      toast.error('Erro ao registrar visitante: ' + (result.error || 'Erro desconhecido'));
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
    if (!selectedResident) {
      toast.error('Selecione o morador que recebe a encomenda antes de finalizar.');
      return;
    }
    
    console.log('[handleRegisterPackageFinal] Iniciando registro de encomenda:', {
      selectedResident: selectedResident.name,
      recipientId: selectedResident.id,
      unit: selectedResident.unit
    });
    if (packageSaving) return;
    setPackageSaving(true);
    try {
      const newPkg: Package = {
        id: `temp-${Date.now()}`,
        recipient: selectedResident.name,
        unit: selectedResident.unit,
        type: packageType,
        receivedAt: new Date().toISOString(),
        displayTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'Pendente',
        deadlineMinutes: 45,
        residentPhone: selectedResident.phone,
        items: packageItems.filter((it) => it.name.trim() !== ''),
        recipientId: selectedResident.id,
        imageUrl: pendingPackageImage ?? null,
        qrCodeData: pendingPackageQrData ?? null
      };

      const result = await savePackage(newPkg);
      if (result.success && result.id) {
        // Recarregar pacotes do banco para garantir que todos os dados estejam atualizados (incluindo image_url)
        const packagesResult = await getPackages();
        if (packagesResult.data) {
          setAllPackages(packagesResult.data);
        } else {
          // Fallback: adicionar o pacote localmente se não conseguir recarregar
          newPkg.id = result.id;
          setAllPackages([newPkg, ...allPackages]);
        }
        
        // Feedback de sucesso
        // A notificação automática no app já foi criada pelo savePackage
        const feedbackMessages = ['✅ Encomenda registrada', '📱 Notificação enviada no app'];
        
        if (sendNotify) {
          // Usar WhatsApp do morador se disponível, senão usar do condomínio
          const whatsappNumber = selectedResident.whatsapp || config.condominiumWhatsApp;
          
          // Normalizar e validar número antes de enviar
          const success = openWhatsApp(whatsappNumber, packageMessage, (error) => {
            toast.error(`${feedbackMessages.join('\n')}\n\n⚠️ Não foi possível enviar via WhatsApp: ${error}\n\nVerifique se o morador tem WhatsApp cadastrado corretamente ou configure o WhatsApp do condomínio nas configurações.`);
          });
          
          if (success) {
            // Se WhatsApp foi enviado com sucesso, adicionar ao feedback
            feedbackMessages.push('💬 WhatsApp enviado');
          }
        }
        
        // Exibir feedback consolidado
        // Usar um pequeno delay para garantir que a UI está atualizada
        setTimeout(() => {
          // Feedback silencioso - não interromper o fluxo
          // O sistema já criou a notificação automaticamente
        }, 100);
      } else {
        console.error('Erro ao salvar pacote:', result.error);
        toast.error('Erro ao salvar encomenda: ' + (result.error || 'Erro desconhecido'));
        return;
      }
      
      resetPackageModal();
      setActiveTab('dashboard');
    } finally {
      setPackageSaving(false);
    }
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
      toast.error('Erro ao marcar como entregue: ' + (result.error || 'Erro desconhecido'));
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Excluir esta encomenda? A ação não pode ser desfeita.')) return;
    
    // Se for um ID temporário ou não for um UUID válido, apenas remover do estado local
    const isTempId = id.startsWith('temp-');
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isTempId || !isValidUUID) {
      console.log('Removendo encomenda temporária do estado local:', id);
      setAllPackages(prev => prev.filter(p => p.id !== id));
      setSelectedPackageForDetail(prev => (prev?.id === id ? null : prev));
      return;
    }
    
    const result = await deletePackage(id);
    if (result.success) {
      setAllPackages(prev => prev.filter(p => p.id !== id));
      setSelectedPackageForDetail(prev => (prev?.id === id ? null : prev));
    } else {
      console.error('Erro ao excluir encomenda:', result.error);
      toast.error('Erro ao excluir encomenda: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleResolveOccurrence = async (id: string) => {
    const occurrence = allOccurrences.find((occ) => occ.id === id);
    if (!occurrence) return;
    const updatedOccurrence = { ...occurrence, status: 'Resolvido' as const };
    const result = await updateOccurrence(updatedOccurrence);
    if (result.success) {
      const { data } = await getOccurrences();
      if (data) setAllOccurrences(data);
    } else {
      console.error('Erro ao resolver ocorrência:', result.error);
      toast.error('Erro ao resolver ocorrência: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleSaveOccurrenceDetails = async () => {
    if (!selectedOccurrenceForDetail) return;
    const result = await updateOccurrence(selectedOccurrenceForDetail);
    if (result.success) {
      const { data } = await getOccurrences();
      if (data) setAllOccurrences(data);
      setSelectedOccurrenceForDetail(null);
    } else {
      console.error('Erro ao salvar ocorrência:', result.error);
      toast.error('Erro ao salvar ocorrência: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleSendReminder = (pkg: Package) => {
    // Buscar morador: primeiro por ID, depois por nome (case-insensitive), depois por unidade
    let resident: Resident | undefined;
    
    if (pkg.recipientId) {
      resident = allResidents.find(r => r.id === pkg.recipientId);
    }
    
    if (!resident) {
      resident = allResidents.find(r => 
        r.name.toLowerCase().trim() === pkg.recipient.toLowerCase().trim()
      );
    }
    
    if (!resident) {
      resident = allResidents.find(r => r.unit === pkg.unit);
    }
    
    // Determinar qual número de WhatsApp usar: morador > condomínio
    const whatsappNumber = resident?.whatsapp || config.condominiumWhatsApp;
    
    const permanence = calculatePermanence(pkg.receivedAt);
    const residentName = resident?.name || pkg.recipient;
    const message = config.whatsappTemplates.packageReminder
      .replace('{residentName}', residentName)
      .replace('{packageType}', pkg.type)
      .replace('{condominiumName}', config.condominiumName)
      .replace('{permanence}', permanence);
    
    // Normalizar e validar número antes de enviar
    const success = openWhatsApp(whatsappNumber, message, (error) => {
      toast.error(`Não foi possível enviar o lembrete via WhatsApp: ${error}\n\nVerifique se o morador tem WhatsApp cadastrado corretamente ou configure o WhatsApp do condomínio nas configurações.`);
    });
    
    if (!success) {
      // Se falhou, não continuar (já exibiu erro)
      return;
    }
  };
  const handleAddPkgCategory = () => { if (!newPkgCatName.trim()) return; setPackageCategories([...packageCategories, newPkgCatName.trim()]); setPackageType(newPkgCatName.trim()); setNewPkgCatName(''); setIsAddingPkgCategory(false); };
  const handleAcknowledgeNotice = (id: string) => { setAllNotices(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); };
  const handleOpenResidentModal = async (resident?: Resident) => { 
    if (resident) { 
      setResidentFormData(resident);
      // Buscar senha do morador apenas se for síndico
      if (role === 'SINDICO' && resident.id) {
        try {
          const { data, error } = await supabase
            .from('residents')
            .select('password_hash')
            .eq('id', resident.id)
            .single();
          
          if (!error && data) {
            setResidentPassword(data.password_hash || null);
          } else {
            setResidentPassword(null);
          }
        } catch (err) {
          console.error('Erro ao buscar senha do morador:', err);
          setResidentPassword(null);
        }
      } else {
        setResidentPassword(null);
      }
    } else { 
      setResidentFormData({ id: '', name: '', unit: '', email: '', phone: '', whatsapp: '' });
      setResidentPassword(null);
    } 
    setIsResidentModalOpen(true); 
  };
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
      toast.error('Erro ao salvar morador: ' + (result.error || 'Erro desconhecido'));
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
      toast.error('Erro ao remover morador: ' + (result.error || 'Erro desconhecido'));
    }
  };
  const handleImportResidents = async (residents: Resident[]) => {
    for (let i = 0; i < residents.length; i++) {
      const r = { ...residents[i], id: `temp-${Date.now()}-${i}` };
      const res = await saveResident(r);
      if (!res.success) {
        const msg = `Erro ao importar "${r.name}": ${res.error || 'Erro desconhecido'}`;
        toast.error(msg);
        throw new Error(msg);
      }
    }
    const { data } = await getResidents();
    if (data) setAllResidents(data);
  };
  const handleImportBoletos = async (boletos: Boleto[]) => {
    for (const b of boletos) {
      const res = await saveBoleto(b);
      if (!res.success) {
        const msg = `Erro ao importar boleto "${b.residentName}": ${res.error || 'Erro desconhecido'}`;
        toast.error(msg);
        throw new Error(msg);
      }
    }
    const { data } = await getBoletos();
    if (data) setAllBoletos(data);
  };
  const handleDeleteBoleto = async (boleto: Boleto) => {
    const result = await deleteBoleto(boleto.id);
    if (result.success) {
      setAllBoletos(prev => prev.filter(b => b.id !== boleto.id));
    } else {
      console.error('Erro ao deletar boleto:', result.error);
      toast.error('Erro ao remover boleto: ' + (result.error || 'Erro desconhecido'));
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

  const handleCameraScanSuccess = (data: { resident?: Resident; qrData?: string; image?: string; fromMode?: 'qr' | 'photo' }) => {
    const hasCapture = Boolean(data.qrData || data.image);
    if (!hasCapture) return;

    const fromPhoto = data.fromMode === 'photo';
    const pkgType = fromPhoto ? 'Foto' : 'QR Code';
    const itemName = fromPhoto ? 'Encomenda via foto' : 'Encomenda via QR Code';

    let resident = data.resident ?? (data.qrData ? findResidentByQRData(data.qrData) : undefined);

    setIsCameraScanModalOpen(false);
    setPackageStep(1);
    setSelectedResident(resident ?? null);
    setSearchResident(resident ? resident.name : '');
    setPackageType(pkgType);
    setNumItems(1);
    setPackageItems([
      {
        id: '1',
        name: itemName,
        description: data.qrData ?? (fromPhoto ? 'Registro por foto' : 'Registro por QR')
      }
    ]);
    setPendingPackageImage(data.image ?? null);
    setPendingPackageQrData(data.qrData ?? null);
    setActiveTab('packages');
    setIsNewPackageModalOpen(true);
  };
  const handleSaveNoticeChanges = async () => {
    if (!selectedNoticeForEdit) return;
    const res = await updateNotice(selectedNoticeForEdit);
    if (res.success) {
      const { data } = await getNotices();
      if (data) setAllNotices(data);
      setSelectedNoticeForEdit(null);
    } else {
      toast.error('Erro ao salvar aviso: ' + (res.error || 'Erro desconhecido'));
    }
  };
  const handleDeleteNotice = async () => {
    if (!selectedNoticeForEdit) return;
    const res = await deleteNotice(selectedNoticeForEdit.id);
    if (res.success) {
      const { data } = await getNotices();
      if (data) setAllNotices(data);
      setSelectedNoticeForEdit(null);
    } else {
      toast.error('Erro ao excluir aviso: ' + (res.error || 'Erro desconhecido'));
    }
  };

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
    // Se for morador, mostrar cadastro/login de morador imediatamente
    if (selectedRole === 'MORADOR') {
      // Pular tela de apresentação e ir direto para cadastro
      setShowLogoSplash(false);
      setShowResidentRegister(true);
      return;
    }
    
    setRole(selectedRole);
    setCurrentResident(null);
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

  const handleSaveNote = async () => {
    if (!newNoteContent.trim()) return;
    const iso = new Date().toISOString();
    if (editingNoteId) {
      const note = allNotes.find((n) => n.id === editingNoteId);
      if (!note) return;
      const res = await updateNote({ ...note, content: newNoteContent, category: newNoteCategory, scheduled: newNoteScheduled });
      if (!res.success) {
        toast.error('Erro ao atualizar nota: ' + (res.error || 'Erro desconhecido'));
        return;
      }
    } else {
      const res = await saveNote({ id: `temp-${Date.now()}`, content: newNoteContent, date: iso, completed: false, category: newNoteCategory, scheduled: newNoteScheduled });
      if (!res.success) {
        toast.error('Erro ao criar nota: ' + (res.error || 'Erro desconhecido'));
        return;
      }
    }
    const { data } = await getNotes();
    if (data) setAllNotes(data);
    setNewNoteContent(''); setNewNoteCategory('Geral'); setNewNoteScheduled(''); setIsScheduleOpen(false); setEditingNoteId(null); setIsNewNoteModalOpen(false);
  };
  const handleAddCategory = () => { if (!newCatName.trim()) return; const colors = ['bg-zinc-100', 'bg-amber-100', 'bg-red-100', 'bg-blue-100', 'bg-purple-100', 'bg-green-100']; const randomColor = colors[Math.floor(Math.random() * colors.length)]; setNoteCategories([...noteCategories, { name: newCatName.trim(), color: randomColor }]); setNewCatName(''); setIsAddingCategory(false); };
  const handleRemoveCategory = (name: string) => { if (name === 'Geral') return; setNoteCategories(noteCategories.filter(cat => cat.name !== name)); if (newNoteCategory === name) setNewNoteCategory('Geral'); };

  const handleSaveStaff = async () => {
    if (!staffFormData.name || !staffFormData.role) return;
    const staff: Staff = {
      id: (staffFormData.id && !String(staffFormData.id).startsWith('temp-') ? staffFormData.id : `temp-${Date.now()}`) as string,
      name: staffFormData.name,
      role: staffFormData.role,
      status: (staffFormData.status as 'Ativo' | 'Férias' | 'Licença') || 'Ativo',
      shift: (staffFormData.shift as 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada' | 'Comercial') || 'Comercial',
      phone: staffFormData.phone,
      email: staffFormData.email
    };
    const res = await saveStaff(staff);
    if (res.success) {
      const { data } = await getStaff();
      if (data) setAllStaff(data);
      setIsStaffModalOpen(false);
      setStaffFormData({});
    } else {
      toast.error('Erro ao salvar funcionário: ' + (res.error || 'Erro desconhecido'));
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm('Deseja desligar este colaborador do sistema?')) return;
    const res = await deleteStaff(id);
    if (res.success) {
      const { data } = await getStaff();
      if (data) setAllStaff(data);
    } else {
      toast.error('Erro ao remover funcionário: ' + (res.error || 'Erro desconhecido'));
    }
  };

  const handleImportStaff = async (staffList: Staff[]) => {
    for (let i = 0; i < staffList.length; i++) {
      const s = { ...staffList[i], id: `temp-${Date.now()}-${i}` };
      const res = await saveStaff(s);
      if (!res.success) {
        throw new Error(res.error || 'Erro desconhecido ao importar funcionário');
      }
    }
    const { data } = await getStaff();
    if (data) setAllStaff(data);
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
          setPackageSearch={setPackageSearch}
          setOccurrenceSearch={setOccurrenceSearch}
          setVisitorSearch={setVisitorSearch}
          setSelectedPackageForDetail={setSelectedPackageForDetail}
          setSelectedVisitorForDetail={setSelectedVisitorForDetail}
          setSelectedOccurrenceForDetail={setSelectedOccurrenceForDetail}
          setReservationFilter={setReservationFilter}
          setEditingNoteId={setEditingNoteId}
          setNewNoteContent={setNewNoteContent}
          setNewNoteCategory={setNewNoteCategory}
          setNewNoteScheduled={setNewNoteScheduled}
          setIsNewNoteModalOpen={setIsNewNoteModalOpen}
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
      case 'residentProfile':
        if (role === 'MORADOR' && currentResident) {
          return (
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
              <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                    Meu Perfil
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Dados do morador
                  </p>
                </div>
              </header>
              <div className="premium-glass rounded-2xl p-6 sm:p-8 border" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-color)] font-black text-xl">
                    {currentResident.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {currentResident.name}
                    </h4>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                      Unidade {currentResident.unit}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                      E-mail
                    </p>
                    <p style={{ color: 'var(--text-primary)' }}>{currentResident.email || 'Não informado'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                      Telefone
                    </p>
                    <p style={{ color: 'var(--text-primary)' }}>{currentResident.phone || 'Não informado'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                      WhatsApp
                    </p>
                    <p style={{ color: 'var(--text-primary)' }}>{currentResident.whatsapp || 'Não informado'}</p>
                  </div>
                </div>
                <p className="mt-6 text-[11px] opacity-60" style={{ color: 'var(--text-secondary)' }}>
                  Para atualizar seus dados cadastrais, entre em contato com a portaria ou síndico.
                </p>
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
            <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
              A página de perfil é exclusiva para o morador autenticado.
            </p>
          </div>
        );
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
      case 'notifications':
        if (role === 'MORADOR' && currentResident) {
          return <NotificationsView moradorId={currentResident.id} allPackages={allPackages.filter(p => p.unit === currentResident.unit)} onViewPackage={setSelectedPackageForDetail} />;
        }
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
            <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
              Esta página é de acesso exclusivo do Morador.
            </p>
          </div>
        );
      case 'packages': 
        if (role === 'MORADOR' && currentResident) {
          const myPackages = allPackages.filter(p => p.unit === currentResident.unit);
          return <PackagesView allPackages={myPackages} allResidents={[]} packageSearch={packageSearch} setPackageSearch={setPackageSearch} setIsNewPackageModalOpen={handleOpenNewPackageModal} setSelectedPackageForDetail={setSelectedPackageForDetail} onDeletePackage={handleDeletePackage} onCameraScan={undefined} />;
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
        return <PackagesView allPackages={allPackages} allResidents={allResidents} packageSearch={packageSearch} setPackageSearch={setPackageSearch} setIsNewPackageModalOpen={handleOpenNewPackageModal} setSelectedPackageForDetail={setSelectedPackageForDetail} onDeletePackage={handleDeletePackage} onCameraScan={() => setIsCameraScanModalOpen(true)} />;
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
          if (!currentResident) {
            return (
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
                <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
                  É necessário estar autenticado como morador para visualizar suas ocorrências.
                </p>
              </div>
            );
          }
          const myOccurrences = allOccurrences.filter(
            (occ) => occ.unit === currentResident.unit || occ.residentName === currentResident.name
          );
          return (
            <OccurrencesView
              allOccurrences={myOccurrences}
              occurrenceSearch={occurrenceSearch}
              setOccurrenceSearch={setOccurrenceSearch}
              setIsOccurrenceModalOpen={setIsOccurrenceModalOpen}
              handleResolveOccurrence={handleResolveOccurrence}
            />
          );
        }
        return (
          <OccurrencesView
            allOccurrences={allOccurrences}
            occurrenceSearch={occurrenceSearch}
            setOccurrenceSearch={setOccurrenceSearch}
            setIsOccurrenceModalOpen={setIsOccurrenceModalOpen}
            handleResolveOccurrence={handleResolveOccurrence}
          />
        );
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
              onImportClick={() => setIsImportStaffModalOpen(true)}
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

  let content: React.ReactNode;
  if (isScreenSaverActive) {
    content = <ScreenSaver onExit={() => setIsScreenSaverActive(false)} theme={theme} />;
  } else if (!isAuthenticated && showLogoSplash) {
    content = <LogoSplash onComplete={() => setShowLogoSplash(false)} durationMs={2200} />;
  } else if (showVideoIntro) {
    content = (
      <VideoIntro
        onComplete={() => {
          sessionStorage.setItem('hasSeenVideoIntro', 'true');
          setShowVideoIntro(false);
        }}
      />
    );
  } else if (!isAuthenticated && showResidentRegister) {
    content = (
      <ResidentRegister
        onRegister={handleResidentRegister}
        onLogin={handleResidentLogin}
        onBack={() => { setShowResidentRegister(false); setShowLogoSplash(false); }}
        theme={theme}
        toggleTheme={toggleTheme}
        existingResidents={allResidents}
      />
    );
  } else if (!isAuthenticated) {
    content = <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />;
  } else {
    content = (
      <>
        <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        role={role} 
        setRole={setRole} 
        onLogout={handleLogout} 
        theme={theme} 
        toggleTheme={toggleTheme}
        notificationCount={role === 'MORADOR' ? unreadNotificationCount : 0}
        onOpenNotifications={role === 'MORADOR' ? () => setActiveTab('notifications') : undefined}
      >
        {renderContent()}
      </Layout>
      {role === 'PORTEIRO' && <DraggableFab onClick={() => { setEditingNoteId(null); setNewNoteContent(''); setIsNewNoteModalOpen(true); }} />}
      <QuickViewModal 
        category={quickViewCategory} data={quickViewData} onClose={() => setQuickViewCategory(null)} onGoToPage={(tab) => setActiveTab(tab)}
        onMarkAsDone={async (note) => {
          const res = await updateNote({ ...note, completed: true });
          if (res.success) { const { data } = await getNotes(); if (data) setAllNotes(data); }
        }}
        onAddNew={() => { if (quickViewCategory === 'visitors') { setQuickViewCategory(null); resetVisitorModal(); setIsVisitorModalOpen(true); } }}
        onSelectItem={(item) => { 
          if (quickViewCategory === 'packages') { setSelectedPackageForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'visitors') { setSelectedVisitorForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'occurrences') { setSelectedOccurrenceForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'reservations') { setActiveTab('reservations'); setQuickViewCategory(null); }
          else if (quickViewCategory === 'notes') { setEditingNoteId(item.id); setNewNoteContent(item.content); setNewNoteCategory(item.category || 'Geral'); setNewNoteScheduled(item.scheduled || ''); setIsNewNoteModalOpen(true); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'notices') { setSelectedNoticeForEdit(item); setQuickViewCategory(null); }
        }}
      />
      
      {/* MODALS */}
      <NewReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} data={newReservationData} setData={setNewReservationData} areasStatus={areasStatus} searchQuery={reservationSearchQuery} setSearchQuery={setReservationSearchQuery} showSuggestions={showResSuggestions} setShowSuggestions={setShowResSuggestions} filteredResidents={filteredResForReservation} hasConflict={hasTimeConflict} onConfirm={handleCreateReservation} />
      <NewVisitorModal isOpen={isVisitorModalOpen} onClose={resetVisitorModal} step={newVisitorStep} setStep={setNewVisitorStep} data={newVisitorData} setData={setNewVisitorData} searchResident={searchResident} setSearchResident={setSearchResident} filteredResidents={filteredResidents} accessTypes={visitorAccessTypes} handleRemoveAccessType={handleRemoveAccessType} isAddingAccessType={isAddingAccessType} setIsAddingAccessType={setIsAddingAccessType} newAccessTypeInput={newAccessTypeInput} setNewAccessTypeInput={setNewAccessTypeInput} handleAddAccessType={handleAddAccessType} onConfirm={handleRegisterVisitor} />
      <NewPackageModal isOpen={isNewPackageModalOpen} onClose={resetPackageModal} step={packageStep} setStep={setPackageStep} searchResident={searchResident} setSearchResident={setSearchResident} selectedResident={selectedResident} setSelectedResident={setSelectedResident} filteredResidents={filteredResidents} allResidents={allResidents} residentsLoading={residentsLoading} residentsError={residentsError} onRetryResidents={() => fetchResidents(false)} packageSaving={packageSaving} pendingImage={pendingPackageImage} pendingQrData={pendingPackageQrData} packageType={packageType} setPackageType={setPackageType} packageCategories={packageCategories} isAddingPkgCategory={isAddingPkgCategory} setIsAddingPkgCategory={setIsAddingPkgCategory} newPkgCatName={newPkgCatName} setNewPkgCatName={setNewPkgCatName} handleAddPkgCategory={handleAddPkgCategory} numItems={numItems} packageItems={packageItems} handleAddItemRow={handleAddItemRow} handleRemoveItemRow={handleRemoveItemRow} updateItem={updateItem} packageMessage={packageMessage} setPackageMessage={setPackageMessage} onConfirm={handleRegisterPackageFinal} />
      <NewNoteModal isOpen={isNewNoteModalOpen} onClose={() => { setIsNewNoteModalOpen(false); setEditingNoteId(null); setIsAddingCategory(false); setIsManagingCategories(false); }} editingId={editingNoteId} categories={noteCategories} newCategory={newNoteCategory} setNewCategory={setNewNoteCategory} isManaging={isManagingCategories} setIsManaging={setIsManagingCategories} removeCategory={handleRemoveCategory} isAdding={isAddingCategory} setIsAdding={setIsAddingCategory} newCatName={newCatName} setNewCatName={setNewCatName} addCategory={handleAddCategory} content={newNoteContent} setContent={setNewNoteContent} isScheduleOpen={isScheduleOpen} setIsScheduleOpen={setIsScheduleOpen} scheduled={newNoteScheduled} setScheduled={setNewNoteScheduled} allNotes={allNotes} setAllNotes={setAllNotes} onSave={handleSaveNote} />
      <StaffFormModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} data={staffFormData} setData={setStaffFormData} onSave={handleSaveStaff} />

      <ResidentProfileModal resident={selectedResidentProfile} onClose={() => setSelectedResidentProfile(null)} onEdit={() => { handleOpenResidentModal(selectedResidentProfile); setSelectedResidentProfile(null); }} onDelete={selectedResidentProfile ? () => handleDeleteResident(selectedResidentProfile.id) : undefined} allPackages={allPackages} visitorLogs={visitorLogs} onPackageSelect={setSelectedPackageForDetail} onCheckOutVisitor={handleVisitorCheckOut} />
      <PackageDetailModal pkg={selectedPackageForDetail} onClose={() => setSelectedPackageForDetail(null)} onDeliver={handleDeliverPackage} onNotify={handleSendReminder} calculatePermanence={calculatePermanence} />
      <VisitorDetailModal visitor={selectedVisitorForDetail} onClose={() => setSelectedVisitorForDetail(null)} onCheckout={handleVisitorCheckOut} calculatePermanence={calculatePermanence} />
      <OccurrenceDetailModal occurrence={selectedOccurrenceForDetail} onClose={() => setSelectedOccurrenceForDetail(null)} onSave={handleSaveOccurrenceDetails} setOccurrence={setSelectedOccurrenceForDetail} />
      <ResidentFormModal 
        isOpen={isResidentModalOpen} 
        onClose={() => {
          setIsResidentModalOpen(false);
          setResidentPassword(null);
        }} 
        data={residentFormData} 
        setData={setResidentFormData} 
        onSave={handleSaveResident}
        role={role}
        residentPassword={residentPassword}
      />
      <ImportResidentsModal isOpen={isImportResidentsModalOpen} onClose={() => setIsImportResidentsModalOpen(false)} onImport={handleImportResidents} existingResidents={allResidents} />
      <ImportBoletosModal isOpen={isImportBoletosModalOpen} onClose={() => setIsImportBoletosModalOpen(false)} onImport={handleImportBoletos} existingBoletos={allBoletos} allResidents={allResidents} />
      <CameraScanModal isOpen={isCameraScanModalOpen} onClose={() => setIsCameraScanModalOpen(false)} onScanSuccess={handleCameraScanSuccess} allResidents={allResidents} />
      <ImportStaffModal isOpen={isImportStaffModalOpen} onClose={() => setIsImportStaffModalOpen(false)} onImport={handleImportStaff} existingStaff={allStaff} />
      <NewOccurrenceModal isOpen={isOccurrenceModalOpen} onClose={() => setIsOccurrenceModalOpen(false)} description={occurrenceDescription} setDescription={setOccurrenceDescription} onSave={async () => {
        if (!occurrenceDescription.trim()) {
          toast.error('Por favor, descreva a ocorrência');
          return;
        }
        
        const newOccurrence: Occurrence = {
          id: `temp-${Date.now()}`,
          residentName: role === 'MORADOR' && currentResident ? currentResident.name : 'Sistema',
          unit: role === 'MORADOR' && currentResident ? currentResident.unit : 'N/A',
          description: occurrenceDescription,
          status: 'Aberto',
          date: new Date().toISOString(),
          reportedBy: role === 'PORTEIRO' ? 'Porteiro' : role === 'SINDICO' ? 'Síndico' : 'Morador'
        };
        
        const result = await saveOccurrence(newOccurrence);
        if (result.success) {
          const { data } = await getOccurrences();
          if (data) setAllOccurrences(data);
          setOccurrenceDescription('');
          setIsOccurrenceModalOpen(false);
        } else {
          console.error('Erro ao salvar ocorrência:', result.error);
          toast.error('Erro ao registrar ocorrência: ' + (result.error || 'Erro desconhecido'));
        }
      }} />
      <NoticeEditModal notice={selectedNoticeForEdit} onClose={() => setSelectedNoticeForEdit(null)} onChange={setSelectedNoticeForEdit} onSave={handleSaveNoticeChanges} onDelete={handleDeleteNotice} />
      </>
    );
  }

  return (
    <>
      {isSupabasePlaceholder && (
        <div className="fixed top-0 left-0 right-0 z-[9999] px-4 py-2 bg-amber-600 text-white text-center text-xs font-bold uppercase tracking-wider shadow-lg">
          Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local ou Vercel.
        </div>
      )}
      {content}
    </>
  );
};

export default App;
