import { supabase } from './supabase';
import { Package, Resident, VisitorLog, Occurrence, Boleto, PackageItem } from '../types';
import { createNotification } from './notificationService';

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
    
    // Se não tiver recipientId, tentar buscar pelo nome e unidade
    if (!recipientId && pkg.recipient && pkg.unit) {
      console.log('[savePackage] Buscando recipientId no banco...', {
        recipient: pkg.recipient,
        unit: pkg.unit
      });
      
      const { data: resident, error: residentError } = await supabase
        .from('residents')
        .select('id, name, unit')
        .eq('name', pkg.recipient.trim())
        .eq('unit', pkg.unit.trim())
        .maybeSingle(); // Usar maybeSingle ao invés de single para não dar erro se não encontrar
      
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
    }
    
    // Log final do recipientId
    console.log('[savePackage] recipientId final:', recipientId || 'NULL - Notificação não será criada');

    // Preparar dados para inserção (apenas campos obrigatórios)
    const insertData: any = {
      recipient_id: recipientId,
      recipient_name: pkg.recipient,
      unit: pkg.unit,
      type: pkg.type,
      received_at: pkg.receivedAt,
      display_time: pkg.displayTime,
      status: pkg.status,
      deadline_minutes: pkg.deadlineMinutes || 45,
      resident_phone: pkg.residentPhone || null
    };

    // Adicionar campos opcionais se existirem
    if (pkg.qrCodeData) {
      insertData.qr_code_data = pkg.qrCodeData;
    }
    if (pkg.imageUrl) {
      insertData.image_url = pkg.imageUrl;
    }

    let { data, error } = await supabase
      .from('packages')
      .insert(insertData)
      .select()
      .single();

    // Se falhar por causa de colunas opcionais não existirem, tentar sem elas
    if (error && error.message) {
      const errorMsg = error.message.toLowerCase();
      const missingColumns: string[] = [];
      
      if (errorMsg.includes('qr_code_data') || errorMsg.includes("qr_code_data")) {
        missingColumns.push('qr_code_data');
        delete insertData.qr_code_data;
      }
      if (errorMsg.includes('image_url') || errorMsg.includes("image_url")) {
        missingColumns.push('image_url');
        delete insertData.image_url;
      }

      if (missingColumns.length > 0) {
        console.warn(`Colunas não encontradas no schema: ${missingColumns.join(', ')}, tentando sem elas...`);
        const retryResult = await supabase
          .from('packages')
          .insert(insertData)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }
    }

    if (error) {
      console.error('Erro ao salvar pacote:', error);
      return { success: false, error: error.message };
    }

    // Salvar itens do pacote se houver
    if (pkg.items && pkg.items.length > 0 && data) {
      const itemsToInsert = pkg.items.map(item => ({
        package_id: data.id,
        name: item.name,
        description: item.description || null
      }));

      const { error: itemsError } = await supabase
        .from('package_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Erro ao salvar itens do pacote:', itemsError);
        // Não falha o salvamento do pacote se os itens falharem
      }
    }

    // Criar notificação automática no app (independente do WhatsApp)
    // Isso acontece automaticamente sempre que uma encomenda é registrada
    console.log('[savePackage] Verificando condições para criar notificação:', {
      recipientId: recipientId || 'null/undefined',
      hasData: !!data,
      dataId: data?.id || 'null'
    });
    
    if (recipientId && data) {
      console.log('[Notificação] ✅ Condições OK. Criando notificação para morador:', recipientId, 'Encomenda:', data.id);
      
      try {
        const notificationResult = await createNotification(
          recipientId,
          '📦 Nova encomenda na portaria',
          'Uma encomenda foi recebida e está disponível para retirada.',
          'package',
          data.id
        );

        if (notificationResult.success) {
          console.log('[Notificação] ✅✅✅ Notificação criada com sucesso! ID:', notificationResult.id);
        } else {
          // Log detalhado do erro mas não falha o salvamento da encomenda
          const errorDetails = {
            error: notificationResult.error,
            moradorId: recipientId,
            packageId: data.id,
            message: 'A encomenda foi salva, mas a notificação não foi criada.',
            action: 'Verifique o console para mais detalhes e execute supabase_fix_notifications_rls.sql se necessário.'
          };
          
          console.error('[Notificação] ❌❌❌ ERRO ao criar notificação automática:', errorDetails);
          
          // Mostrar erro no console de forma mais visível
          console.group('%c❌ ERRO: Notificação não foi criada', 'color: red; font-weight: bold; font-size: 14px;');
          console.error('Detalhes:', errorDetails);
          console.error('Erro específico:', notificationResult.error);
          console.groupEnd();
        }
      } catch (err: any) {
        console.error('[Notificação] ❌❌❌ EXCEÇÃO ao criar notificação:', err);
        console.group('%c❌ EXCEÇÃO: Erro ao criar notificação', 'color: red; font-weight: bold; font-size: 14px;');
        console.error('Erro:', err);
        console.error('Stack:', err?.stack);
        console.groupEnd();
      }
    } else {
      const warningDetails = {
        recipientId: recipientId || 'null/undefined',
        hasData: !!data,
        dataId: data?.id || 'null',
        message: 'A encomenda foi salva, mas não há recipientId ou data.id para criar a notificação.'
      };
      
      console.warn('[Notificação] ⚠️⚠️⚠️ Não foi possível criar notificação - condições não atendidas:', warningDetails);
      
      // Mostrar warning no console de forma mais visível
      console.group('%c⚠️ AVISO: Notificação não foi criada - condições não atendidas', 'color: orange; font-weight: bold; font-size: 14px;');
      console.warn('Detalhes:', warningDetails);
      console.warn('recipientId:', recipientId);
      console.warn('data:', data);
      console.groupEnd();
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar pacote:', err);
    return { success: false, error: err.message || 'Erro ao salvar pacote' };
  }
};

