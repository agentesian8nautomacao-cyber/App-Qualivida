import { supabase } from './supabase';
import { Package, Resident, VisitorLog, Occurrence, Boleto, PackageItem, Notice, ChatMessage, Staff } from '../types';
import { createNotification } from './notificationService';
import { getData, createData, updateData, deleteData, upsertCachedRecord, setCachedTable, type GetDataOptions } from './offlineDataService';
import { createClient } from '@supabase/supabase-js';
import { calculateFileSHA256 } from '../utils/hashUtils';
import { logAdminAudit } from './adminAudit';

// ============================================
// SERVIÇOS PARA PACOTES (ENCOMENDAS)
// ============================================

type DbPackageStatus = 'pendente' | 'recebida';

function toDbPackageStatus(status: any): DbPackageStatus {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'pendente' || raw === 'p') return 'pendente';
  if (raw === 'recebida' || raw === 'entregue' || raw === 'e') return 'recebida';
  // legado PT-BR
  if (raw === 'pendente') return 'pendente';
  if (raw === 'entregue') return 'recebida';
  return 'pendente';
}

function fromDbPackageStatus(status: any): DbPackageStatus {
  return toDbPackageStatus(status);
}

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
      status: toDbPackageStatus(pkg.status),
      deadline_minutes: pkg.deadlineMinutes || 45,
      resident_phone: pkg.residentPhone || null,
      received_by_name: pkg.receivedByName || null,
      oculta_para_morador: false,
      data_recebimento: null
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
    const dbStatus = toDbPackageStatus(pkg.status);
    const receiptAt = dbStatus === 'recebida' ? new Date().toISOString() : null;

    const updateDataObj: any = {
      id: pkg.id,
      status: dbStatus,
      data_recebimento: receiptAt,
      delivered_at: receiptAt
    };

    // Se foi marcado como entregue, registrar quem entregou
    if (dbStatus === 'recebida' && deliveredBy) {
      updateDataObj.delivered_by = deliveredBy;
    } else if (dbStatus !== 'recebida') {
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

export const hidePackageForResident = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await updateData('packages', { id, oculta_para_morador: true });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao ocultar encomenda:', err);
    return { success: false, error: err?.message || 'Erro ao ocultar encomenda' };
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
          oculta_para_morador,
          data_recebimento,
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
      status: fromDbPackageStatus(p.status),
      deadlineMinutes: p.deadline_minutes || 45,
      residentPhone: p.resident_phone || undefined,
      recipientId: p.recipient_id || undefined,
      imageUrl: p.image_url || null,
      qrCodeData: p.qr_code_data || null,
      receivedByName: p.received_by_name || null,
      receiptAt: p.data_recebimento ?? p.delivered_at ?? null,
      hiddenForResident: !!p.oculta_para_morador,
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
          // extra_data é necessário para identificação por CPF (importação de boletos)
          .select('id, name, unit, email, phone, whatsapp, extra_data')
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
      whatsapp: r.whatsapp || '',
      extraData: r.extra_data ?? undefined
    }));
    
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar moradores:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar moradores' };
  }
};

export const saveResident = async (resident: Resident, options?: { passwordPlain?: string }): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const isNew = !resident.id || resident.id.startsWith('temp-');
    const emailRaw = (resident.email || '').toString().trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isNew && (!emailRaw || !emailRegex.test(emailRaw))) {
      return {
        success: false,
        error: 'E-mail válido obrigatório para morador. Necessário para login e recuperação de senha.'
      };
    }

    let authUserId: string | null = null;
    if (isNew && emailRaw && emailRegex.test(emailRaw)) {
      const pwd = (options?.passwordPlain && options.passwordPlain.length >= 6)
        ? options.passwordPlain
        : '123456';
      authUserId = await createAuthUserViaApi(emailRaw, pwd);
      if (!authUserId) {
        return {
          success: false,
          error: 'Não foi possível criar usuário em auth.users. Adicione SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL no Vercel.'
        };
      }
    }

    const payload: any = {
      id: isNew ? undefined : resident.id,
      name: resident.name,
      unit: resident.unit,
      email: resident.email || null,
      phone: resident.phone || null,
      whatsapp: resident.whatsapp || null
    };
    if (authUserId) payload.auth_user_id = authUserId;

    if (resident.extraData !== undefined || resident.vehiclePlate || resident.vehicleModel || resident.vehicleColor) {
      const baseExtra = resident.extraData || {};
      payload.extra_data = {
        ...baseExtra,
        vehiclePlate: resident.vehiclePlate || baseExtra.vehiclePlate,
        vehicleModel: resident.vehicleModel || baseExtra.vehicleModel,
        vehicleColor: resident.vehicleColor || baseExtra.vehicleColor
      };
    }

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

type DbVisitorStatus = 'pendente' | 'confirmado' | 'finalizado';

function toDbVisitorStatus(status: any): DbVisitorStatus {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'pendente') return 'pendente';
  if (raw === 'confirmado') return 'confirmado';
  if (raw === 'finalizado') return 'finalizado';
  // legado
  if (raw === 'active') return 'confirmado';
  if (raw === 'completed') return 'finalizado';
  return 'pendente';
}

