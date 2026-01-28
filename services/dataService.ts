import { supabase } from './supabase';
import { Package, Resident, VisitorLog, Occurrence, Boleto, PackageItem, Notice, ChatMessage, Staff } from '../types';
import { createNotification } from './notificationService';
import { getData, createData, updateData, deleteData, type GetDataOptions } from './offlineDataService';

// ============================================
// SERVIÇOS PARA PACOTES (ENCOMENDAS)
// ============================================

export const savePackage = async (pkg: Package): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    console.log('[savePackage] Iniciando salvamento de encomenda:', {
      recipient: pkg.recipient,
      unit: pkg.unit,
      recipientId: pkg.recipientId || 'null/undefined'
    });
    
    let recipientId: string | null = pkg.recipientId ?? null;
    
    // Se não tiver recipientId, tentar buscar pelo nome e unidade (apenas se online)
    if (!recipientId && pkg.recipient && pkg.unit && typeof navigator !== 'undefined' && navigator.onLine) {
      console.log('[savePackage] Buscando recipientId no banco...', {
        recipient: pkg.recipient,
        unit: pkg.unit
      });
      
      try {
        const { data: resident, error: residentError } = await supabase
          .from('residents')
          .select('id, name, unit')
          .eq('name', pkg.recipient.trim())
          .eq('unit', pkg.unit.trim())
          .maybeSingle();
        
        if (residentError) {
          console.warn('[savePackage] Erro ao buscar morador:', residentError);
        }
        
        if (resident) {
          recipientId = resident.id;
          console.log('[savePackage] ✅ recipientId encontrado:', recipientId, 'Morador:', resident.name, resident.unit);
        } else {
          console.warn('[savePackage] ⚠️ Morador não encontrado:', {
            recipient: pkg.recipient,
            unit: pkg.unit,
            message: 'A encomenda será salva, mas a notificação não será criada porque o morador não foi encontrado.'
          });
        }
      } catch (err) {
        console.warn('[savePackage] Erro ao buscar morador (offline?):', err);
      }
    }
    
    // Log final do recipientId
    console.log('[savePackage] recipientId final:', recipientId || 'NULL - Notificação não será criada');

    // Preparar dados para inserção. Não incluir id: cada encomenda é novo registro (UUID em createData).
    const insertData: any = {
      recipient_id: recipientId,
      recipient_name: pkg.recipient,
      unit: pkg.unit,
      type: pkg.type,
      received_at: pkg.receivedAt,
      display_time: pkg.displayTime,
      status: pkg.status,
      deadline_minutes: pkg.deadlineMinutes || 45,
      resident_phone: pkg.residentPhone || null,
      received_by_name: pkg.receivedByName || null
    };

    // Adicionar campos opcionais se existirem
    if (pkg.qrCodeData) {
      insertData.qr_code_data = pkg.qrCodeData;
    }
    if (pkg.imageUrl) {
      insertData.image_url = pkg.imageUrl;
    }

    // Usar camada offline para salvar
    const result = await createData('packages', insertData);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const packageId = result.id!;

    // Salvar itens do pacote se houver (usando camada offline)
    if (pkg.items && pkg.items.length > 0) {
      for (const item of pkg.items) {
        await createData('package_items', {
          package_id: packageId,
          name: item.name,
          description: item.description || null
        });
      }
    }

    // Criar notificação automática (apenas se online e tiver recipientId)
    if (recipientId && typeof navigator !== 'undefined' && navigator.onLine) {
      console.log('[Notificação] ✅ Condições OK. Criando notificação para morador:', recipientId, 'Encomenda:', packageId);
      
      try {
        // Montar mensagem da notificação com nome do porteiro
        const porteiroName = pkg.receivedByName || 'Porteiro';
        const notificationMessage = pkg.receivedByName 
          ? `Uma encomenda foi recebida por ${porteiroName} e está disponível para retirada.`
          : 'Uma encomenda foi recebida e está disponível para retirada.';
        
        const notificationResult = await createNotification(
          recipientId,
          '📦 Nova encomenda na portaria',
          notificationMessage,
          'package',
          packageId,
          pkg.imageUrl ?? undefined
        );

        if (notificationResult.success) {
          console.log('[Notificação] ✅✅✅ Notificação criada com sucesso! ID:', notificationResult.id);
        } else {
          console.warn('[Notificação] ⚠️ Não foi possível criar notificação:', notificationResult.error);
        }
      } catch (err: any) {
        console.warn('[Notificação] ⚠️ Erro ao criar notificação:', err);
      }
    } else {
      console.log('[Notificação] ⚠️ Notificação não criada (offline ou sem recipientId)');
    }

    return { success: true, id: packageId };
  } catch (err: any) {
    console.error('Erro ao salvar pacote:', err);
    return { success: false, error: err.message || 'Erro ao salvar pacote' };
  }
};

