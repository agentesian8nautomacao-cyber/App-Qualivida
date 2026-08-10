import { supabase } from './supabase';
import { Notification } from '../types';

// ============================================
// SERVIÇOS PARA NOTIFICAÇÕES
// ============================================

/**
 * Busca todas as notificações de um morador
 */
export const getNotifications = async (moradorId: string): Promise<{ data: Notification[]; error?: string }> => {
  try {
    console.log('[getNotifications] Buscando notificações para morador:', moradorId);
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('morador_id', moradorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getNotifications] ❌ Erro ao buscar notificações:', error);
      return { data: [], error: error.message };
    }

    const notifications: Notification[] = (data || []).map((n) => ({
      id: n.id,
      morador_id: n.morador_id,
      title: n.title,
      message: n.message,
      type: n.type || 'package',
      related_id: n.related_id || undefined,
      image_url: n.image_url ?? undefined,
      read: n.read || false,
      created_at: n.created_at
    }));

    console.log('[getNotifications] ✅ Notificações encontradas:', notifications.length);
    return { data: notifications };
  } catch (err: any) {
    console.error('[getNotifications] ❌ Erro inesperado:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar notificações' };
  }
};

/**
 * Busca notificações não lidas de um morador
 */
export const getUnreadNotifications = async (moradorId: string): Promise<{ data: Notification[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('morador_id', moradorId)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar notificações não lidas:', error);
      return { data: [], error: error.message };
    }

    const notifications: Notification[] = (data || []).map((n) => ({
      id: n.id,
      morador_id: n.morador_id,
      title: n.title,
      message: n.message,
      type: n.type || 'package',
      related_id: n.related_id || undefined,
      image_url: n.image_url ?? undefined,
      read: n.read || false,
      created_at: n.created_at
    }));

    return { data: notifications };
  } catch (err: any) {
    console.error('Erro ao buscar notificações não lidas:', err);
    return { data: [], error: err?.message ?? 'Erro ao carregar notificações não lidas' };
  }
};

/**
 * Marca uma notificação como lida
 */
export const markNotificationAsRead = async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao marcar notificação como lida:', err);
    return { success: false, error: err?.message ?? 'Erro ao marcar notificação como lida' };
  }
};

/**
 * Marca todas as notificações de um morador como lidas
 */
export const markAllNotificationsAsRead = async (moradorId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('morador_id', moradorId)
      .eq('read', false);

    if (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao marcar todas as notificações como lidas:', err);
    return { success: false, error: err?.message ?? 'Erro ao marcar todas as notificações como lidas' };
  }
};

/**
 * Cria uma nova notificação
 * @param imageUrl - URL da imagem da encomenda (quando registro via foto). Opcional.
 */
export const createNotification = async (
  moradorId: string,
  title: string,
  message: string,
  type: Notification['type'] = 'package',
  relatedId?: string,
  imageUrl?: string | null
): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    console.log('[createNotification] Iniciando criação de notificação:', {
      moradorId,
      title,
      type,
      relatedId,
      hasImage: Boolean(imageUrl)
    });

    const insertData: any = {
      morador_id: moradorId,
      title,
      message,
      type,
      read: false
    };

    if (relatedId) {
      insertData.related_id = relatedId;
    }
    if (imageUrl) {
      insertData.image_url = imageUrl;
    }

    console.log('[createNotification] Dados para inserção:', insertData);

    const { data, error } = await supabase
      .from('notifications')
      .insert(insertData as any) // Usar 'as any' para contornar cache do schema se necessário
      .select()
      .single();

    if (error) {
      console.error('[createNotification] ❌ Erro do Supabase:', {
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Verificar se é erro de tabela não encontrada
      if (error.message && (
        error.message.includes('relation') ||
        error.message.includes('does not exist') ||
        error.message.includes('not found')
      )) {
        return { 
          success: false, 
          error: 'A tabela notifications não existe no Supabase. Execute o script supabase_notifications.sql no SQL Editor.' 
        };
      }
      
      return { success: false, error: error.message || 'Erro ao criar notificação' };
    }

    console.log('[createNotification] ✅ Notificação criada:', data);
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('[createNotification] ❌ Erro inesperado:', err);
    return { success: false, error: err?.message ?? 'Erro ao criar notificação' };
  }
};

/**
 * Conta notificações não lidas de um morador
 */
export const countUnreadNotifications = async (moradorId: string): Promise<{ count: number; error?: string }> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('morador_id', moradorId)
      .eq('read', false);

    if (error) {
      console.error('Erro ao contar notificações não lidas:', error);
      return { count: 0, error: error.message };
    }

    return { count: count || 0 };
  } catch (err: any) {
    console.error('Erro ao contar notificações não lidas:', err);
    return { count: 0, error: err?.message ?? 'Erro ao contar notificações não lidas' };
  }
};

/**
 * Deleta uma notificação (hard delete no banco; persiste de imediato).
 * Garantir RLS na tabela `notifications` permitindo DELETE para o morador dono.
 */
export const deleteNotification = async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[deleteNotification] Deletando notificação:', notificationId);
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('[deleteNotification] ❌ Erro ao deletar notificação:', error);
      return { success: false, error: error.message };
    }

    console.log('[deleteNotification] ✅ Notificação deletada com sucesso');
    return { success: true };
  } catch (err: any) {
    console.error('[deleteNotification] ❌ Erro inesperado:', err);
    return { success: false, error: err?.message ?? 'Erro ao deletar notificação' };
  }
};
