
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, Volume2, VolumeX, Eye, EyeOff, Lock, X, Sun } from 'lucide-react';
import Layout from './components/Layout';
import Login from './components/Login';
import ResidentRegister from './components/ResidentRegister';
import ScreenSaver from './components/ScreenSaver';
import { UserRole, Package, Resident, VisitorLog, PackageItem, Occurrence, Notice, ChatMessage, QuickViewCategory, Staff, Boleto, Notification } from './types';
import SentinelaConciergeApp from './sentinela/App';
import type { OccurrenceItem } from './sentinela/types';

// Components
import RecentEventsBar from './components/RecentEventsBar';
import QuickViewModal from './components/QuickViewModal';

// Views
import DashboardView from './components/views/DashboardView';
import SindicoDashboardView from './components/views/SindicoDashboardView'; // Nova Importação
import NoticesView from './components/views/NoticesView';
import ReservationsView from './components/views/ReservationsView';
import VisitorsView from './components/views/VisitorsView';
import PackagesView from './components/views/PackagesView';
import ResidentsView from './components/views/ResidentsView';
import OccurrencesView from './components/views/OccurrencesView';
import StaffView from './components/views/StaffView';
import SettingsView from './components/views/SettingsView';
import BoletosView from './components/views/BoletosView';
import MoradorDashboardView from './components/views/MoradorDashboardView';
import NotificationsView from './components/views/NotificationsView';

// Contexts
import { useAppConfig } from './contexts/AppConfigContext';
import { useToast } from './contexts/ToastContext';
import { ConnectivityProvider } from './contexts/ConnectivityContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Utils
import { normalizeUnit, compareUnits } from './utils/unitFormatter';
import { openWhatsApp } from './utils/phoneNormalizer';

// Services
import {
  getResidents, getPackages, savePackage, updatePackage, deletePackage,
  saveResident, deleteResident,
  getVisitors, saveVisitor, updateVisitor,
  getOccurrences, saveOccurrence, updateOccurrence, deleteOccurrence,
  getBoletos, saveBoleto, updateBoleto, deleteBoleto,
  getNotices, saveNotice, updateNotice, deleteNotice,
  getChatMessages, getChatMessagesFromServer, saveChatMessage, deleteAllChatMessages,
  getStaff, saveStaff, deleteStaff, getPorteiroLoginInfo,
  getAreas, getReservations, saveReservation, updateReservation
} from './services/dataService';
import { getNotifications, deleteNotification, markNotificationAsRead, markAllNotificationsAsRead } from './services/notificationService';
import { supabase, isSupabasePlaceholder } from './services/supabase';

// Modals
import { NewReservationModal, NewVisitorModal, NewPackageModal, StaffFormModal, type StaffFormData } from './components/modals/ActionModals';
import { ResidentProfileModal, PackageDetailModal, VisitorDetailModal, OccurrenceDetailModal, ResidentFormModal, NewOccurrenceModal, NoticeEditModal } from './components/modals/DetailModals';
import ImportResidentsModal from './components/modals/ImportResidentsModal';
import ImportBoletosModal from './components/modals/ImportBoletosModal';
import ImportPackagesModal from './components/modals/ImportPackagesModal';
import CameraScanModal from './components/modals/CameraScanModal';
import ImportStaffModal from './components/modals/ImportStaffModal';

