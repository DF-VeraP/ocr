import React from 'react';
import { Search, Filter, Layers } from 'lucide-react';

interface FilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  tipoFilter: string;
  onTipoFilterChange: (value: string) => void;
  estadoFilter: string;
  onEstadoFilterChange: (value: string) => void;
  totalCount: number;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  search,
  onSearchChange,
  tipoFilter,
  onTipoFilterChange,
  estadoFilter,
  onEstadoFilterChange,
  totalCount,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
      {/* Buscador predictivo (RF-071) */}
      <div className="relative w-full sm:w-80">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por número o nombre..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sena-500/50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        {/* Filtro por Tipo de Documento (RF-069) */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Layers className="w-4 h-4 text-slate-400" />
          <select
            value={tipoFilter}
            onChange={(e) => onTipoFilterChange(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sena-500/50"
          >
            <option value="TODOS">Todos los Tipos</option>
            <option value="CC_TRADICIONAL">Cédula Tradicional (Amarilla)</option>
            <option value="CC_DIGITAL">Cédula Digital</option>
            <option value="TI">Tarjeta de Identidad (TI)</option>
            <option value="CONTRASENA">Contraseña</option>
          </select>
        </div>

        {/* Filtro por Estado de Validación (RF-070) */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={estadoFilter}
            onChange={(e) => onEstadoFilterChange(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sena-500/50"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="EXISTE">Existe en Excel</option>
            <option value="NO_EXISTE">No Existe en Excel</option>
            <option value="DISCREPANCIA">Con Discrepancia</option>
            <option value="INCOMPLETA">Incompleta (1 cara)</option>
          </select>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ml-auto">
          {totalCount} registro(s)
        </span>
      </div>
    </div>
  );
};
