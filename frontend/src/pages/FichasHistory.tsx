import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { BatchHistoryItem } from '../types';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Trash2,
  ExternalLink,
  Download,
  Calendar,
  Loader2,
  FolderOpen,
  RefreshCw,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

export const FichasHistory: React.FC = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  // Modal de confirmación para eliminar lote individual
  const [batchToDelete, setBatchToDelete] = useState<BatchHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/batches');
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Error cargando historial de fichas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleOpenBatchInDashboard = (batchId: string) => {
    localStorage.setItem('sena_current_batch_id', batchId);
    navigate('/');
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/batches/${batchToDelete.id}`);
      setBatches((prev) => prev.filter((b) => b.id !== batchToDelete.id));
      setDeleteMessage(`Se eliminó correctamente el cargue de la Ficha ${batchToDelete.numeroFicha}.`);
      setTimeout(() => setDeleteMessage(null), 5000);
      setBatchToDelete(null);

      // Si el lote borrado era el que estaba activo en localStorage, limpiarlo
      if (localStorage.getItem('sena_current_batch_id') === batchToDelete.id) {
        localStorage.removeItem('sena_current_batch_id');
      }
    } catch (err: any) {
      console.error('Error al eliminar lote:', err);
      alert(err.response?.data?.error || 'Error al eliminar el cargue');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportExcel = async (batchId: string, numeroFicha: string) => {
    try {
      const response = await api.get(`/batches/${batchId}/export/excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte_Validacion_Ficha_${numeroFicha}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exportando Excel:', err);
      alert('Error al descargar el archivo Excel.');
    }
  };

  // Filtrado de lotes
  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.numeroFicha.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.pdfFilename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.excelFilename.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'TODOS' || b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sena-50 dark:bg-sena-950/60 text-sena-600 dark:text-sena-400 border border-sena-200/60 dark:border-sena-800/60">
              Gestión de Lotes y Fichas
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Historial de Cargues por Ficha
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Consulte, explore, edite o elimine los cargues de cédulas y matrices Excel realizados en el sistema
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchBatches}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sena-500 to-sena-600 hover:from-sena-600 hover:to-sena-700 text-white text-xs font-semibold shadow-lg shadow-sena-500/20 flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuevo Cargue</span>
          </button>
        </div>
      </div>

      {/* Mensaje de eliminación exitosa */}
      {deleteMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{deleteMessage}</span>
          </div>
          <button
            onClick={() => setDeleteMessage(null)}
            className="font-bold underline hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número de ficha (ej. 3591229) o nombre de archivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sena-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sena-500"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="COMPLETED">Completados</option>
            <option value="PROCESSING">En Procesamiento</option>
            <option value="FAILED">Fallidos</option>
          </select>
        </div>
      </div>

      {/* Listado de Lotes por Ficha */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-16 text-center border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-sena-500" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Consultando cargues y fichas registradas...
          </p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-16 text-center border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-700/60 text-slate-400 flex items-center justify-center mx-auto">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No se encontraron cargues de fichas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {searchTerm
                ? 'No existen cargues que coincidan con los criterios de búsqueda.'
                : 'Aún no se ha realizado ninguna carga de lote PDF/Excel. Vaya al Panel principal para procesar su primera ficha.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sena-500 to-sena-600 hover:from-sena-600 hover:to-sena-700 text-white text-xs font-semibold shadow-md transition-all inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ir a Cargar Documentos</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBatches.map((b) => {
            const dateStr = new Date(b.createdAt).toLocaleString('es-CO', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
              >
                <div>
                  {/* Fila superior: Badge Ficha y Estado */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wider bg-gradient-to-r from-sena-500 to-sena-600 text-white shadow-sm shadow-sena-500/25">
                        FICHA {b.numeroFicha}
                      </span>
                      {b.status === 'COMPLETED' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/50">
                          <CheckCircle2 className="w-3 h-3" /> Completado
                        </span>
                      ) : b.status === 'PROCESSING' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center gap-1 border border-blue-200 dark:border-blue-800/50 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> Procesando
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 flex items-center gap-1 border border-red-200 dark:border-red-800/50">
                          <AlertTriangle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dateStr}
                    </span>
                  </div>

                  {/* Nombres de los archivos cargados */}
                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                      <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <span className="truncate font-medium" title={b.pdfFilename}>
                        {b.pdfFilename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="truncate font-medium" title={b.excelFilename}>
                        {b.excelFilename}
                      </span>
                    </div>
                  </div>

                  {/* Estadísticas métricas del lote */}
                  <div className="grid grid-cols-4 gap-2 pt-4 text-center">
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-lg font-bold text-slate-900 dark:text-white block font-mono">
                        {b.totalDocuments}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        En PDF
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-lg font-bold text-slate-900 dark:text-white block font-mono">
                        {b.totalExcel}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        En Excel
                      </span>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
                        {b.validCount}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">
                        Coinciden
                      </span>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/40">
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400 block font-mono">
                        {b.discrepancyCount}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 tracking-wider">
                        Discrepancia
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones del Lote */}
                <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setBatchToDelete(b)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition-colors"
                    title="Eliminar este cargue de la base de datos"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportExcel(b.id, b.numeroFicha)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenBatchInDashboard(b.id)}
                      className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <span>Abrir Ficha</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Cargue Específico */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  ¿Eliminar cargue de la Ficha {batchToDelete.numeroFicha}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Esta acción eliminará de forma permanente los registros de cédulas extraídas y la matriz de validación de este cargue ({batchToDelete.totalDocuments} cédulas y {batchToDelete.totalExcel} inscritos). Los demás lotes permanecerán intactos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBatchToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Eliminar Cargue</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