function fromDbVisitorStatus(status: any): VisitorLog['status'] {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'pendente' || raw === 'confirmado' || raw === 'finalizado') return raw as any;
  if (raw === 'active') return 'confirmado';
  if (raw === 'completed') return 'finalizado';
  return 'pendente';
}

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
      morador_id: visitor.moradorId ?? residentId,
      nome_visitante: visitor.visitorName ?? visitor.visitorNames ?? null,
      observacao: visitor.observation ?? null,
      visitor_count: visitor.visitorCount || 1, // legado
      visitor_names: visitor.visitorNames || visitor.visitorName || null, // legado
      type: visitor.type ?? 'Visita', // legado
      doc: visitor.doc ?? null, // legado
      vehicle: visitor.vehicle ?? null, // legado
      plate: visitor.plate ?? null, // legado
      data_registro: new Date().toISOString(),
      data_confirmacao: null,
      porteiro_id: null,
      entry_time: visitor.entryTime || null,
      exit_time: visitor.exitTime || null,
      status: toDbVisitorStatus(visitor.status)
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
      status: toDbVisitorStatus(visitor.status)
    });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar visitante:', err);
    return { success: false, error: err.message || 'Erro ao atualizar visitante' };
  }
};

/** Confirma entrada do visitante (porteiro/síndico) via RPC. */
export const confirmExpectedVisitor = async (visitorId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('confirm_expected_visitor', { p_visitor_id: visitorId });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erro ao confirmar visitante' };
  }
};

export type GetVisitorsResult = { data: VisitorLog[]; error?: string };

export const getVisitors = async (filterByUnit?: string): Promise<GetVisitorsResult> => {
  try {
    const result = await getData<any>('visitors', {
      fetchRemote: async () => {
        let query = supabase
          .from('visitors')
          .select('id, morador_id, resident_id, resident_name, unit, nome_visitante, observacao, visitor_count, visitor_names, type, entry_time, exit_time, status, registered_by, porteiro_id, data_registro, data_confirmacao');
        
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
      moradorId: v.morador_id ?? v.resident_id ?? undefined,
      residentName: v.resident_name,
      unit: v.unit,
      visitorCount: v.visitor_count ?? 1,
      visitorName: v.nome_visitante ?? undefined,
      observation: v.observacao ?? undefined,
      visitorNames: v.visitor_names ?? undefined, // legado
      type: v.type ?? 'Visita',
      entryTime: v.entry_time,
      exitTime: v.exit_time ?? undefined,
      status: fromDbVisitorStatus(v.status) as any,
      registeredBy: v.registered_by ?? undefined,
      confirmedAt: v.data_confirmacao ?? undefined,
      doormanId: v.porteiro_id ?? undefined
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

type DbOccurrenceStatus = 'aberta' | 'em_andamento' | 'resolvida';

function toDbOccurrenceStatus(status: Occurrence['status'] | string | null | undefined): DbOccurrenceStatus {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();
  // UI legado (PT-BR)
  if (lower === 'aberto' || lower === 'aberta') return 'aberta';
  if (lower.includes('andamento') || lower.replace(/\s+/g, '_') === 'em_andamento') return 'em_andamento';
  if (lower === 'resolvido' || lower === 'resolvida') return 'resolvida';
  // Padrão seguro
  return 'aberta';
}

function fromDbOccurrenceStatus(status: string | null | undefined): Occurrence['status'] {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'aberta' || raw === 'aberto') return 'Aberto';
  if (raw === 'em_andamento' || raw.includes('andamento')) return 'Em Andamento';
  if (raw === 'resolvida' || raw === 'resolvido') return 'Resolvido';
  // fallback para não quebrar UI em dados inesperados
  return 'Aberto';
}

function generateOccurrenceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const saveOccurrence = async (occurrence: Occurrence): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    // Usar resident_id do payload quando fornecido (ex.: morador criando); senão buscar por nome/unidade
    let residentId: string | null = occurrence.residentId ? String(occurrence.residentId).trim() || null : null;
    if (!residentId && occurrence.residentName && isOnline) {
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

    const id = occurrence.id && !occurrence.id.startsWith('temp-') ? occurrence.id : generateOccurrenceId();
    // Payload mínimo para INSERT funcionar mesmo sem migration 010 (sem updated_at, image_url, messages).
    const payloadMinimal: any = {
      id,
      resident_id: residentId,
      resident_name: occurrence.residentName,
      unit: occurrence.unit,
      description: occurrence.description,
      status: toDbOccurrenceStatus(occurrence.status),
      date: occurrence.date,
      reported_by: occurrence.reportedBy,
      deleted_by_admin: false
    };
    const payloadFull: any = {
      ...payloadMinimal,
      image_url: occurrence.imageUrl || null,
      messages: occurrence.messages || []
    };

    // Online: insert direto no Supabase (só colunas mínimas) para o admin ver; fallback em createData se falhar.
    if (isOnline) {
      const { data, error } = await supabase
        .from('occurrences')
        .insert(payloadMinimal)
        .select()
        .single();
      if (!error && data) {
        // Garantir messages no cache para a UI (backend pode não devolver se coluna não existir)
        const row = { ...data, messages: data.messages ?? occurrence.messages ?? [], image_url: data.image_url ?? occurrence.imageUrl ?? null };
        await upsertCachedRecord('occurrences', row);
        return { success: true, id: data.id };
      }
      // Log detalhado para debug (RLS, coluna faltando, etc.)
      const msg = error?.message ?? '';
      const hint =
        msg.includes('policy') || msg.includes('permission') || msg.includes('RLS')
          ? ' Aplique a migration 009_occurrences_rls_allow_insert_select.sql no Supabase.'
          : msg.includes('column') || error?.code === '42703'
            ? ' Aplique a migration 010_occurrences_add_updated_at.sql no Supabase.'
            : '';
      console.warn('[saveOccurrence] Insert direto falhou. O admin não verá a ocorrência até o sync.', {
        code: error?.code,
        message: msg,
        details: error?.details,
        hint: hint || 'Ver migrations 009 e 010 na pasta migrations.'
      });
    }

    const result = await createData('occurrences', payloadFull);
    if (!result.success) return { success: false, error: result.error };

    return { success: true, id: result.id };
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
      status: toDbOccurrenceStatus(occurrence.status),
      messages: occurrence.messages || []
    });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao atualizar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao atualizar ocorrência' };
  }
};

/** Exclusão por perfil: morador oculta só para si; admin/síndico/porteiro oculta só para staff. A ocorrência permanece visível para o outro. */
export const deleteOccurrence = async (
  id: string,
  opts?: { by?: 'resident' | 'admin' }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const by = opts?.by ?? 'admin';
    const payload = by === 'resident'
      ? { id, deleted_by_resident: true }
      : { id, deleted_by_admin: true };
    const result = await updateData('occurrences', payload);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao deletar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao deletar ocorrência' };
  }
};

