import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Input } from './input';
import { Camera, CameraOff, X, CheckCircle, RotateCw, FlipHorizontal, Flashlight, FlashlightOff, Keyboard } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanningRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const manualInputRef = useRef<HTMLInputElement>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('Initializing camera...');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Play success sound
  const playSuccessSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (err) {
      // Sound not critical, fail silently
      console.debug('Could not play sound:', err);
    }
  }, []);

  // Vibrate on mobile devices
  const vibrate = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }, []);

  // Handle successful barcode scan
  const handleBarcodeFound = useCallback((barcode: string) => {
    // Prevent duplicate scans within 2 seconds
    if (lastScannedRef.current === barcode || isProcessingRef.current) {
      return;
    }

    lastScannedRef.current = barcode;
    isProcessingRef.current = true;
    setIsProcessing(true);
    setShowSuccess(true);
    setScanStatus(`✓ Scanned: ${barcode}`);
    
    // Play feedback
    playSuccessSound();
    vibrate();

    // Process after brief delay for visual feedback
    setTimeout(() => {
      onScan(barcode);
      isProcessingRef.current = false;
      setIsProcessing(false);
      setShowSuccess(false);
      onClose();
    }, 800);
  }, [onScan, onClose, playSuccessSound, vibrate]);

  useEffect(() => {
    if (isOpen) {
      lastScannedRef.current = null;
      isProcessingRef.current = false;
      setIsProcessing(false);
      setShowSuccess(false);
      setShowManualEntry(false);
      setManualBarcode('');
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  // Focus input when manual entry is shown
  useEffect(() => {
    if (showManualEntry && manualInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        manualInputRef.current?.focus();
        manualInputRef.current?.click();
      }, 100);
    }
  }, [showManualEntry]);

  const startScanning = async () => {
    setError(null);
    setIsScanning(true);
    setScanStatus('Requesting camera access...');
    scanningRef.current = true;

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isSecure) {
          setError('Camera access requires HTTPS. Please use a secure connection.');
          setHasPermission(false);
          setIsScanning(false);
          scanningRef.current = false;
          return;
        }
        setError('Camera API not supported in this browser. Please use a modern browser.');
        setHasPermission(false);
        setIsScanning(false);
        scanningRef.current = false;
        return;
      }

      // Detect if mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Try with preferred constraints first
      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: isMobile ? { ideal: facingMode } : 'user',
          width: { ideal: isMobile ? 720 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          aspectRatio: { ideal: 16/9 },
          ...(torchEnabled && { torch: true } as any)
        }
      };

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      // Try with preferred constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn('Failed with preferred constraints, trying fallback:', err);
        
        // Fallback 1: Try without aspect ratio constraint
        try {
          constraints = {
            video: {
              facingMode: isMobile ? { ideal: facingMode } : 'user',
              ...(torchEnabled && { torch: true } as any)
            }
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err2) {
          lastError = err2 instanceof Error ? err2 : new Error(String(err2));
          console.warn('Failed with aspect ratio fallback, trying basic constraints:', err2);
          
          // Fallback 2: Try with just facingMode
          try {
            constraints = {
              video: {
                facingMode: isMobile ? { ideal: facingMode } : 'user'
              }
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (err3) {
            lastError = err3 instanceof Error ? err3 : new Error(String(err3));
            console.warn('Failed with facingMode fallback, trying minimal constraints:', err3);
            
            // Fallback 3: Try with minimal constraints
            try {
              constraints = {
                video: true
              };
              stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err4) {
              lastError = err4 instanceof Error ? err4 : new Error(String(err4));
              throw lastError;
            }
          }
        }
      }

      if (!stream) {
        throw lastError || new Error('Failed to access camera');
      }

      streamRef.current = stream;
      setHasPermission(true);
      setScanStatus('Camera ready, looking for barcodes...');

      if (videoRef.current && scanningRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            const onReady = () => {
              if (videoRef.current) {
                videoRef.current.removeEventListener('loadedmetadata', onReady);
              }
              resolve(undefined);
            };
            videoRef.current.addEventListener('loadedmetadata', onReady);
            if (videoRef.current.readyState >= 2) {
              resolve(undefined);
            }
          }
        });

        // Initialize barcode reader
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
        }

        const reader = readerRef.current;
        let lastScanTime = 0;
        const scanInterval = isMobile ? 200 : 100; // Throttle scans for performance

        // Optimized scanning loop using requestAnimationFrame
        const scanFrame = async () => {
          if (!scanningRef.current || !videoRef.current || isProcessingRef.current) {
            if (scanningRef.current) {
              animationFrameRef.current = requestAnimationFrame(scanFrame);
            }
            return;
          }

          const now = Date.now();
          // Throttle scanning to avoid excessive CPU usage
          if (now - lastScanTime < scanInterval) {
            animationFrameRef.current = requestAnimationFrame(scanFrame);
            return;
          }
          lastScanTime = now;

          try {
            const video = videoRef.current;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              try {
                const result = await reader.decodeOnceFromVideoDevice(undefined, video);
                if (result && scanningRef.current && !isProcessingRef.current) {
                  const barcode = result.getText();
                  if (barcode && barcode.trim()) {
                    handleBarcodeFound(barcode);
                    return;
                  }
                }
              } catch (decodeError) {
                // NotFoundException is expected, continue scanning
                if (!(decodeError instanceof NotFoundException)) {
                  console.debug('Decode error:', decodeError);
                }
              }
            }
          } catch (error) {
            console.debug('Scan frame error:', error);
          }

          if (scanningRef.current) {
            animationFrameRef.current = requestAnimationFrame(scanFrame);
          }
        };

        // Start the scanning loop
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error('Error starting camera:', err);
      setHasPermission(false);
      scanningRef.current = false;
      
      if (err instanceof Error) {
        const errorName = err.name;
        const errorMessage = err.message.toLowerCase();
        
        if (errorName === 'NotAllowedError' || errorMessage.includes('permission denied') || errorMessage.includes('not allowed')) {
          setError('Camera permission denied. Please allow camera access in your browser settings and try again.');
        } else if (errorName === 'NotFoundError' || errorMessage.includes('no device') || errorMessage.includes('not found')) {
          setError('No camera found on this device. Please connect a camera and try again.');
        } else if (errorName === 'NotReadableError' || errorMessage.includes('not readable') || errorMessage.includes('could not start')) {
          setError('Camera is being used by another application. Please close other apps using the camera and try again.');
        } else if (errorName === 'OverconstrainedError' || errorMessage.includes('constraint')) {
          setError('Camera settings are not supported. Trying with basic settings...');
          // Retry with minimal constraints after a short delay
          setTimeout(() => {
            setError(null);
            setHasPermission(null);
            setScanStatus('Retrying with basic settings...');
            startScanning();
          }, 1000);
          return;
        } else if (errorName === 'TypeError' || errorMessage.includes('failed to execute')) {
          setError('Camera API error. Please ensure you are using HTTPS or localhost and try again.');
        } else if (errorMessage.includes('secure context') || errorMessage.includes('https')) {
          setError('Camera access requires a secure connection (HTTPS). Please use HTTPS or localhost.');
        } else {
          setError(`Failed to access camera: ${err.message || 'Unknown error'}. Please check your browser permissions and try again.`);
        }
      } else {
        setError('Unable to access camera. Please check your browser permissions and ensure you are using HTTPS or localhost.');
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    scanningRef.current = false;
    
    // Cancel animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    // Stop the reader
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (error) {
        console.warn('Error resetting reader:', error);
      }
    }

    // Stop the camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        // Turn off torch if enabled
        if ('applyConstraints' in track && torchEnabled) {
          (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setScanStatus('Camera stopped');
    setTorchEnabled(false);
  };

  const handleRetry = () => {
    setError(null);
    setHasPermission(null);
    setScanStatus('Initializing camera...');
    lastScannedRef.current = null;
    isProcessingRef.current = false;
    setIsProcessing(false);
    startScanning();
  };

  const handleFlipCamera = () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);
    stopScanning();
    setTimeout(() => {
      startScanning();
    }, 100);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const newTorchState = !torchEnabled;
      if ('applyConstraints' in videoTrack) {
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: newTorchState }]
        });
        setTorchEnabled(newTorchState);
      }
    } catch (err) {
      console.warn('Torch not supported:', err);
      setError('Flashlight not supported on this device');
    }
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      handleBarcodeFound(manualBarcode.trim());
    }
  };

  const checkTorchSupport = async () => {
    if (!streamRef.current) return false;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return false;
    
    try {
      const capabilities = (videoTrack.getCapabilities?.() || {}) as any;
      return capabilities.torch === true;
    } catch {
      return false;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4" 
      style={{ 
        pointerEvents: 'auto', 
        zIndex: 9999,
        position: 'fixed'
      }}
      onClick={(e) => {
        // Only close if clicking the backdrop, not the content
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card 
        className="w-full max-w-md mx-auto sm:max-w-lg md:max-w-xl" 
        style={{ 
          pointerEvents: 'auto',
          zIndex: 10000,
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent 
          className="p-4 sm:p-6" 
          style={{ 
            pointerEvents: 'auto',
            zIndex: 10001,
            position: 'relative'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Scan Barcode</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {hasPermission === false ? (
            <div className="text-center py-8">
              <CameraOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4 text-sm sm:text-base">
                {error || 'Camera access is required to scan barcodes'}
              </p>
              <Button onClick={handleRetry} className="w-full">
                <Camera className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {!showManualEntry ? (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Success overlay */}
                    {showSuccess && (
                      <div className="absolute inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center z-10 animate-pulse">
                        <div className="bg-white rounded-full p-4 shadow-2xl">
                          <CheckCircle className="w-12 h-12 text-green-500" />
                        </div>
                      </div>
                    )}
                    
                    {/* Scanning overlay - Responsive sizing */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`border-2 border-white border-dashed w-32 h-20 sm:w-48 sm:h-32 md:w-56 md:h-36 rounded-lg relative transition-all ${showSuccess ? 'border-green-500 scale-110' : ''}`}>
                        <div className="w-full h-full border-4 border-transparent">
                          <div className={`w-full h-1 ${showSuccess ? 'bg-green-500' : 'bg-red-500'} animate-pulse absolute top-1/2 left-0 transform -translate-y-1/2`}></div>
                        </div>
                        {/* Corner markers */}
                        <div className={`absolute top-0 left-0 w-3 h-3 sm:w-4 sm:h-4 border-l-2 border-t-2 ${showSuccess ? 'border-green-500' : 'border-white'}`}></div>
                        <div className={`absolute top-0 right-0 w-3 h-3 sm:w-4 sm:h-4 border-r-2 border-t-2 ${showSuccess ? 'border-green-500' : 'border-white'}`}></div>
                        <div className={`absolute bottom-0 left-0 w-3 h-3 sm:w-4 sm:h-4 border-l-2 border-b-2 ${showSuccess ? 'border-green-500' : 'border-white'}`}></div>
                        <div className={`absolute bottom-0 right-0 w-3 h-3 sm:w-4 sm:h-4 border-r-2 border-b-2 ${showSuccess ? 'border-green-500' : 'border-white'}`}></div>
                      </div>
                    </div>

                    {/* Status overlay */}
                    <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4">
                      <div className={`bg-black bg-opacity-70 text-white text-xs p-2 rounded text-center ${showSuccess ? 'bg-green-600' : ''}`}>
                        {scanStatus}
                      </div>
                    </div>

                    {/* Instructions overlay */}
                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4">
                      <div className="bg-black bg-opacity-70 text-white text-xs sm:text-sm p-2 sm:p-3 rounded-lg text-center">
                        Hold steady and point camera at barcode
                      </div>
                    </div>

                    {/* Control buttons */}
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex gap-2">
                      {/* Torch button */}
                      {streamRef.current && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={toggleTorch}
                          className="h-9 w-9 p-0 bg-black bg-opacity-70 border-white border hover:bg-opacity-90 rounded-full shadow-lg"
                          title={torchEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
                        >
                          {torchEnabled ? (
                            <Flashlight className="w-5 h-5 text-yellow-300" />
                          ) : (
                            <FlashlightOff className="w-5 h-5 text-white" />
                          )}
                        </Button>
                      )}
                      {/* Camera flip button */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleFlipCamera}
                        className="h-9 w-9 p-0 bg-black bg-opacity-70 border-white border hover:bg-opacity-90 rounded-full shadow-lg"
                        title={facingMode === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
                      >
                        <FlipHorizontal className="w-5 h-5 text-white" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div 
                  className="space-y-4" 
                  style={{ 
                    pointerEvents: 'auto', 
                    position: 'relative', 
                    zIndex: 10002
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="text-center py-4">
                    <Keyboard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2">Manual Barcode Entry</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Enter the barcode manually if camera scanning is not working
                    </p>
                  </div>
                  <div 
                    style={{ 
                      position: 'relative', 
                      zIndex: 10003,
                      pointerEvents: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Input
                      ref={manualInputRef}
                      type="text"
                      placeholder="Enter barcode..."
                      value={manualBarcode}
                      onChange={(e) => {
                        e.stopPropagation();
                        setManualBarcode(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter' && manualBarcode.trim() && !isProcessing) {
                          e.preventDefault();
                          handleManualSubmit();
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.currentTarget.focus();
                        e.currentTarget.select();
                      }}
                      onFocus={(e) => {
                        e.stopPropagation();
                        e.currentTarget.select();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.focus();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        e.currentTarget.focus();
                      }}
                      className="text-center text-lg w-full"
                      autoFocus
                      style={{ 
                        pointerEvents: 'auto', 
                        zIndex: 10003,
                        position: 'relative',
                        cursor: 'text'
                      }}
                    />
                  </div>
                  <div className="flex gap-2" style={{ pointerEvents: 'auto' }}>
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowManualEntry(false);
                        setManualBarcode('');
                      }}
                      className="flex-1"
                      type="button"
                    >
                      Back to Camera
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (manualBarcode.trim() && !isProcessing) {
                          handleManualSubmit();
                        }
                      }}
                      disabled={!manualBarcode.trim() || isProcessing}
                      className="flex-1"
                      type="button"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Submit
                    </Button>
                  </div>
                </div>
              )}

              {error && !showManualEntry && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              {!showManualEntry && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowManualEntry(true)}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    <Keyboard className="w-4 h-4 mr-2" />
                    Manual Entry
                  </Button>
                  <Button variant="outline" onClick={onClose} className="flex-1" disabled={isProcessing}>
                    Cancel
                  </Button>
                  {error && (
                    <Button onClick={handleRetry} className="flex-1" disabled={isProcessing}>
                      <RotateCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}