export const updatePackage = async (pkg: Package): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('packages')
      .update({
        recipient_name: pkg.recipient,
        unit: pkg.unit,
        type: pkg.type,
        status: pkg.status,
        delivered_at: pkg.status === 'Entregue' ? new Date().toISOString() : null
      })
      .eq('id', pkg.id);

    if (error) {
      console.error('Erro ao atualizar pacote:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar pacote:', err);
    return { success: false, error: err.message || 'Erro ao atualizar pacote' };
  }
};

export const deletePackage = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir encomenda:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao excluir encomenda:', err);
    return { success: false, error: err?.message || 'Erro ao excluir encomenda' };
  }
};

// ============================================
// SERVIÇOS PARA MORADORES
// ============================================

export type GetResidentsResult = { data: Resident[]; error?: string };

export const getResidents = async (): Promise<GetResidentsResult> => {
  try {
    const { data, error } = await supabase
      .from('residents')
      .select('id, name, unit, email, phone, whatsapp')
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar moradores:', error);
      return { data: [], error: error.message };
    }

    const list = (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      email: r.email || '',
      phone: r.phone || '',
      whatsapp: r.whatsapp || ''
    }));
    return { data: list };
  } catch (err: any) {
    console.error('Erro ao buscar moradores:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar moradores' };
  }
};

export const saveResident = async (resident: Resident): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    if (resident.id && resident.id.startsWith('temp-')) {
      // Novo morador - inserir
      const { data, error } = await supabase
        .from('residents')
        .insert({
          name: resident.name,
          unit: resident.unit,
          email: resident.email || null,
          phone: resident.phone || null,
          whatsapp: resident.whatsapp || null
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar morador:', error);
        return { success: false, error: error.message };
      }

      return { success: true, id: data.id };
    } else {
      // Morador existente - atualizar
      const { error } = await supabase
        .from('residents')
        .update({
          name: resident.name,
          unit: resident.unit,
          email: resident.email || null,
          phone: resident.phone || null,
          whatsapp: resident.whatsapp || null
        })
        .eq('id', resident.id);

      if (error) {
        console.error('Erro ao atualizar morador:', error);
        return { success: false, error: error.message };
      }

      return { success: true, id: resident.id };
    }
  } catch (err: any) {
    console.error('Erro ao salvar morador:', err);
    return { success: false, error: err.message || 'Erro ao salvar morador' };
  }
};

