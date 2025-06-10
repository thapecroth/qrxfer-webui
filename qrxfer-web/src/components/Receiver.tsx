import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { QRProtocol } from '../utils/qrProtocol';
import { TransferStatus } from '../types/transfer';
import type { 
  TransferChunk, 
  TransferHeader, 
  TransferProgress 
} from '../types/transfer';

const Receiver: React.FC = () => {
  const [status, setStatus] = useState<TransferStatus>(TransferStatus.IDLE);
  const [progress, setProgress] = useState<TransferProgress>({
    totalChunks: 0,
    receivedChunks: 0,
    missingChunks: [],
    currentChunk: 0,
    isComplete: false,
    hash: null
  });
  const [chunks, setChunks] = useState<TransferChunk[]>([]);
  const [header, setHeader] = useState<TransferHeader | null>(null);
  const [fileName, setFileName] = useState<string>('received_file');
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [receivedSequences, setReceivedSequences] = useState<Set<number>>(new Set());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const headerMessages = useRef<string[]>([]);
  const isReceivingHeader = useRef<boolean>(false);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
    if (status === TransferStatus.RECEIVING) {
      setStatus(TransferStatus.IDLE);
    }
  }, [status]);

  const getCameraDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setCameraDevices(cameras);
      if (cameras.length > 0 && !selectedDevice) {
        setSelectedDevice(cameras[0].deviceId);
      }
    } catch (error) {
      console.error('Error getting camera devices:', error);
      setErrorMessage('Could not access camera devices');
    }
  }, [selectedDevice]);

  useEffect(() => {
    getCameraDevices();
    return () => {
      stopScanning();
    };
  }, [getCameraDevices, stopScanning]);

  const startScanning = async () => {
    try {
      setErrorMessage('');
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        setStatus(TransferStatus.RECEIVING);
        startQRScanning();
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      setErrorMessage('Could not start camera. Please check permissions.');
    }
  };

  const startQRScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(() => {
      scanQRCode();
    }, 100);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      processQRCode(code.data);
    }
  };

  const processQRCode = (data: string) => {
    const message = QRProtocol.parseMessage(data);
    if (!message) return;

    try {
      if (data === QRProtocol.MESSAGE_BEGIN) {
        resetReceiver();
        isReceivingHeader.current = true;
        headerMessages.current = [];
        return;
      }

      if (data === QRProtocol.HEADER_BEGIN) {
        return;
      }

      if (data.startsWith('LEN:') || data.startsWith('HASH:')) {
        if (isReceivingHeader.current) {
          headerMessages.current.push(data);
        }
        return;
      }

      if (data === QRProtocol.HEADER_END) {
        const parsedHeader = QRProtocol.parseHeader(headerMessages.current);
        if (parsedHeader) {
          setHeader(parsedHeader);
          setProgress(prev => ({
            ...prev,
            totalChunks: parsedHeader.length,
            hash: parsedHeader.hash
          }));
          isReceivingHeader.current = false;
        }
        return;
      }

      if (data === QRProtocol.MESSAGE_END) {
        if (chunks.length > 0) {
          completeTransfer();
        }
        return;
      }

      if (message.type === 'chunk') {
        const chunk = QRProtocol.parseDataChunk(data);
        if (chunk && !receivedSequences.has(chunk.sequence)) {
          setChunks(prev => {
            const updated = [...prev, chunk];
            return updated.sort((a, b) => a.sequence - b.sequence);
          });
          
          setReceivedSequences(prev => new Set([...prev, chunk.sequence]));
          
          setProgress(prev => {
            const newMissingChunks = [];
            for (let i = 0; i < prev.totalChunks; i++) {
              if (!receivedSequences.has(i) && i !== chunk.sequence) {
                newMissingChunks.push(i);
              }
            }

            return {
              ...prev,
              receivedChunks: prev.receivedChunks + 1,
              currentChunk: chunk.sequence,
              missingChunks: newMissingChunks
            };
          });
        }
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      setErrorMessage('Error processing QR code data');
    }
  };

  const completeTransfer = async () => {
    if (!header || chunks.length === 0) {
      setErrorMessage('No data received');
      return;
    }

    try {
      const reconstructedData = QRProtocol.reconstructData(chunks);
      const isValid = await QRProtocol.verifyIntegrity(reconstructedData, header.hash);

      if (isValid) {
        setStatus(TransferStatus.COMPLETED);
        setProgress(prev => ({ ...prev, isComplete: true }));
        
        if (autoSave) {
          QRProtocol.downloadFile(reconstructedData, fileName);
        }
      } else {
        setErrorMessage('Data integrity check failed!');
        setStatus(TransferStatus.ERROR);
      }
    } catch (error) {
      console.error('Error completing transfer:', error);
      setErrorMessage('Error reconstructing file');
      setStatus(TransferStatus.ERROR);
    }
  };

  const manualDownload = () => {
    if (chunks.length > 0 && header) {
      try {
        const reconstructedData = QRProtocol.reconstructData(chunks);
        QRProtocol.downloadFile(reconstructedData, fileName);
      } catch (error) {
        console.error('Error downloading file:', error);
        setErrorMessage('Error downloading file');
      }
    }
  };

  const resetReceiver = () => {
    setChunks([]);
    setHeader(null);
    setProgress({
      totalChunks: 0,
      receivedChunks: 0,
      missingChunks: [],
      currentChunk: 0,
      isComplete: false,
      hash: null
    });
    setReceivedSequences(new Set());
    headerMessages.current = [];
    isReceivingHeader.current = false;
    setErrorMessage('');
    setStatus(TransferStatus.IDLE);
  };

  const clearData = () => {
    resetReceiver();
    stopScanning();
  };

  const getStatusColor = () => {
    switch (status) {
      case TransferStatus.COMPLETED:
        return 'text-green-600';
      case TransferStatus.ERROR:
        return 'text-red-600';
      case TransferStatus.RECEIVING:
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatFileSize = (chunks: number, chunkSize: number = 30): string => {
    const bytes = chunks * chunkSize;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8 text-gray-800">QR Transfer - Receiver</h1>

      {/* Camera Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Camera Device
        </label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {cameraDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      {/* Camera Preview */}
      <div className="mb-6">
        <div className="bg-black rounded-lg overflow-hidden relative">
          <video
            ref={videoRef}
            className="w-full h-80 object-cover"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
              <p className="text-white text-lg">Camera Preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <button
          onClick={isScanning ? stopScanning : startScanning}
          className={`px-6 py-2 rounded-md text-white font-medium ${
            isScanning 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isScanning ? 'Stop Scanning' : 'Start Scanning'}
        </button>
        
        <button
          onClick={clearData}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Clear Data
        </button>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="autoSave"
            checked={autoSave}
            onChange={(e) => setAutoSave(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="autoSave" className="ml-2 block text-sm text-gray-700">
            Auto-save when complete
          </label>
        </div>
      </div>

      {/* File Name Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          File Name
        </label>
        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter filename for download"
        />
      </div>

      {/* Progress Section */}
      <div className="mb-6 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Transfer Progress</h3>
        
        {header && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Expected: {header.length} chunks
            </p>
            <p className="text-sm text-gray-600">
              Size: ~{formatFileSize(header.length)}
            </p>
          </div>
        )}

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Received: {progress.receivedChunks} / {progress.totalChunks}</span>
            <span>{progress.totalChunks > 0 ? Math.round((progress.receivedChunks / progress.totalChunks) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${progress.totalChunks > 0 ? (progress.receivedChunks / progress.totalChunks) * 100 : 0}%` 
              }}
            />
          </div>
        </div>

        {progress.missingChunks.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Missing chunks: {progress.missingChunks.length}
            </p>
            <div className="text-xs text-gray-500 max-h-20 overflow-y-auto">
              {progress.missingChunks.slice(0, 20).join(', ')}
              {progress.missingChunks.length > 20 && '...'}
            </div>
          </div>
        )}

        {progress.hash && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Hash: {progress.isComplete ? '✓ Verified' : progress.hash.substring(0, 16) + '...'}
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={manualDownload}
            disabled={chunks.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download File
          </button>
          <button
            onClick={completeTransfer}
            disabled={chunks.length === 0 || !header}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Complete Transfer
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        <p className={`text-lg font-medium ${getStatusColor()}`}>
          Status: {status.charAt(0).toUpperCase() + status.slice(1)}
        </p>
        {errorMessage && (
          <p className="text-red-600 text-sm mt-2">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};

export default Receiver;