export const updatePackage = async (pkg: Package, deliveredBy?: string | null): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateDataObj: any = {
      id: pkg.id,
      recipient_name: pkg.recipient,
      unit: pkg.unit,
      type: pkg.type,
      status: pkg.status,
      delivered_at: pkg.status === 'Entregue' ? new Date().toISOString() : null
    };

    // Se foi marcado como entregue, registrar quem entregou
    if (pkg.status === 'Entregue' && deliveredBy) {
      updateDataObj.delivered_by = deliveredBy;
    } else if (pkg.status !== 'Entregue') {
      // Se não está entregue, limpar delivered_by
      updateDataObj.delivered_by = null;
    }

    const result = await updateData('packages', updateDataObj);

    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar pacote:', err);
    return { success: false, error: err.message || 'Erro ao atualizar pacote' };
  }
};

export const deletePackage = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await deleteData('packages', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao excluir encomenda:', err);
    return { success: false, error: err?.message || 'Erro ao excluir encomenda' };
  }
};

export type GetPackagesResult = { data: Package[]; error?: string };

export const getPackages = async (): Promise<GetPackagesResult> => {
  try {
    // Função para buscar do Supabase
    const fetchRemote = async () => {
      const { data, error } = await supabase
        .from('packages')
        .select(`
          id,
          recipient_id,
          recipient_name,
          unit,
          type,
          received_at,
          display_time,
          status,
          deadline_minutes,
          resident_phone,
          delivered_at,
          delivered_by,
          received_by_name,
          qr_code_data,
          image_url,
          created_at,
          updated_at
        `)
        .order('received_at', { ascending: false });

      if (error) throw error;
      return data || [];
    };

    // Buscar do cache primeiro (offline-first)
    const result = await getData<any>('packages', {
      fetchRemote,
      onRemoteUpdate: (remote) => {
        // Atualizar itens dos pacotes quando dados remotos chegarem
        updatePackageItems(remote.map((p: any) => p.id));
      }
    });

    // Buscar itens dos pacotes do cache
    const packageIds = result.data.map((p: any) => p.id);
    const packageItemsMap = await getPackageItemsMap(packageIds);

    // Converter para o formato Package
    const packages: Package[] = result.data.map((p: any) => ({
      id: p.id,
      recipient: p.recipient_name,
      unit: p.unit,
      type: p.type,
      receivedAt: p.received_at,
      displayTime: p.display_time || new Date(p.received_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      status: p.status as 'Pendente' | 'Entregue',
      deadlineMinutes: p.deadline_minutes || 45,
      residentPhone: p.resident_phone || undefined,
      recipientId: p.recipient_id || undefined,
      imageUrl: p.image_url || null,
      qrCodeData: p.qr_code_data || null,
      receivedByName: p.received_by_name || null,
      items: packageItemsMap[p.id] || []
    }));

    // Garantir ordenação por data (mais recente primeiro) - redundante mas garante consistência
    packages.sort((a, b) => {
      const dateA = new Date(a.receivedAt).getTime();
      const dateB = new Date(b.receivedAt).getTime();
      return dateB - dateA; // Mais recente primeiro
    });

    // Log para debug
    console.log('[getPackages]', {
      totalPackages: packages.length,
      fromCache: result.fromCache,
      error: result.error,
      samplePackages: packages.slice(0, 3).map(p => ({ id: p.id, unit: p.unit, status: p.status, receivedAt: p.receivedAt }))
    });

    return { data: packages, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar pacotes:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar encomendas' };
  }
};

// Helper para buscar itens dos pacotes
async function getPackageItemsMap(packageIds: string[]): Promise<Record<string, PackageItem[]>> {
  if (packageIds.length === 0) return {};
  
  try {
    // Buscar do cache primeiro
    const cachedItems = await getData<any>('package_items', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('package_items')
          .select('id, package_id, name, description')
          .in('package_id', packageIds);
        if (error) throw error;
        return data || [];
      }
    });

    const map: Record<string, PackageItem[]> = {};
    cachedItems.data.forEach((item: any) => {
      if (!map[item.package_id]) {
        map[item.package_id] = [];
      }
      map[item.package_id].push({
        id: item.id,
        name: item.name,
        description: item.description || ''
      });
    });
    return map;
  } catch (err) {
    console.warn('Erro ao buscar itens dos pacotes:', err);
    return {};
  }
}

