
export type UserRole = 'MORADOR' | 'PORTEIRO' | 'SINDICO';
export type QuickViewCategory = 'packages' | 'visitors' | 'occurrences' | 'reservations' | 'notices' | null;

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
  /** ID do morador no Supabase (residents.id); garante vínculo encomenda → morador. */
  recipientId?: string;
  /** Base64 ou URL da foto da encomenda (captura). */
  imageUrl?: string | null;
  /** Dados lidos do QR Code (captura). */
  qrCodeData?: string | null;
  /** Nome do porteiro que recebeu a encomenda */
  receivedByName?: string | null;
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
  /** Placa do veículo principal do morador (opcional). */
  vehiclePlate?: string;
  /** Modelo do veículo principal do morador (opcional). */
  vehicleModel?: string;
  /** Cor do veículo principal do morador (opcional). */
  vehicleColor?: string;
  extraData?: Record<string, any>; // Campos adicionais do arquivo de importação
}

export interface OccurrenceMessage {
  id: string;
  text: string;
  senderRole: 'MORADOR' | 'SINDICO' | 'PORTEIRO';
  senderName: string;
  timestamp: string;
  read: boolean;
}

export interface Occurrence {
  id: string;
  residentName: string;
  unit: string;
  description: string;
  status: 'Aberto' | 'Em Andamento' | 'Resolvido';
  date: string;
  reportedBy: string; // Nome ou cargo de quem reportou
  imageUrl?: string | null; // Foto/anexo opcional da ocorrência
  messages?: OccurrenceMessage[]; // Sistema de chat para comunicação
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
  /** Imagem do aviso (URL ou base64). Opcional. */
  imageUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderRole: 'MORADOR' | 'SINDICO' | 'PORTEIRO';
  timestamp: string;
  read: boolean;
}


export interface VisitorLog {
  id: string;
  residentName: string;
  unit: string;
  visitorCount: number;
  visitorNames?: string;
  entryTime: string;
  exitTime?: string;
  status: 'active' | 'completed';
  type?: string;
  doc?: string;
  vehicle?: string;
  plate?: string;
  registeredBy?: string; // ID do usuário que registrou o visitante
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

/** Tipo do boleto: condomínio (taxa), água ou luz */
export type BoletoType = 'condominio' | 'agua' | 'luz';

export interface Boleto {
  id: string;
  residentName: string;
  unit: string;
  referenceMonth: string; // Ex: "01/2025"
  dueDate: string; // Data de vencimento
  amount: number; // Valor em reais
  status: 'Pendente' | 'Pago' | 'Vencido';
  /** Tipo: Condomínio (padrão), Água ou Luz */
  boletoType?: BoletoType;
  barcode?: string; // Código de barras do boleto
  pdfUrl?: string; // URL para download do PDF
  paidDate?: string; // Data de pagamento
  description?: string; // Descrição adicional

  // Campos para identificação de boletos importados
  resident_id?: string; // ID do morador no sistema (referência para residents.id)
  unidade_id?: string; // ID da unidade no sistema
  nosso_numero?: string; // Nosso número do boleto
}

export interface Notification {
  id: string;
  morador_id: string;
  title: string;
  message: string;
  type: 'package' | 'visitor' | 'occurrence' | 'other';
  related_id?: string; // ID do registro relacionado (ex: package.id)
  image_url?: string | null; // Imagem da encomenda quando registro via foto (opcional)
  read: boolean;
  created_at: string;
}

// --- FINANCIAL ENTRY TYPES ---

export type FinancialEntryType = 'receita' | 'despesa';

export interface FinancialEntry {
  id: string;
  type: FinancialEntryType;
  category: string; // ex: "Manutenção", "Limpeza", "Multas", "Aluguéis", etc.
  description: string;
  amount: number;
  date: string; // ISO string
  createdBy: string; // Nome do usuário que criou
  createdAt: string; // ISO string
  referenceMonth?: string; // Para agrupamento mensal (opcional)
}