export const deleteResident = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('residents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar morador:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
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
    // Buscar resident_id
    let residentId: string | null = null;
    if (visitor.residentName) {
      const { data: resident } = await supabase
        .from('residents')
        .select('id')
        .eq('name', visitor.residentName)
        .eq('unit', visitor.unit)
        .single();
      residentId = resident?.id || null;
    }

    const { data, error } = await supabase
      .from('visitors')
      .insert({
        resident_id: residentId,
        resident_name: visitor.residentName,
        unit: visitor.unit,
        visitor_count: visitor.visitorCount || 1,
        visitor_names: visitor.visitorNames || null,
        entry_time: visitor.entryTime,
        exit_time: visitor.exitTime || null,
        status: visitor.status
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar visitante:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar visitante:', err);
    return { success: false, error: err.message || 'Erro ao salvar visitante' };
  }
};

export const updateVisitor = async (visitor: VisitorLog): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('visitors')
      .update({
        exit_time: visitor.exitTime || null,
        status: visitor.status
      })
      .eq('id', visitor.id);

    if (error) {
      console.error('Erro ao atualizar visitante:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar visitante:', err);
    return { success: false, error: err.message || 'Erro ao atualizar visitante' };
  }
};

// ============================================
// SERVIÇOS PARA OCORRÊNCIAS
// ============================================

export const saveOccurrence = async (occurrence: Occurrence): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Buscar resident_id
    let residentId: string | null = null;
    if (occurrence.residentName) {
      const { data: resident } = await supabase
        .from('residents')
        .select('id')
        .eq('name', occurrence.residentName)
        .eq('unit', occurrence.unit)
        .single();
      residentId = resident?.id || null;
    }

    const { data, error } = await supabase
      .from('occurrences')
      .insert({
        resident_id: residentId,
        resident_name: occurrence.residentName,
        unit: occurrence.unit,
        description: occurrence.description,
        status: occurrence.status,
        date: occurrence.date,
        reported_by: occurrence.reportedBy
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar ocorrência:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao salvar ocorrência' };
  }
};

export const updateOccurrence = async (occurrence: Occurrence): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('occurrences')
      .update({
        description: occurrence.description,
        status: occurrence.status
      })
      .eq('id', occurrence.id);

    if (error) {
      console.error('Erro ao atualizar ocorrência:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar ocorrência:', err);
    return { success: false, error: err.message || 'Erro ao atualizar ocorrência' };
  }
};

// ============================================
// SERVIÇOS PARA BOLETOS
// ============================================

export const saveBoleto = async (boleto: Boleto): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Buscar resident_id
    let residentId: string | null = null;
    if (boleto.residentName) {
      const { data: resident } = await supabase
        .from('residents')
        .select('id')
        .eq('name', boleto.residentName)
        .eq('unit', boleto.unit)
        .single();
      residentId = resident?.id || null;
    }

    const { data, error } = await supabase
      .from('boletos')
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar boleto:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Erro ao salvar boleto:', err);
    return { success: false, error: err.message || 'Erro ao salvar boleto' };
  }
};

export const updateBoleto = async (boleto: Boleto): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('boletos')
      .update({
        status: boleto.status,
        paid_date: boleto.paidDate || null
      })
      .eq('id', boleto.id);

    if (error) {
      console.error('Erro ao atualizar boleto:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao atualizar boleto:', err);
    return { success: false, error: err.message || 'Erro ao atualizar boleto' };
  }
};

export const deleteBoleto = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('boletos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar boleto:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao deletar boleto:', err);
    return { success: false, error: err.message || 'Erro ao deletar boleto' };
  }
};
