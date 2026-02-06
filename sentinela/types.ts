

export interface KnowledgeBase {
  name: string;
  mimeType: string;
  data: string; // Base64
}

export enum UserRole {
  Doorman = "Porteiro",
  Manager = "Síndico",
  Resident = "Morador"
}

// Configuration specific to a role identity
export interface RoleConfig {
    assistantName: string;
    assistantAvatar?: string; // Base64
    instructions: string;
}

// Task / Demand Interface
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'maintenance' | 'security' | 'delivery' | 'cleaning' | 'admin';

export interface Task {
    id: string;
    title: string;
    description: string;
    priority: TaskPriority;
    category: TaskCategory;
    deadline: string; // "Hoje", "Amanhã", etc.
    createdByRole: UserRole;
    timestamp: number;
    status: 'pending' | 'in_progress' | 'done';
}

// Nutrition App Enums
export enum Gender {
  Male = "Male",
  Female = "Female",
  Other = "Other"
}

export enum ActivityLevel {
  Sedentary = "Sedentary",
  Light = "Light",
  Moderate = "Moderate",
  Active = "Active",
  VeryActive = "VeryActive"
}

export enum Goal {
  LoseWeight = "LoseWeight",
  Maintain = "Maintain",
  GainMuscle = "GainMuscle",
  ImproveHealth = "ImproveHealth"
}

export interface PantryItem {
  id: string;
  name: string;
}

export interface UserProfile {
  // Global Fields
  name: string;
  role?: UserRole;
  condoName?: string;
  aiVoice?: string; // Voice setting can remain global or move to config if needed
  
  // Distinct Configurations per Role
  doormanConfig: RoleConfig;
  managerConfig: RoleConfig;
  
  knowledgeBase?: KnowledgeBase; // Shared Knowledge Base (Regimento)
  
  // Nutrition Fields (Legacy/Hybrid)
  age?: number;
  gender?: Gender;
  height?: number; // cm
  weight?: number; // kg
  activityLevel?: ActivityLevel;
  goal?: Goal;
  restrictions?: string;
  mealsPerDay?: number;
  medicalHistory?: string;
  routineDescription?: string;
  foodPreferences?: string;
  streak?: number;
  lastActiveDate?: string;
  avatar?: string;
  chefAvatar?: string;
  pantryItems?: PantryItem[];
  
  // Deprecated fields kept for type safety during migration if needed, but unused in new logic
  assistantName?: string;
  assistantAvatar?: string;
  doormanInstructions?: string;
  managerInstructions?: string;
}

export interface OccurrenceItem {
  id: string;
  type: "Visitante" | "Encomenda" | "Serviço" | "Ocorrência" | "Aviso" | "Multa" | "Circular";
  title: string;
  description: string;
  timestamp: number;
  involvedParties?: string; // Quem está envolvido (Ex: Apto 102)
  status: "Open" | "Resolved" | "Logged";
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: number;
  isSystemEvent?: boolean;
  
  // Integration Fields (New)
  senderId?: string;
  senderName?: string;
  isExternal?: boolean; // True if message comes from an external system (e.g., Resident App)
}

// Nutrition App Interfaces

export interface Macros {
  protein: number;
  carbs: number;
  fats: number;
}

export interface MealItem {
  name: string;
  calories: number;
  macros: Macros;
  emoji?: string;
  description?: string;
  image?: string;
  substitutions?: string[];
  type?: string; // e.g. 'Breakfast'
}

export interface Meal {
  type: string;
  items: MealItem[];
}

export interface DailyPlan {
  totalCalories: number;
  targetMacros: Macros;
  hydrationTarget?: number; // ml
  meals: Meal[];
  nutritionalAnalysis?: string;
  notes?: string;
  shoppingList?: string[];
  behavioralTips?: string[];
}

export interface LogItem extends MealItem {
  timestamp: number;
  type: string; // Breakfast, Lunch, etc.
}

export interface Habit {
  id: number;
  text: string;
  completed: boolean;
}

export interface WellnessState {
  mood: 'good' | 'neutral' | 'bad' | null;
  waterGlasses: number;
  habits: Habit[];
  notifications: {
    water: boolean;
    sleep: boolean;
    meals: boolean;
  };
}

export type AppView = 'dashboard' | 'diet_plan' | 'smart_meal' | 'personal_chat' | 'progress' | 'wellness' | 'challenges' | 'library' | 'profile' | 'security' | 'settings' | 'landing' | 'chat' | 'live';

export interface ScanHistoryItem {
    id: string;
    image: string;
    resultName?: string;
    date: string;
}

export interface Recipe {
    title: string;
    description: string;
    ingredients: string[];
    steps: string[];
    calories: number;
    time: string;
    image: string;
}
