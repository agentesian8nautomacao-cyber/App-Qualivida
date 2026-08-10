import { Package } from '../types';
import { getCachedTable } from '../services/offlineDb';
import { jsPDF } from 'jspdf';

/** Normaliza registro do cache para formato Package */
function normalizeCachedPackage(p: any): Package {
  const statusRaw = String(p.status ?? '').trim().toLowerCase();
  const status: Package['status'] = (statusRaw === 'recebida' || statusRaw === 'entregue') ? 'recebida' : 'pendente';
  return {
    id: p.id || '',
    recipient: p.recipient_name || p.recipient || '',
    unit: p.unit || '',
    type: p.type || '',
    receivedAt: p.received_at || p.receivedAt || '',
    displayTime: p.display_time || p.displayTime || '',
    status,
    deadlineMinutes: (p.deadline_minutes ?? p.deadlineMinutes) ?? 45,
    residentPhone: p.resident_phone || p.residentPhone || undefined,
    recipientId: p.recipient_id || p.recipientId || undefined,
    imageUrl: p.image_url ?? p.imageUrl ?? null,
    qrCodeData: p.qr_code_data ?? p.qrCodeData ?? null,
    items: p.items || [],
    receivedByName: p.received_by_name ?? p.receivedByName ?? null,
    receiptAt: p.data_recebimento ?? p.receiptAt ?? p.delivered_at ?? null,
    hiddenForResident: !!(p.oculta_para_morador ?? p.hiddenForResident)
  };
}

/**
 * Obtém a lista de encomendas para exportação: prioriza a lista passada (todas as registradas no app).
 * Se não for passada ou estiver vazia, usa o cache local (IndexedDB) para exportar todas do cache.
 */
async function getPackagesForExport(passedPackages?: Package[]): Promise<Package[]> {
  if (passedPackages && passedPackages.length > 0) {
    return passedPackages;
  }
  const cachedPackages = await getCachedTable<any>('packages');
  return cachedPackages.map(normalizeCachedPackage);
}

/**
 * Exporta todas as encomendas registradas para CSV.
 * Prioriza a lista passada (todas as encomendas carregadas no app); caso vazia, usa cache local.
 * @param allPackages - Lista completa de encomendas (recomendado para exportar todas as registradas)
 */
export async function exportPackagesToCSV(allPackages?: Package[]): Promise<void> {
  try {
    const packages = await getPackagesForExport(allPackages);

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
      const statusLabel = pkg.status === 'pendente' ? 'Pendente' : 'Recebida';
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
        statusLabel,
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
 * Exporta todas as encomendas registradas para JSON.
 * Prioriza a lista passada (todas as encomendas carregadas no app); caso vazia, usa cache local.
 * @param allPackages - Lista completa de encomendas (recomendado para exportar todas as registradas)
 */
export async function exportPackagesToJSON(allPackages?: Package[]): Promise<void> {
  try {
    const packages = await getPackagesForExport(allPackages);

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

/**
 * Exporta todas as encomendas registradas para PDF.
 * Prioriza a lista passada (todas as encomendas carregadas no app); caso vazia, usa cache local.
 * @param allPackages - Lista completa de encomendas (recomendado para exportar todas as registradas)
 * @param condominiumName - Nome do condomínio para título do relatório (opcional)
 */
export async function exportPackagesToPDF(
  allPackages?: Package[],
  condominiumName?: string
): Promise<void> {
  try {
    const packages = await getPackagesForExport(allPackages);

    if (packages.length === 0) {
      alert('Nenhuma encomenda encontrada para exportar.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.getPageWidth();
    const margin = 10;
    let y = 15;
    const lineHeight = 6;
    const numCols = 7;
    const colW = (pageW - margin * 2) / numCols;

    const condoTitle = (condominiumName || 'Qualivida Club Residence').toUpperCase();

    // Cabeçalho do relatório com nome do condomínio
    doc.setFontSize(12);
    doc.text(`CONDOMÍNIO ${condoTitle}`, margin, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.text('Relatório de Encomendas - Todas as registradas', margin, y);
    y += lineHeight;
    doc.setFontSize(9);
    doc.text(
      `Data da exportação: ${new Date().toLocaleString('pt-BR')}  |  Total: ${packages.length} encomenda(s)`,
      margin,
      y
    );
    y += lineHeight * 1.5;

    // Cabeçalho da tabela (inclui Recebido por = porteiro)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const headers = ['Destinatário', 'Unidade', 'Tipo', 'Data/Hora', 'Recebido por', 'Status', 'Itens'];
    headers.forEach((h, i) => doc.text(h, margin + i * colW, y));
    y += lineHeight;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');

    for (const pkg of packages) {
      if (y > 190) {
        // Nova página: repetir cabeçalho com nome do condomínio
        doc.addPage('a4', 'landscape');
        y = 15;
        doc.setFontSize(12);
        doc.text(`CONDOMÍNIO ${condoTitle}`, margin, y);
        y += lineHeight;
        doc.setFontSize(10);
        doc.text('Relatório de Encomendas - Todas as registradas', margin, y);
        y += lineHeight;
        doc.setFontSize(8);
      }
      const receivedStr = pkg.receivedAt
        ? new Date(pkg.receivedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : pkg.displayTime || '-';
      const receivedBy = (pkg.receivedByName || '-').toString().slice(0, 14);
      const itemsStr = pkg.items && pkg.items.length > 0
        ? pkg.items.map(it => it.name).join(', ').slice(0, 22) + (pkg.items.map(it => it.name).join(', ').length > 22 ? '...' : '')
        : '-';
      const texts = [
        (pkg.recipient || '-').slice(0, 18),
        (pkg.unit || '-').slice(0, 8),
        (pkg.type || '-').slice(0, 10),
        receivedStr.slice(0, 14),
        receivedBy,
        (pkg.status === 'pendente' ? 'Pendente' : 'Recebida'),
        itemsStr
      ];
      texts.forEach((t, i) => doc.text(String(t), margin + i * colW, y));
      y += lineHeight;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    doc.save(`encomendas_${dateStr}_${timeStr}.pdf`);
    console.log(`✅ ${packages.length} encomendas exportadas em PDF com sucesso!`);
  } catch (error) {
    console.error('Erro ao exportar encomendas para PDF:', error);
    alert('Erro ao exportar encomendas para PDF. Verifique o console para mais detalhes.');
  }
}
