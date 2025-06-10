import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QRProtocol } from '../utils/qrProtocol';
import { TransferStatus } from '../types/transfer';
import type { QRTransferConfig, FileData } from '../types/transfer';

const Sender: React.FC = () => {
  const [file, setFile] = useState<FileData | null>(null);
  const [config, setConfig] = useState<QRTransferConfig>({
    chunkSize: 30,
    autoAdvance: true,
    delay: 200
  });
  const [qrMessages, setQrMessages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<TransferStatus>(TransferStatus.IDLE);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const arrayBuffer = await selectedFile.arrayBuffer();
    setFile({
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      data: arrayBuffer
    });
    setStatus(TransferStatus.IDLE);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (!droppedFile) return;

    const arrayBuffer = await droppedFile.arrayBuffer();
    setFile({
      name: droppedFile.name,
      size: droppedFile.size,
      type: droppedFile.type,
      data: arrayBuffer
    });
    setStatus(TransferStatus.IDLE);
  };

  const generateQRCodes = async () => {
    if (!file) return;

    setStatus(TransferStatus.PREPARING);
    
    const chunks = QRProtocol.chunkData(file.data, config.chunkSize);
    const hash = await QRProtocol.calculateHash(file.data);
    const headers = QRProtocol.createHeader(chunks.length, hash);
    
    const messages: string[] = [];
    messages.push(...headers);
    
    chunks.forEach((chunk, index) => {
      messages.push(QRProtocol.createDataMessage(index, chunk));
    });
    
    messages.push(QRProtocol.MESSAGE_END);
    
    setQrMessages(messages);
    setCurrentIndex(0);
    setStatus(TransferStatus.SENDING);
    
    // Generate first QR code
    generateQRCode(messages[0]);
  };

  const generateQRCode = async (message: string) => {
    try {
      const url = await QRCode.toDataURL(message, {
        width: 300,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };


  const nextQR = () => {
    if (currentIndex < qrMessages.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      generateQRCode(qrMessages[newIndex]);
    } else {
      setStatus(TransferStatus.COMPLETED);
      setIsPlaying(false);
    }
  };

  const prevQR = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      generateQRCode(qrMessages[newIndex]);
    }
  };

  const toggleAutoPlay = () => {
    if (isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      const interval = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= qrMessages.length - 1) {
            setIsPlaying(false);
            setStatus(TransferStatus.COMPLETED);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return prev;
          }
          const newIndex = prev + 1;
          generateQRCode(qrMessages[newIndex]);
          return newIndex;
        });
      }, config.delay);
      
      intervalRef.current = interval;
      setIsPlaying(true);
    }
  };

  const resetTransfer = () => {
    setFile(null);
    setQrMessages([]);
    setCurrentIndex(0);
    setStatus(TransferStatus.IDLE);
    setQrCodeUrl('');
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = () => {
    switch (status) {
      case TransferStatus.COMPLETED:
        return 'text-green-600';
      case TransferStatus.ERROR:
        return 'text-red-600';
      case TransferStatus.SENDING:
        return 'text-blue-600';
      case TransferStatus.PREPARING:
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8 text-gray-800">QR Transfer - Sender</h1>
      
      {/* File Upload Section */}
      <div className="mb-8">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-8 text-center hover:border-blue-400 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div>
              <p className="text-lg font-semibold text-gray-700">{file.name}</p>
              <p className="text-gray-500">{formatFileSize(file.size)}</p>
              <p className="text-gray-400 text-sm">{file.type}</p>
            </div>
          ) : (
            <div>
              <p className="text-lg text-gray-600">Drop files here or click to browse</p>
              <p className="text-sm text-gray-400">Select a file to transfer via QR codes</p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Section */}
      {file && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Transfer Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chunk Size (bytes)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={config.chunkSize}
                onChange={(e) => setConfig({...config, chunkSize: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delay (ms)
              </label>
              <input
                type="number"
                min="50"
                max="5000"
                value={config.delay}
                onChange={(e) => setConfig({...config, delay: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoAdvance"
                checked={config.autoAdvance}
                onChange={(e) => setConfig({...config, autoAdvance: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoAdvance" className="ml-2 block text-sm text-gray-700">
                Auto-advance QR codes
              </label>
            </div>
          </div>
          
          <div className="mt-4 flex gap-4">
            <button
              onClick={generateQRCodes}
              disabled={status === TransferStatus.PREPARING}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === TransferStatus.PREPARING ? 'Generating...' : 'Generate QR Codes'}
            </button>
            <button
              onClick={resetTransfer}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* QR Code Display Section */}
      {qrMessages.length > 0 && (
        <div className="mb-8">
          <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
            <div className="text-center">
              {qrCodeUrl && (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code" 
                  className="mx-auto mb-4 border border-gray-300 rounded"
                />
              )}
              
              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-700">
                  {currentIndex + 1} / {qrMessages.length}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / qrMessages.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-4">
                <button
                  onClick={prevQR}
                  disabled={currentIndex === 0}
                  className="px-3 md:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                >
                  ← Prev
                </button>
                <button
                  onClick={toggleAutoPlay}
                  disabled={status === TransferStatus.COMPLETED}
                  className="px-3 md:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                  onClick={nextQR}
                  disabled={currentIndex === qrMessages.length - 1}
                  className="px-3 md:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                >
                  Next →
                </button>
              </div>

              <p className={`text-sm font-medium ${getStatusColor()}`}>
                Status: {status.charAt(0).toUpperCase() + status.slice(1)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sender;