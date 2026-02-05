/**
 * Tipos do módulo Sentinela (chat sentinela) integrados ao projeto principal.
 * UserRole do app principal ('PORTEIRO' | 'SINDICO') é mapeado para SentinelaRole.
 */

export type SentinelaRole = 'Porteiro' | 'Síndico' | 'Morador';

export interface KnowledgeBase {
  name: string;
  mimeType: string;
  data: string;
}

export interface RoleConfig {
  assistantName: string;
  assistantAvatar?: string;
  instructions: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'maintenance' | 'security' | 'delivery' | 'cleaning' | 'admin';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  category: TaskCategory;
  deadline: string;
  createdByRole: SentinelaRole;
  timestamp: number;
  status: 'pending' | 'in_progress' | 'done';
}

export interface SentinelaUserProfile {
  name: string;
  role?: SentinelaRole;
  condoName?: string;
  aiVoice?: string;
  doormanConfig: RoleConfig;
  managerConfig: RoleConfig;
  knowledgeBase?: KnowledgeBase;
}

export type OccurrenceTypeSentinela =
  | 'Visitante'
  | 'Encomenda'
  | 'Serviço'
  | 'Ocorrência'
  | 'Aviso'
  | 'Multa'
  | 'Circular';

export interface OccurrenceItemSentinela {
  id: string;
  type: OccurrenceTypeSentinela;
  title: string;
  description: string;
  timestamp: number;
  involvedParties?: string;
  status: 'Open' | 'Resolved' | 'Logged';
}

export interface SentinelaChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: number;
  isSystemEvent?: boolean;
  senderId?: string;
  senderName?: string;
  isExternal?: boolean;
}