export type GetOccurrencesResult = { data: Occurrence[]; error?: string };

/** Converte valor para string ISO; evita RangeError quando date é null/inválido. */
function occurrenceDateToIso(value: any): string {
  if (value == null || value === '') return new Date().toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function mapRowToOccurrence(o: any): Occurrence {
  return {
    id: o.id,
    residentId: o.resident_id ?? undefined,
    residentName: o.resident_name,
    unit: o.unit,
    description: o.description,
    status: fromDbOccurrenceStatus(o.status),
    date: occurrenceDateToIso(o.date),
    reportedBy: o.reported_by,
    imageUrl: o.image_url || null,
    messages: Array.isArray(o.messages) ? o.messages : [],
    deletedByAdmin: !!o.deleted_by_admin,
    deletedByResident: !!o.deleted_by_resident,
    isRead: o.is_read === true
  };
}

const OCCURRENCES_SELECT_FULL = 'id, resident_id, resident_name, unit, description, status, date, reported_by, deleted_by_admin, deleted_by_resident, image_url, messages, updated_at, is_read';
const OCCURRENCES_SELECT_MIN = 'id, resident_id, resident_name, unit, description, status, date, reported_by, deleted_by_admin';

/** Busca ocorrências no Supabase. Tenta select completo; em 400/coluna inexistente tenta só colunas básicas; se ambos falharem retorna [] para não quebrar a UI. */
async function fetchOccurrencesFromServer(): Promise<any[]> {
  const { data, error } = await supabase
    .from('occurrences')
    .select(OCCURRENCES_SELECT_FULL)
    .order('date', { ascending: false });
  if (!error) return data || [];
  const isBadRequest = (error as any).status === 400 || error.code === '42703' || String(error.message || '').toLowerCase().includes('column');
  if (isBadRequest) {
    const { data: dataMin, error: errMin } = await supabase
      .from('occurrences')
      .select(OCCURRENCES_SELECT_MIN)
      .order('date', { ascending: false });
    if (!errMin) return dataMin || [];
    console.warn('[fetchOccurrencesFromServer] Select mínimo também falhou. Aplique migrations 009 e 010 no Supabase.', errMin);
    return [];
  }
  throw error;
}

export const getOccurrences = async (opts?: { onRemoteUpdate?: (data: Occurrence[]) => void; forceRemote?: boolean }): Promise<GetOccurrencesResult> => {
  try {
    // Staff: forçar busca no servidor para sempre ver ocorrências criadas por moradores (ignora cache).
    if (opts?.forceRemote) {
      const raw = await fetchOccurrencesFromServer();
      const list = raw.map((o: any) => mapRowToOccurrence(o));
      await setCachedTable('occurrences', raw);
      opts.onRemoteUpdate?.(list);
      return { data: list };
    }

    const result = await getData<any>('occurrences', {
      fetchRemote: async () => fetchOccurrencesFromServer(),
      onRemoteUpdate: opts?.onRemoteUpdate
        ? (rows: any[]) => opts.onRemoteUpdate!(rows.map(mapRowToOccurrence))
        : undefined
    });

    const list: Occurrence[] = result.data.map((o: any) => mapRowToOccurrence(o));
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar ocorrências:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar ocorrências' };
  }
};

/** Busca uma ocorrência pelo ID direto no Supabase (evita cache local). Útil quando a lista ainda não tem a ocorrência (ex.: após criar ou em ambiente local). */
export const getOccurrenceById = async (id: string): Promise<{ data: Occurrence | null; error?: string }> => {
  try {
    if (!id || typeof navigator !== 'undefined' && !navigator.onLine) {
      return { data: null, error: 'Offline ou ID inválido' };
    }
    const idStr = String(id).trim();
    const { data: row, error } = await supabase
      .from('occurrences')
      .select(OCCURRENCES_SELECT_FULL)
      .eq('id', idStr)
      .maybeSingle();

    if (error) {
      console.warn('[getOccurrenceById]', error);
      return { data: null, error: error.message };
    }
    if (!row) return { data: null };

    const occ: Occurrence = {
      id: row.id,
      residentId: row.resident_id ?? undefined,
      residentName: row.resident_name,
      unit: row.unit,
      description: row.description,
      status: fromDbOccurrenceStatus(row.status),
      date: occurrenceDateToIso(row.date),
      reportedBy: row.reported_by,
      imageUrl: row.image_url || null,
      messages: Array.isArray(row.messages) ? row.messages : [],
      deletedByAdmin: !!row.deleted_by_admin,
      deletedByResident: !!row.deleted_by_resident,
      isRead: row.is_read === true
    };
    return { data: occ };
  } catch (err: any) {
    console.error('Erro ao buscar ocorrência por ID:', err);
    return { data: null, error: err?.message };
  }
};

/** Marca ocorrência como lida (morador). Notificação some do sino; a ocorrência continua na listagem. */
export const markOccurrenceAsRead = async (occurrenceId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await updateData('occurrences', { id: occurrenceId, is_read: true });
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('[markOccurrenceAsRead]', err);
    return { success: false, error: err?.message ?? 'Erro ao marcar como lida' };
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
    const explicitId =
      typeof (boleto as any)?.id === 'string' &&
      (boleto as any).id.trim() &&
      !(boleto as any).id.startsWith('temp-')
        ? (boleto as any).id.trim()
        : null;

    // Buscar resident_id (prioridade: payload já informado)
    let residentId: string | null = null;
    if (boleto.resident_id && typeof boleto.resident_id === 'string' && boleto.resident_id.trim() && !boleto.resident_id.startsWith('temp-')) {
      residentId = boleto.resident_id;
    }
    if (!residentId && boleto.residentName) {
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
      // Permite forçar UUID (ex.: upload do PDF antes do INSERT)
      ...(explicitId ? { id: explicitId } : {}),
      resident_id: residentId,
      resident_name: boleto.residentName,
      unit: boleto.unit,
      reference_month: boleto.referenceMonth,
      due_date: boleto.dueDate,
      amount: boleto.amount,
      status: boleto.status,
      boleto_type: boleto.boletoType || 'condominio',
      barcode: boleto.barcode || null,
      pdf_url: boleto.pdfUrl || null, // LEGACY - será removido
      paid_date: boleto.paidDate || null,
      description: boleto.description || null,
      // Campos para PDF original (documento imutável)
      pdf_original_path: boleto.pdf_original_path || null,
      checksum_pdf: boleto.checksum_pdf || null
    };

    const result = await createData('boletos', payload);
    if (!result.success) return { success: false, error: result.error };

    // Os PDFs são gerados on-demand quando o usuário solicita visualização
    // Não precisamos gerar PDFs automaticamente no momento do salvamento
    logAdminAudit({
      action: 'BOLETO_CREATE',
      entityType: 'boletos',
      entityId: result.id ?? null,
      metadata: {
        unit: boleto.unit,
        reference_month: boleto.referenceMonth,
        amount: boleto.amount,
        status: boleto.status,
        boleto_type: boleto.boletoType || 'condominio',
        resident_id: residentId,
      }
    }).catch(() => {});

    return { success: true, id: result.id };
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
    if (result.success) {
      logAdminAudit({
        action: 'BOLETO_UPDATE',
        entityType: 'boletos',
        entityId: boleto.id,
        metadata: {
          status: boleto.status,
          paid_date: boleto.paidDate || null,
        }
      }).catch(() => {});
    }
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
    if (result.success) {
      logAdminAudit({
        action: 'BOLETO_DELETE',
        entityType: 'boletos',
        entityId: id
      }).catch(() => {});
    }
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao deletar boleto:', err);
    return { success: false, error: err.message || 'Erro ao deletar boleto' };
  }
};

