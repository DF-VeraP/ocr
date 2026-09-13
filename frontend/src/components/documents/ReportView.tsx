import React from 'react';
import { ReportItem } from '../../types';
import { Download, Printer, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface ReportViewProps {
  batchId: string;
  report: ReportItem[];
}

export const ReportView: React.FC<ReportViewProps> = ({ batchId, report }) => {
  const handleExportExcel = () => {
    const token = useAuthStore.getState().token;
    const url = token
      ? `/api/batches/${batchId}/export/excel?token=${encodeURIComponent(token)}`
      : `/api/batches/${batchId}/export/excel`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const totalInscritos = report.length;
  const encontrados = report.filter((r) => r.encontradoEnPdf).length;
  const discrepancias = report.filter((r) => r.estadoValidacion === 'DISCREPANCIA').length;
  const faltantes = report.filter((r) => !r.encontradoEnPdf).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
      {/* Encabezado y Acciones de Exportación (RF-063, RF-064) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Reporte de Validación Oficial (Matriz Excel)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mostrando exclusivamente las personas matriculadas en el archivo Excel oficial (RF-061).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen Numérico */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 block">Total en Lista Excel</span>
          <span className="text-2xl font-bold text-slate-800 dark:text-white">{totalInscritos}</span>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 block">Identificados con PDF</span>
          <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{encontrados}</span>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
          <span className="text-xs text-amber-600 dark:text-amber-400 block">Con Discrepancias</span>
          <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">{discrepancias}</span>
        </div>
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
          <span className="text-xs text-red-600 dark:text-red-400 block">Faltantes en PDF</span>
          <span className="text-2xl font-bold text-red-700 dark:text-red-300">{faltantes}</span>
        </div>
      </div>

      {/* Tabla Oficial (RF-062) con largo fijo y scroll vertical en pantalla, expandible al imprimir */}
      <div className="overflow-x-auto overflow-y-auto max-h-[500px] print:max-h-none print:overflow-visible rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner relative">
        <table className="w-full text-left text-xs print:text-[10px]">
          <thead className="sticky top-0 print:static z-10 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 shadow-sm">
            <tr>
              <th className="px-3.5 py-3">No.</th>
              <th className="px-3.5 py-3">Identificación (Excel)</th>
              <th className="px-3.5 py-3">Nombre Oficial (Excel)</th>
              <th className="px-3.5 py-3">Tipo Doc.</th>
              <th className="px-3.5 py-3">Fecha Nacimiento (OCR)</th>
              <th className="px-3.5 py-3">Estado Matriz</th>
              <th className="px-3.5 py-3">Escaneo en PDF</th>
              <th className="px-3.5 py-3">Nombre Extraído OCR</th>
              <th className="px-3.5 py-3">Estado de Validación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {report.map((item, idx) => {
              const formatTipoDoc = (tipo: string) => {
                if (tipo.includes('CC')) return { label: 'CC', cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
                if (tipo.includes('TI')) return { label: 'TI', cls: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
                if (tipo.includes('CONTRA')) return { label: 'Contraseña', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
                return { label: tipo === 'NO_DETECTADO' ? 'N/A' : tipo, cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700' };
              };
              const tipoBadge = formatTipoDoc(item.tipoDocumento || '');

              return (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="px-3.5 py-3 font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-3.5 py-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {item.identificacion}
                  </td>
                  <td className="px-3.5 py-3 font-medium text-slate-900 dark:text-white">
                    {item.nombreOficial}
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${tipoBadge.cls}`}>
                      {tipoBadge.label}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {item.fechaNacimiento ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.fechaNacimiento}</span>
                    ) : (
                      <em className="text-slate-400 text-[11px]">No disponible</em>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {item.estadoOficial}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    {item.encontradoEnPdf ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Encontrado
                      </span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> No aportado
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                    {item.nombreOcr || <em className="text-slate-400">No disponible</em>}
                  </td>
                  <td className="px-3.5 py-3">
                    {item.estadoValidacion === 'EXISTE' ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-medium">
                        Existe y Coincide
                      </span>
                    ) : item.estadoValidacion === 'DISCREPANCIA' ? (
                      <div className="space-y-0.5">
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Discrepancia
                        </span>
                        {item.discrepancias && item.discrepancias.length > 0 && (
                          <span className="block text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                            {item.discrepancias[0].campo}: OCR dice &quot;{item.discrepancias[0].valorOcr}&quot;
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-medium">
                        Sin Cédula en PDF
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
