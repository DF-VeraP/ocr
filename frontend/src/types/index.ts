export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  requiresPasswordChange: boolean;
  createdAt?: string;
}

export type DocumentType = 'CC_TRADICIONAL' | 'CC_DIGITAL' | 'TI' | 'CONTRASENA';
export type ValidationStatus = 'EXISTE' | 'NO_EXISTE' | 'DISCREPANCIA' | 'NO_APORTADO';
export type CompletitudStatus = 'COMPLETO' | 'INCOMPLETA';

export interface ExtractedDocument {
  id: string;
  batchId: string;
  numeroDocumento: string;
  tipoDocumento: DocumentType;
  nombres?: string | null;
  apellidos?: string | null;
  nombreCompleto?: string | null;
  fechaNacimiento?: string | null;
  lugarNacimiento?: string | null;
  sexo?: string | null;
  grupoSanguineo?: string | null;
  fechaExpedicion?: string | null;
  lugarExpedicion?: string | null;
  estatura?: string | null;
  fechaVencimiento?: string | null;
  lugarPreparacion?: string | null;
  oficinaEntrega?: string | null;
  fotoUrl?: string | null;
  tieneFrente: boolean;
  tieneReverso: boolean;
  estadoCompletitud: CompletitudStatus;
  estadoValidacion: ValidationStatus;
  detalleDiscrepancias?: { campo: string; valorOcr: string; valorExcel: string }[] | null;
  createdAt: string;
}

export interface ProcessingBatch {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  isPaused?: boolean;
  totalPages: number;
  processedPages: number;
  pdfFilename: string;
  excelFilename: string;
  numeroFicha?: string;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface BatchHistoryItem {
  id: string;
  userId: string;
  pdfFilename: string;
  excelFilename: string;
  numeroFicha: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalPages: number;
  processedPages: number;
  percentage: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  totalDocuments: number;
  totalExcel: number;
  validCount: number;
  discrepancyCount: number;
  nonExcelCount: number;
}

export interface ReportItem {
  identificacion: string;
  identificacionLimpia: string;
  nombreOficial: string;
  estadoOficial: string;
  encontradoEnPdf: boolean;
  tipoDocumento: string;
  nombreOcr?: string | null;
  fechaNacimiento?: string | null;
  fotoUrl?: string | null;
  estadoValidacion: ValidationStatus;
  estadoCompletitud: CompletitudStatus;
  discrepancias?: { campo: string; valorOcr: string; valorExcel: string }[] | null;
}

export interface RegistrationRequest {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}
