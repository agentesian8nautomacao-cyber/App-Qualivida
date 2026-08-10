
import React, { useState } from 'react';
import { X, Calendar, Wrench, Shield, Package, Trash2, Check, ArrowRight, Flag, Layers, Briefcase } from 'lucide-react';
import { UserRole, TaskPriority, TaskCategory, Task } from '../types';

interface TaskCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    userRole: UserRole;
    onSave: (task: Task) => void;
}

// --- CONFIGURATION PER ROLE ---
const THEMES = {
    [UserRole.Manager]: {
        accentText: 'text-amber-500',
        bgAccent: 'bg-amber-500',
        headerLabel: 'NOVA DEMANDA',
        headerTitle: 'Delegar Tarefa',
        buttonLabel: 'Delegar Tarefa'
    },
    [UserRole.Doorman]: {
        accentText: 'text-emerald-500',
        bgAccent: 'bg-emerald-500',
        headerLabel: 'REGISTRAR AÇÃO',
        headerTitle: 'Criar Lembrete',
        buttonLabel: 'Registrar Lembrete'
    },
    [UserRole.Resident]: { // Fallback
         accentText: 'text-blue-500',
         bgAccent: 'bg-blue-500',
         headerLabel: 'NOVO PEDIDO',
         headerTitle: 'Solicitar',
         buttonLabel: 'Enviar'
    }
};

const TaskCreator: React.FC<TaskCreatorProps> = ({ isOpen, onClose, userRole, onSave }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [category, setCategory] = useState<TaskCategory>('maintenance');
    const [deadline, setDeadline] = useState('Hoje');

    if (!isOpen) return null;

    const theme = THEMES[userRole] || THEMES[UserRole.Doorman];

    const handleSave = () => {
        if (!title.trim()) return;

        const newTask: Task = {
            id: Date.now().toString(),
            title,
            description,
            priority,
            category,
            deadline,
            createdByRole: userRole,
            timestamp: Date.now(),
            status: 'pending'
        };

        onSave(newTask);
        // Reset form
        setTitle('');
        setDescription('');
        onClose();
    };

    const priorities: { id: TaskPriority; label: string; color: string }[] = [
        { id: 'low', label: 'Baixa', color: 'bg-blue-500' },
        { id: 'medium', label: 'Média', color: 'bg-yellow-500' },
        { id: 'high', label: 'Alta', color: 'bg-orange-500' },
        { id: 'urgent', label: 'Urgente', color: 'bg-red-500' },
    ];

    const categories: { id: TaskCategory; label: string; icon: any }[] = [
        { id: 'maintenance', label: 'Manutenção', icon: Wrench },
        { id: 'security', label: 'Segurança', icon: Shield },
        { id: 'delivery', label: 'Entregas', icon: Package },
        { id: 'cleaning', label: 'Limpeza', icon: Trash2 },
        { id: 'admin', label: 'Admin', icon: Briefcase },
    ];

    const deadlines = ["Hoje", "Amanhã", "Próximo Turno", "Semana que vem"];

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            />

            {/* Card Content */}
            <div className="relative w-full max-w-lg bg-[#18181b] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-500 border border-white/5 overflow-hidden">
                
                {/* Visual Indicator of Role */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${theme.bgAccent} opacity-50`}></div>

                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${theme.accentText} opacity-80 mb-1 block`}>
                            {theme.headerLabel}
                        </span>
                        <h2 className="text-white font-serif text-2xl">
                            {theme.headerTitle}
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 bg-white/5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Inputs */}
                <div className="space-y-6">
                    {/* Title Input */}
                    <div className="relative">
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="O que precisa ser feito?"
                            className="w-full bg-transparent text-3xl font-serif text-white placeholder:text-zinc-700 outline-none border-none p-0 opacity-100"
                            autoFocus
                        />
                    </div>

                    {/* Description Input */}
                    <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Adicione detalhes, local ou instruções específicas..."
                        className="w-full h-24 bg-transparent text-zinc-400 placeholder:text-zinc-700 outline-none resize-none text-sm leading-relaxed"
                    />

                    {/* Smart Selectors (Horizontal Scrolls) */}
                    <div className="space-y-4">
                        
                        {/* Priority Pills */}
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase mb-2">
                                <Flag size={10} /> Prioridade
                            </label>
                            <div className="flex gap-2">
                                {priorities.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPriority(p.id)}
                                        className={`px-3 py-1.5 rounded-full flex items-center gap-2 transition-all border ${
                                            priority === p.id 
                                            ? 'bg-white/10 border-white/20 text-white' 
                                            : 'bg-transparent border-white/5 text-zinc-600 hover:text-zinc-400'
                                        }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${p.color} ${priority === p.id ? 'shadow-[0_0_8px_currentColor]' : ''}`} />
                                        <span className="text-xs font-medium">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category Pills */}
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase mb-2">
                                <Layers size={10} /> Categoria
                            </label>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                {categories.map(c => {
                                    const Icon = c.icon;
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setCategory(c.id)}
                                            className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-all border flex-shrink-0 ${
                                                category === c.id 
                                                ? `bg-white/10 border-white/20 text-white` 
                                                : 'bg-transparent border-white/5 text-zinc-600 hover:text-zinc-400'
                                            }`}
                                        >
                                            <Icon size={14} />
                                            <span className="text-xs font-medium">{c.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                         {/* Deadline Pills */}
                         <div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase mb-2">
                                <Calendar size={10} /> Prazo
                            </label>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                {deadlines.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDeadline(d)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap ${
                                            deadline === d 
                                            ? 'bg-zinc-800 border-zinc-600 text-zinc-200' 
                                            : 'bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-700'
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Action */}
                <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={!title.trim()}
                        className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-black transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg ${theme.bgAccent}`}
                    >
                        {theme.buttonLabel}
                        <ArrowRight size={20} />
                    </button>
                </div>

            </div>
        </div>
    );
};

export default TaskCreator;