// Helper para atualizar itens quando pacotes são atualizados
async function updatePackageItems(packageIds: string[]): Promise<void> {
  if (packageIds.length === 0) return;
  try {
    const { data, error } = await supabase
      .from('package_items')
      .select('id, package_id, name, description')
      .in('package_id', packageIds);
    if (!error && data) {
      await getData<any>('package_items', {
        fetchRemote: async () => data
      });
    }
  } catch (err) {
    console.warn('Erro ao atualizar itens dos pacotes:', err);
  }
}

// ============================================
// SERVIÇOS PARA MORADORES
// ============================================

export type GetResidentsResult = { data: Resident[]; error?: string };

export const getResidents = async (): Promise<GetResidentsResult> => {
  try {
    const result = await getData<any>('residents', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('residents')
          .select('id, name, unit, email, phone, whatsapp')
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      }
    });

    const list = result.data.map((r: any) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      email: r.email || '',
      phone: r.phone || '',
      whatsapp: r.whatsapp || ''
    }));
    
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar moradores:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar moradores' };
  }
};

export const saveResident = async (resident: Resident): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const isNew = !resident.id || resident.id.startsWith('temp-');
    const payload: any = {
      id: isNew ? undefined : resident.id,
      name: resident.name,
      unit: resident.unit,
      email: resident.email || null,
      phone: resident.phone || null,
      whatsapp: resident.whatsapp || null
    };

    const result = isNew 
      ? await createData('residents', payload)
      : await updateData('residents', payload);

    return { success: result.success, id: result.id || resident.id, error: result.error };
  } catch (err: any) {
    console.error('Erro ao salvar morador:', err);
    return { success: false, error: err.message || 'Erro ao salvar morador' };
  }
};

export const deleteResident = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await deleteData('residents', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao deletar morador:', err);
    return { success: false, error: err.message || 'Erro ao deletar morador' };
  }
};

// ============================================
// SERVIÇOS PARA VISITANTES
// ============================================

export const saveVisitor = async (visitor: VisitorLog): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Buscar resident_id (apenas se online)
    let residentId: string | null = null;
    if (visitor.residentName && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data: resident } = await supabase
          .from('residents')
          .select('id')
          .eq('name', visitor.residentName)
          .eq('unit', visitor.unit)
          .maybeSingle();
        residentId = resident?.id || null;
      } catch (err) {
        console.warn('Erro ao buscar resident_id (offline?):', err);
      }
    }

    const payload: any = {
      resident_id: residentId,
      resident_name: visitor.residentName,
      unit: visitor.unit,
      visitor_count: visitor.visitorCount || 1,
      visitor_names: visitor.visitorNames || null,
      type: visitor.type ?? 'Visita',
      doc: visitor.doc ?? null,
      vehicle: visitor.vehicle ?? null,
      plate: visitor.plate ?? null,
      entry_time: visitor.entryTime,
      exit_time: visitor.exitTime || null,
      status: visitor.status
    };

    const result = await createData('visitors', payload);
    return { success: result.success, id: result.id, error: result.error };
  } catch (err: any) {
    console.error('Erro ao salvar visitante:', err);
    return { success: false, error: err.message || 'Erro ao salvar visitante' };
  }
};

