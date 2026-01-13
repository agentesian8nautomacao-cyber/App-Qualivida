
export type UserRole = 'MORADOR' | 'PORTEIRO' | 'SINDICO';
export type QuickViewCategory = 'packages' | 'visitors' | 'occurrences' | 'reservations' | 'notes' | 'notices' | null;

export interface PackageItem {
  id: string;
  name: string;
  description: string;
}

export interface Package {
  id: string;
  recipient: string;
  unit: string;
  type: string;
  receivedAt: string; // ISO String para cálculos precisos
  displayTime: string; // Hora formatada para exibição
  status: 'Pendente' | 'Entregue';
  deadlineMinutes: number; // Prazo estipulado pelo porteiro
  residentPhone?: string;
  items?: PackageItem[]; // Lista de itens detalhados
}

export interface Reservation {
  id: string;
  area: string;
  resident: string;
  unit: string;
  date: string;
  status: 'Confirmada' | 'Cancelada';
}

export interface Resident {
  id: string;
  name: string;
  unit: string;
  email: string;
  phone: string;
  whatsapp: string;
  extraData?: Record<string, any>; // Campos adicionais do arquivo de importação
}

export interface Occurrence {
  id: string;
  residentName: string;
  unit: string;
  description: string;
  status: 'Aberto' | 'Em Andamento' | 'Resolvido';
  date: string;
  reportedBy: string; // Nome ou cargo de quem reportou
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  status: 'Ativo' | 'Férias' | 'Licença';
  shift: 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada' | 'Comercial';
  phone?: string;
  email?: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  authorRole: 'MORADOR' | 'SINDICO' | 'PORTEIRO'; // Nova diferenciação visual
  date: string;
  category?: 'Urgente' | 'Manutenção' | 'Social' | 'Institucional';
  priority?: 'high' | 'normal';
  pinned?: boolean; // Fixar no topo
  read?: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderRole: 'MORADOR' | 'SINDICO' | 'PORTEIRO';
  timestamp: string;
  read: boolean;
}

export interface Note {
  id: string;
  content: string;
  date: string;
  completed: boolean;
  scheduled?: string;
  category?: string;
}

export interface VisitorLog {
  id: string;
  residentName: string;
  unit: string;
  visitorCount: number;
  visitorNames?: string; // Opcional
  entryTime: string;
  exitTime?: string;
  status: 'active' | 'completed';
}

// --- CRM TYPES ---

export type UnitStatus = 'calm' | 'warning' | 'critical';

export interface CrmUnit {
  id: string;
  unit: string; // ex: "101"
  floor: string; // ex: "1º Andar"
  residentName: string;
  status: UnitStatus;
  tags: string[]; // ex: "#Pet", "#Idoso", "#Festeiro"
  lastIncident?: string;
  npsScore?: number; // 0-100 (Satisfação estimada)
}

export type ConflictStatus = 'analysis' | 'mediation' | 'legal' | 'resolved';

export interface CrmIssue {
  id: string;
  title: string;
  involvedUnits: string[];
  severity: 'low' | 'medium' | 'high';
  status: ConflictStatus;
  description: string;
  updatedAt: string;
}

export interface Boleto {
  id: string;
  residentName: string;
  unit: string;
  referenceMonth: string; // Ex: "01/2025"
  dueDate: string; // Data de vencimento
  amount: number; // Valor em reais
  status: 'Pendente' | 'Pago' | 'Vencido';
  barcode?: string; // Código de barras do boleto
  pdfUrl?: string; // URL para download do PDF
  paidDate?: string; // Data de pagamento
  description?: string; // Descrição adicional
}