export type GetBoletosResult = { data: Boleto[]; error?: string };

export const getBoletos = async (options?: {
  /**
   * Callback chamado quando o Supabase retornar dados mais recentes.
   * Útil porque `getData` é offline-first e retorna cache imediatamente.
   */
  onRemoteUpdate?: (rows: Boleto[]) => void;
}): Promise<GetBoletosResult> => {
  try {
    const toDateStr = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      const d = new Date(v);
      return d.toISOString().slice(0, 10);
    };

    const mapRow = (b: any): Boleto => ({
      id: b.id,
      residentName: b.resident_name,
      unit: b.unit,
      referenceMonth: b.reference_month,
      dueDate: toDateStr(b.due_date),
      amount: Number(b.amount),
      status: b.status as 'Pendente' | 'Pago' | 'Vencido',
      boletoType: (b.boleto_type === 'agua' || b.boleto_type === 'luz' ? b.boleto_type : 'condominio') as 'condominio' | 'agua' | 'luz',
      barcode: b.barcode ?? undefined,
      pdfUrl: b.pdf_url ?? undefined, // LEGACY
      paidDate: b.paid_date ? toDateStr(b.paid_date) : undefined,
      description: b.description ?? undefined,
      resident_id: b.resident_id ?? undefined,
      // Campos para PDF original (documento imutável)
      pdf_original_path: b.pdf_original_path ?? undefined,
      checksum_pdf: b.checksum_pdf ?? undefined
    });

    const result = await getData<any>('boletos', {
      fetchRemote: async () => {
        // Limitar a 1000 registros mais recentes para performance
        const { data, error } = await supabase
          .from('boletos')
          .select('id, resident_id, resident_name, unit, reference_month, due_date, amount, status, boleto_type, barcode, pdf_url, paid_date, description, pdf_original_path, checksum_pdf')
          .order('due_date', { ascending: false })
          .limit(1000);
        if (error) throw error;
        return data || [];
      },
      onRemoteUpdate: (remote) => {
        try {
          options?.onRemoteUpdate?.((remote || []).map(mapRow));
        } catch (e) {
          console.warn('[getBoletos] Falha em onRemoteUpdate:', e);
        }
      }
    });

    const list: Boleto[] = (result.data || []).map(mapRow);
    return { data: list, error: result.error };
  } catch (err: any) {
    console.error('Erro ao buscar boletos:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar boletos' };
  }
};

