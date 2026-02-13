import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, User, MapPin, CreditCard } from 'lucide-react';
import { Resident } from '../../types';
import { addBoletoOriginalPdf } from '../../services/dataService';
// Temporariamente comentado até resolver dependências
// import { processBoletoPDF, ValidationResult } from '../../services/pdfProcessingService';

interface BoletoPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (boletoData: any) => void;
  allResidents: Resident[];
}

// Função mock para processamento de PDF (temporária)
const processBoletoPDF = async (file: File, allResidents: Resident[]): Promise<any> => {
  // Simular processamento
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Dados mock baseados no arquivo PDF
  const mockData = {
    cpf: "123.456.789-00",
    unidade: "101",
    nome: "João Silva",
    valor: 250.00,
    vencimento: "10/12/2024",
    nossoNumero: "001234567",
    referencia: "12/2024",
    codigoBarras: "00190000090012345678901234567890123456789012"
  };

  // Procurar residente correspondente
  const resident = allResidents.find(r =>
    r.unit === mockData.unidade ||
    r.name.toLowerCase().includes(mockData.nome.toLowerCase())
  );

  return {
    isValid: !!resident,
    confidence: resident ? 90 : 0,
    extractedData: mockData,
    resident: resident || null,
    suggestions: resident ? [] : allResidents.slice(0, 3),
    errors: resident ? [] : ['Morador não encontrado no sistema']
  };
};

