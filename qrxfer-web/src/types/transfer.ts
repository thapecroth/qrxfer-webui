export interface TransferChunk {
  sequence: number;
  data: string; // base64 encoded
}

export interface TransferHeader {
  length: number;
  hash: string;
}

export interface TransferMessage {
  type: 'header' | 'chunk' | 'end';
  content: string;
}

export interface TransferProgress {
  totalChunks: number;
  receivedChunks: number;
  missingChunks: number[];
  currentChunk: number;
  isComplete: boolean;
  hash: string | null;
}

export interface QRTransferConfig {
  chunkSize: number;
  autoAdvance: boolean;
  delay: number;
}

export interface FileData {
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
}

export interface ScanResult {
  data: string;
  timestamp: number;
}

export const TransferStatus = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  SENDING: 'sending',
  RECEIVING: 'receiving',
  COMPLETED: 'completed',
  ERROR: 'error',
  PAUSED: 'paused'
} as const;

export type TransferStatus = typeof TransferStatus[keyof typeof TransferStatus];

export interface TransferState {
  status: TransferStatus;
  currentStep: number;
  totalSteps: number;
  errorMessage?: string;
}