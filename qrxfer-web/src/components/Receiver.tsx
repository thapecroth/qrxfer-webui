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
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lastError, setLastError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const headerMessages = useRef<string[]>([]);
  const isReceivingHeader = useRef<boolean>(false);

  const stopScanning = useCallback(() => {
    // Clear all timeouts and intervals
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Stop all camera tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped track: ${track.kind}, state: ${track.readyState}`);
      });
      streamRef.current = null;
    }

    // Reset video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }

    setCameraReady(false);
    setIsScanning(false);
    setRetryCount(0);
    
    if (status === TransferStatus.RECEIVING) {
      setStatus(TransferStatus.IDLE);
    }
  }, [status]);

  const checkCameraPermissions = useCallback(async (): Promise<PermissionState> => {
    try {
      // Check if permissions API is available
      if ('permissions' in navigator && navigator.mediaDevices) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setPermissionState(result.state);
        return result.state;
      }
      
      // Fallback: try to access devices to infer permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = devices.some((device: MediaDeviceInfo) => device.label !== '');
      
      if (hasLabels) {
        setPermissionState('granted');
        return 'granted';
      } else {
        setPermissionState('prompt');
        return 'prompt';
      }
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      setPermissionState('denied');
      return 'denied';
    }
  }, []);

  // Debug info (remove in production)
  useEffect(() => {
    console.log('Camera state:', {
      isScanning,
      cameraReady,
      permissionState,
      deviceCount: cameraDevices.length,
      selectedDevice: selectedDevice.substring(0, 8),
      retryCount,
      lastError
    });
  }, [isScanning, cameraReady, permissionState, cameraDevices.length, selectedDevice, retryCount, lastError]);

  const getCameraDevices = useCallback(async (requestPermission: boolean = false): Promise<MediaDeviceInfo[]> => {
    try {
      setErrorMessage('');
      setLastError('');
      
      // Request permission if needed
      if (requestPermission) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(track => track.stop());
        } catch (permError) {
          console.warn('Permission request failed:', permError);
          setPermissionState('denied');
          throw new Error('Camera permission denied');
        }
      }

      // Get available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`Found ${cameras.length} camera devices:`, cameras.map(c => ({ id: c.deviceId, label: c.label })));
      
      setCameraDevices(cameras);
      
      // Auto-select first camera if none selected
      if (cameras.length > 0 && !selectedDevice) {
        const preferredCamera = cameras.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('rear')
        ) || cameras[0];
        
        setSelectedDevice(preferredCamera.deviceId);
        console.log('Auto-selected camera:', preferredCamera.label || preferredCamera.deviceId);
      }
      
      return cameras;
    } catch (error) {
      console.error('Error getting camera devices:', error);
      const errorMsg = error instanceof Error ? error.message : 'Could not access camera devices';
      setErrorMessage(errorMsg);
      setLastError(errorMsg);
      return [];
    }
  }, [selectedDevice]);

  // Initialize camera system
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        await checkCameraPermissions();
        await getCameraDevices();
      } catch (error) {
        console.error('Camera initialization failed:', error);
      }
    };

    initializeCamera();
    
    return () => {
      stopScanning();
    };
  }, [checkCameraPermissions, getCameraDevices, stopScanning]);

  const startCameraWithRetry = useCallback(async (deviceId?: string, attempt: number = 1): Promise<boolean> => {
    const maxRetries = 3;
    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 },
        facingMode: deviceId ? undefined : { ideal: 'environment' } // Prefer back camera
      }
    };

    try {
      console.log(`Starting camera attempt ${attempt}/${maxRetries} with constraints:`, constraints);
      
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Configure video element
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      const video = videoRef.current;
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;

      // Wait for video to be ready with timeout
      const videoReady = new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video initialization timeout'));
        }, 10000); // 10 second timeout

        const onLoadedMetadata = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          console.log(`Video ready: ${video.videoWidth}x${video.videoHeight}`);
          resolve(true);
        };

        const onError = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('Video load error'));
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);

        // If video is already ready
        if (video.readyState >= 2) {
          onLoadedMetadata();
        }
      });

      await video.play();
      await videoReady;

      setCameraReady(true);
      setRetryCount(0);
      setLastError('');
      
      console.log('Camera started successfully');
      return true;

    } catch (error) {
      console.error(`Camera start attempt ${attempt} failed:`, error);
      setLastError(error instanceof Error ? error.message : 'Unknown camera error');
      
      // Clean up on failure
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraReady(false);

      // Retry with fallback constraints
      if (attempt < maxRetries) {
        console.log(`Retrying camera start in 1 second... (${attempt}/${maxRetries})`);
        setRetryCount(attempt);
        
        return new Promise(resolve => {
          retryTimeoutRef.current = setTimeout(async () => {
            let fallbackDeviceId = deviceId;
            
            // Try different strategies on different attempts
            if (attempt === 2) {
              // Second attempt: try without specific device
              fallbackDeviceId = undefined;
            } else if (attempt === 3) {
              // Third attempt: try a different camera
              const otherCameras = cameraDevices.filter(d => d.deviceId !== deviceId);
              fallbackDeviceId = otherCameras[0]?.deviceId;
            }
            
            const result = await startCameraWithRetry(fallbackDeviceId, attempt + 1);
            resolve(result);
          }, 1000);
        });
      }

      return false;
    }
  }, [cameraDevices]);

  const startScanning = async () => {
    try {
      setErrorMessage('');
      setLastError('');
      
      // Check camera permissions first
      const permissionState = await checkCameraPermissions();
      if (permissionState === 'denied') {
        setErrorMessage('Camera access denied. Please allow camera permissions in your browser settings.');
        return;
      }

      // Ensure we have camera devices
      const devices = await getCameraDevices(permissionState === 'prompt');
      if (devices.length === 0) {
        setErrorMessage('No camera devices found. Please connect a camera and try again.');
        return;
      }

      // Start camera with selected device
      const success = await startCameraWithRetry(selectedDevice);
      if (!success) {
        setErrorMessage(`Failed to start camera after multiple attempts. Last error: ${lastError}`);
        return;
      }

      setIsScanning(true);
      setStatus(TransferStatus.RECEIVING);
      startQRScanning();
      
    } catch (error) {
      console.error('Error in startScanning:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error starting camera';
      setErrorMessage(`Camera error: ${errorMsg}`);
    }
  };

  const startQRScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    // Start scanning with a reasonable interval
    scanIntervalRef.current = setInterval(() => {
      if (cameraReady && videoRef.current && videoRef.current.readyState >= 2) {
        scanQRCode();
      }
    }, 150); // Slightly slower to reduce CPU usage
    
    console.log('QR scanning started');
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // More robust readiness check
    if (!context || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      // Set canvas size to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Draw current video frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data for QR scanning
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Scan for QR codes with options for better detection
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        console.log('QR Code detected:', code.data.substring(0, 50) + '...');
        processQRCode(code.data);
      }
    } catch (error) {
      console.error('Error during QR scanning:', error);
      // Don't stop scanning on single frame errors
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

  // Handle device change
  const handleDeviceChange = useCallback(async (newDeviceId: string) => {
    const wasScanning = isScanning;
    
    if (wasScanning) {
      stopScanning();
    }
    
    setSelectedDevice(newDeviceId);
    
    if (wasScanning) {
      // Small delay to ensure cleanup is complete
      setTimeout(() => {
        startScanning();
      }, 500);
    }
  }, [isScanning, startScanning, stopScanning]);

  // Handle visibility change to pause/resume camera
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isScanning) {
        console.log('Page hidden, pausing camera');
        stopScanning();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isScanning, stopScanning]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const formatFileSize = (chunks: number, chunkSize: number = 30): string => {
    const bytes = chunks * chunkSize;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-0">
      <div className="bg-gradient-to-br from-white/90 to-emerald-50/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl shadow-emerald-500/20 p-4 sm:p-6 md:p-8 border border-white/30">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-6 sm:mb-8 md:mb-12 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">Receive Files</h1>

        {/* Camera Selection */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <label className="block text-base sm:text-lg font-semibold text-gray-700">
              📹 Camera Device
            </label>
            <button
              onClick={() => getCameraDevices(true)}
              disabled={isScanning}
              className="px-3 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh camera list"
            >
              🔄 Refresh
            </button>
          </div>
          <select
            value={selectedDevice}
            onChange={(e) => handleDeviceChange(e.target.value)}
            disabled={isScanning}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-emerald-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300 bg-white/90 backdrop-blur-sm shadow-sm text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cameraDevices.length === 0 ? (
              <option value="">No cameras found</option>
            ) : (
              cameraDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                </option>
              ))
            )}
          </select>
          
          {/* Camera Status Info */}
          {cameraDevices.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              Found {cameraDevices.length} camera{cameraDevices.length !== 1 ? 's' : ''}
              {permissionState === 'granted' && ' • ✓ Permission granted'}
              {cameraReady && ' • 🟢 Ready'}
            </div>
          )}
        </div>

        {/* Camera Preview */}
        <div className="mb-6 sm:mb-8">
          <div className="relative bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              className="w-full h-48 sm:h-80 lg:h-96 object-cover"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            
            {/* Camera Status Overlay */}
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 backdrop-blur-sm">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <svg className="w-6 sm:w-8 h-6 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 002 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-white text-lg sm:text-xl font-semibold mb-1 sm:mb-2">Camera Preview</p>
                <p className="text-gray-300 text-xs sm:text-sm text-center px-4">
                  {permissionState === 'denied' ? 'Camera access denied' :
                   cameraDevices.length === 0 ? 'No cameras detected' :
                   retryCount > 0 ? `Retrying... (${retryCount}/3)` :
                   'Click "Start Scanning" to begin'}
                </p>
                {retryCount > 0 && (
                  <div className="mt-2 w-8 h-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
                  </div>
                )}
              </div>
            )}
            
            {/* Permission State Indicator */}
            {permissionState !== 'granted' && (
              <div className="absolute top-2 right-2">
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  permissionState === 'denied' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-yellow-500 text-black'
                }`}>
                  {permissionState === 'denied' ? '🚫 Denied' : '❓ Permission needed'}
                </div>
              </div>
            )}
            
            {/* Camera Ready Indicator */}
            {cameraReady && isScanning && (
              <div className="absolute top-2 left-2">
                <div className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500 text-white">
                  📹 Live
                </div>
              </div>
            )}
            
            {/* Scanning overlay */}
            {isScanning && cameraReady && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-32 sm:w-48 h-32 sm:h-48 border-2 sm:border-4 border-emerald-400 rounded-xl sm:rounded-2xl animate-pulse opacity-70"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-emerald-300 font-semibold bg-black/50 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm">
                      📱 Scanning for QR codes...
                    </div>
                  </div>
                  
                  {/* Corner markers for better QR positioning */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-emerald-300"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-emerald-300"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-emerald-300"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-emerald-300"></div>
                </div>
              </div>
            )}
            
            {/* Camera Loading State */}
            {isScanning && !cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mb-4"></div>
                <p className="text-white text-sm font-medium">Starting camera...</p>
                {lastError && (
                  <p className="text-red-300 text-xs mt-2 text-center px-4">{lastError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={isScanning ? stopScanning : startScanning}
            disabled={permissionState === 'denied' || (cameraDevices.length === 0 && permissionState !== 'prompt')}
            className={`flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed ${
              isScanning 
                ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
            }`}
          >
            {isScanning ? (
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
                Stop Scanning
              </div>
            ) : (
              <div className="flex items-center justify-center">
                {retryCount > 0 ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Retrying...
                  </>
                ) : permissionState === 'denied' ? (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Permission Denied
                  </>
                ) : cameraDevices.length === 0 ? (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    No Cameras
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h6m2 5H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2z" />
                    </svg>
                    Start Scanning
                  </>
                )}
              </div>
            )}
          </button>
          
          <button
            onClick={clearData}
            className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-slate-600 to-gray-600 text-white font-semibold rounded-lg sm:rounded-xl hover:from-slate-700 hover:to-gray-700 transition-all duration-300 shadow-lg text-sm sm:text-base"
          >
            Clear Data
          </button>

          <div className="flex items-center justify-center sm:justify-start">
            <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-emerald-200">
              <input
                type="checkbox"
                id="autoSave"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 focus:ring-emerald-500 border-emerald-300 rounded"
              />
              <label htmlFor="autoSave" className="ml-2 sm:ml-3 block text-xs sm:text-sm font-medium text-gray-700">
                Auto-save when complete
              </label>
            </div>
          </div>
        </div>

        {/* File Name Input */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
            💾 File Name
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-emerald-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300 bg-white/90 backdrop-blur-sm shadow-sm text-sm sm:text-base"
            placeholder="Enter filename for download"
          />
        </div>

        {/* Progress Section */}
        <div className="mb-6 sm:mb-8 p-4 sm:p-8 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 rounded-xl sm:rounded-2xl border border-emerald-200/50">
          <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-800">📈 Transfer Progress</h3>
          
          {header && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700">
                    Expected: {header.length} chunks
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Size: ~{formatFileSize(header.length)}
                  </p>
                </div>
                <div className="w-10 sm:w-12 h-10 sm:h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 sm:w-6 h-5 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 sm:mb-6">
            <div className="flex justify-between text-sm sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
              <span>Received: {progress.receivedChunks} / {progress.totalChunks}</span>
              <span className="text-emerald-600">{progress.totalChunks > 0 ? Math.round((progress.receivedChunks / progress.totalChunks) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 sm:h-3 rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${progress.totalChunks > 0 ? (progress.receivedChunks / progress.totalChunks) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {progress.missingChunks.length > 0 && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-orange-50 rounded-lg sm:rounded-xl border border-orange-200">
              <p className="text-xs sm:text-sm font-semibold text-orange-700 mb-2 flex items-center">
                <svg className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Missing chunks: {progress.missingChunks.length}
              </p>
              <div className="text-xs text-orange-600 max-h-16 sm:max-h-20 overflow-y-auto bg-white rounded p-2">
                {progress.missingChunks.slice(0, 20).join(', ')}
                {progress.missingChunks.length > 20 && '...'}
              </div>
            </div>
          )}

          {progress.hash && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-purple-50 rounded-lg sm:rounded-xl border border-purple-200">
              <p className="text-xs sm:text-sm font-semibold text-purple-700 flex items-center">
                <svg className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Hash: {progress.isComplete ? '✓ Verified' : progress.hash.substring(0, 16) + '...'}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={manualDownload}
              disabled={chunks.length === 0}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-lg sm:rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center text-sm sm:text-base"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Download File
            </button>
            <button
              onClick={completeTransfer}
              disabled={chunks.length === 0 || !header}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg sm:rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center text-sm sm:text-base"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete Transfer
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="text-center">
          <div className={`inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-lg font-semibold ${getStatusColor()} ${
            status === TransferStatus.COMPLETED 
              ? 'bg-green-100' 
              : status === TransferStatus.ERROR 
              ? 'bg-red-100' 
              : status === TransferStatus.RECEIVING 
              ? 'bg-blue-100' 
              : 'bg-gray-100'
          }`}>
            <div className={`w-2 sm:w-3 h-2 sm:h-3 rounded-full mr-2 sm:mr-3 ${
              status === TransferStatus.COMPLETED 
                ? 'bg-green-500' 
                : status === TransferStatus.ERROR 
                ? 'bg-red-500' 
                : status === TransferStatus.RECEIVING 
                ? 'bg-blue-500 animate-pulse' 
                : 'bg-gray-500'
            }`}></div>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
          {errorMessage && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg sm:rounded-xl">
              <p className="text-red-600 font-medium flex items-center justify-center text-sm sm:text-base">
                <svg className="w-4 sm:w-5 h-4 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {errorMessage}
              </p>
              {(permissionState === 'denied' || errorMessage.includes('permission')) && (
                <div className="mt-3 text-xs text-red-500 text-center">
                  <p>To fix this:</p>
                  <p>1. Click the camera icon in your browser's address bar</p>
                  <p>2. Allow camera access for this site</p>
                  <p>3. Refresh the page</p>
                </div>
              )}
              {cameraDevices.length === 0 && !errorMessage.includes('permission') && (
                <div className="mt-3 text-xs text-red-500 text-center">
                  <p>Make sure your camera is connected and not being used by another app</p>
                  <button
                    onClick={() => getCameraDevices(true)}
                    className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Receiver;