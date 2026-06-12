export type LogEventType =
  | 'login'
  | 'logout'
  | 'disconnect'
  | 'crash'
  | 'item_change'
  | 'payment'
  | 'quest'
  | 'combat'
  | 'chat'
  | 'system'
  | 'unknown';

export interface LogEvent {
  id: string;
  timestamp: Date;
  rawTimestamp: string;
  type: LogEventType;
  playerId: string;
  playerName?: string;
  content: string;
  rawContent: string;
  details?: Record<string, string | number | boolean>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isMarked?: boolean;
  markNote?: string;
  markType?: 'freeze' | 'abnormal' | 'bug' | 'important';
  isMerged?: boolean;
  mergedIds?: string[];
  isMergedRep?: boolean;
  mergedRepId?: string;
  csNote?: string;
  batchId?: string;
}

export interface LogFile {
  path: string;
  name: string;
  content: string;
  size?: number;
  error?: string;
  batchId?: string;
}

export type FileParseStatus = 'success' | 'partial' | 'failed' | 'empty' | 'unknown_format';

export interface FileImportDetail {
  path: string;
  name: string;
  size?: number;
  status: FileParseStatus;
  totalLines: number;
  parsedCount: number;
  failedCount: number;
  errorMessage?: string;
  sampleErrors?: string[];
  sampleSuccessLines?: string[];
  sampleFailedLines?: string[];
  sourceZip?: string;
  batchId?: string;
}

export interface ImportBatch {
  id: string;
  timestamp: Date;
  sourcePaths: string[];
  sourceZipNames: string[];
  fileCount: number;
  successFiles: number;
  failedFiles: number;
  emptyFiles: number;
  unknownFormatFiles: number;
  totalParsedEvents: number;
  totalFailedLines: number;
  details: FileImportDetail[];
}

export interface ImportSummary {
  totalFiles: number;
  successFiles: number;
  failedFiles: number;
  emptyFiles: number;
  unknownFormatFiles: number;
  totalParsedEvents: number;
  totalFailedLines: number;
  details: FileImportDetail[];
}

export type OperationStatus = 'success' | 'failed' | 'cancelled' | 'not_supported';

export interface OperationNotification {
  id: string;
  type: 'copy' | 'export' | 'import' | 'save';
  status: OperationStatus;
  message: string;
  detail?: string;
  timestamp: Date;
}

export interface ProblemChain {
  id: string;
  playerId: string;
  anchorEvent: LogEvent;
  relatedEvents: LogEvent[];
  chainType: 'payment_missing' | 'crash_freeze' | 'item_missing' | 'disconnect_anomaly';
  startTime: Date;
  endTime: Date;
  description: string;
}

export interface ReportSection {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  eventRange: 'all' | 'marked' | 'template_filtered';
}

export interface ReportHistoryEntry {
  id: string;
  timestamp: Date;
  templateId: string;
  templateName: string;
  playerId: string;
  playerName?: string;
  sections: ReportSection[];
  exportStatus: OperationStatus;
  exportFilePath?: string;
  contentLength: number;
  content: string;
}

export interface PlayerSession {
  playerId: string;
  playerName: string;
  events: LogEvent[];
  loginEvents: LogEvent[];
  disconnectEvents: LogEvent[];
  startTime: Date;
  endTime: Date;
  totalDuration: number;
}

export interface SearchFilter {
  playerId?: string;
  eventTypes?: LogEventType[];
  keyword?: string;
  startTime?: Date;
  endTime?: Date;
  severity?: ('info' | 'warning' | 'error' | 'critical')[];
  onlyMarked?: boolean;
}

export interface SavedFilter {
  name: string;
  filter: SearchFilter;
  createdAt: Date;
}

export interface WorkTicketSummary {
  playerId: string;
  playerName?: string;
  issueTitle: string;
  issueDescription: string;
  keyEvents: LogEvent[];
  markedEvents: LogEvent[];
  timelineSummary: string;
  csNotes: string[];
  suggestedActions: string[];
}

export type WindowId = 'import' | 'timeline' | 'search' | 'mark' | 'summary';
