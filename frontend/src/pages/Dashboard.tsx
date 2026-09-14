import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../api/client';
import { DualDropzone } from '../components/upload/DualDropzone';
import { BatchProgress } from '../components/dashboard/BatchProgress';
import { FilterToolbar } from '../components/documents/FilterToolbar';
import { DocumentGrid } from '../components/documents/DocumentGrid';
import { ReportView } from '../components/documents/ReportView';
import { EditDocumentModal } from '../components/documents/EditDocumentModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ExtractedDocument, ReportItem } from '../types';
import { Layers, FileSpreadsheet, Sparkles, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Loader2, Clock } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(() => {
    return localStorage.getItem('sena_current_batch_id') || null;
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'documentos' | 'reporte'>('documentos');

  // Estado del lote activo y lotes disponibles
  const [batchInfo, setBatchInfo] = useState<any | null>(null);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);

  // Estado para edición manual de documentos
  const [documentToEdit, setDocumentToEdit] = useState<ExtractedDocument | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Estado de documentos
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [report, setReport] = useState<ReportItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);

  // Estados para eliminación de datos
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState<string>('');
  const [tipoFilter, setTipoFilter] = useState<string>('TODOS');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');

  // Modal de cambio forzoso de contraseña (RF-015)
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(
    Boolean(user?.requiresPasswordChange)
  );

  const fetchBatchData = async (batchId: string) => {
    setIsLoadingDocs(true);
    try {
      const [docsRes, reportRes] = await Promise.all([
        api.get(`/batches/${batchId}/documents`, {
          params: {
            tipo: tipoFilter,
            estado: estadoFilter,
            search,
          },
        }),
        api.get(`/batches/${batchId}/report`),
      ]);

      setDocuments(docsRes.data.documents || []);
      setReport(reportRes.data.report || []);
    } catch (err) {
      console.error('Error obteniendo datos del lote:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Recuperación automática de lote activo o previo al cargar o tras suspensión del PC
  useEffect(() => {
    const restoreBatch = async () => {
      const savedId = localStorage.getItem('sena_current_batch_id');
      try {
        if (savedId) {
          const res = await api.get(`/batches/${savedId}/status`);
          const b = res.data?.batch;
          if (b) {
            setCurrentBatchId(b.id);
            if (b.status === 'PROCESSING' || b.status === 'QUEUED') {
              setIsProcessing(true);
            } else if (b.status === 'COMPLETED') {
              setIsProcessing(false);
              fetchBatchData(b.id);
            }
            return;
          }
        }

        // Si no hay id guardado o falló, buscar el último lote registrado en backend
        const latestRes = await api.get('/batches/latest');
        const latest = latestRes.data?.batch;
        if (latest) {
          localStorage.setItem('sena_current_batch_id', latest.id);
          setCurrentBatchId(latest.id);
          if (latest.status === 'PROCESSING' || latest.status === 'QUEUED') {
            setIsProcessing(true);
          } else if (latest.status === 'COMPLETED') {
            setIsProcessing(false);
            fetchBatchData(latest.id);
          }
        }
      } catch (err) {
        // Sin lote previo activo
      }
    };

    restoreBatch();
  }, []);

  // Re-sincronizar automáticamente cuando el equipo despierta de suspensión (visibilitychange / online)
  useEffect(() => {
    const handleWakeUp = async () => {
      if (document.visibilityState === 'visible') {
        const activeId = currentBatchId || localStorage.getItem('sena_current_batch_id');
        if (activeId) {
          try {
            const res = await api.get(`/batches/${activeId}/status`);
            const b = res.data?.batch;
            if (b) {
              if (b.status === 'COMPLETED') {
                setIsProcessing(false);
                fetchBatchData(activeId);
              } else if (b.status === 'PROCESSING' || b.status === 'QUEUED') {
                setIsProcessing(true);
              }
            }
          } catch (e) {
            console.error('Error re-sincronizando tras suspensión:', e);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('online', handleWakeUp);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('online', handleWakeUp);
    };
  }, [currentBatchId]);

  useEffect(() => {
    if (currentBatchId && !isProcessing) {
      fetchBatchData(currentBatchId);
    }
  }, [currentBatchId, isProcessing, tipoFilter, estadoFilter, search]);

  const fetchBatchInfo = async (batchId: string) => {
    try {
      const [statusRes, batchesRes] = await Promise.all([
        api.get(`/batches/${batchId}/status`),
        api.get('/batches'),
      ]);
      setBatchInfo(statusRes.data?.batch || null);
      setAvailableBatches(batchesRes.data?.batches || []);
    } catch (e) {
      // Ignorar error
    }
  };

  useEffect(() => {
    if (currentBatchId) {
      fetchBatchInfo(currentBatchId);
    }
  }, [currentBatchId]);

  const handleDocumentUpdated = (updatedDoc: ExtractedDocument) => {
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    if (currentBatchId) {
      fetchBatchData(currentBatchId);
    }
  };

  const handleSwitchBatch = (newId: string) => {
    localStorage.setItem('sena_current_batch_id', newId);
    setCurrentBatchId(newId);
    setIsProcessing(false);
  };

  // Estado para registrar el tiempo total de procesamiento del lote
  const [lastProcessingTime, setLastProcessingTime] = useState<number | null>(null);

  // Trigger numérico para forzar el reseteo de inputs en DualDropzone
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  const handleBatchStarted = (batchId: string) => {
    localStorage.setItem('sena_current_batch_id', batchId);
    setCurrentBatchId(batchId);
    setIsProcessing(true);
    setLastProcessingTime(null);
  };

  const handleBatchCompleted = (durationSeconds?: number) => {
    setIsProcessing(false);
    setResetTrigger((prev) => prev + 1);
    if (durationSeconds !== undefined) {
      setLastProcessingTime(durationSeconds);
    }
    if (currentBatchId) {
      fetchBatchData(currentBatchId);
      fetchBatchInfo(currentBatchId);
    }
  };

  const handleBatchCancelled = () => {
    setIsProcessing(false);
    setResetTrigger((prev) => prev + 1);
    // Como el backend elimina el lote cancelado de la BD, removemos la referencia local
    localStorage.removeItem('sena_current_batch_id');
    setCurrentBatchId(null);
    setBatchInfo(null);
    setDocuments([]);
    setReport([]);
  };

  const handleBatchError = (_errMsg: string) => {
    setIsProcessing(false);
    setResetTrigger((prev) => prev + 1);
    // Al fallar, el backend elimina el lote con error de la BD
    localStorage.removeItem('sena_current_batch_id');
    setCurrentBatchId(null);
    setBatchInfo(null);
    setDocuments([]);
    setReport([]);
  };

  const handleDeleteAllData = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete('/batches');
      localStorage.removeItem('sena_current_batch_id');
      setCurrentBatchId(null);
      setDocuments([]);
      setReport([]);
      setShowDeleteModal(false);
      setSuccessMessage('Se eliminaron correctamente todos los datos de lotes, cédulas y Excel de la base de datos.');
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Error al eliminar los datos de la base de datos.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Mensaje de éxito al eliminar */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Modal de cambio forzoso en primer login (RF-015) */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onSuccess={() => setShowPasswordModal(false)}
      />

      {/* Modal de confirmación para eliminar datos de la base de datos */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  ¿Eliminar datos de la base de datos?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Esta acción borrará de forma permanente todos los lotes procesados, las cédulas extraídas, los registros del Excel oficial y los archivos temporales asociados.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteAllData}
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
                    <span>Sí, Eliminar Todos los Datos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zona de Carga de Archivos */}
      <DualDropzone onBatchStarted={handleBatchStarted} resetTrigger={resetTrigger} />

      {/* Opción para limpiar datos previos si se desea reiniciar */}
      {!isProcessing && (
        <div className="flex justify-end -mt-4">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar todos los datos guardados en la BD</span>
          </button>
        </div>
      )}

      {/* Barra de progreso interactiva SSE (RF-065, RF-066) */}
      {currentBatchId && isProcessing && (
        <BatchProgress
          batchId={currentBatchId}
          onCompleted={handleBatchCompleted}
          onCancelled={handleBatchCancelled}
          onError={handleBatchError}
        />
      )}

      {/* Visualización de Resultados tras Procesar */}
      {currentBatchId && !isProcessing && (
        <div className="space-y-6">
          {/* Barra de Ficha Activa y Selector de Fichas */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-sena-500 to-sena-600 text-white shadow-sm shadow-sena-500/20">
                FICHA {batchInfo?.numeroFicha || 'ACTIVA'}
              </span>
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-xs sm:max-w-md">
                  {batchInfo?.pdfFilename || 'Cargando lote...'}
                </span>
                <span className="text-slate-400 truncate block max-w-xs sm:max-w-md">
                  Matriz: {batchInfo?.excelFilename || 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {availableBatches.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 hidden md:inline">Cambiar Ficha:</span>
                  <select
                    value={currentBatchId}
                    onChange={(e) => handleSwitchBatch(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sena-500"
                  >
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        Ficha {b.numeroFicha} ({b.totalDocuments || b.totalPages} docs)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate('/fichas')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-sena-500" />
                <span>Ver Todas las Fichas</span>
              </button>
            </div>
          </div>

          {/* Navegación por pestañas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
              <button
                onClick={() => setActiveTab('documentos')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'documentos'
                    ? 'bg-white dark:bg-slate-700 text-sena-600 dark:text-sena-400 shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Explorador de Documentos ({documents.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('reporte')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'reporte'
                    ? 'bg-white dark:bg-slate-700 text-sena-600 dark:text-sena-400 shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Reporte Oficial Excel ({report.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {lastProcessingTime !== null && (
                <div className="px-3 py-1.5 rounded-xl bg-sena-50 dark:bg-sena-950/40 border border-sena-200 dark:border-sena-800/60 flex items-center gap-2 text-xs text-sena-700 dark:text-sena-300">
                  <Clock className="w-3.5 h-3.5 text-sena-600 dark:text-sena-400" />
                  <span>
                    Tiempo de procesamiento: <strong>{Math.floor(lastProcessingTime / 60)}m {lastProcessingTime % 60}s</strong>
                  </span>
                </div>
              )}

              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 transition-colors border border-red-200/70 dark:border-red-900/70"
                title="Eliminar todos los datos de lotes guardados en la base de datos"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Datos Guardados</span>
              </button>

              <button
                onClick={() => currentBatchId && fetchBatchData(currentBatchId)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                <span>Actualizar Datos</span>
              </button>
            </div>
          </div>

          {/* Contenido de la pestaña activa */}
          {activeTab === 'documentos' ? (
            <div className="space-y-6">
              <FilterToolbar
                search={search}
                onSearchChange={setSearch}
                tipoFilter={tipoFilter}
                onTipoFilterChange={setTipoFilter}
                estadoFilter={estadoFilter}
                onEstadoFilterChange={setEstadoFilter}
                totalCount={documents.length}
              />
              <DocumentGrid
                documents={documents}
                onEditDocument={(doc) => {
                  setDocumentToEdit(doc);
                  setIsEditModalOpen(true);
                }}
              />
            </div>
          ) : (
            <ReportView batchId={currentBatchId} report={report} />
          )}
        </div>
      )}

      {/* Modal de edición manual de documento */}
      <EditDocumentModal
        isOpen={isEditModalOpen}
        document={documentToEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setDocumentToEdit(null);
        }}
        onSaved={handleDocumentUpdated}
      />
    </div>
  );
};
