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
    <div className="max-w-5xl mx-auto px-2 sm:px-0">
      <div className="bg-gradient-to-br from-white/90 to-blue-50/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl shadow-purple-500/20 p-4 sm:p-6 md:p-8 border border-white/30">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-6 sm:mb-8 md:mb-12 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Send Files</h1>
      
        {/* File Upload Section */}
        <div className="mb-6 sm:mb-10">
          <div
            className="group relative border-2 border-dashed border-gray-300 rounded-xl sm:rounded-2xl p-4 sm:p-8 md:p-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-300 cursor-pointer"
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
              <div className="space-y-4">
                <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 sm:w-8 h-6 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-bold text-gray-800 break-all">{file.name}</p>
                  <p className="text-base sm:text-lg text-gray-600">{formatFileSize(file.size)}</p>
                  <p className="text-gray-500 text-xs sm:text-sm bg-gray-100 rounded-full px-2 sm:px-3 py-1 inline-block mt-2 break-all">{file.type}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 sm:w-8 h-6 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-semibold text-gray-700">Drop files here or click to browse</p>
                  <p className="text-gray-500 mt-2 text-sm sm:text-base">Select any file to transfer via QR codes</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1">All file types supported • Processed locally</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Section */}
        {file && (
          <div className="mb-6 sm:mb-10 p-4 sm:p-8 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 rounded-xl sm:rounded-2xl border border-indigo-200/50">
            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-800">Transfer Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                  Chunk Size (bytes)
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={config.chunkSize}
                  onChange={(e) => setConfig({...config, chunkSize: parseInt(e.target.value)})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-indigo-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-300 bg-white/90 backdrop-blur-sm text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                  Delay (ms)
                </label>
                <input
                  type="number"
                  min="50"
                  max="5000"
                  value={config.delay}
                  onChange={(e) => setConfig({...config, delay: parseInt(e.target.value)})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-indigo-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-300 bg-white/90 backdrop-blur-sm text-sm sm:text-base"
                />
              </div>
              <div className="flex items-center justify-center sm:justify-start lg:justify-start sm:col-span-2 lg:col-span-1">
                <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-indigo-200">
                  <input
                    type="checkbox"
                    id="autoAdvance"
                    checked={config.autoAdvance}
                    onChange={(e) => setConfig({...config, autoAdvance: e.target.checked})}
                    className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 focus:ring-purple-500 border-indigo-300 rounded"
                  />
                  <label htmlFor="autoAdvance" className="ml-2 sm:ml-3 block text-xs sm:text-sm font-medium text-gray-700">
                    Auto-advance QR codes
                  </label>
                </div>
              </div>
            </div>
            
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={generateQRCodes}
                disabled={status === TransferStatus.PREPARING}
                className="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg sm:rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-purple-600/30 hover:shadow-xl hover:shadow-purple-600/50 disabled:shadow-none text-sm sm:text-base"
              >
                {status === TransferStatus.PREPARING ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating...
                  </div>
                ) : (
                  'Generate QR Codes'
                )}
              </button>
              <button
                onClick={resetTransfer}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-slate-600 to-gray-600 text-white font-semibold rounded-lg sm:rounded-xl hover:from-slate-700 hover:to-gray-700 transition-all duration-300 shadow-lg shadow-slate-600/30 text-sm sm:text-base"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* QR Code Display Section */}
        {qrMessages.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-gradient-to-br from-white/95 to-indigo-50/80 backdrop-blur-sm border-2 border-indigo-200/50 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl">
              <div className="text-center">
                {qrCodeUrl && (
                  <div className="relative inline-block mb-4 sm:mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl blur-xl opacity-25"></div>
                    <img 
                      src={qrCodeUrl} 
                      alt="QR Code" 
                      className="relative mx-auto border-2 sm:border-4 border-white rounded-xl sm:rounded-2xl shadow-2xl bg-white p-2 sm:p-4 w-48 h-48 sm:w-auto sm:h-auto max-w-xs"
                    />
                  </div>
                )}
                
                <div className="mb-6 sm:mb-8">
                  <p className="text-lg sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-3">
                    {currentIndex + 1} / {qrMessages.length}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 mt-3 sm:mt-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 sm:h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${((currentIndex + 1) / qrMessages.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-2">
                    {Math.round(((currentIndex + 1) / qrMessages.length) * 100)}% Complete
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <button
                    onClick={prevQR}
                    disabled={currentIndex === 0}
                    className="flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-gray-600 text-white font-medium rounded-lg sm:rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>
                  <button
                    onClick={toggleAutoPlay}
                    disabled={status === TransferStatus.COMPLETED}
                    className={`flex items-center px-4 sm:px-6 py-2 sm:py-3 font-medium rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base ${
                      isPlaying 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pause
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h6m2 5H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2z" />
                        </svg>
                        Play
                      </>
                    )}
                  </button>
                  <button
                    onClick={nextQR}
                    disabled={currentIndex === qrMessages.length - 1}
                    className="flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-gray-600 text-white font-medium rounded-lg sm:rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  >
                    Next
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <div className={`inline-flex items-center px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold ${getStatusColor()} ${
                  status === TransferStatus.COMPLETED 
                    ? 'bg-green-100' 
                    : status === TransferStatus.ERROR 
                    ? 'bg-red-100' 
                    : status === TransferStatus.SENDING 
                    ? 'bg-blue-100' 
                    : 'bg-gray-100'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 ${
                    status === TransferStatus.COMPLETED 
                      ? 'bg-green-500' 
                      : status === TransferStatus.ERROR 
                      ? 'bg-red-500' 
                      : status === TransferStatus.SENDING 
                      ? 'bg-blue-500 animate-pulse' 
                      : 'bg-gray-500'
                  }`}></div>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sender;