const BoletoPDFModal: React.FC<BoletoPDFModalProps> = ({
  isOpen,
  onClose,
  onSave,
  allResidents
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setValidationResult(null);
      setSelectedResident(null);
      setManualMode(false);
    }
  };

  const handleProcessPDF = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const result = await processBoletoPDF(file, allResidents);
      setValidationResult(result);

      if (result.isValid && result.resident) {
        setSelectedResident(result.resident);
      }
    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      setValidationResult({
        isValid: false,
        confidence: 0,
        extractedData: {},
        suggestions: [],
        errors: ['Erro ao processar o arquivo PDF']
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAssociation = async () => {
    if (!validationResult || !selectedResident || !file) return;

    setIsProcessing(true);
    try {
      // Primeiro salvar o boleto
      const boletoData = {
        resident_id: selectedResident.id,
        unidade_id: selectedResident.unit,
        residentName: selectedResident.name,
        unit: selectedResident.unit,
        nosso_numero: validationResult.extractedData.nossoNumero,
        amount: validationResult.extractedData.valor,
        dueDate: validationResult.extractedData.vencimento,
        referenceMonth: validationResult.extractedData.referencia,
        barcode: validationResult.extractedData.codigoBarras,
        status: 'Pendente' as const,
        pdfUrl: '', // Será definido após salvar
        extractedData: validationResult.extractedData
      };

      // Salvar boleto e obter ID
      onSave(boletoData);

      // Aguardar um momento para o boleto ser salvo
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simular ID do boleto (em produção, o onSave deveria retornar o ID)
      const boletoId = `temp-${Date.now()}`;

      // Anexar PDF permanentemente
      const pdfResult = await addBoletoOriginalPdf(boletoId, file);
      if (!pdfResult.success) {
        console.warn('PDF não foi anexado:', pdfResult.error);
        alert('⚠️ Boleto salvo, mas houve problema ao anexar o PDF. Você pode anexá-lo manualmente depois.');
      } else {
        console.log('PDF anexado com sucesso');
      }

    } catch (error) {
      console.error('Erro ao salvar boleto com PDF:', error);
      alert('❌ Erro ao salvar boleto. Tente novamente.');
      return;
    } finally {
      setIsProcessing(false);
    }

    handleClose();
  };

  const handleManualAssociation = (resident: Resident) => {
    setSelectedResident(resident);
    setManualMode(true);
  };

  const handleClose = () => {
    setFile(null);
    setValidationResult(null);
    setSelectedResident(null);
    setManualMode(false);
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-color)] rounded-2xl border border-[var(--border-color)] shadow-2xl animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Processar Boleto PDF</h2>
              <p className="text-sm opacity-70">Upload inteligente com reconhecimento automático</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6">
          {/* Upload de arquivo */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Selecione o arquivo PDF do boleto
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--text-primary)] transition-colors"
              >
                {file ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-[var(--text-primary)]" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm opacity-70">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 mx-auto opacity-50" />
                    <p className="font-medium">Clique para selecionar PDF</p>
                    <p className="text-sm opacity-70">ou arraste o arquivo aqui</p>
                  </div>
                )}
              </div>
            </div>

            {file && !validationResult && (
              <button
                onClick={handleProcessPDF}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-lg font-medium hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Processar Boleto
                  </>
                )}
              </button>
            )}
          </div>

          {/* Resultado da validação */}
          {validationResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)]">
                {validationResult.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium">
                    {validationResult.isValid ? 'Morador encontrado automaticamente' : 'Confirmação manual necessária'}
                  </p>
                  <p className="text-sm opacity-70">
                    Confiança: {validationResult.confidence}%
                  </p>
                </div>
              </div>

              {/* Dados extraídos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(validationResult.extractedData).map(([key, value]) => (
                  value && (
                    <div key={key} className="p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)]">
                      <p className="text-xs opacity-70 uppercase font-medium">
                        {key === 'cpf' ? 'CPF' :
                         key === 'unidade' ? 'Unidade' :
                         key === 'nome' ? 'Nome' :
                         key === 'valor' ? 'Valor' :
                         key === 'vencimento' ? 'Vencimento' :
                         key === 'nossoNumero' ? 'Nosso Número' :
                         key === 'referencia' ? 'Referência' :
                         key === 'codigoBarras' ? 'Código de Barras' : key}
                      </p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  )
                ))}
              </div>

              {/* Morador encontrado */}
              {validationResult.isValid && validationResult.resident && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-400">Morador identificado</span>
                  </div>
                  <p className="font-medium">{validationResult.resident.name}</p>
                  <p className="text-sm opacity-70">{validationResult.resident.unit}</p>
                </div>
              )}

              {/* Sugestões */}
              {validationResult.suggestions.length > 0 && !validationResult.isValid && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sugestões encontradas:</p>
                  {validationResult.suggestions.map((resident) => (
                    <div
                      key={resident.id}
                      onClick={() => handleManualAssociation(resident)}
                      className="p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--text-primary)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{resident.name}</p>
                          <p className="text-sm opacity-70">{resident.unit}</p>
                        </div>
                        <button className="px-3 py-1 text-sm bg-[var(--text-primary)] text-[var(--bg-color)] rounded">
                          Selecionar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Seleção manual se nenhuma sugestão */}
              {!validationResult.isValid && validationResult.suggestions.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selecione o morador manualmente:</p>
                  <select
                    value={selectedResident?.id || ''}
                    onChange={(e) => {
                      const resident = allResidents.find(r => r.id === e.target.value);
                      if (resident) setSelectedResident(resident);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)]"
                  >
                    <option value="">Selecione um morador</option>
                    {allResidents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {resident.name} - {resident.unit}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Erros */}
              {validationResult.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  {validationResult.errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-400">{error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Morador selecionado para confirmação */}
          {selectedResident && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-blue-400">Morador selecionado</span>
              </div>
              <p className="font-medium">{selectedResident.name}</p>
              <p className="text-sm opacity-70">{selectedResident.unit}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(validationResult?.isValid || selectedResident) && (
          <div className="flex gap-3 p-6 border-t border-[var(--border-color)]">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmAssociation}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--text-primary)] text-[var(--bg-color)] font-medium hover:opacity-90 transition-colors"
            >
              Confirmar e Salvar Boleto
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoletoPDFModal;