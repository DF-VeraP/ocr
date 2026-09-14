import React, { useState, useEffect } from 'react';
import { ExtractedDocument, DocumentType } from '../../types';
import { api } from '../../api/client';
import { X, Save, AlertTriangle, Loader2, CheckCircle2, FileEdit } from 'lucide-react';

interface EditDocumentModalProps {
  isOpen: boolean;
  document: ExtractedDocument | null;
  onClose: () => void;
  onSaved: (updatedDoc: ExtractedDocument) => void;
}

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  isOpen,
  document: doc,
  onClose,
  onSaved,
}) => {
  const [tipoDocumento, setTipoDocumento] = useState<DocumentType>('CC_TRADICIONAL');
  const [numeroDocumento, setNumeroDocumento] = useState<string>('');
  const [nombres, setNombres] = useState<string>('');
  const [apellidos, setApellidos] = useState<string>('');
  const [fechaNacimiento, setFechaNacimiento] = useState<string>('');
  const [lugarNacimiento, setLugarNacimiento] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (doc) {
      setTipoDocumento(doc.tipoDocumento);
      setNumeroDocumento(doc.numeroDocumento || '');
      setNombres(doc.nombres || '');
      setApellidos(doc.apellidos || '');
      setFechaNacimiento(doc.fechaNacimiento || '');
      setLugarNacimiento(doc.lugarNacimiento || '');
      setError(null);
    }
  }, [doc]);

  if (!isOpen || !doc) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        nombreCompleto: `${nombres.trim()} ${apellidos.trim()}`.trim(),
        fechaNacimiento: fechaNacimiento.trim(),
        lugarNacimiento: lugarNacimiento.trim(),
      };

      const res = await api.patch(`/batches/${doc.batchId}/documents/${doc.id}`, payload);
      if (res.data?.document) {
        onSaved(res.data.document);
        onClose();
      }
    } catch (err: any) {
      console.error('Error guardando documento:', err);
      setError(err.response?.data?.error || 'Error al guardar los cambios del documento');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sena-50 dark:bg-sena-950/50 text-sena-600 dark:text-sena-400 flex items-center justify-center border border-sena-200/50 dark:border-sena-800/50">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Editar Registro de Cédula
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajuste manual para corregir lecturas inexactas del escaneo OCR
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Tipo de Documento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tipo de Documento
            </label>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as DocumentType)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-sena-500 focus:outline-none"
            >
              <option value="CC_TRADICIONAL">Cédula de Ciudadanía Tradicional (Amarilla)</option>
              <option value="CC_DIGITAL">Cédula de Ciudadanía Digital</option>
              <option value="TI">Tarjeta de Identidad</option>
              <option value="CONTRASENA">Contraseña / Comprobante de Documento</option>
            </select>
          </div>

          {/* Número de Cédula / NUIP */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Número de Identificación / NUIP
            </label>
            <input
              type="text"
              required
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ej: 1117491401"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-sena-500 focus:outline-none"
            />
          </div>

          {/* Nombres y Apellidos en dos columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nombres
              </label>
              <input
                type="text"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Ej: CARLOS ARLES"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-sena-500 focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Apellidos
              </label>
              <input
                type="text"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Ej: SILVA VEGA"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-sena-500 focus:outline-none uppercase"
              />
            </div>
          </div>

          {/* Fecha de Nacimiento y Lugar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Fecha de Nacimiento
              </label>
              <input
                type="text"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                placeholder="Ej: 15-ENE-1995"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-sena-500 focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Lugar de Nacimiento (Opcional)
              </label>
              <input
                type="text"
                value={lugarNacimiento}
                onChange={(e) => setLugarNacimiento(e.target.value)}
                placeholder="Ej: FLORENCIA (CAQUETÁ)"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-sena-500 focus:outline-none uppercase"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-blue-500" />
            <span>Al guardar, el sistema re-evaluará automáticamente la coincidencia con la matriz oficial de Excel.</span>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sena-500 to-sena-600 hover:from-sena-600 hover:to-sena-700 text-white text-xs font-semibold shadow-lg shadow-sena-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando y Validando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