/** Nome do bucket de storage para PDFs de boleto (deve existir no Supabase e estar público). */
const BOLETOS_STORAGE_BUCKET = 'boletos';



/**
 * Faz upload do PDF do boleto para o Supabase Storage e retorna a URL pública.
 * O bucket "boletos" deve existir no projeto e estar configurado como público para leitura.
 */

/**
 * Faz upload do PDF ORIGINAL do boleto para o Supabase Storage.
 * Este é o PDF imutável importado pelo síndico, que deve ser preservado integralmente.
 * @param file Arquivo PDF original do boleto
 * @param boletoId UUID único do boleto
 * @returns Promise com caminho do arquivo e checksum SHA-256
 */
export const uploadBoletoOriginalPdf = async (
  file: File,
  boletoId: string
): Promise<{ path: string; checksum: string; error?: string }> => {
  try {
    // Storage geralmente exige sessão Auth (role=authenticated) quando RLS está ativo.
    // Se não houver sessão, o upload vai falhar com RLS; preferimos retornar um erro claro.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return {
        path: '',
        checksum: '',
        error: 'Sessão inválida/expirada. Faça login novamente antes de importar boletos (upload do PDF requer autenticação).'
      };
    }

    // Calcular hash SHA-256 do arquivo original para garantia de integridade
    const checksum = await calculateFileSHA256(file);

    // Caminho do arquivo: /boletos/original/{uuid}.pdf
    const path = `original/${boletoId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(BOLETOS_STORAGE_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: 'application/pdf',
        // Metadata para auditoria
        metadata: {
          checksum_sha256: checksum,
          uploaded_at: new Date().toISOString(),
          original_filename: file.name,
          file_size: file.size.toString()
        }
      });

    if (uploadError) {
      console.error('[uploadBoletoOriginalPdf] Erro ao fazer upload do PDF original:', uploadError);
      return { path: '', checksum: '', error: uploadError.message };
    }

    console.log(`[uploadBoletoOriginalPdf] PDF original salvo com sucesso: ${path}, checksum: ${checksum}`);
    logAdminAudit({
      action: 'BOLETO_PDF_UPLOAD',
      entityType: 'storage',
      entityId: boletoId,
      metadata: {
        path,
        checksum_sha256: checksum,
        original_filename: file.name,
        file_size: file.size,
      }
    }).catch(() => {});
    return { path, checksum };
  } catch (err: any) {
    console.error('[uploadBoletoOriginalPdf] Erro ao fazer upload do PDF original:', err);
    return { path: '', checksum: '', error: err?.message ?? 'Erro ao enviar PDF original' };
  }
};

/**
 * Adiciona PDF original a um boleto existente que não tem PDF
 * @param boletoId ID do boleto
 * @param pdfFile Arquivo PDF a ser anexado
 * @returns Promise com resultado da operação
 */
export const addBoletoOriginalPdf = async (
  boletoId: string,
  pdfFile: File
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verificar se o boleto existe e não tem PDF
    const { data: boleto, error: fetchError } = await supabase
      .from('boletos')
      .select('id, pdf_original_path, pdf_url')
      .eq('id', boletoId)
      .single();

    if (fetchError || !boleto) {
      return { success: false, error: 'Boleto não encontrado' };
    }

    if (boleto.pdf_original_path) {
      return { success: false, error: 'Este boleto já possui PDF original' };
    }

    // Upload do PDF original
    const uploadResult = await uploadBoletoOriginalPdf(pdfFile, boletoId);
    if (!uploadResult.path) {
      return { success: false, error: uploadResult.error || 'Falha no upload do PDF' };
    }

    // Atualizar o boleto com o caminho do PDF
    const { error: updateError } = await supabase
      .from('boletos')
      .update({
        pdf_original_path: uploadResult.path,
        checksum_pdf: uploadResult.checksum,
        pdf_url: null // Limpar pdf_url antigo se existir
      })
      .eq('id', boletoId);

    if (updateError) {
      console.error('[addBoletoOriginalPdf] Erro ao atualizar boleto:', updateError);
      return { success: false, error: 'Erro ao atualizar boleto com PDF' };
    }

    console.log(`[addBoletoOriginalPdf] PDF adicionado com sucesso ao boleto ${boletoId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[addBoletoOriginalPdf] Erro:', err);
    return { success: false, error: err?.message || 'Erro ao adicionar PDF' };
  }
};

