import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../api/client';

interface DualDropzoneProps {
  onBatchStarted: (batchId: string) => void;
}

export const DualDropzone: React.FC<DualDropzoneProps> = ({ onBatchStarted }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMessage('El archivo de cédulas debe ser un documento PDF (.pdf)');
        return;
      }
      setPdfFile(file);
      setErrorMessage(null);
    }
  };

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
        setErrorMessage('La lista de verificación debe ser un archivo Excel (.xlsx o .xls)');
        return;
      }
      setExcelFile(file);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !excelFile) {
      setErrorMessage('Debe seleccionar obligatoriamente ambos archivos (PDF de cédulas y Excel)');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('excel', excelFile);

      const response = await api.post('/batches/upload', formData);

      if (response.data.batchId) {
        onBatchStarted(response.data.batchId);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Error al iniciar el procesamiento del lote');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200/80 dark:border-slate-700">
      <div className="mb-6 text-center max-w-xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cargar Lote de Documentos</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Suba el PDF con los escaneos de las cédulas y el reporte Excel oficial para realizar la extracción OCR y el cruce automatizado.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zona PDF */}
          <div className="relative group">
            <input
              type="file"
              id="pdfUpload"
              accept=".pdf"
              onChange={handlePdfChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div
              className={`p-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center h-48 ${
                pdfFile
                  ? 'border-sena-500 bg-sena-50/50 dark:bg-sena-950/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-sena-400 bg-slate-50 dark:bg-slate-800/50'
              }`}
            >
              {pdfFile ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-sena-500 mb-2" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs">
                    {pdfFile.name}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB • Listo para procesar
                  </span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    PDF de Cédulas Escaneadas
                  </span>
                  <span className="text-xs text-slate-400 mt-1">Arrastre o haga clic para seleccionar (.pdf)</span>
                </>
              )}
            </div>
          </div>

          {/* Zona Excel */}
          <div className="relative group">
            <input
              type="file"
              id="excelUpload"
              accept=".xlsx, .xls"
              onChange={handleExcelChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div
              className={`p-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center h-48 ${
                excelFile
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400 bg-slate-50 dark:bg-slate-800/50'
              }`}
            >
              {excelFile ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs">
                    {excelFile.name}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    {(excelFile.size / 1024).toFixed(1)} KB • Matriz oficial cargada
                  </span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-3">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Lista de Validación Excel
                  </span>
                  <span className="text-xs text-slate-400 mt-1">Arrastre o haga clic para seleccionar (.xlsx / .xls)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={!pdfFile || !excelFile || isUploading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-sena-500 to-sena-600 hover:from-sena-600 hover:to-sena-700 text-white font-semibold text-sm shadow-lg shadow-sena-500/25 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:scale-[1.01]"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Iniciando Procesamiento...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Procesar y Validar Cédulas</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