export const updateVisitor = async (visitor: VisitorLog): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await updateData('visitors', {
      id: visitor.id,
      exit_time: visitor.exitTime || null,
      status: visitor.status
    });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar visitante:', err);
    return { success: false, error: err.message || 'Erro ao atualizar visitante' };
  }
};

export type GetVisitorsResult = { data: VisitorLog[]; error?: string };

export const getVisitors = async (filterByUnit?: string): Promise<GetVisitorsResult> => {
  try {
    const result = await getData<any>('visitors', {
      fetchRemote: async () => {
        let query = supabase
          .from('visitors')
          .select('id, resident_name, unit, visitor_count, visitor_names, type, entry_time, exit_time, status');
        
        // Se fornecido, filtrar por unidade (para moradores verem apenas seus visitantes)
        if (filterByUnit) {
          query = query.eq('unit', filterByUnit);
        }
        
        const { data, error } = await query.order('entry_time', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    });

    const list: VisitorLog[] = result.data.map((v: any) => ({
      id: v.id,
      residentName: v.resident_name,
      unit: v.unit,
      visitorCount: v.visitor_count ?? 1,
      visitorNames: v.visitor_names ?? undefined,
      type: v.type ?? 'Visita',
      entryTime: v.entry_time,
      exitTime: v.exit_time ?? undefined,
      status: v.status as 'active' | 'completed'
    }));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar visitantes:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar visitantes' };
  }
};

// ============================================
// SERVIÇOS PARA OCORRÊNCIAS
// ============================================

export const saveOccurrence = async (occurrence: Occurrence): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Buscar resident_id (apenas se online)
    let residentId: string | null = null;
    if (occurrence.residentName && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data: resident } = await supabase
          .from('residents')
          .select('id')
          .eq('name', occurrence.residentName)
          .eq('unit', occurrence.unit)
          .maybeSingle();
        residentId = resident?.id || null;
      } catch (err) {
        console.warn('Erro ao buscar resident_id (offline?):', err);
      }
    }

    const payload: any = {
      resident_id: residentId,
      resident_name: occurrence.residentName,
      unit: occurrence.unit,
      description: occurrence.description,
      status: occurrence.status,
      date: occurrence.date,
      reported_by: occurrence.reportedBy
    };

    const result = await createData('occurrences', payload);
    return { success: result.success, id: result.id, error: result.error };
  } catch (err: any) {
    console.error('Erro ao salvar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao salvar ocorrência' };
  }
};

export const updateOccurrence = async (occurrence: Occurrence): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await updateData('occurrences', {
      id: occurrence.id,
      description: occurrence.description,
      status: occurrence.status
    });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao atualizar ocorrência' };
  }
};

export const deleteOccurrence = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await deleteData('occurrences', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao deletar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao deletar ocorrência' };
  }
};

export type GetOccurrencesResult = { data: Occurrence[]; error?: string };

export const getOccurrences = async (): Promise<GetOccurrencesResult> => {
  try {
    const result = await getData<any>('occurrences', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('occurrences')
          .select('id, resident_name, unit, description, status, date, reported_by')
          .order('date', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    });

    const list: Occurrence[] = result.data.map((o: any) => ({
      id: o.id,
      residentName: o.resident_name,
      unit: o.unit,
      description: o.description,
      status: o.status as 'Aberto' | 'Em Andamento' | 'Resolvido',
      date: typeof o.date === 'string' ? o.date : new Date(o.date).toISOString(),
      reportedBy: o.reported_by
    }));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar ocorrências:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar ocorrências' };
  }
};

// ============================================
// SERVIÇOS PARA BOLETOS
// ============================================

