import { Package } from '../types';
import { getCachedTable } from '../services/offlineDb';

/**
 * Exporta todas as encomendas do cache local para CSV
 * Funciona offline, buscando dados do IndexedDB
 * @param fallbackPackages - Dados do estado como fallback caso o IndexedDB esteja vazio
 */
export async function exportPackagesToCSV(fallbackPackages?: Package[]): Promise<void> {
  try {
    // Buscar todas as encomendas do cache local (IndexedDB)
    const cachedPackages = await getCachedTable<any>('packages');
    
    // Normalizar dados do cache para formato Package
    let packages: Package[];
    
    // Se não houver dados no cache e tiver fallback, usar fallback diretamente
    if (cachedPackages.length === 0 && fallbackPackages && fallbackPackages.length > 0) {
      packages = fallbackPackages;
    } else if (cachedPackages.length > 0) {
      // Normalizar dados do cache para formato Package
      packages = cachedPackages.map((p: any) => ({
        id: p.id || '',
        recipient: p.recipient_name || p.recipient || '',
        unit: p.unit || '',
        type: p.type || '',
        receivedAt: p.received_at || p.receivedAt || '',
        displayTime: p.display_time || p.displayTime || '',
        status: p.status || 'Pendente',
        deadlineMinutes: p.deadline_minutes || p.deadlineMinutes || 45,
        residentPhone: p.resident_phone || p.residentPhone || '',
        recipientId: p.recipient_id || p.recipientId || '',
        imageUrl: p.image_url || p.imageUrl || null,
        qrCodeData: p.qr_code_data || p.qrCodeData || null,
        items: p.items || []
      }));
    } else {
      packages = [];
    }

    if (packages.length === 0) {
      alert('Nenhuma encomenda encontrada para exportar.');
      return;
    }

    // Criar cabeçalho CSV
    const headers = [
      'ID',
      'Destinatário',
      'Unidade',
      'Tipo',
      'Data/Hora Recebimento',
      'Hora Exibição',
      'Status',
      'Prazo (minutos)',
      'Telefone',
      'Itens',
      'Data Exportação'
    ];

    // Criar linhas CSV
    const rows = packages.map(pkg => {
      const receivedDate = pkg.receivedAt 
        ? new Date(pkg.receivedAt).toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '';
      
      const items = pkg.items && pkg.items.length > 0
        ? pkg.items.map(item => `${item.name}${item.description ? ` (${item.description})` : ''}`).join('; ')
        : '';

      return [
        pkg.id,
        pkg.recipient,
        pkg.unit,
        pkg.type,
        receivedDate,
        pkg.displayTime,
        pkg.status,
        pkg.deadlineMinutes.toString(),
        pkg.residentPhone || '',
        items,
        new Date().toLocaleString('pt-BR')
      ];
    });

    // Combinar cabeçalho e linhas
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // Escapar vírgulas e quebras de linha no CSV
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');

    // Criar BOM para UTF-8 (garante acentuação correta no Excel)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Criar link de download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Nome do arquivo com data/hora
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    link.download = `encomendas_${dateStr}_${timeStr}.csv`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Limpar URL
    URL.revokeObjectURL(url);
    
    console.log(`✅ ${packages.length} encomendas exportadas com sucesso!`);
  } catch (error) {
    console.error('Erro ao exportar encomendas:', error);
    alert('Erro ao exportar encomendas. Verifique o console para mais detalhes.');
  }
}

/**
 * Exporta todas as encomendas do cache local para JSON
 * Funciona offline, buscando dados do IndexedDB
 * @param fallbackPackages - Dados do estado como fallback caso o IndexedDB esteja vazio
 */
export async function exportPackagesToJSON(fallbackPackages?: Package[]): Promise<void> {
  try {
    // Buscar todas as encomendas do cache local (IndexedDB)
    const cachedPackages = await getCachedTable<any>('packages');
    
    // Normalizar dados do cache para formato Package
    let packages: Package[];
    
    // Se não houver dados no cache e tiver fallback, usar fallback diretamente
    if (cachedPackages.length === 0 && fallbackPackages && fallbackPackages.length > 0) {
      packages = fallbackPackages;
    } else if (cachedPackages.length > 0) {
      // Normalizar dados do cache para formato Package
      packages = cachedPackages.map((p: any) => ({
        id: p.id || '',
        recipient: p.recipient_name || p.recipient || '',
        unit: p.unit || '',
        type: p.type || '',
        receivedAt: p.received_at || p.receivedAt || '',
        displayTime: p.display_time || p.displayTime || '',
        status: p.status || 'Pendente',
        deadlineMinutes: p.deadline_minutes || p.deadlineMinutes || 45,
        residentPhone: p.resident_phone || p.residentPhone || '',
        recipientId: p.recipient_id || p.recipientId || '',
        imageUrl: p.image_url || p.imageUrl || null,
        qrCodeData: p.qr_code_data || p.qrCodeData || null,
        items: p.items || []
      }));
    } else {
      packages = [];
    }

    if (packages.length === 0) {
      alert('Nenhuma encomenda encontrada para exportar.');
      return;
    }

    // Criar objeto com metadados
    const exportData = {
      exportDate: new Date().toISOString(),
      totalPackages: packages.length,
      packages: packages
    };

    // Converter para JSON formatado
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    
    // Criar link de download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Nome do arquivo com data/hora
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    link.download = `encomendas_${dateStr}_${timeStr}.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Limpar URL
    URL.revokeObjectURL(url);
    
    console.log(`✅ ${packages.length} encomendas exportadas em JSON com sucesso!`);
  } catch (error) {
    console.error('Erro ao exportar encomendas:', error);
    alert('Erro ao exportar encomendas. Verifique o console para mais detalhes.');
  }
}