// Services
import { registerResident, loginResident, updateResidentPassword } from './services/residentAuth';
import { checkUserSession, User as AdminUser, updateUserProfile, changeUserPassword, changeUsername } from './services/userAuth';

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole>('PORTEIRO');
  const [currentResident, setCurrentResident] = useState<Resident | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [residentAvatar, setResidentAvatar] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isScreenSaverActive, setIsScreenSaverActive] = useState(false);
  const [showResidentRegister, setShowResidentRegister] = useState(false);
  // Controle de áudio do vídeo (legacy – mantido por compatibilidade, mesmo sem vídeo)
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);

  // Carregar dados do usuário administrador (síndico/porteiro) e avatar local
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentAdminUser(null);
      setAdminAvatar(null);
      setResidentAvatar(null);
      return;
    }

    const user = checkUserSession();
    setCurrentAdminUser(user);

    if (user) {
      try {
        const stored = localStorage.getItem(`admin_avatar_${user.id}`);
        if (stored) {
          setAdminAvatar(stored);
        } else {
          setAdminAvatar(null);
        }
      } catch {
        setAdminAvatar(null);
      }
    }
  }, [isAuthenticated, role]);

  const handleAdminAvatarChange = (file: File | null) => {
    if (!file || !currentAdminUser) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;
      setAdminAvatar(dataUrl);
      try {
        localStorage.setItem(`admin_avatar_${currentAdminUser.id}`, dataUrl);
      } catch (err) {
        console.warn('Falha ao salvar avatar do administrador localmente:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Carregar avatar do morador autenticado (perfil "Meu Perfil")
  useEffect(() => {
    if (!currentResident) {
      setResidentAvatar(null);
      return;
    }
    try {
      const stored = localStorage.getItem(`resident_avatar_${currentResident.id}`);
      setResidentAvatar(stored || null);
    } catch {
      setResidentAvatar(null);
    }
  }, [currentResident]);

  const handleResidentAvatarChange = (file: File | null) => {
    if (!file || !currentResident) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;
      setResidentAvatar(dataUrl);
      try {
        localStorage.setItem(`resident_avatar_${currentResident.id}`, dataUrl);
      } catch (err) {
        console.warn('Falha ao salvar avatar do morador localmente:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Estados para edição de perfil
  const [isEditingAdminProfile, setIsEditingAdminProfile] = useState(false);
  const [adminProfileData, setAdminProfileData] = useState({ name: '', email: '', phone: '' });
  const [adminProfilePasswordData, setAdminProfilePasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showAdminProfilePasswords, setShowAdminProfilePasswords] = useState({ current: false, new: false, confirm: false });
  const [adminPasswordData, setAdminPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [adminUsernameData, setAdminUsernameData] = useState({ currentPassword: '', newUsername: '', confirmUsername: '' });
  const [isAdminCredentialsModalOpen, setIsAdminCredentialsModalOpen] = useState(false);
  const [isEditingResidentProfile, setIsEditingResidentProfile] = useState(false);
  const [residentProfileData, setResidentProfileData] = useState({
    email: '',
    phone: '',
    whatsapp: '',
    vehiclePlate: '',
    vehicleModel: '',
    vehicleColor: ''
  });
  const [residentPasswordData, setResidentPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [isChangingResidentPassword, setIsChangingResidentPassword] = useState(false);
  // Estados para visibilidade de senhas (olhinho)
  const [showResidentPasswords, setShowResidentPasswords] = useState({ current: false, new: false, confirm: false });
  const [showAdminPasswords, setShowAdminPasswords] = useState({ current: false, new: false, confirm: false });
  const [showFirstLoginChangePasswordModal, setShowFirstLoginChangePasswordModal] = useState(false);
  const [firstLoginPasswordData, setFirstLoginPasswordData] = useState({ new: '', confirm: '' });

  // Handlers para perfil do síndico/porteiro
  const handleStartEditAdminProfile = () => {
    if (currentAdminUser) {
      setAdminProfileData({
        name: currentAdminUser.name || '',
        email: currentAdminUser.email || '',
        phone: currentAdminUser.phone || ''
      });
      setAdminProfilePasswordData({ current: '', new: '', confirm: '' });
      setShowAdminProfilePasswords({ current: false, new: false, confirm: false });
      setIsEditingAdminProfile(true);
    }
  };

  const handleSaveAdminProfile = async () => {
    if (!currentAdminUser) return;
    const result = await updateUserProfile(currentAdminUser.id, adminProfileData);
    if (result.success && result.user) {
      setCurrentAdminUser(result.user);
      const pwdNew = adminProfilePasswordData.new.trim();
      const pwdConfirm = adminProfilePasswordData.confirm.trim();
      if (pwdNew || pwdConfirm) {
        if (pwdNew !== pwdConfirm) {
          toast.error('As senhas não coincidem');
          return;
        }
        if (pwdNew.length < 6 || pwdNew.length > 32 || !/^[A-Za-z0-9]+$/.test(pwdNew) || !/[A-Za-z]/.test(pwdNew) || !/[0-9]/.test(pwdNew)) {
          toast.error('A nova senha deve ter 6 caracteres, apenas letras e números. O sistema diferencia maiúsculas de minúsculas.');
          return;
        }
        if (!adminProfilePasswordData.current.trim()) {
          toast.error('Informe a senha atual para alterar a senha');
          return;
        }
        const pwdResult = await changeUserPassword(
          currentAdminUser.username,
          adminProfilePasswordData.current.trim(),
          adminProfilePasswordData.new.trim()
        );
        if (pwdResult.success) {
          setAdminProfilePasswordData({ current: '', new: '', confirm: '' });
          setShowAdminProfilePasswords({ current: false, new: false, confirm: false });
          toast.success('Senha alterada com sucesso!');
        } else {
          toast.error(pwdResult.error || 'Erro ao alterar senha');
          return;
        }
      }
      setIsEditingAdminProfile(false);
      setAdminProfileData({ name: '', email: '', phone: '' });
      toast.success('Perfil atualizado com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao atualizar perfil');
    }
  };

  const handleChangeAdminPassword = async () => {
    if (!currentAdminUser) return;
    if (adminPasswordData.new !== adminPasswordData.confirm) {
      toast.error('As senhas não coincidem');
      return;
    }
    const pwd = adminPasswordData.new.trim();
    if (pwd.length < 6 || pwd.length > 32 || !/^[A-Za-z0-9]+$/.test(pwd) || !/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      toast.error('A nova senha deve ter 6 caracteres, apenas letras e números. O sistema diferencia maiúsculas de minúsculas.');
      return;
    }
    const result = await changeUserPassword(
      currentAdminUser.username,
      adminPasswordData.current,
      adminPasswordData.new
    );
    if (result.success) {
      setAdminPasswordData({ current: '', new: '', confirm: '' });
      setShowAdminPasswords({ current: false, new: false, confirm: false });
      setIsAdminCredentialsModalOpen(false);
      toast.success('Senha alterada com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao alterar senha');
    }
  };

  const handleChangeAdminUsername = async () => {
    if (!currentAdminUser) return;
    if (adminUsernameData.newUsername.trim().toLowerCase() !== adminUsernameData.confirmUsername.trim().toLowerCase()) {
      toast.error('Os usuários não coincidem');
      return;
    }
    if (adminUsernameData.newUsername.trim().length < 3) {
      toast.error('O novo usuário deve ter pelo menos 3 caracteres');
      return;
    }
    const result = await changeUsername(
      currentAdminUser.id,
      currentAdminUser.username,
      adminUsernameData.currentPassword,
      adminUsernameData.newUsername.trim()
    );
    if (result.success && result.user) {
      setCurrentAdminUser(result.user);
      setAdminUsernameData({ currentPassword: '', newUsername: '', confirmUsername: '' });
      setIsAdminCredentialsModalOpen(false);
      toast.success('Usuário de login alterado com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao alterar usuário');
    }
  };

  const closeAdminCredentialsModal = () => {
    setIsAdminCredentialsModalOpen(false);
    setAdminUsernameData({ currentPassword: '', newUsername: '', confirmUsername: '' });
    setAdminPasswordData({ current: '', new: '', confirm: '' });
    setShowAdminPasswords({ current: false, new: false, confirm: false });
  };

  const handleFirstLoginChangePassword = async () => {
    if (!currentAdminUser) return;
    if (firstLoginPasswordData.new !== firstLoginPasswordData.confirm) {
      toast.error('As senhas não coincidem');
      return;
    }
    const pwdFirst = firstLoginPasswordData.new.trim();
    if (pwdFirst.length < 6 || pwdFirst.length > 32 || !/^[A-Za-z0-9]+$/.test(pwdFirst) || !/[A-Za-z]/.test(pwdFirst) || !/[0-9]/.test(pwdFirst)) {
      toast.error('A nova senha deve ter 6 caracteres, apenas letras e números. O sistema diferencia maiúsculas de minúsculas.');
      return;
    }
    const result = await changeUserPassword(
      currentAdminUser.username,
      '123456',
      pwdFirst,
      { storePlain: true }
    );
    if (result.success) {
      setShowFirstLoginChangePasswordModal(false);
      setFirstLoginPasswordData({ new: '', confirm: '' });
      toast.success('Senha definida com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao alterar senha');
    }
  };

  // Handlers para perfil do morador
  const handleStartEditResidentProfile = () => {
    if (currentResident) {
      setResidentProfileData({
        email: currentResident.email || '',
        phone: currentResident.phone || '',
        whatsapp: currentResident.whatsapp || '',
        vehiclePlate: currentResident.vehiclePlate || '',
        vehicleModel: currentResident.vehicleModel || '',
        vehicleColor: currentResident.vehicleColor || ''
      });
      setIsEditingResidentProfile(true);
    }
  };

  const handleSaveResidentProfile = async () => {
    if (!currentResident) return;
    const updatedResident: Resident = {
      ...currentResident,
      email: residentProfileData.email,
      phone: residentProfileData.phone,
      whatsapp: residentProfileData.whatsapp,
      vehiclePlate: residentProfileData.vehiclePlate,
      vehicleModel: residentProfileData.vehicleModel,
      vehicleColor: residentProfileData.vehicleColor
    };
    const result = await saveResident(updatedResident);
    if (result.success) {
      setCurrentResident(updatedResident);
      setIsEditingResidentProfile(false);
      toast.success('Perfil atualizado com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao atualizar perfil');
    }
  };

  const handleChangeResidentPassword = async () => {
    if (!currentResident) return;
    if (residentPasswordData.new !== residentPasswordData.confirm) {
      toast.error('As senhas não coincidem');
      return;
    }
    const pwdRes = residentPasswordData.new.trim();
    if (pwdRes.length < 6 || pwdRes.length > 32 || !/^[A-Za-z0-9]+$/.test(pwdRes) || !/[A-Za-z]/.test(pwdRes) || !/[0-9]/.test(pwdRes)) {
      toast.error('A nova senha deve ter 6 caracteres, apenas letras e números. O sistema diferencia maiúsculas de minúsculas.');
      return;
    }
    // Validar senha atual
    const loginResult = await loginResident(currentResident.unit, residentPasswordData.current);
    if (!loginResult.success) {
      toast.error('Senha atual incorreta');
      return;
    }
    const result = await updateResidentPassword(currentResident.id, pwdRes);
    if (result.success) {
      setIsChangingResidentPassword(false);
      setResidentPasswordData({ current: '', new: '', confirm: '' });
      toast.success('Senha alterada com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao alterar senha');
    }
  };
  
  // Link ?morador=true ou ?resident=true: apenas preseleciona perfil Morador no Login (cadastro só por "Criar conta")
  // (não abre mais ResidentRegister automaticamente)

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
    // Se for morador, filtrar visitantes apenas da sua unidade
    const unitFilter = role === 'MORADOR' && currentResident ? currentResident.unit : undefined;
    getVisitors(unitFilter).then((res) => { if (!cancelled && res.data) setVisitorLogs(res.data); });
    getOccurrences().then((res) => { if (!cancelled && res.data) setAllOccurrences(res.data); });
    getBoletos().then((res) => { if (!cancelled && res.data) setAllBoletos(res.data); });
    return () => { cancelled = true; };
  }, [isAuthenticated, role, currentResident]);

  // Carregar avisos, chat, staff do Supabase
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getNotices((data) => { if (!cancelled && data) setAllNotices(data); }).then((res) => {
      if (!cancelled && res.data) setAllNotices(res.data);
    });
    getChatMessages().then((res) => {
      if (!cancelled && res.data) {
        const sessionStart = chatSessionStartRef.current;
        const visible = sessionStart
          ? res.data.filter((m: ChatMessage) => m.timestamp >= sessionStart)
          : res.data;
        setChatMessages(visible);
      }
    });
    getStaff().then((res) => { if (!cancelled && res.data) setAllStaff(res.data); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Realtime simples para o chat "Linha Direta"
  // Sempre que qualquer mensagem nova for inserida em chat_messages,
  // recarregamos a lista e aplicamos o filtro por sessão atual.
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('chat-messages-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async () => {
          const res = await getChatMessagesFromServer();
          if (res.data) {
            const sessionStart = chatSessionStartRef.current;
            const visible = sessionStart
              ? res.data.filter((m: ChatMessage) => m.timestamp >= sessionStart)
              : res.data;
            setChatMessages(visible);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] Chat conectado');
        if (status === 'CHANNEL_ERROR') console.warn('[Realtime] Chat: erro no canal');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Refetch avisos e chat ao abrir o Mural (garante visibilidade e mensagens atualizadas)
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'notices') return;
    getNotices((data) => setAllNotices(data || [])).then((res) => {
      if (res.data) setAllNotices(res.data);
    });
    getChatMessagesFromServer().then((res) => {
      if (res.data) {
        const sessionStart = chatSessionStartRef.current;
        const visible = sessionStart
          ? res.data.filter((m: ChatMessage) => m.timestamp >= sessionStart)
          : res.data;
        setChatMessages(visible);
      }
    });
  }, [isAuthenticated, activeTab]);

  const [allOccurrences, setAllOccurrences] = useState<Occurrence[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [allBoletos, setAllBoletos] = useState<Boleto[]>([]);
  const [boletoSearch, setBoletoSearch] = useState('');

  // Estado de notificações (fonte única de verdade; evita reidratação ao voltar na aba)
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const recentlyDeletedNotificationIds = useRef<Set<string>>(new Set());
  const recentlyMarkedAsReadIds = useRef<Set<string>>(new Set());

  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffFormData, setStaffFormData] = useState<StaffFormData>({});
  const [isImportStaffModalOpen, setIsImportStaffModalOpen] = useState(false);

  const [noticeFilter, setNoticeFilter] = useState<'all' | 'urgent' | 'unread'>('all');
  const [activeNoticeTab, setActiveNoticeTab] = useState<'wall' | 'chat'>('wall');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // === LINHA DIRETA (CHAT GLOBAL) ===
  // Registra o início da sessão de chat para que o histórico
  // antigo (mensagens de testes ou de outras sessões) NÃO apareça.
  // Assim, o modal abre sempre "vazio" e só mostra mensagens
  // trocadas a partir do login atual.
  const chatSessionStartRef = useRef<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sempre que o usuário autenticar, marcamos o início da sessão
  // de chat. Ao deslogar, limpamos o estado e o marcador.
  useEffect(() => {
    if (isAuthenticated) {
      if (!chatSessionStartRef.current) {
        chatSessionStartRef.current = new Date().toISOString();
      }
    } else {
      chatSessionStartRef.current = null;
      setChatMessages([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'notices' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isChatOpen]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');

    const nowIso = new Date().toISOString();
    // Garante que sempre temos um "marco" de início da sessão,
    // mesmo que o usuário tenha acabado de logar e a ref ainda
    // não tenha sido inicializada pelo efeito.
    if (!chatSessionStartRef.current) {
      chatSessionStartRef.current = nowIso;
    }

    const newMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      text,
      senderRole: role,
      timestamp: nowIso,
      read: false
    };

    const res = await saveChatMessage(newMsg);
    if (res.success) {
      const { data } = await getChatMessagesFromServer();
      if (data) {
        const sessionStart = chatSessionStartRef.current;
        const visible = sessionStart
          ? data.filter(m => m.timestamp >= sessionStart)
          : data;
        setChatMessages(visible);
      }
    } else {
      // Em caso de erro, devolve o texto para o input
      setChatInput(text);
      console.error('Erro ao enviar mensagem:', res.error);
    }
  };

  const handleRefreshChatMessages = useCallback(async () => {
    const res = await getChatMessagesFromServer();
    if (res.data) {
      const sessionStart = chatSessionStartRef.current;
      const visible = sessionStart
        ? res.data.filter((m: ChatMessage) => m.timestamp >= sessionStart)
        : res.data;
      setChatMessages(visible);
    }
  }, []);

  const handleClearChatMessages = useCallback(async () => {
    if (!window.confirm('Apagar todas as mensagens do chat? Esta ação não pode ser desfeita.')) return;
    const res = await deleteAllChatMessages();
    if (res.success) {
      setChatMessages([]);
    } else {
      console.error('Erro ao apagar mensagens:', res.error);
    }
  }, []);

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
      hasNewNotice: allNotices.some(n => isWithin(n.date, 1440))
    };
  }, [allPackages, visitorLogs, allOccurrences, allNotices, dayReservations]);

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
      case 'notices': return allNotices.slice(0, 3);
      default: return [];
    }
  }, [quickViewCategory, allPackages, visitorLogs, allOccurrences, allNotices, dayReservations]);

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
  const [isImportPackagesModalOpen, setIsImportPackagesModalOpen] = useState(false);
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
      reservations: dayReservations.filter(r => resFilter(r)).slice(0, 4)
    };
  }, [globalSearchQuery, allResidents, allPackages, visitorLogs, allOccurrences, dayReservations]);

  const hasAnyGlobalResult = useMemo(() => {
    if (!globalResults) return false;
    return (globalResults.residents.length > 0 || globalResults.packages.length > 0 || globalResults.visitors.length > 0 || globalResults.occurrences.length > 0 || globalResults.reservations.length > 0);
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

  // Recarregar pacotes e notificações quando morador acessa a aba de notificações (fallback se Realtime não entregar)
  useEffect(() => {
    if (!isAuthenticated || role !== 'MORADOR' || activeTab !== 'notifications' || !currentResident) return;
    
    const loadPackages = async () => {
      const result = await getPackages();
      if (result.data) setAllPackages(result.data);
    };
    const loadNotifications = async () => {
      const result = await getNotifications(currentResident.id);
      if (result.data) {
        setAllNotifications(result.data);
        setUnreadNotificationCount(result.data.filter(n => !n.read).length);
      }
    };
    loadPackages();
    loadNotifications();
  }, [isAuthenticated, role, activeTab, currentResident]);

  // Carregar notificações e pacotes quando morador estiver autenticado (e ao abrir dashboard para manter cards em sync com o badge)
  useEffect(() => {
    if (!isAuthenticated || role !== 'MORADOR' || !currentResident) return;

    const loadNotifications = async () => {
      setNotificationsLoading(true);
      const result = await getNotifications(currentResident.id);
      if (result.data) {
        setAllNotifications(result.data);
        setUnreadNotificationCount(result.data.filter(n => !n.read).length);
      }
      setNotificationsLoading(false);
    };

    const loadPackages = async () => {
      const result = await getPackages();
      if (result.data) setAllPackages(result.data);
    };

    loadNotifications();
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
            image_url: payload.new.image_url ?? undefined,
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
          toast.success(newNotification.title || 'Nova notificação');
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
          const id = payload.new?.id;
          const nowRead = payload.new?.read === true;
          if (recentlyMarkedAsReadIds.current.has(id)) return;
          let shouldDecrement = false;
          setAllNotifications(prev => {
            const n = prev.find(x => x.id === id);
            shouldDecrement = Boolean(n && !n.read && nowRead);
            return prev.map(x => x.id === id ? { ...x, read: nowRead || false } : x);
          });
          if (shouldDecrement) {
            queueMicrotask(() => setUnreadNotificationCount(c => Math.max(0, c - 1)));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `morador_id=eq.${currentResident.id}`
        },
        (payload) => {
          const id = (payload as { old?: { id?: string } }).old?.id;
          if (!id) return;
          if (recentlyDeletedNotificationIds.current.has(id)) {
            recentlyDeletedNotificationIds.current.delete(id);
            return;
          }
          const wasUnread = (payload as { old?: { read?: boolean } }).old?.read === false;
          setAllNotifications(prev => prev.filter(n => n.id !== id));
          if (wasUnread) {
            setUnreadNotificationCount(prev => Math.max(0, prev - 1));
          }
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

  // Refetch notificações quando o morador volta à aba/janela do app (fallback se Realtime não entregar)
  useEffect(() => {
    if (!isAuthenticated || role !== 'MORADOR' || !currentResident) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      getNotifications(currentResident.id).then((result) => {
        if (result.data) {
          setAllNotifications(result.data);
          setUnreadNotificationCount(result.data.filter(n => !n.read).length);
        }
      });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isAuthenticated, role, currentResident]);

  // Refetch pacotes e notificações quando morador abre o dashboard (mantém cards e badge em sync)
  useEffect(() => {
    if (!isAuthenticated || role !== 'MORADOR' || !currentResident || activeTab !== 'dashboard') return;
    getPackages().then((res) => { if (res.data) setAllPackages(res.data); });
    getNotifications(currentResident.id).then((result) => {
      if (result.data) {
        setAllNotifications(result.data);
        setUnreadNotificationCount(result.data.filter(n => !n.read).length);
      }
    });
  }, [isAuthenticated, role, currentResident, activeTab]);

  const handleDeleteNotification = useCallback(async (notificationId: string) => {
    const result = await deleteNotification(notificationId);
    if (!result.success) {
      toast.error('Erro ao excluir notificação: ' + (result.error || 'Erro desconhecido'));
      return;
    }
    const notification = allNotifications.find(n => n.id === notificationId);
    const wasUnread = notification?.read === false;
    recentlyDeletedNotificationIds.current.add(notificationId);
    setTimeout(() => recentlyDeletedNotificationIds.current.delete(notificationId), 5000);
    setAllNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (wasUnread) {
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    }
  }, [allNotifications, toast]);

  const handleMarkNotificationAsRead = useCallback(async (notificationId: string) => {
    const result = await markNotificationAsRead(notificationId);
    if (result.success) {
      recentlyMarkedAsReadIds.current.add(notificationId);
      setTimeout(() => recentlyMarkedAsReadIds.current.delete(notificationId), 5000);
      setAllNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const handleMarkAllNotificationsAsRead = useCallback(async () => {
    if (!currentResident) return;
    const result = await markAllNotificationsAsRead(currentResident.id);
    if (result.success) {
      setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotificationCount(0);
    }
  }, [currentResident]);

  const handleVisitorCheckOut = async (id: string) => {
    const visitor = visitorLogs.find((v) => v.id === id);
    if (!visitor) return;
    const updatedVisitor = { ...visitor, status: 'completed' as const, exitTime: new Date().toISOString() };
    const result = await updateVisitor(updatedVisitor);
    if (result.success) {
      const unitFilter = role === 'MORADOR' && currentResident ? currentResident.unit : undefined;
      const { data } = await getVisitors(unitFilter);
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
      const unitFilter = role === 'MORADOR' && currentResident ? currentResident.unit : undefined;
      const { data } = await getVisitors(unitFilter);
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
      // Obter nome do porteiro para identificar quem recebeu a encomenda
      const porteiroName = currentAdminUser?.name || currentAdminUser?.username || 'Porteiro';
      
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
        qrCodeData: pendingPackageQrData ?? null,
        receivedByName: porteiroName
      };

      const result = await savePackage(newPkg);
      if (result.success && result.id) {
        const savedId = result.id;
        // Recarregar pacotes para garantir histórico completo (evitar substituição indevida)
        const packagesResult = await getPackages();
        let nextList = packagesResult.data ?? [];
        const alreadyIncludes = nextList.some((p) => p.id === savedId);
        if (!alreadyIncludes) {
          const merged: Package = { ...newPkg, id: savedId };
          nextList = [merged, ...nextList];
        }
        setAllPackages(nextList);
        
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
    
    // Verificar se é morador tentando dar baixa em encomenda que não é dele
    if (role === 'MORADOR' && currentResident) {
      // Morador só pode dar baixa em encomendas da sua unidade
      if (pkg.unit !== currentResident.unit) {
        toast.error('Você só pode dar baixa em encomendas da sua unidade.');
        return;
      }
    }
    
    // Determinar quem está dando a baixa
    let deliveredBy: string | null = null;
    if (role === 'MORADOR' && currentResident) {
      // Se for morador, usar o recipient_id (ID do morador)
      deliveredBy = pkg.recipientId || currentResident.id;
    } else if (role === 'PORTEIRO' || role === 'SINDICO') {
      // Se for porteiro/síndico, usar o ID do usuário admin
      deliveredBy = currentAdminUser?.id || null;
    }
    
    const updatedPkg = { ...pkg, status: 'Entregue' as const };
    const result = await updatePackage(updatedPkg, deliveredBy);
    
    if (result.success) {
      setAllPackages(prev => prev.map(p => p.id === id ? updatedPkg : p));
      setSelectedPackageForDetail(null);
      toast.success('Encomenda marcada como entregue com sucesso!');
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
  const handleDeleteOccurrence = async (id: string) => {
    const occurrence = allOccurrences.find((occ) => occ.id === id);
    if (!occurrence) return;
    
    // Confirmar exclusão apenas se não estiver resolvida (segurança extra)
    if (occurrence.status !== 'Resolvido') {
      toast.error('Apenas ocorrências resolvidas podem ser excluídas');
      return;
    }
    
    const result = await deleteOccurrence(id);
    if (result.success) {
      setAllOccurrences(prev => prev.filter(occ => occ.id !== id));
      setSelectedOccurrenceForDetail(prev => (prev?.id === id ? null : prev));
      toast.success('Ocorrência excluída com sucesso');
    } else {
      console.error('Erro ao excluir ocorrência:', result.error);
      toast.error('Erro ao excluir ocorrência: ' + (result.error || 'Erro desconhecido'));
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
    const isNew = (residentFormData.id || '').startsWith('temp-') || !residentFormData.id;
    if (isNew && (!residentFormData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(residentFormData.email))) {
      toast.error('E-mail válido obrigatório para novo morador (necessário para login e recuperação de senha).');
      return;
    }
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
    
    // Salvar no Supabase (senha padrão 123456 para novo; morador pode trocar via Esqueci minha senha)
    const result = await saveResident(resident, isNew ? { passwordPlain: '123456' } : undefined);
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
      const res = await saveResident(r, { passwordPlain: '123456' });
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
  const handleImportPackages = async (packagesToImport: Package[]) => {
    for (const p of packagesToImport) {
      const pkg: Package = {
        ...p,
        id: '', // novo registro
        recipient: p.recipient,
        unit: p.unit,
        type: p.type || 'Outros',
        receivedAt: p.receivedAt || new Date().toISOString(),
        displayTime: p.displayTime || new Date(p.receivedAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: p.status || 'Pendente',
        deadlineMinutes: p.deadlineMinutes ?? 45,
        items: p.items
      };
      const res = await savePackage(pkg);
      if (!res.success) {
        toast.error(`Erro ao importar "${p.recipient}": ${res.error || 'Erro desconhecido'}`);
        throw new Error(res.error);
      }
    }
    const { data } = await getPackages();
    if (data) setAllPackages(data);
    toast.success(`${packagesToImport.length} encomenda(s) importada(s).`);
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
    const isNew = !selectedNoticeForEdit.id;
    const res = isNew
      ? await saveNotice(selectedNoticeForEdit as Notice)
      : await updateNotice(selectedNoticeForEdit);
    if (res.success) {
      const { data } = await getNotices();
      if (data) setAllNotices(data);
      setSelectedNoticeForEdit(null);
      if (isNew) toast.success('Aviso criado.');
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
  const handleDeleteNoticeById = async (id: string) => {
    const res = await deleteNotice(id);
    if (res.success) {
      const { data } = await getNotices();
      if (data) setAllNotices(data);
      setSelectedNoticeForEdit((prev) => (prev?.id === id ? null : prev));
    } else {
      toast.error('Erro ao excluir aviso: ' + (res.error || 'Erro desconhecido'));
    }
  };
  const createDraftNotice = (): Notice => ({
    id: '',
    title: '',
    content: '',
    author: currentAdminUser?.name || currentAdminUser?.username || (role === 'SINDICO' ? 'Síndico' : 'Portaria'),
    authorRole: role,
    date: new Date().toISOString(),
    category: undefined,
    priority: 'normal',
    pinned: false,
    read: false,
    imageUrl: undefined
  });

  /** Resolve morador a partir de involvedParties e, se necessário, título/descrição (para notificar o morador na encomenda por voz). */
  const resolveResidentFromVoiceEvent = useCallback((item: { involvedParties?: string; title?: string; description?: string }): Resident | null => {
    if (!allResidents.length) return null;
    const parts = [item.involvedParties, item.title, item.description].filter(Boolean).join(' ');
    if (!parts.trim()) return null;

    const tryFind = (search: string): Resident | null => {
      if (!search?.trim()) return null;
      const q = search.trim().toLowerCase();
      const byUnit = allResidents.find((r) => r.unit.toLowerCase() === q || r.unit.toLowerCase().includes(q));
      if (byUnit) return byUnit;
      const byName = allResidents.find((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase()));
      return byName || null;
    };

    if (item.involvedParties?.trim()) {
      const r = tryFind(item.involvedParties);
      if (r) return r;
    }
    if (item.title?.trim()) {
      const r = tryFind(item.title);
      if (r) return r;
    }
    const combined = parts.trim().toLowerCase();
    const byUnitInText = allResidents.find((r) => combined.includes(r.unit.toLowerCase()));
    if (byUnitInText) return byUnitInText;
    const byNameInText = allResidents.find((r) => combined.includes(r.name.toLowerCase()));
    if (byNameInText) return byNameInText;
    const numMatch = combined.match(/\b(\d{2,4})\b/);
    if (numMatch) {
      const possibleUnit = numMatch[1];
      const byNum = allResidents.find((r) => r.unit === possibleUnit || r.unit.endsWith(possibleUnit) || r.unit.includes(possibleUnit));
      if (byNum) return byNum;
    }
    return null;
  }, [allResidents]);

  /** Persiste no backend e notifica o morador quando o assistente de voz (ou chat) regista encomenda, ocorrência ou aviso. */
  const handleVoiceEventPersist = useCallback(async (item: OccurrenceItem) => {
    const reporterName = currentAdminUser?.name || currentAdminUser?.username || (role === 'SINDICO' ? 'Síndico' : 'Portaria');
    const resident = resolveResidentFromVoiceEvent({ involvedParties: item.involvedParties, title: item.title, description: item.description });

    try {
      if (item.type === 'Encomenda') {
        const newPkg: Package = {
          id: `temp-${Date.now()}`,
          recipient: resident?.name ?? (item.involvedParties || 'A confirmar'),
          unit: resident?.unit ?? (item.involvedParties || '—'),
          type: item.title || 'Encomenda',
          receivedAt: new Date().toISOString(),
          displayTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'Pendente',
          deadlineMinutes: 45,
          recipientId: resident?.id ?? undefined,
          receivedByName: reporterName
        };
        const result = await savePackage(newPkg);
        if (result.success) {
          const { data } = await getPackages();
          if (data) setAllPackages(data);
          if (resident?.id) {
            toast.success('Encomenda registrada por voz. O morador foi notificado.');
          } else {
            toast.info('Encomenda registrada por voz. Informe a unidade ou nome do morador na próxima vez para enviar a notificação.');
          }
        } else toast.error(result.error || 'Erro ao salvar encomenda.');
        return;
      }

      if (item.type === 'Ocorrência' || item.type === 'Serviço') {
        const occ: Occurrence = {
          id: `temp-${Date.now()}`,
          residentName: resident?.name ?? (item.involvedParties || 'Condomínio'),
          unit: resident?.unit ?? (item.involvedParties || '—'),
          description: [item.title, item.description].filter(Boolean).join(' — '),
          status: 'Aberto',
          date: new Date().toISOString(),
          reportedBy: reporterName
        };
        const result = await saveOccurrence(occ);
        if (result.success) {
          const { data } = await getOccurrences();
          if (data) setAllOccurrences(data);
          toast.success('Ocorrência registrada por voz. O morador foi notificado.');
        } else toast.error(result.error || 'Erro ao salvar ocorrência.');
        return;
      }

      if (item.type === 'Aviso') {
        const notice: Notice = {
          id: '',
          title: item.title || 'Aviso',
          content: item.description || '',
          author: reporterName,
          authorRole: role,
          date: new Date().toISOString(),
          priority: 'normal',
          pinned: false,
          read: false
        };
        const result = await saveNotice(notice);
        if (result.success) {
          getNotices((data) => { if (data) setAllNotices(data); }).then((res) => { if (res.data) setAllNotices(res.data); });
          toast.success('Aviso registrado por voz e publicado no mural.');
        } else toast.error(result.error || 'Erro ao salvar aviso.');
        return;
      }

      if (item.type === 'Visitante') {
        const visitor: VisitorLog = {
          id: `temp-${Date.now()}`,
          residentName: resident?.name ?? (item.involvedParties || 'A confirmar'),
          unit: resident?.unit ?? (item.involvedParties || '—'),
          visitorCount: 1,
          visitorNames: item.title || item.description || undefined,
          entryTime: new Date().toISOString(),
          status: 'active',
          type: 'Visita'
        };
        const result = await saveVisitor(visitor);
        if (result.success) {
          const unitFilter = role === 'MORADOR' && currentResident ? currentResident.unit : undefined;
          const { data } = await getVisitors(unitFilter);
          if (data) setVisitorLogs(data);
          toast.success('Visitante registrado por voz.');
        } else toast.error(result.error || 'Erro ao registrar visitante.');
      }
    } catch (err: any) {
      console.error('[handleVoiceEventPersist]', err);
      toast.error('Erro ao persistir registro de voz: ' + (err?.message || 'Erro desconhecido'));
    }
  }, [currentAdminUser, role, currentResident, resolveResidentFromVoiceEvent, toast]);

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

  const handleLogin = (selectedRole: UserRole, options?: { mustChangePassword?: boolean }) => {
    // MORADOR: permanece no modal Login; cadastro só abre via "Criar conta"
    if (selectedRole === 'MORADOR') return;

    setRole(selectedRole);
    setCurrentResident(null);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    setShowFirstLoginChangePasswordModal(!!options?.mustChangePassword);
    if (options?.mustChangePassword) setFirstLoginPasswordData({ new: '', confirm: '' });
  };
  
  const handleLogout = () => { 
    setIsAuthenticated(false); 
    setCurrentResident(null);
    setShowResidentRegister(false);
    // Não reexibir vídeo após logout — deve exibir-se apenas uma vez
    setActiveTab('dashboard');
    // Limpar dados do morador da sessão
    sessionStorage.removeItem('currentResident');
    sessionStorage.removeItem('residentRole');
    // Limpar dados do usuário da sessão
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('userRole');
  };


  const handleSaveStaff = async () => {
    if (!staffFormData.name || !staffFormData.role) return;
    const isNewStaff = !staffFormData.id || String(staffFormData.id).startsWith('temp-');
    const isPorteiro = (staffFormData.role || '').toLowerCase() === 'porteiro';
    if (isNewStaff && isPorteiro && (!staffFormData.passwordPlain || staffFormData.passwordPlain.length < 6 || staffFormData.passwordPlain !== staffFormData.passwordConfirm)) {
      return;
    }
    const staff: Staff = {
      id: (staffFormData.id && !String(staffFormData.id).startsWith('temp-') ? staffFormData.id : `temp-${Date.now()}`) as string,
      name: staffFormData.name,
      role: staffFormData.role,
      status: (staffFormData.status as 'Ativo' | 'Férias' | 'Licença') || 'Ativo',
      shift: (staffFormData.shift as 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada' | 'Comercial') || 'Comercial',
      phone: staffFormData.phone,
      email: staffFormData.email
    };
    const options = isPorteiro && staffFormData.passwordPlain ? { passwordPlain: staffFormData.passwordPlain } : undefined;
    const res = await saveStaff(staff, options);
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
      // Dashboard do Morador: visão simplificada, sem registro de encomendas
      if (role === 'MORADOR' && currentResident) {
        return (
          <MoradorDashboardView
            currentResident={currentResident}
            allBoletos={allBoletos}
            allNotices={allNotices}
            allPackages={allPackages}
            allReservations={dayReservations}
            onViewBoleto={(boleto) => {
              if (boleto.pdfUrl) {
                window.open(boleto.pdfUrl, '_blank');
              }
            }}
            onDownloadBoleto={(boleto) => {
              if (boleto.pdfUrl) {
                const link = document.createElement('a');
                link.href = boleto.pdfUrl;
                link.download = `boleto-${boleto.unit}-${boleto.referenceMonth}.pdf`;
                link.click();
              }
            }}
            onViewPackage={setSelectedPackageForDetail}
            onViewNotice={(_notice) => {
              setActiveTab('notices');
            }}
          />
        );
      }
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
        />
      );
    }

    switch (activeTab) {
      case 'notices': {
        const filteredNotices = allNotices
          .filter(n => {
            if (noticeFilter === 'urgent') return n.category === 'Urgente';
            if (noticeFilter === 'unread') return !n.read;
            return true;
          })
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        return (
          <NoticesView
            filteredNotices={filteredNotices}
            setNoticeFilter={setNoticeFilter}
            noticeFilter={noticeFilter}
            activeNoticeTab={activeNoticeTab}
            setActiveNoticeTab={setActiveNoticeTab}
            isChatOpen={isChatOpen}
            setIsChatOpen={setIsChatOpen}
            chatMessages={chatMessages}
            role={role}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendChatMessage={handleSendChatMessage}
            chatEndRef={chatEndRef}
            handleAcknowledgeNotice={handleAcknowledgeNotice}
            onRefreshChat={handleRefreshChatMessages}
            onClearChat={handleClearChatMessages}
            onAddNotice={role === 'PORTEIRO' || role === 'SINDICO' ? () => setSelectedNoticeForEdit(createDraftNotice()) : undefined}
            onEditNotice={role === 'PORTEIRO' || role === 'SINDICO' ? (n) => setSelectedNoticeForEdit(n) : undefined}
            onDeleteNotice={role === 'PORTEIRO' || role === 'SINDICO' ? handleDeleteNoticeById : undefined}
          />
        );
      }
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
        return <ResidentsView allResidents={allResidents} residentSearch={residentSearch} setResidentSearch={setResidentSearch} handleOpenResidentModal={handleOpenResidentModal} setSelectedResidentProfile={setSelectedResidentProfile} handleDeleteResident={handleDeleteResident} allPackages={allPackages} visitorLogs={visitorLogs} onImportClick={role === 'SINDICO' ? () => setIsImportResidentsModalOpen(true) : undefined} canManageResidents={role === 'SINDICO'} />;
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
                {!isEditingResidentProfile && !isChangingResidentPassword && (
                  <button
                    onClick={handleStartEditResidentProfile}
                    className="px-4 py-2 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    Editar Perfil
                  </button>
                )}
              </header>
              <div className="premium-glass rounded-2xl p-6 sm:p-8 border" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-4 mb-6">
                  <label className="relative cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) handleResidentAvatarChange(file);
                      }}
                    />
                    <div className="w-14 h-14 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-color)] font-black text-xl overflow-hidden relative">
                      {residentAvatar ? (
                        <img
                          src={residentAvatar}
                          alt="Foto do morador"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{currentResident.name?.charAt(0) || '?'}</span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest transition-opacity">
                        Alterar
                      </div>
                    </div>
                  </label>
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {currentResident.name}
                    </h4>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                      Unidade {currentResident.unit}
                    </p>
                  </div>
                </div>

                {isEditingResidentProfile ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={residentProfileData.email}
                          onChange={(e) => setResidentProfileData({ ...residentProfileData, email: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                          Telefone
                        </label>
                        <input
                          type="tel"
                          value={residentProfileData.phone}
                          onChange={(e) => setResidentProfileData({ ...residentProfileData, phone: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                          WhatsApp
                        </label>
                        <input
                          type="tel"
                          value={residentProfileData.whatsapp}
                          onChange={(e) => setResidentProfileData({ ...residentProfileData, whatsapp: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Dados do veículo
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                            Placa
                          </label>
                          <input
                            type="text"
                            value={residentProfileData.vehiclePlate}
                            onChange={(e) => setResidentProfileData({ ...residentProfileData, vehiclePlate: e.target.value.toUpperCase() })}
                            className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)] tracking-[0.2em]"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            placeholder="ABC1D23"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                            Modelo
                          </label>
                          <input
                            type="text"
                            value={residentProfileData.vehicleModel}
                            onChange={(e) => setResidentProfileData({ ...residentProfileData, vehicleModel: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            placeholder="Ex: Corolla XEi"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                            Cor
                          </label>
                          <input
                            type="text"
                            value={residentProfileData.vehicleColor}
                            onChange={(e) => setResidentProfileData({ ...residentProfileData, vehicleColor: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            placeholder="Ex: Prata"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveResidentProfile}
                        className="px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingResidentProfile(false);
                          setResidentProfileData({
                            email: '',
                            phone: '',
                            whatsapp: '',
                            vehiclePlate: '',
                            vehicleModel: '',
                            vehicleColor: ''
                          });
                        }}
                        className="px-6 py-2 rounded-xl border font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : isChangingResidentPassword ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                        Senha Atual
                      </label>
                      <div className="relative">
                        <input
                          type={showResidentPasswords.current ? 'text' : 'password'}
                          value={residentPasswordData.current}
                          onChange={(e) => setResidentPasswordData({ ...residentPasswordData, current: e.target.value })}
                          className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="Digite sua senha atual"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResidentPasswords({ ...showResidentPasswords, current: !showResidentPasswords.current })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {showResidentPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                        Nova Senha
                      </label>
                      <div className="relative">
                        <input
                          type={showResidentPasswords.new ? 'text' : 'password'}
                          value={residentPasswordData.new}
                          onChange={(e) => setResidentPasswordData({ ...residentPasswordData, new: e.target.value })}
                          className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="Digite a nova senha"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResidentPasswords({ ...showResidentPasswords, new: !showResidentPasswords.new })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {showResidentPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                        Confirmar Nova Senha
                      </label>
                      <div className="relative">
                        <input
                          type={showResidentPasswords.confirm ? 'text' : 'password'}
                          value={residentPasswordData.confirm}
                          onChange={(e) => setResidentPasswordData({ ...residentPasswordData, confirm: e.target.value })}
                          className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="Confirme a nova senha"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResidentPasswords({ ...showResidentPasswords, confirm: !showResidentPasswords.confirm })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {showResidentPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleChangeResidentPassword}
                        className="px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}
                      >
                        Alterar Senha
                      </button>
                      <button
                        onClick={() => {
                          setIsChangingResidentPassword(false);
                          setResidentPasswordData({ current: '', new: '', confirm: '' });
                          setShowResidentPasswords({ current: false, new: false, confirm: false });
                        }}
                        className="px-6 py-2 rounded-xl border font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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

                    <div className="mt-6 pt-6 border-t space-y-3" style={{ borderColor: 'var(--border-color)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                        Dados do veículo
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                            Placa
                          </p>
                          <p style={{ color: 'var(--text-primary)' }}>
                            {currentResident.vehiclePlate || 'Não informado'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                            Modelo
                          </p>
                          <p style={{ color: 'var(--text-primary)' }}>
                            {currentResident.vehicleModel || 'Não informado'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                            Cor
                          </p>
                          <p style={{ color: 'var(--text-primary)' }}>
                            {currentResident.vehicleColor || 'Não informado'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <button
                        onClick={() => setIsChangingResidentPassword(true)}
                        className="px-4 py-2 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        Alterar Senha
                      </button>
                    </div>
                  </>
                )}
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
      case 'sindicoProfile':
        if ((role === 'SINDICO' || role === 'PORTEIRO') && currentAdminUser) {
          return (
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
              <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                    Meu Perfil
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {role === 'SINDICO' ? 'Dados do síndico' : 'Dados do porteiro'}
                  </p>
                </div>
                {!isEditingAdminProfile && (
                  <button
                    onClick={handleStartEditAdminProfile}
                    className="px-4 py-2 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    Editar Perfil
                  </button>
                )}
              </header>
              <div className="premium-glass rounded-2xl p-6 sm:p-8 border" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-4 mb-6">
                  <label className="relative cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) handleAdminAvatarChange(file);
                      }}
                    />
                    <div className="w-14 h-14 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-color)] font-black text-xl overflow-hidden relative">
                      {adminAvatar ? (
                        <img
                          src={adminAvatar}
                          alt="Foto do síndico"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{(currentAdminUser.name || currentAdminUser.username || '?').charAt(0)}</span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest transition-opacity">
                        Alterar
                      </div>
                    </div>
                  </label>
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {currentAdminUser.name || currentAdminUser.username}
                    </h4>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                      {role === 'SINDICO' ? 'Síndico' : 'Porteiro'}
                    </p>
                  </div>
                </div>

                {isEditingAdminProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                          Nome
                        </label>
                        <input
                          type="text"
                          value={adminProfileData.name}
                          onChange={(e) => setAdminProfileData({ ...adminProfileData, name: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={adminProfileData.email}
                          onChange={(e) => setAdminProfileData({ ...adminProfileData, email: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                          Telefone
                        </label>
                        <input
                          type="tel"
                          value={adminProfileData.phone}
                          onChange={(e) => setAdminProfileData({ ...adminProfileData, phone: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                    <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-3 block" style={{ color: 'var(--text-secondary)' }}>
                        Alterar senha (opcional)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                            Senha atual
                          </label>
                          <div className="relative">
                            <input
                              type={showAdminProfilePasswords.current ? 'text' : 'password'}
                              value={adminProfilePasswordData.current}
                              onChange={(e) => setAdminProfilePasswordData({ ...adminProfilePasswordData, current: e.target.value })}
                              className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              placeholder="Só para alterar senha"
                              autoComplete="current-password"
                            />
                            <button type="button" onClick={() => setShowAdminProfilePasswords((s) => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: 'var(--text-primary)' }}>{showAdminProfilePasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                            Nova senha
                          </label>
                          <div className="relative">
                            <input
                              type={showAdminProfilePasswords.new ? 'text' : 'password'}
                              value={adminProfilePasswordData.new}
                              onChange={(e) => setAdminProfilePasswordData({ ...adminProfilePasswordData, new: e.target.value })}
                              className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              placeholder="6 caracteres, letras e números"
                              autoComplete="new-password"
                            />
                            <button type="button" onClick={() => setShowAdminProfilePasswords((s) => ({ ...s, new: !s.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: 'var(--text-primary)' }}>{showAdminProfilePasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>
                            Confirmar nova senha
                          </label>
                          <div className="relative">
                            <input
                              type={showAdminProfilePasswords.confirm ? 'text' : 'password'}
                              value={adminProfilePasswordData.confirm}
                              onChange={(e) => setAdminProfilePasswordData({ ...adminProfilePasswordData, confirm: e.target.value })}
                              className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              placeholder="Repita a nova senha"
                              autoComplete="new-password"
                            />
                            <button type="button" onClick={() => setShowAdminProfilePasswords((s) => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: 'var(--text-primary)' }}>{showAdminProfilePasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveAdminProfile}
                        className="px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingAdminProfile(false);
                          setAdminProfileData({ name: '', email: '', phone: '' });
                          setAdminProfilePasswordData({ current: '', new: '', confirm: '' });
                          setShowAdminProfilePasswords({ current: false, new: false, confirm: false });
                        }}
                        className="px-6 py-2 rounded-xl border font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                          Usuário de login
                        </p>
                        <p style={{ color: 'var(--text-primary)' }}>{currentAdminUser.username}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                          E-mail
                        </p>
                        <p style={{ color: 'var(--text-primary)' }}>{currentAdminUser.email || 'Não informado'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>
                          Telefone
                        </p>
                        <p style={{ color: 'var(--text-primary)' }}>{currentAdminUser.phone || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <button
                        onClick={() => setIsAdminCredentialsModalOpen(true)}
                        className="px-4 py-2 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        Alterar usuário e senha
                      </button>
                    </div>
                    <p className="mt-6 text-[11px] opacity-60" style={{ color: 'var(--text-secondary)' }}>
                      A foto do perfil é armazenada apenas neste dispositivo para manter o acesso rápido e offline.
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
            <h3 className="text-2xl font-black uppercase tracking-tight">Acesso Restrito</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
              A página de perfil do síndico é exclusiva para usuários autenticados com perfil de síndico.
            </p>
          </div>
        );
      case 'boletos': 
        if (role === 'MORADOR' && currentResident) {
          const myBoletos = allBoletos.filter(b => b.unit === currentResident.unit);
          return <BoletosView allBoletos={myBoletos} boletoSearch={boletoSearch} setBoletoSearch={setBoletoSearch} allResidents={[currentResident]} onViewBoleto={(boleto) => { if (boleto.pdfUrl) window.open(boleto.pdfUrl, '_blank'); }} onDownloadBoleto={(boleto) => { if (boleto.pdfUrl) { const link = document.createElement('a'); link.href = boleto.pdfUrl; link.download = `boleto-${boleto.unit}-${boleto.referenceMonth}.pdf`; link.click(); } }} showImportButton={false} isResidentView={true} />;
        }
        return <BoletosView allBoletos={allBoletos} boletoSearch={boletoSearch} setBoletoSearch={setBoletoSearch} allResidents={allResidents} onViewBoleto={(boleto) => { if (boleto.pdfUrl) window.open(boleto.pdfUrl, '_blank'); }} onDownloadBoleto={(boleto) => { if (boleto.pdfUrl) { const link = document.createElement('a'); link.href = boleto.pdfUrl; link.download = `boleto-${boleto.unit}-${boleto.referenceMonth}.pdf`; link.click(); } }} onDeleteBoleto={handleDeleteBoleto} onImportClick={() => setIsImportBoletosModalOpen(true)} showImportButton={true} isResidentView={false} />;
      case 'visitors': 
        return <VisitorsView visitorLogs={visitorLogs} visitorSearch={visitorSearch} setVisitorSearch={setVisitorSearch} setIsVisitorModalOpen={setIsVisitorModalOpen} visitorTab={visitorTab} setVisitorTab={setVisitorTab} handleVisitorCheckOut={handleVisitorCheckOut} calculatePermanence={calculatePermanence} role={role} />;
      case 'notifications':
        if (role === 'MORADOR' && currentResident) {
          const normUnit = (u: string) => (u ?? '').trim().toUpperCase();
          const residentUnitNorm = normUnit(currentResident.unit);
          const moradorPackagesForNotifications = allPackages.filter(p => normUnit(p.unit) === residentUnitNorm);
          return (
            <NotificationsView
              notifications={allNotifications}
              loading={notificationsLoading}
              allPackages={moradorPackagesForNotifications}
              onViewPackage={setSelectedPackageForDetail}
              onMarkAsRead={handleMarkNotificationAsRead}
              onMarkAllAsRead={handleMarkAllNotificationsAsRead}
              onDeleteNotification={handleDeleteNotification}
            />
          );
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
          // Normalizar unidades para comparação (remover espaços, converter para maiúsculas)
          const normalizeUnit = (unit: string) => unit?.trim().toUpperCase() || '';
          const residentUnit = normalizeUnit(currentResident.unit);
          
          // Filtrar encomendas do morador e ordenar por data (mais recente primeiro)
          const myPackages = allPackages
            .filter(p => normalizeUnit(p.unit) === residentUnit)
            .sort((a, b) => {
              const dateA = new Date(a.receivedAt).getTime();
              const dateB = new Date(b.receivedAt).getTime();
              return dateB - dateA; // Mais recente primeiro
            });
          
          // Log para debug
          console.log('[PackagesView - Morador]', {
            residentUnit,
            totalPackages: allPackages.length,
            myPackagesCount: myPackages.length,
            myPackages: myPackages.map(p => ({ id: p.id, unit: p.unit, status: p.status, receivedAt: p.receivedAt }))
          });
          
          // Morador pode apenas visualizar suas encomendas, sem registrar novas
          return (
            <PackagesView
              allPackages={myPackages}
              allResidents={[]}
              packageSearch={packageSearch}
              setPackageSearch={setPackageSearch}
              setIsNewPackageModalOpen={() => {}}
              setSelectedPackageForDetail={setSelectedPackageForDetail}
              onDeletePackage={undefined}
              onCameraScan={undefined}
              canRegister={false}
            />
          );
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
        return <PackagesView allPackages={allPackages} allResidents={allResidents} packageSearch={packageSearch} setPackageSearch={setPackageSearch} setIsNewPackageModalOpen={handleOpenNewPackageModal} setSelectedPackageForDetail={setSelectedPackageForDetail} onDeletePackage={handleDeletePackage} onCameraScan={() => setIsCameraScanModalOpen(true)} onImportClick={() => setIsImportPackagesModalOpen(true)} />;
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
              handleDeleteOccurrence={handleDeleteOccurrence}
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
            handleDeleteOccurrence={handleDeleteOccurrence}
          />
        );
      case 'sentinela':
        // Módulo Sentinela (concierge de portaria/síndico)
        // Porteiro acessa apenas "Controle de Acesso"; gestão administrativa (Síndico) é restrita.
        return (
          <SentinelaConciergeApp
            allowManager={role === 'SINDICO'}
            onExit={() => setActiveTab('dashboard')}
            onPersistVoiceEvent={handleVoiceEventPersist}
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
              onEditStaff={(staff) => {
                setStaffFormData(staff);
                setIsStaffModalOpen(true);
                if ((staff.role || '').toLowerCase() === 'porteiro' && staff.id && !String(staff.id).startsWith('temp-')) {
                  getPorteiroLoginInfo(staff).then((info) => {
                    if (info) setStaffFormData((prev) => ({ ...prev, passwordPlain: info.password, passwordConfirm: info.password }));
                  });
                }
              }}
              onDeleteStaff={handleDeleteStaff}
              onImportClick={() => setIsImportStaffModalOpen(true)}
           />
        );
      default: return <div className="p-10 text-center opacity-40 font-black uppercase">{activeTab}</div>;
    }
  };

  let content: React.ReactNode;
  if (isScreenSaverActive) {
    content = <ScreenSaver onExit={() => setIsScreenSaverActive(false)} theme={theme} />;
  } else if (!isAuthenticated && showResidentRegister) {
    content = (
      <ResidentRegister
        onRegister={handleResidentRegister}
        onLogin={handleResidentLogin}
        onBack={() => setShowResidentRegister(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        existingResidents={allResidents}
      />
    );
  } else if (!isAuthenticated) {
    content = (
      <Login
        onLogin={handleLogin}
        onMoradorLogin={handleResidentLogin}
        onRequestResidentRegister={() => setShowResidentRegister(true)}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
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
      <QuickViewModal 
        category={quickViewCategory} data={quickViewData} onClose={() => setQuickViewCategory(null)} onGoToPage={(tab) => setActiveTab(tab)}
        onAddNew={() => { if (quickViewCategory === 'visitors') { setQuickViewCategory(null); resetVisitorModal(); setIsVisitorModalOpen(true); } }}
        onSelectItem={(item) => { 
          if (quickViewCategory === 'packages') { setSelectedPackageForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'visitors') { setSelectedVisitorForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'occurrences') { setSelectedOccurrenceForDetail(item); setQuickViewCategory(null); } 
          else if (quickViewCategory === 'reservations') { setActiveTab('reservations'); setQuickViewCategory(null); }
          else if (quickViewCategory === 'notices') { setSelectedNoticeForEdit(item); setQuickViewCategory(null); }
        }}
      />
      
      {/* MODALS */}
      <NewReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} data={newReservationData} setData={setNewReservationData} areasStatus={areasStatus} searchQuery={reservationSearchQuery} setSearchQuery={setReservationSearchQuery} showSuggestions={showResSuggestions} setShowSuggestions={setShowResSuggestions} filteredResidents={filteredResForReservation} hasConflict={hasTimeConflict} onConfirm={handleCreateReservation} />
      <NewVisitorModal isOpen={isVisitorModalOpen} onClose={resetVisitorModal} step={newVisitorStep} setStep={setNewVisitorStep} data={newVisitorData} setData={setNewVisitorData} searchResident={searchResident} setSearchResident={setSearchResident} filteredResidents={filteredResidents} accessTypes={visitorAccessTypes} handleRemoveAccessType={handleRemoveAccessType} isAddingAccessType={isAddingAccessType} setIsAddingAccessType={setIsAddingAccessType} newAccessTypeInput={newAccessTypeInput} setNewAccessTypeInput={setNewAccessTypeInput} handleAddAccessType={handleAddAccessType} onConfirm={handleRegisterVisitor} />
      <NewPackageModal isOpen={isNewPackageModalOpen} onClose={resetPackageModal} step={packageStep} setStep={setPackageStep} searchResident={searchResident} setSearchResident={setSearchResident} selectedResident={selectedResident} setSelectedResident={setSelectedResident} filteredResidents={filteredResidents} allResidents={allResidents} residentsLoading={residentsLoading} residentsError={residentsError} onRetryResidents={() => fetchResidents(false)} packageSaving={packageSaving} pendingImage={pendingPackageImage} pendingQrData={pendingPackageQrData} packageType={packageType} setPackageType={setPackageType} packageCategories={packageCategories} isAddingPkgCategory={isAddingPkgCategory} setIsAddingPkgCategory={setIsAddingPkgCategory} newPkgCatName={newPkgCatName} setNewPkgCatName={setNewPkgCatName} handleAddPkgCategory={handleAddPkgCategory} numItems={numItems} packageItems={packageItems} handleAddItemRow={handleAddItemRow} handleRemoveItemRow={handleRemoveItemRow} updateItem={updateItem} packageMessage={packageMessage} setPackageMessage={setPackageMessage} onConfirm={handleRegisterPackageFinal} />
      <StaffFormModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} data={staffFormData} setData={setStaffFormData} onSave={handleSaveStaff} />

      {showFirstLoginChangePasswordModal && currentAdminUser && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-md bg-white text-black rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black uppercase">Altere sua senha</h3>
              <button type="button" onClick={() => { setShowFirstLoginChangePasswordModal(false); setFirstLoginPasswordData({ new: '', confirm: '' }); }} className="p-2 rounded-xl hover:bg-zinc-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-zinc-600 mb-4">Você está usando a senha padrão. Defina uma senha pessoal para acessar o sistema.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (firstLoginPasswordData.new.length >= 6 && firstLoginPasswordData.new === firstLoginPasswordData.confirm) {
                  handleFirstLoginChangePassword();
                }
              }}
              className="space-y-0"
            >
              <div className="space-y-3 mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500" htmlFor="first-login-new-password">Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input id="first-login-new-password" type="password" value={firstLoginPasswordData.new} onChange={e => setFirstLoginPasswordData(prev => ({ ...prev, new: e.target.value }))} className="w-full pl-10 pr-4 py-3 bg-zinc-50 rounded-xl border border-zinc-200 outline-none focus:border-black" placeholder="Mín. 6 caracteres" autoComplete="new-password" />
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500" htmlFor="first-login-confirm-password">Confirmar senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input id="first-login-confirm-password" type="password" value={firstLoginPasswordData.confirm} onChange={e => setFirstLoginPasswordData(prev => ({ ...prev, confirm: e.target.value }))} className="w-full pl-10 pr-4 py-3 bg-zinc-50 rounded-xl border border-zinc-200 outline-none focus:border-black" placeholder="Repita a senha" autoComplete="new-password" />
                </div>
              </div>
              <button type="submit" disabled={firstLoginPasswordData.new.length < 6 || firstLoginPasswordData.new !== firstLoginPasswordData.confirm} className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed">
                Definir senha
              </button>
            </form>
          </div>
        </div>
      )}

      {isAdminCredentialsModalOpen && currentAdminUser && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ color: 'var(--text-primary)' }}>
          <div className="relative w-full max-w-lg rounded-2xl shadow-2xl p-6 sm:p-8 border overflow-y-auto max-h-[90vh]" style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase tracking-tight">Alterar usuário e senha</h3>
              <button type="button" onClick={closeAdminCredentialsModal} className="p-2 rounded-xl opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-primary)' }} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-8">
              {/* Seção: Alterar usuário de login */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>Usuário de login</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Atual: <strong style={{ color: 'var(--text-primary)' }}>{currentAdminUser.username}</strong></p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>Senha atual (para confirmar)</label>
                  <div className="relative">
                    <input
                      type={showAdminPasswords.current ? 'text' : 'password'}
                      value={adminUsernameData.currentPassword}
                      onChange={(e) => setAdminUsernameData({ ...adminUsernameData, currentPassword: e.target.value })}
                      className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      placeholder="Digite sua senha"
                    />
                    <button type="button" onClick={() => setShowAdminPasswords({ ...showAdminPasswords, current: !showAdminPasswords.current })} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: 'var(--text-primary)' }}>{showAdminPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>Novo usuário de login</label>
                  <input
                    type="text"
                    value={adminUsernameData.newUsername}
                    onChange={(e) => setAdminUsernameData({ ...adminUsernameData, newUsername: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="Mín. 3 caracteres"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>Confirmar novo usuário</label>
                  <input
                    type="text"
                    value={adminUsernameData.confirmUsername}
                    onChange={(e) => setAdminUsernameData({ ...adminUsernameData, confirmUsername: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="Digite novamente"
                    autoComplete="username"
                  />
                </div>
                <button type="button" onClick={handleChangeAdminUsername} className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}>Alterar usuário</button>
              </div>

              <div className="border-t py-4" style={{ borderColor: 'var(--border-color)' }} />

              {/* Seção: Alterar senha */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>Senha de acesso</p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>Senha atual</label>
                  <div className="relative">
                    <input
                      type={showAdminPasswords.current ? 'text' : 'password'}
                      value={adminPasswordData.current}
                      onChange={(e) => setAdminPasswordData({ ...adminPasswordData, current: e.target.value })}
                      className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      placeholder="Digite sua senha atual"
                    />
                    <button type="button" onClick={() => setShowAdminPasswords({ ...showAdminPasswords, current: !showAdminPasswords.current })} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: 'var(--text-primary)' }}>{showAdminPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>Nova senha</label>
                  <div className="relative">
                    <input
                      type={showAdminPasswords.new ? 'text' : 'password'}
                      value={adminPasswordData.new}
                      onChange={(e) => setAdminPasswordData({ ...adminPasswordData, new: e.target.value })}
                      className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      placeholder="Mín. 6 caracteres"
                    />
                    <button type="button" onClick={() => setShowAdminPasswords({ ...showAdminPasswords, new: !showAdminPasswords.new })} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: 'var(--text-primary)' }}>{showAdminPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block" style={{ color: 'var(--text-secondary)' }}>Confirmar nova senha</label>
                  <div className="relative">
                    <input
                      type={showAdminPasswords.confirm ? 'text' : 'password'}
                      value={adminPasswordData.confirm}
                      onChange={(e) => setAdminPasswordData({ ...adminPasswordData, confirm: e.target.value })}
                      className="w-full px-4 py-2 pr-10 rounded-xl border bg-transparent text-sm font-medium outline-none transition-all focus:border-[var(--text-primary)]"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      placeholder="Repita a nova senha"
                    />
                    <button type="button" onClick={() => setShowAdminPasswords({ ...showAdminPasswords, confirm: !showAdminPasswords.confirm })} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: 'var(--text-primary)' }}>{showAdminPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <button type="button" onClick={handleChangeAdminPassword} className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}>Alterar senha</button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t flex justify-end" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" onClick={closeAdminCredentialsModal} className="px-5 py-2 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <ResidentProfileModal resident={selectedResidentProfile} onClose={() => setSelectedResidentProfile(null)} onEdit={role === 'SINDICO' && selectedResidentProfile ? () => { handleOpenResidentModal(selectedResidentProfile); setSelectedResidentProfile(null); } : undefined} onDelete={selectedResidentProfile && role === 'SINDICO' ? () => handleDeleteResident(selectedResidentProfile.id) : undefined} allPackages={allPackages} visitorLogs={visitorLogs} onPackageSelect={setSelectedPackageForDetail} onCheckOutVisitor={handleVisitorCheckOut} />
      <PackageDetailModal 
        pkg={selectedPackageForDetail} 
        onClose={() => setSelectedPackageForDetail(null)} 
        onDeliver={handleDeliverPackage} 
        onNotify={handleSendReminder} 
        calculatePermanence={calculatePermanence}
        currentRole={role}
        currentResident={currentResident}
      />
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
      <ImportPackagesModal isOpen={isImportPackagesModalOpen} onClose={() => setIsImportPackagesModalOpen(false)} onImport={handleImportPackages} existingPackages={allPackages} />
      <CameraScanModal isOpen={isCameraScanModalOpen} onClose={() => setIsCameraScanModalOpen(false)} onScanSuccess={handleCameraScanSuccess} allResidents={allResidents} />
      <ImportStaffModal isOpen={isImportStaffModalOpen} onClose={() => setIsImportStaffModalOpen(false)} onImport={handleImportStaff} existingStaff={allStaff} />
      <NewOccurrenceModal isOpen={isOccurrenceModalOpen} onClose={() => setIsOccurrenceModalOpen(false)} description={occurrenceDescription} setDescription={setOccurrenceDescription} onSave={async (imageDataUrl?: string | null) => {
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
          reportedBy: role === 'PORTEIRO' ? 'Porteiro' : role === 'SINDICO' ? 'Síndico' : 'Morador',
          imageUrl: imageDataUrl ?? null
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
    <ConnectivityProvider>
      <>
        {isSupabasePlaceholder && (
          <div className="fixed top-0 left-0 right-0 z-[9999] px-4 py-2 bg-amber-600 text-white text-center text-xs font-bold uppercase tracking-wider shadow-lg">
            Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local ou Vercel.
          </div>
        )}
        {content}
      </>
    </ConnectivityProvider>
  );
};

export default App;