export const saveBoleto = async (boleto: Boleto): Promise<{ success: boolean; error?: string; id?: string }> => {
  // Boletos são críticos e não devem funcionar offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'Boletos não podem ser salvos offline. Conecte-se à internet.' };
  }

  try {
    // Buscar resident_id
    let residentId: string | null = null;
    if (boleto.residentName) {
      try {
        const { data: resident } = await supabase
          .from('residents')
          .select('id')
          .eq('name', boleto.residentName)
          .eq('unit', boleto.unit)
          .maybeSingle();
        residentId = resident?.id || null;
      } catch (err) {
        console.warn('Erro ao buscar resident_id:', err);
      }
    }

    const payload: any = {
      resident_id: residentId,
      resident_name: boleto.residentName,
      unit: boleto.unit,
      reference_month: boleto.referenceMonth,
      due_date: boleto.dueDate,
      amount: boleto.amount,
      status: boleto.status,
      barcode: boleto.barcode || null,
      pdf_url: boleto.pdfUrl || null,
      paid_date: boleto.paidDate || null,
      description: boleto.description || null
    };

    const result = await createData('boletos', payload);
    return { success: result.success, id: result.id, error: result.error };
  } catch (err: any) {
    console.error('Erro ao salvar boleto:', err);
    return { success: false, error: err.message || 'Erro ao salvar boleto' };
  }
};

export const updateBoleto = async (boleto: Boleto): Promise<{ success: boolean; error?: string }> => {
  // Boletos são críticos e não devem funcionar offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'Boletos não podem ser atualizados offline. Conecte-se à internet.' };
  }

  try {
    const result = await updateData('boletos', {
      id: boleto.id,
      status: boleto.status,
      paid_date: boleto.paidDate || null
    });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar boleto:', err);
    return { success: false, error: err.message || 'Erro ao atualizar boleto' };
  }
};

export const deleteBoleto = async (id: string): Promise<{ success: boolean; error?: string }> => {
  // Boletos são críticos e não devem funcionar offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'Boletos não podem ser deletados offline. Conecte-se à internet.' };
  }

  try {
    const result = await deleteData('boletos', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao deletar boleto:', err);
    return { success: false, error: err.message || 'Erro ao deletar boleto' };
  }
};

export type GetBoletosResult = { data: Boleto[]; error?: string };

export const getBoletos = async (): Promise<GetBoletosResult> => {
  try {
    const result = await getData<any>('boletos', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('boletos')
          .select('id, resident_name, unit, reference_month, due_date, amount, status, barcode, pdf_url, paid_date, description')
          .order('due_date', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    });

    const toDateStr = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      const d = new Date(v);
      return d.toISOString().slice(0, 10);
    };

    const list: Boleto[] = result.data.map((b: any) => ({
      id: b.id,
      residentName: b.resident_name,
      unit: b.unit,
      referenceMonth: b.reference_month,
      dueDate: toDateStr(b.due_date),
      amount: Number(b.amount),
      status: b.status as 'Pendente' | 'Pago' | 'Vencido',
      barcode: b.barcode ?? undefined,
      pdfUrl: b.pdf_url ?? undefined,
      paidDate: b.paid_date ? toDateStr(b.paid_date) : undefined,
      description: b.description ?? undefined
    }));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar boletos:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar boletos' };
  }
};


// ============================================
// SERVIÇOS PARA AVISOS (NOTICES)
// ============================================

export type GetNoticesResult = { data: Notice[]; error?: string };

const toIso = (v: any) => (v ? (typeof v === 'string' ? v : new Date(v).toISOString()) : '');

function mapNoticesFromRaw(raw: any[]): Notice[] {
  return raw.map((n: any) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    author: n.author,
    authorRole: n.author_role as 'MORADOR' | 'SINDICO' | 'PORTEIRO',
    date: toIso(n.date),
    category: n.category ?? undefined,
    priority: (n.priority as 'high' | 'normal') ?? 'normal',
    pinned: !!n.pinned,
    read: false
  }));
}

/**
 * Busca avisos do mural. Todos os perfis (Morador, Portaria, Síndico) devem
 * receber os mesmos avisos. onRemoteUpdate atualiza o estado quando o fetch
 * remoto terminar (ex.: ao abrir a aba Mural).
 */