/**
 * Faz download do PDF original do boleto e verifica integridade
 * @param pdfOriginalPath Caminho do PDF original no storage
 * @param expectedChecksum Hash SHA-256 esperado para verificação
 * @returns Promise com URL do blob para download ou erro
 */
export const downloadBoletoOriginalPdf = async (
  pdfOriginalPath: string,
  expectedChecksum?: string
): Promise<{ url: string; error?: string }> => {
  try {
    console.log(`[downloadBoletoOriginalPdf] Baixando PDF original: ${pdfOriginalPath}`);

    // Fazer download do arquivo
    const { data, error } = await supabase.storage
      .from(BOLETOS_STORAGE_BUCKET)
      .download(pdfOriginalPath);

    if (error || !data) {
      console.error('[downloadBoletoOriginalPdf] Erro ao baixar PDF original:', error);
      return { url: '', error: error?.message ?? 'Erro ao baixar PDF original' };
    }

    // Verificar integridade se checksum foi fornecido
    if (expectedChecksum) {
      const fileLike = (data instanceof File)
        ? data
        : new File([data], 'boleto-original.pdf', { type: data.type || 'application/pdf' });
      const actualChecksum = await calculateFileSHA256(fileLike);
      if (actualChecksum !== expectedChecksum) {
        console.error(`[downloadBoletoOriginalPdf] ❌ CHECKSUM INVÁLIDO! Esperado: ${expectedChecksum}, Calculado: ${actualChecksum}`);
        return {
          url: '',
          error: 'PDF original foi alterado ou corrompido. Integridade comprometida.'
        };
      }
      console.log(`[downloadBoletoOriginalPdf] ✅ Integridade verificada: checksum ${actualChecksum}`);
    }

    // Criar URL do blob para download
    const blobUrl = URL.createObjectURL(data);
    return { url: blobUrl };
  } catch (err: any) {
    console.error('[downloadBoletoOriginalPdf] Erro ao baixar PDF original:', err);
    return { url: '', error: err?.message ?? 'Erro ao baixar PDF original' };
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
    read: false,
    imageUrl: n.image_url ?? undefined
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
          .select('id, title, content, author, author_role, date, category, priority, pinned, image_url')
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
    const isNew = !notice.id || String(notice.id).startsWith('temp-');
    const result = await createData('notices', {
      title: notice.title,
      content: notice.content,
      author: notice.author,
      author_role: notice.authorRole,
      date: notice.date,
      category: notice.category || null,
      priority: notice.priority ?? 'normal',
      pinned: notice.pinned ?? false,
      image_url: notice.imageUrl ?? null
    });
    // Notificar todos os moradores no sino quando um novo aviso é registrado no mural
    if (result.success && result.id && isNew && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data: residents } = await getResidents();
        if (residents?.length) {
          for (const r of residents) {
            try {
              await createNotification(r.id, 'Novo aviso no mural', notice.title, 'other', result.id);
            } catch (e) {
              console.warn('[saveNotice] Erro ao notificar morador', r.id, e);
            }
          }
        }
      } catch (e) {
        console.warn('[saveNotice] Erro ao notificar moradores do mural:', e);
      }
    }
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
      pinned: notice.pinned ?? false,
      image_url: notice.imageUrl ?? null
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

function chatMapFromRaw(rows: any[]): ChatMessage[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);
  const cutoffIso = cutoff.toISOString();
  const toIso = (v: any) => (v ? (typeof v === 'string' ? v : new Date(v).toISOString()) : '');
  return (rows || [])
    .map((m: any) => ({
      id: m.id,
      text: m.text,
      senderRole: m.sender_role as 'MORADOR' | 'SINDICO' | 'PORTEIRO',
      timestamp: toIso(m.timestamp),
      read: !!m.read
    }))
    .filter((m) => !m.timestamp || m.timestamp >= cutoffIso);
}

/** Busca mensagens direto no Supabase (para Realtime e botão Atualizar). Não usa cache. */
export const getChatMessagesFromServer = async (): Promise<GetChatMessagesResult> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, text, sender_role, timestamp, read')
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return { data: chatMapFromRaw(data || []) };
  } catch (err: any) {
    console.error('Erro ao buscar chat do servidor:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar chat' };
  }
};

