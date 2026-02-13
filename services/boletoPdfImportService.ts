import type { Boleto, Resident } from '../types';
import { extractFieldsFromBoletoText, extractTextFromPdf } from './pdfBoletoExtractor';
import { saveBoleto, uploadBoletoOriginalPdf } from './dataService';

export type ImportItemStatus = 'pendente' | 'processando' | 'sucesso' | 'erro';

export type ImportItem = {
  key: string;
  file: File;
  status: ImportItemStatus;
  message?: string;
  extracted?: {
    cpf?: string;
    unidade?: string;
    vencimento?: string;
    referencia?: string;
    valor?: number;
  };
  resident?: { id: string; name: string; unit: string };
  boletoId?: string;
  pdfPath?: string;
};

export type ImportProgressCallback = (item: ImportItem) => void;

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');
const normalizeUnitKey = (v: string) =>
  (v || '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^\w]/g, '');

const normalizeUnitDisplay = (v: string) => {
  const raw = (v || '').toString().trim().toUpperCase().replace(/\s+/g, '');
  const m = raw.match(/^(\d{2})[\/\-]?(\d{3})$/);
  if (m) return `${m[1]}/${m[2]}`;
  return raw;
};

const brDateToIso = (v?: string) => {
  const s = (v || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return '';
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yy = m[3];
  return `${yy}-${mm}-${dd}`;
};

const getResidentCpfDigits = (r: Resident): string => {
  const extra = (r as any)?.extraData || {};
  const candidates = [
    extra?.cpf,
    extra?.CPF,
    extra?.cpf_cnpj,
    extra?.cpfCnpj,
    extra?.['CPF/CNPJ'],
    extra?.['cpf/cnpj'],
    extra?.documento,
    extra?.document
  ].filter(Boolean);
  for (const c of candidates) {
    const d = onlyDigits(String(c));
    if (d.length >= 11) return d;
  }
  return '';
};

const validatePdfFile = (file: File): string | null => {
  if (!file) return 'Arquivo inválido.';
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Arquivo rejeitado: tipo inválido (apenas PDF).';
  if (file.size > MAX_PDF_SIZE_BYTES) {
    const mb = (MAX_PDF_SIZE_BYTES / 1024 / 1024).toFixed(0);
    return `Arquivo rejeitado: tamanho máximo permitido é ${mb}MB.`;
  }
  return null;
};

const fileKey = (f: File) => `${f.name}::${f.size}::${f.lastModified}`;

export async function importBoletosFromPdfFiles(args: {
  files: File[];
  allResidents: Resident[];
  existingBoletos: Boleto[];
  onProgress?: ImportProgressCallback;
}): Promise<{ items: ImportItem[]; successCount: number; errorCount: number }> {
  const { files, allResidents, existingBoletos, onProgress } = args;
  const list = (files || []).filter(Boolean);

  const items: ImportItem[] = list.map((file) => ({
    key: fileKey(file),
    file,
    status: 'pendente'
  }));

  const update = (patch: Partial<ImportItem> & { key: string }) => {
    const idx = items.findIndex((i) => i.key === patch.key);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch };
      onProgress?.(items[idx]);
    }
  };

  let successCount = 0;
  let errorCount = 0;

  for (const it of items) {
    update({ key: it.key, status: 'processando', message: undefined });

    // LOG 1 - arquivo recebido
    console.log('[ImportBoletos][1] Arquivo recebido:', {
      fileName: it.file.name,
      type: it.file.type,
      size: it.file.size
    });

    const validationError = validatePdfFile(it.file);
    if (validationError) {
      console.warn('[ImportBoletos][7] Erro de validação:', { fileName: it.file.name, reason: validationError });
      errorCount += 1;
      update({ key: it.key, status: 'erro', message: validationError });
      continue;
    }

    try {
      // LOG 2 - pdf lido
      const text = await extractTextFromPdf(it.file);
      console.log('[ImportBoletos][2] PDF lido com sucesso:', { fileName: it.file.name, textLength: text.length });

      // LOG 3 - cpf + unidade extraídos
      const fields = extractFieldsFromBoletoText(text);
      const cpfDigits = onlyDigits(fields.cpf || '');
      const unidade = normalizeUnitDisplay(String(fields.unidade || '').trim());
      console.log('[ImportBoletos][3] CPF e unidade extraídos:', { fileName: it.file.name, cpf: cpfDigits, unidade });

      update({
        key: it.key,
        extracted: {
          cpf: cpfDigits || undefined,
          unidade: unidade || undefined,
          vencimento: fields.vencimento,
          referencia: fields.referencia,
          valor: fields.valor
        }
      });

      if (!cpfDigits || cpfDigits.length < 11) {
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: 'CPF do pagador não encontrado (ou inválido) no PDF.' });
        continue;
      }
      if (!unidade) {
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: 'Unidade não encontrada no PDF.' });
        continue;
      }

      // LOG 4 - morador localizado (CPF + unidade)
      const byCpf = (allResidents || []).filter((r) => getResidentCpfDigits(r) === cpfDigits);
      const targetUnitKey = normalizeUnitKey(unidade);
      const resident = byCpf.find((r) => normalizeUnitKey(r.unit) === targetUnitKey) || null;

      if (!resident) {
        // Diagnóstico melhor: existe alguém na unidade? está sem CPF? CPF diferente?
        const residentsByUnit = (allResidents || []).filter((r) => normalizeUnitKey(r.unit) === targetUnitKey);
        const unitHint =
          residentsByUnit.length > 0
            ? residentsByUnit.some((r) => !getResidentCpfDigits(r))
              ? `Existe morador cadastrado na unidade ${unidade}, mas ele está sem CPF no cadastro (residents.extra_data).`
              : `Existe morador cadastrado na unidade ${unidade}, mas o CPF cadastrado não confere com o CPF do PDF.`
            : `Nenhum morador cadastrado com a unidade ${unidade}.`;

        console.warn('[ImportBoletos][7] Erro de associação (morador não localizado):', {
          fileName: it.file.name,
          cpf: cpfDigits,
          unidade,
          matchesByCpf: byCpf.length,
          matchesByUnit: residentsByUnit.length
        });

        errorCount += 1;
        update({
          key: it.key,
          status: 'erro',
          message: `Morador não localizado no sistema (CPF + unidade). ${unitHint}`
        });
        continue;
      }

      console.log('[ImportBoletos][4] Morador localizado:', {
        fileName: it.file.name,
        residentId: resident.id,
        residentName: resident.name,
        residentUnit: resident.unit
      });

      update({ key: it.key, resident: { id: resident.id, name: resident.name, unit: resident.unit } });

      const referenceMonth = (fields.referencia || '').trim();
      const dueDateIso = brDateToIso(fields.vencimento);
      const amount = typeof fields.valor === 'number' && Number.isFinite(fields.valor) ? fields.valor : NaN;

      if (!referenceMonth) {
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: 'Referência (mm/aaaa) não encontrada no PDF.' });
        continue;
      }
      if (!dueDateIso) {
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: 'Vencimento não encontrado no PDF.' });
        continue;
      }
      if (!Number.isFinite(amount) || !(amount > 0)) {
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: 'Valor não encontrado (ou inválido) no PDF.' });
        continue;
      }

      // Duplicata por morador + referência
      const dup = existingBoletos.some((b) => b.resident_id === resident.id && b.referenceMonth === referenceMonth);
      if (dup) {
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: `Já existe boleto para este morador na referência ${referenceMonth}.` });
        continue;
      }

      // LOG 5 - upload concluído
      const boletoId = crypto?.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const up = await uploadBoletoOriginalPdf(it.file, boletoId);
      if (!up.path) {
        console.warn('[ImportBoletos][7] Erro no upload:', { fileName: it.file.name, error: up.error });
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: up.error || 'Falha ao enviar PDF original para o storage.' });
        continue;
      }
      console.log('[ImportBoletos][5] Upload concluído:', { fileName: it.file.name, pdfPath: up.path, checksum: up.checksum });

      // LOG 6 - registro criado
      const boleto: Boleto = {
        id: boletoId,
        residentName: resident.name,
        unit: resident.unit,
        referenceMonth,
        dueDate: dueDateIso,
        amount,
        status: 'Pendente',
        boletoType: 'condominio',
        resident_id: resident.id,
        unidade_id: resident.unit,
        nosso_numero: fields.nossoNumero || boletoId,
        barcode: fields.codigoBarras || undefined,
        pdfUrl: undefined,
        pdf_original_path: up.path,
        checksum_pdf: up.checksum,
        description: '[IMPORT] PDF original importado e associado automaticamente (CPF + unidade).'
      } as any;

      const res = await saveBoleto(boleto);
      if (!res.success || !res.id) {
        console.warn('[ImportBoletos][7] Erro ao criar registro no banco:', { fileName: it.file.name, error: res.error });
        errorCount += 1;
        update({ key: it.key, status: 'erro', message: res.error || 'Falha ao criar registro de boleto no banco.' });
        continue;
      }

      console.log('[ImportBoletos][6] Registro de boleto criado:', { fileName: it.file.name, boletoId: res.id });

      successCount += 1;
      update({ key: it.key, status: 'sucesso', message: 'Importado e associado com sucesso.', boletoId: res.id, pdfPath: up.path });
    } catch (e) {
      console.warn('[ImportBoletos][7] Erro inesperado:', { fileName: it.file.name, error: e });
      errorCount += 1;
      update({
        key: it.key,
        status: 'erro',
        message: e instanceof Error ? e.message : 'Erro desconhecido ao processar PDF.'
      });
    }
  }

  return { items, successCount, errorCount };
}

