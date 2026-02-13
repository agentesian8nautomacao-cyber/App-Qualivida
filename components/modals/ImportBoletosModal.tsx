import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, CheckCircle2, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { Boleto, Resident } from '../../types';
import { saveBoleto, uploadBoletoOriginalPdf } from '../../services/dataService';
import { extractFieldsFromBoletoText, extractTextFromPdf } from '../../services/pdfBoletoExtractor';
import { useToast } from '../../contexts/ToastContext';

interface ImportBoletosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  existingBoletos: Boleto[];
  allResidents: Resident[];
  /** PDFs pré-selecionados pelo file picker do SO (ex.: clique no botão "Importar Boletos"). */
  initialPdfFiles?: File[];
}

type ImportItemStatus = 'pendente' | 'processando' | 'sucesso' | 'erro';
type ImportItem = {
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

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const ImportBoletosModal: React.FC<ImportBoletosModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingBoletos,
  allResidents,
  initialPdfFiles
}) => {
  const toast = useToast();

  const generateUuid = () => {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const startedBatchRef = useRef<string>('');

  function brDateToIso(v?: string) {
    const s = (v || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!m) return '';
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yy = m[3];
    return `${yy}-${mm}-${dd}`;
  }

  const itemsSummary = useMemo(() => {
    const total = items.length;
    const ok = items.filter((i) => i.status === 'sucesso').length;
    const err = items.filter((i) => i.status === 'erro').length;
    const processing = items.filter((i) => i.status === 'processando').length;
    return { total, ok, err, processing };
  }, [items]);

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

  const buildBatchId = (files: File[]) =>
    (files || [])
      .map((f) => `${f.name}::${f.size}::${f.lastModified}`)
      .sort()
      .join('|');

  const importPdfFiles = async (files: File[]) => {
    const list = (files || []).filter(Boolean);
    if (!list.length) return;

    const batchId = buildBatchId(list);
    if (startedBatchRef.current === batchId) return;
    startedBatchRef.current = batchId;

    const initialItems: ImportItem[] = list.map((file) => ({
      key: `${file.name}::${file.size}::${file.lastModified}`,
      file,
      status: 'pendente'
    }));
    setItems(initialItems);
    setIsImporting(true);

    let successCount = 0;
    let errorCount = 0;

    for (const item of initialItems) {
      const file = item.file;
      const key = item.key;

      const fail = (message: string) => {
        errorCount += 1;
        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'erro', message } : it)));
      };

      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'processando', message: undefined } : it)));

      // ETAPA 1 — Recebimento do arquivo
      console.log('[ImportBoletos][1] Arquivo recebido:', {
        fileName: file.name,
        type: file.type,
        size: file.size
      });
      const validationError = validatePdfFile(file);
      if (validationError) {
        console.warn('[ImportBoletos][1] Rejeitado:', { fileName: file.name, reason: validationError });
        fail(validationError);
        continue;
      }

      try {
        // ETAPA 2 — Leitura do PDF (identificação)
        const text = await extractTextFromPdf(file);
        console.log('[ImportBoletos][2] PDF lido com sucesso:', { fileName: file.name, textLength: text.length });

        const fields = extractFieldsFromBoletoText(text);
        const cpfDigits = onlyDigits(fields.cpf || '');
        const unidade = normalizeUnitDisplay(String(fields.unidade || '').trim());

        console.log('[ImportBoletos][3] CPF e unidade extraídos:', {
          fileName: file.name,
          cpf: cpfDigits,
          unidade
        });

        setItems((prev) =>
          prev.map((it) =>
            it.key === key
              ? {
                  ...it,
                  extracted: {
                    cpf: cpfDigits || undefined,
                    unidade: unidade || undefined,
                    vencimento: fields.vencimento,
                    referencia: fields.referencia,
                    valor: fields.valor
                  }
                }
              : it
          )
        );

        if (!cpfDigits || cpfDigits.length < 11) {
          console.warn('[ImportBoletos][7] Erro de associação (CPF ausente/inválido):', { fileName: file.name });
          fail('CPF do pagador não encontrado (ou inválido) no PDF.');
          continue;
        }
        if (!unidade) {
          console.warn('[ImportBoletos][7] Erro de associação (unidade ausente):', { fileName: file.name });
          fail('Unidade não encontrada no PDF.');
          continue;
        }

        // ETAPA 3 — Localização do morador no sistema (CPF + confirmação por unidade)
        const byCpf = (allResidents || []).filter((r) => getResidentCpfDigits(r) === cpfDigits);
        const targetUnitKey = normalizeUnitKey(unidade);
        const resident = byCpf.find((r) => normalizeUnitKey(r.unit) === targetUnitKey) || null;

        if (!resident) {
          console.warn('[ImportBoletos][7] Erro de associação (morador não localizado):', {
            fileName: file.name,
            cpf: cpfDigits,
            unidade,
            matchesByCpf: byCpf.length
          });
          fail('Morador não localizado no sistema (CPF + unidade).');
          continue;
        }

        console.log('[ImportBoletos][4] Morador localizado:', {
          fileName: file.name,
          residentId: resident.id,
          residentName: resident.name,
          residentUnit: resident.unit
        });

        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, resident: { id: resident.id, name: resident.name, unit: resident.unit } } : it)));

        // Extrair campos obrigatórios para registro
        const referenceMonth = (fields.referencia || '').trim();
        const dueDateIso = brDateToIso(fields.vencimento);
        const amount = typeof fields.valor === 'number' && Number.isFinite(fields.valor) ? fields.valor : NaN;
        if (!referenceMonth) {
          fail('Referência (mm/aaaa) não encontrada no PDF.');
          continue;
        }
        if (!dueDateIso) {
          fail('Vencimento não encontrado no PDF.');
          continue;
        }
        if (!Number.isFinite(amount) || !(amount > 0)) {
          fail('Valor não encontrado (ou inválido) no PDF.');
          continue;
        }

        // Evitar duplicatas (mesmo morador + referência)
        const dup = existingBoletos.some((b) => b.resident_id === resident.id && b.referenceMonth === referenceMonth);
        if (dup) {
          fail(`Já existe boleto para este morador na referência ${referenceMonth}.`);
          continue;
        }

        // ETAPA 4 — Armazenamento do PDF (imutável)
        const boletoId = generateUuid();
        console.log('[ImportBoletos][4] Gerando UUID e preparando upload:', { fileName: file.name, boletoId });

        const up = await uploadBoletoOriginalPdf(file, boletoId);
        if (!up.path) {
          console.warn('[ImportBoletos][7] Erro no upload:', { fileName: file.name, error: up.error });
          fail(up.error || 'Falha ao enviar PDF original para o storage.');
          continue;
        }
        console.log('[ImportBoletos][5] Upload concluído:', { fileName: file.name, pdfPath: up.path, checksum: up.checksum });

        // ETAPA 5 — Registro do boleto no banco
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
          console.warn('[ImportBoletos][7] Erro ao criar registro no banco:', { fileName: file.name, error: res.error });
          fail(res.error || 'Falha ao criar registro de boleto no banco.');
          continue;
        }

        console.log('[ImportBoletos][6] Registro de boleto criado:', { fileName: file.name, boletoId: res.id });

        successCount += 1;
        setItems((prev) =>
          prev.map((it) =>
            it.key === key
              ? { ...it, status: 'sucesso', message: 'Importado e associado com sucesso.', boletoId: res.id, pdfPath: up.path }
              : it
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido ao processar PDF.';
        console.warn('[ImportBoletos][7] Erro inesperado:', { fileName: file.name, error: e });
        fail(msg);
      }
    }

    setIsImporting(false);

    // ETAPA 6 — Finalização
    if (successCount > 0) {
      toast.success(`${successCount} boleto(s) importado(s) com sucesso.`);
      onImportSuccess?.();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} arquivo(s) com erro na importação.`);
    }

    // Fecha automaticamente apenas quando todos tiveram sucesso
    if (successCount > 0 && errorCount === 0) {
      handleClose();
    }
  };

  const handleClose = () => {
    startedBatchRef.current = '';
    setItems([]);
    setIsImporting(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    onClose();
  };

  // Se o Financeiro abrir o modal já com PDFs selecionados pelo SO, importar automaticamente.
  useEffect(() => {
    if (!isOpen) return;
    if (!initialPdfFiles?.length) return;
    importPdfFiles(initialPdfFiles).catch((e) => {
      console.warn('[ImportBoletosModal] Falha ao iniciar importação:', e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPdfFiles]);

  if (!isOpen) {
    return null;
  }
  if (typeof document === 'undefined') {
    // Segurança (SSR). No Vite client-side isso não deve acontecer.
    return null;
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="premium-glass border border-[var(--border-color)] rounded-3xl w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Importar Boletos
            </h2>
            <p className="text-[11px] opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
              Selecione um ou vários PDFs. O sistema irá identificar (CPF + unidade) no próprio PDF e associar ao morador existente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-2xl hover:bg-white/10 transition-colors"
            title="Fechar"
            style={{ color: 'var(--text-primary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar scroll-smooth">
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                  PDFs
                </p>
                <p className="text-sm font-bold mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {itemsSummary.total ? `${itemsSummary.total} arquivo(s) no lote` : 'Nenhum arquivo selecionado'}
                </p>
                <p className="text-[11px] opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Regras: não depende do nome do arquivo • associação somente com CPF + unidade do PDF.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  disabled={isImporting}
                >
                  <Upload className="w-4 h-4" />
                  Selecionar PDFs
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    try {
                      e.currentTarget.value = '';
                    } catch {}
                    importPdfFiles(files).catch((err) => console.warn('[ImportBoletosModal] Falha ao importar PDFs selecionados:', err));
                  }}
                />
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                    Progresso
                  </p>
                  <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {isImporting ? 'Importando...' : 'Importação finalizada'}
                  </p>
                </div>
                <div className="text-xs font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                  {itemsSummary.ok} OK • {itemsSummary.err} Erro • {itemsSummary.processing} Processando
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {items.map((it) => (
                  <div
                    key={it.key}
                    className="rounded-2xl border p-3 flex items-start justify-between gap-3"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate" style={{ color: 'var(--text-primary)' }}>
                        {it.file.name}
                      </p>
                      <p className="text-xs opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {it.extracted?.unidade ? `Unidade: ${it.extracted.unidade}` : 'Unidade: —'} •{' '}
                        {it.extracted?.referencia ? `Ref: ${it.extracted.referencia}` : 'Ref: —'} •{' '}
                        {it.resident ? `Morador: ${it.resident.name}` : 'Morador: —'}
                      </p>
                      {it.message && (
                        <p
                          className="text-xs mt-1"
                          style={{ color: it.status === 'erro' ? 'rgb(248 113 113)' : 'var(--text-secondary)' }}
                        >
                          {it.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {it.status === 'processando' && <Loader2 className="w-4 h-4 animate-spin opacity-70" />}
                      {it.status === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      {it.status === 'erro' && <AlertCircle className="w-4 h-4 text-red-400" />}
                      {it.status === 'pendente' && <FileText className="w-4 h-4 opacity-50" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // CRÍTICO: usar portal para evitar clipping por overflow/transform do layout.
  return createPortal(modal, document.body);
};

export default ImportBoletosModal;