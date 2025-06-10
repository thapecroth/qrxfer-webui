import type { TransferChunk, TransferHeader, TransferMessage } from '../types/transfer';

export class QRProtocol {
  static readonly MESSAGE_BEGIN = '-----BEGIN XFER MESSAGE-----';
  static readonly MESSAGE_END = '-----END XFER MESSAGE-----';
  static readonly HEADER_BEGIN = '-----BEGIN XFER HEADER-----';
  static readonly HEADER_END = '-----END XFER HEADER-----';
  static chunkData(data: ArrayBuffer, chunkSize: number): string[] {
    const uint8Array = new Uint8Array(data);
    const chunks: string[] = [];
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      const base64 = btoa(String.fromCharCode(...chunk));
      chunks.push(base64);
    }
    
    return chunks;
  }

  static async calculateHash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  }

  static createHeader(length: number, hash: string): string[] {
    return [
      QRProtocol.MESSAGE_BEGIN,
      QRProtocol.HEADER_BEGIN,
      `LEN:${length}`,
      `HASH:${hash}`,
      QRProtocol.HEADER_END
    ];
  }

  static createDataMessage(sequence: number, data: string): string {
    return `${sequence.toString().padStart(10, '0')}:${data}`;
  }

  static parseMessage(message: string): TransferMessage | null {
    if (message === QRProtocol.MESSAGE_BEGIN || message === QRProtocol.MESSAGE_END) {
      return { type: message === QRProtocol.MESSAGE_BEGIN ? 'header' : 'end', content: message };
    }
    
    if (message === QRProtocol.HEADER_BEGIN || message === QRProtocol.HEADER_END) {
      return { type: 'header', content: message };
    }
    
    if (message.startsWith('LEN:') || message.startsWith('HASH:')) {
      return { type: 'header', content: message };
    }
    
    // Check if it's a data chunk (sequence:data format)
    const chunkMatch = message.match(/^(\d{10}):(.+)$/);
    if (chunkMatch) {
      return { type: 'chunk', content: message };
    }
    
    return null;
  }

  static parseDataChunk(message: string): TransferChunk | null {
    const match = message.match(/^(\d{10}):(.+)$/);
    if (!match) return null;
    
    return {
      sequence: parseInt(match[1], 10),
      data: match[2]
    };
  }

  static parseHeader(headerMessages: string[]): TransferHeader | null {
    let length = 0;
    let hash = '';
    
    for (const message of headerMessages) {
      if (message.startsWith('LEN:')) {
        length = parseInt(message.split(':')[1], 10);
      } else if (message.startsWith('HASH:')) {
        hash = message.split(':')[1];
      }
    }
    
    if (length > 0 && hash) {
      return { length, hash };
    }
    
    return null;
  }

  static reconstructData(chunks: TransferChunk[]): ArrayBuffer {
    // Sort chunks by sequence number
    const sortedChunks = chunks.sort((a, b) => a.sequence - b.sequence);
    
    // Decode base64 chunks
    const decodedChunks = sortedChunks.map(chunk => {
      const binaryString = atob(chunk.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    });
    
    // Calculate total length
    const totalLength = decodedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    
    // Combine chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of decodedChunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }

  static async verifyIntegrity(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
    const uint8Array = new Uint8Array(data);
    const hashBuffer = await crypto.subtle.digest('SHA-1', uint8Array);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return hashHex === expectedHash;
  }

  static downloadFile(data: ArrayBuffer, fileName: string, mimeType?: string): void {
    const blob = new Blob([data], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
}