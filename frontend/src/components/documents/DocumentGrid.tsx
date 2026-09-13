import React from 'react';
import { ExtractedDocument } from '../../types';
import { User as UserIcon, Calendar, MapPin, Ruler, CheckCircle, AlertCircle, HelpCircle, FileText, Pencil } from 'lucide-react';

interface DocumentGridProps {
  documents: ExtractedDocument[];
  onEditDocument?: (doc: ExtractedDocument) => void;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({ documents, onEditDocument }) => {
  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
        <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No se encontraron documentos</h3>
        <p className="text-xs text-slate-400 mt-1">Ajuste los filtros de búsqueda o verifique la carga del lote.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {documents.map((doc) => {
        const fullName = doc.nombreCompleto || `${doc.nombres || ''} ${doc.apellidos || ''}`.trim() || 'Sin Nombre Identificado';

        return (
          <div
            key={doc.id}
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
          >
            <div>
              {/* Encabezado: Tipo y Estado */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {doc.tipoDocumento === 'CC_TRADICIONAL'
                    ? 'CC Tradicional'
                    : doc.tipoDocumento === 'CC_DIGITAL'
                    ? 'CC Digital'
                    : doc.tipoDocumento === 'TI'
                    ? 'Tarjeta Identidad'
                    : 'Contraseña'}
                </span>

                {doc.estadoValidacion === 'EXISTE' ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Existe en Excel
                  </span>
                ) : doc.estadoValidacion === 'DISCREPANCIA' ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Discrepancia
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> No en Excel
                  </span>
                )}
              </div>

              {/* Datos Principales: Identificación, Número y Nombre Completo */}
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-sena-50 dark:bg-sena-950/60 border border-sena-200/60 dark:border-sena-800/60 text-sena-600 dark:text-sena-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <UserIcon className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-sena-600 dark:text-sena-400 block tracking-wide">
                    NÚMERO / NUIP
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight block">
                    {doc.numeroDocumento || 'Sin número'}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 leading-snug line-clamp-2">
                    {fullName}
                  </h4>
                </div>
              </div>

              {/* Detalle de Campos Específicos (RF-067, RF-038 al RF-041) */}
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                {doc.fechaNacimiento && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nacimiento: <strong>{doc.fechaNacimiento}</strong></span>
                  </div>
                )}

                {doc.lugarNacimiento && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">Lugar Nac.: <strong>{doc.lugarNacimiento}</strong></span>
                  </div>
                )}

                {/* Estatura (solo CC) */}
                {doc.estatura && (
                  <div className="flex items-center gap-2">
                    <Ruler className="w-3.5 h-3.5 text-slate-400" />
                    <span>Estatura: <strong>{doc.estatura} m</strong></span>
                  </div>
                )}

                {/* Fecha Vencimiento (solo TI y CC Digital) */}
                {doc.fechaVencimiento && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>Vencimiento: <strong>{doc.fechaVencimiento}</strong></span>
                  </div>
                )}

                {/* Campos exclusivos de Contraseña */}
                {doc.oficinaEntrega && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-sena-500" />
                    <span>Entrega: <strong>{doc.oficinaEntrega}</strong></span>
                  </div>
                )}

                {doc.grupoSanguineo && (
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 font-bold text-red-500 text-center leading-none">🩸</span>
                    <span>RH: <strong>{doc.grupoSanguineo}</strong> | Sexo: <strong>{doc.sexo || 'N/A'}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Pie de tarjeta: Completitud y Acción de Edición */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Caras: {doc.tieneFrente ? '✓ Frente' : '✗ Sin frente'} {doc.tipoDocumento !== 'CONTRASENA' ? (doc.tieneReverso ? '✓ Reverso' : '✗ Sin reverso') : ''}
                {doc.estadoCompletitud === 'INCOMPLETA' && (
                  <span className="text-red-500 font-medium ml-1.5">• Incompleta</span>
                )}
              </span>

              {onEditDocument && (
                <button
                  type="button"
                  onClick={() => onEditDocument(doc)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-sena-600 dark:hover:text-sena-400 hover:bg-sena-50 dark:hover:bg-sena-950/40 border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Editar datos extraídos"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Editar</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