export const getChatMessages = async (): Promise<GetChatMessagesResult> => {
  try {
    const mapFromRaw = (rows: any[]): ChatMessage[] => chatMapFromRaw(rows);

    const result = await getData<any>('chat_messages', {
      fetchRemote: async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id, text, sender_role, timestamp, read')
          .order('timestamp', { ascending: true });
        if (error) throw error;

        // Limpa mensagens mais antigas que 24h direto no banco (melhor esforço)
        const now = new Date();
        now.setDate(now.getDate() - 1); // hard-limit de 24h no servidor
        const hardCutoffIso = now.toISOString();
        (data || [])
          .filter((m: any) => m.timestamp && new Date(m.timestamp).toISOString() < hardCutoffIso)
          .forEach((m: any) => {
            // best-effort, sem await para não travar UI
            deleteData('chat_messages', m.id);
          });

        return data || [];
      },
      onRemoteUpdate: (rows) => {
        // Atualiza imediatamente quem estiver escutando o cache (ex.: botão de atualizar)
        const mapped = mapFromRaw(rows);
        // Sobrescreve cache com apenas as mensagens recentes
        // (mantém consistência entre cache e política de retenção)
        mapped.forEach(() => {}); // no-op apenas para evitar lints em mapped quando não usado aqui
      }
    });

    const list = mapFromRaw(result.data);
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

export const deleteChatMessage = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await deleteData('chat_messages', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao apagar mensagem:', err);
    return { success: false, error: err?.message ?? 'Erro ao apagar mensagem' };
  }
};