export const getNotices = async (
  onRemoteUpdate?: (notices: Notice[]) => void
): Promise<GetNoticesResult> => {
  try {
    const result = await getData<any>('notices', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('notices')
          .select('id, title, content, author, author_role, date, category, priority, pinned')
          .order('date', { ascending: false });
        if (error) throw error;
        return data || [];
      },
      onRemoteUpdate:
        onRemoteUpdate ? (raw) => onRemoteUpdate(mapNoticesFromRaw(raw)) : undefined
    });

    const list = mapNoticesFromRaw(result.data);
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar avisos:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar avisos' };
  }
};

export const saveNotice = async (notice: Notice): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const result = await createData('notices', {
      title: notice.title,
      content: notice.content,
      author: notice.author,
      author_role: notice.authorRole,
      date: notice.date,
      category: notice.category || null,
      priority: notice.priority ?? 'normal',
      pinned: notice.pinned ?? false
    });
    return { success: result.success, id: result.id, error: result.error };
  } catch (err: any) {
    console.error('Erro ao salvar aviso:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar aviso' };
  }
};

export const updateNotice = async (notice: Notice): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await updateData('notices', {
      id: notice.id,
      title: notice.title,
      content: notice.content,
      category: notice.category || null,
      priority: notice.priority ?? 'normal',
      pinned: notice.pinned ?? false
    });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar aviso:', err);
    return { success: false, error: err.message || 'Erro ao atualizar aviso' };
  }
};

export const deleteNotice = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await deleteData('notices', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao deletar aviso:', err);
    return { success: false, error: err.message || 'Erro ao deletar aviso' };
  }
};

// ============================================
// SERVIÇOS PARA CHAT
// ============================================

export type GetChatMessagesResult = { data: ChatMessage[]; error?: string };

export const getChatMessages = async (): Promise<GetChatMessagesResult> => {
  try {
    const result = await getData<any>('chat_messages', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id, text, sender_role, timestamp, read')
          .order('timestamp', { ascending: true });
        if (error) throw error;
        return data || [];
      }
    });

    const toIso = (v: any) => (v ? (typeof v === 'string' ? v : new Date(v).toISOString()) : '');

    const list: ChatMessage[] = result.data.map((m: any) => ({
      id: m.id,
      text: m.text,
      senderRole: m.sender_role as 'MORADOR' | 'SINDICO' | 'PORTEIRO',
      timestamp: toIso(m.timestamp),
      read: !!m.read
    }));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar chat:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar chat' };
  }
};

export const saveChatMessage = async (msg: ChatMessage): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const result = await createData('chat_messages', {
      text: msg.text,
      sender_role: msg.senderRole,
      timestamp: msg.timestamp,
      read: msg.read ?? false
    });
    return { success: result.success, id: result.id, error: result.error };
  } catch (err: any) {
    console.error('Erro ao salvar mensagem:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar mensagem' };
  }
};

// ============================================
// SERVIÇOS PARA FUNCIONÁRIOS (STAFF)
// ============================================

export type GetStaffResult = { data: Staff[]; error?: string };

export const getStaff = async (): Promise<GetStaffResult> => {
  try {
    const result = await getData<any>('staff', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('staff')
          .select('id, name, role, status, shift, phone, email')
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      }
    });

    const list: Staff[] = result.data.map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      status: s.status as 'Ativo' | 'Férias' | 'Licença',
      shift: s.shift as 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada' | 'Comercial',
      phone: s.phone ?? undefined,
      email: s.email ?? undefined
    }));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar funcionários:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar funcionários' };
  }
};

// Helper para gerar username único baseado no nome
const generateUsername = (name: string): string => {
  // Normalizar nome: remover acentos, converter para minúsculas, substituir espaços por underscore
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_') // Substitui caracteres especiais por underscore
    .replace(/_+/g, '_') // Remove underscores duplicados
    .replace(/^_|_$/g, ''); // Remove underscores no início e fim
  
  return normalized || 'porteiro';
};