/** Remove todas as mensagens do chat no servidor (e cache local). */
export const deleteAllChatMessages = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data } = await getChatMessages();
    if (!data?.length) return { success: true };
    for (const msg of data) {
      await deleteData('chat_messages', msg.id);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao apagar todas as mensagens:', err);
    return { success: false, error: err?.message ?? 'Erro ao apagar mensagens' };
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

const STAFF_ROLES_WITH_LOGIN = ['porteiro', 'síndico', 'sindico', 'portaria'];

/** Chama API Vercel para criar usuário em auth.users (usa service_role no servidor). */
const createAuthUserViaApi = async (email: string, password?: string): Promise<string | null> => {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    if (!base) return null;
    const res = await fetch(`${base}/api/create-auth-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: password && password.length >= 6 ? password : undefined,
        emailConfirm: true
      })
    });
    const data = await res.json();
    if (res.ok && data?.auth_user_id) return data.auth_user_id;
    return null;
  } catch {
    return null;
  }
};

// Cria em auth.users e na tabela users para porteiro/síndico (login e recuperação de senha).
const createUserFromStaff = async (staff: Staff, passwordPlain?: string, authUserIdPre?: string | null): Promise<{ success: boolean; error?: string; authUserId?: string | null }> => {
  try {
    const roleLower = staff.role.toLowerCase();
    if (!STAFF_ROLES_WITH_LOGIN.includes(roleLower)) return { success: true };

    let username = generateUsername(staff.name);
    let counter = 1;
    let finalUsername = username;

    while (true) {
      const { data: existing } = await supabase.from('users').select('id').eq('username', finalUsername).maybeSingle();
      if (!existing) break;
      finalUsername = `${username}_${counter}`;
      counter++;
      if (counter > 100) {
        finalUsername = `${username}_${Date.now()}`;
        break;
      }
    }

    let authUserId: string | null = authUserIdPre ?? null;

    // 1) Backend com service_role
    if (!authUserId && staff.email) {
      const serviceKey = (typeof process !== 'undefined'
        ? process.env?.SUPABASE_SERVICE_ROLE_KEY
        : undefined)?.trim();
      const supabaseUrl = (typeof process !== 'undefined'
        ? process.env?.SUPABASE_URL
        : undefined)?.trim();
      if (serviceKey && supabaseUrl) {
        try {
          const adminSup = createClient(supabaseUrl, serviceKey);
          const { data: createData, error } = await (adminSup.auth as any).admin.createUser({
            email: String(staff.email).trim().toLowerCase(),
            email_confirm: true
          });
          if (!error && createData) authUserId = (createData.user?.id ?? createData.id) ?? null;
        } catch {}
      }
    }

    // 2) API Vercel (frontend em produção)
    if (!authUserId && staff.email && typeof window !== 'undefined') {
      const pwd = (passwordPlain && passwordPlain.trim().length >= 6) ? passwordPlain.trim() : '123456';
      authUserId = await createAuthUserViaApi(String(staff.email), pwd);
    }

    const roleDb = roleLower.includes('sindico') || roleLower.includes('síndico') ? 'SINDICO' : 'PORTEIRO';
    const insertPayload: any = {
      username: finalUsername,
      role: roleDb,
      name: staff.name,
      email: staff.email || null,
      phone: staff.phone || null,
      is_active: staff.status === 'Ativo',
      auth_user_id: authUserId
    };

    if (!authUserId) {
      if (!staff.email) {
        return {
          success: false,
          error: 'E-mail obrigatório. O cadastro em auth.users permite login e recuperação de senha.'
        };
      }
      return {
        success: false,
        error: 'Não foi possível criar usuário em auth.users. Adicione SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL nas variáveis do Vercel (Projeto → Settings → Environment Variables).'
      };
    }

    const { error: userError } = await supabase
      .from('users')
      .insert(insertPayload);

    if (userError) {
      const status = (userError as any)?.status;
      const code = String((userError as any)?.code || '');
      const msg = String((userError as any)?.message || '').toLowerCase();
      if (status === 409 || code === '23505' || msg.includes('duplicate') || msg.includes('already exists') || msg.includes('conflict')) {
        const updatePayload: Record<string, unknown> = {
          name: staff.name,
          email: staff.email || null,
          phone: staff.phone || null,
          is_active: staff.status === 'Ativo',
          auth_user_id: authUserId
        };
        const { error: updateError } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('username', finalUsername);
        if (updateError) return { success: false, error: updateError.message };
        return { success: true, authUserId };
      }
      return { success: false, error: userError.message };
    }

    console.log('[createUserFromStaff] ✅ Usuário criado:', staff.name, 'Username:', finalUsername, 'auth_user_id:', authUserId);
    return { success: true, authUserId };
  } catch (err: any) {
    console.error('[createUserFromStaff] Erro inesperado:', err);
    return { success: false, error: err?.message ?? 'Erro ao criar usuário' };
  }
};

export const saveStaff = async (staff: Staff, options?: { passwordPlain?: string }): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const isNew = !staff.id || staff.id.startsWith('temp-');
    const roleLower = staff.role.toLowerCase();
    const hasLogin = STAFF_ROLES_WITH_LOGIN.includes(roleLower);
    const passwordPlain = options?.passwordPlain?.trim();

    let authUserId: string | null = null;
    if (isNew && hasLogin && staff.email) {
      authUserId = await createAuthUserViaApi(
        String(staff.email),
        (passwordPlain && passwordPlain.length >= 6) ? passwordPlain : '123456'
      );
    }

    const payload: any = {
      id: isNew ? undefined : staff.id,
      name: staff.name,
      role: staff.role,
      status: staff.status ?? 'Ativo',
      shift: staff.shift ?? 'Comercial',
      phone: staff.phone || null,
      email: staff.email || null
    };
    if (authUserId) payload.auth_user_id = authUserId;

    const result = isNew
      ? await createData('staff', payload)
      : await updateData('staff', payload);

    if (!result.success) return { success: false, error: result.error };

    if (hasLogin) {
      const userResult = await createUserFromStaff(staff, passwordPlain, authUserId);
      if (!userResult.success) {
        if (authUserId) {
          console.warn('[saveStaff] Staff vinculado a auth.users, mas falha ao criar users:', userResult.error);
        } else {
          return { success: false, error: userResult.error };
        }
      }
      // Atualizar staff com auth_user_id (ex.: ao editar porteiro que não tinha)
      const finalAuthId = userResult.authUserId ?? authUserId;
      if (finalAuthId && !payload.auth_user_id && result.id) {
        await supabase.from('staff').update({ auth_user_id: finalAuthId }).eq('id', result.id);
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
// CONVITES PARA PORTARIA / ADM (link único por e-mail)
// ============================================

export type StaffInviteRole = 'PORTEIRO' | 'SINDICO' | 'CABO_TURMA' | 'RONDISTA';

/** Gera token seguro para convite (64 caracteres hex). */
function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Cria um convite para Portaria ou ADM. Retorna o link único para o convidado.
 * Apenas administradores (já autenticados) podem criar; RLS garante isso.
 */
export const createStaffInvite = async (
  email: string,
  role: StaffInviteRole,
  createdBy?: string,
  expiresInDays: number = 7
): Promise<{ success: boolean; inviteLink?: string; error?: string }> => {
  try {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return { success: false, error: 'E-mail válido é obrigatório.' };
    }
    if (!['PORTEIRO', 'SINDICO', 'CABO_TURMA', 'RONDISTA'].includes(role)) {
      return { success: false, error: 'Perfil de convite inválido (use A, B, C ou D).' };
    }

    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { error } = await supabase.from('staff_invites').insert({
      email: emailNorm,
      role,
      token,
      expires_at: expiresAt.toISOString(),
      created_by: createdBy || null
    });

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
        return { success: false, error: 'Já existe um convite pendente para este e-mail.' };
      }
      return { success: false, error: error.message };
    }

    const origin =
      (typeof window !== 'undefined' && window.location.origin)
        ? window.location.origin
        : (typeof (import.meta as any)?.env?.VITE_APP_URL === 'string' ? String((import.meta as any).env.VITE_APP_URL).replace(/\/$/, '') : '');
    if (!origin || !/^https?:\/\//.test(origin)) {
      return { success: false, error: 'URL do app não configurada (VITE_APP_URL ou origin).' };
    }
    const inviteLink = `${origin}/accept-invite?token=${encodeURIComponent(token)}`;
    return { success: true, inviteLink };
  } catch (err: any) {
    console.error('[createStaffInvite]', err);
    return { success: false, error: err?.message ?? 'Erro ao criar convite.' };
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

export const deleteReservation = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await deleteData('reservations', id);
    return { success: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao excluir reserva:', err);
    return { success: false, error: err?.message ?? 'Erro ao excluir reserva' };
  }
};