/** Busca login (usuário e senha) do porteiro para o síndico ver no modal de edição. Senha só é retornada se estiver em plain. */
export const getPorteiroLoginInfo = async (staff: Staff): Promise<{ username: string; password: string } | null> => {
  if ((staff.role || '').toLowerCase() !== 'porteiro') return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username, password_hash')
      .eq('role', 'PORTEIRO')
      .eq('name', staff.name.trim())
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const hash = data.password_hash;
    const password = hash && hash.startsWith('plain:') ? hash.substring(6) : null;
    if (password == null) return { username: data.username, password: '123456' };
    return { username: data.username, password };
  } catch (e) {
    console.warn('[getPorteiroLoginInfo]', e);
    return null;
  }
};

// Helper para criar usuário na tabela users quando porteiro é importado
// passwordPlain: senha pessoal do porteiro (obrigatória no cadastro manual; em import usa 123456 se não informada)
const createUserFromStaff = async (staff: Staff, passwordPlain?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Apenas criar usuário se for porteiro
    if (staff.role.toLowerCase() !== 'porteiro') {
      return { success: true };
    }

    // Gerar username único
    let username = generateUsername(staff.name);
    let counter = 1;
    let finalUsername = username;

    // Verificar se username já existe e gerar um único
    while (true) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', finalUsername)
        .maybeSingle();

      if (!existing) break; // Username disponível
      
      finalUsername = `${username}_${counter}`;
      counter++;
      
      // Limite de segurança para evitar loop infinito
      if (counter > 100) {
        finalUsername = `${username}_${Date.now()}`;
        break;
      }
    }

    // Senha: pessoal se informada, senão padrão 123456 (ex.: import em lote)
    const plain = (passwordPlain && passwordPlain.trim().length >= 6) ? passwordPlain.trim() : '123456';
    const passwordHash = `plain:${plain}`;

    // Criar usuário na tabela users
    const { error: userError } = await supabase
      .from('users')
      .insert({
        username: finalUsername,
        password_hash: passwordHash,
        role: 'PORTEIRO',
        name: staff.name,
        email: staff.email || null,
        phone: staff.phone || null,
        is_active: staff.status === 'Ativo'
      });

    if (userError) {
      // Se o erro for de duplicidade, tentar atualizar
      if (userError.code === '23505' || userError.message.includes('duplicate')) {
        // Usuário já existe, atualizar dados (e senha se informada)
        const updatePayload: Record<string, unknown> = {
          name: staff.name,
          email: staff.email || null,
          phone: staff.phone || null,
          is_active: staff.status === 'Ativo'
        };
        if (passwordPlain && passwordPlain.trim().length >= 6) {
          updatePayload.password_hash = `plain:${passwordPlain.trim()}`;
        }
        const { error: updateError } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('username', finalUsername);

        if (updateError) {
          console.warn('[createUserFromStaff] Erro ao atualizar usuário existente:', updateError);
          return { success: false, error: updateError.message };
        }
        return { success: true };
      }
      
      console.warn('[createUserFromStaff] Erro ao criar usuário:', userError);
      return { success: false, error: userError.message };
    }

    console.log('[createUserFromStaff] ✅ Usuário criado para porteiro:', staff.name, 'Username:', finalUsername);
    return { success: true };
  } catch (err: any) {
    console.error('[createUserFromStaff] Erro inesperado:', err);
    return { success: false, error: err?.message ?? 'Erro ao criar usuário' };
  }
};

export const saveStaff = async (staff: Staff, options?: { passwordPlain?: string }): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const isNew = !staff.id || staff.id.startsWith('temp-');
    const payload: any = {
      id: isNew ? undefined : staff.id,
      name: staff.name,
      role: staff.role,
      status: staff.status ?? 'Ativo',
      shift: staff.shift ?? 'Comercial',
      phone: staff.phone || null,
      email: staff.email || null
    };

    const result = isNew 
      ? await createData('staff', payload)
      : await updateData('staff', payload);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const passwordPlain = options?.passwordPlain?.trim();
    // Se for um porteiro novo, criar usuário na tabela users com senha pessoal (ou padrão se import)
    if (isNew && staff.role.toLowerCase() === 'porteiro') {
      const userResult = await createUserFromStaff(staff, passwordPlain);
      if (!userResult.success) {
        console.warn('[saveStaff] Aviso: Funcionário salvo, mas não foi possível criar usuário:', userResult.error);
        // Não falhar o salvamento do staff, apenas avisar
      }
    } else if (!isNew && staff.role.toLowerCase() === 'porteiro') {
      // Se estiver atualizando um porteiro existente, atualizar também o usuário (senha só se informada)
      const userResult = await createUserFromStaff(staff, passwordPlain);
      if (!userResult.success) {
        console.warn('[saveStaff] Aviso: Funcionário atualizado, mas não foi possível atualizar usuário:', userResult.error);
      }
    }

    return { success: true, id: result.id || staff.id };
  } catch (err: any) {
    console.error('Erro ao salvar funcionário:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar funcionário' };
  }
};

export const deleteStaff = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await deleteData('staff', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao deletar funcionário:', err);
    return { success: false, error: err.message || 'Erro ao deletar funcionário' };
  }
};

// ============================================
// SERVIÇOS PARA ÁREAS E RESERVAS
// ============================================

export interface AreaRow {
  id: string;
  name: string;
  capacity: number;
  rules: string | null;
}

export type GetAreasResult = { data: AreaRow[]; error?: string };

export const getAreas = async (): Promise<GetAreasResult> => {
  try {
    const result = await getData<any>('areas', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('areas')
          .select('id, name, capacity, rules')
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      }
    });

    const list: AreaRow[] = result.data.map((a: any) => ({
      id: a.id,
      name: a.name,
      capacity: a.capacity ?? 0,
      rules: a.rules ?? null
    }));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar áreas:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar áreas' };
  }
};

export interface ReservationRow {
  id: string;
  areaId: string;
  areaName: string;
  residentId: string;
  residentName: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

export type GetReservationsResult = { data: ReservationRow[]; error?: string };

export const getReservations = async (): Promise<GetReservationsResult> => {
  try {
    const areasRes = await getAreas();
    const areaMap = Object.fromEntries(areasRes.data.map((a) => [a.id, a.name]));

    const result = await getData<any>('reservations', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('reservations')
          .select('id, area_id, resident_id, resident_name, unit, date, start_time, end_time, status')
          .order('date', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    });

    const toDateStr = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v.slice(0, 10);
      return new Date(v).toISOString().slice(0, 10);
    };
    const toTimeStr = (v: any) => {
      if (!v) return '00:00';
      if (typeof v === 'string') return v.slice(0, 5);
      const d = new Date(`1970-01-01T${v}`);
      return d.toTimeString().slice(0, 5);
    };

    const list: ReservationRow[] = result.data.map((r: any) => ({
      id: r.id,
      areaId: r.area_id,
      areaName: areaMap[r.area_id] ?? '',
      residentId: r.resident_id,
      residentName: r.resident_name,
      unit: r.unit,
      date: toDateStr(r.date),
      startTime: toTimeStr(r.start_time),
      endTime: toTimeStr(r.end_time),
      status: r.status
    }));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar reservas:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar reservas' };
  }
};

export const saveReservation = async (r: {
  areaId: string;
  residentId: string;
  residentName: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const result = await createData('reservations', {
      area_id: r.areaId,
      resident_id: r.residentId,
      resident_name: r.residentName,
      unit: r.unit,
      date: r.date,
      start_time: r.startTime,
      end_time: r.endTime,
      status: r.status ?? 'scheduled'
    });
    return { success: result.success, id: result.id, error: result.error };
  } catch (err: any) {
    console.error('Erro ao salvar reserva:', err);
    return { success: false, error: err?.message ?? 'Erro ao salvar reserva' };
  }
};

export const updateReservation = async (
  id: string,
  updates: { status?: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await updateData('reservations', { id, ...updates });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar reserva:', err);
    return { success: false, error: err?.message ?? 'Erro ao atualizar reserva' };
  }
};
