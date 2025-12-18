import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Play, Square, RefreshCw, Settings, Wifi, WifiOff, Flame, AlertTriangle } from 'lucide-react';

export default function LiveStream() {
  // Stream state
  const [streamUrl, setStreamUrl] = useState('');
  const [cfUrl, setCfUrl] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  
  // Fire detection state
  const [fireDetectRunning, setFireDetectRunning] = useState(false);
  const [fireDetectLoading, setFireDetectLoading] = useState(false);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(500);
  
  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Cloudflare URL from backend
  const fetchCfUrl = useCallback(async () => {
    try {
      const res = await fetch('/api/cf-url');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.url) {
        setCfUrl(data.url);
        setStreamUrl(`${data.url}/capture`);
        return data.url;
      }
    } catch (err) {
      console.error('Failed to fetch CF URL:', err);
    }
    return null;
  }, []);

  // Check fire detection status
  const checkFireDetectStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/fire-detect/status');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setFireDetectRunning(data.running === true);
    } catch (err) {
      console.error('Failed to check fire detect status:', err);
    }
  }, []);

  // Start/Stop fire detection
  const toggleFireDetect = async (action: 'start' | 'stop') => {
    setFireDetectLoading(true);
    try {
      const res = await fetch(`/api/fire-detect/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success || data.ok) {
        setFireDetectRunning(action === 'start');
      } else {
        alert(`Failed to ${action}: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
    setFireDetectLoading(false);
  };

  // Load frame
  const loadFrame = useCallback(() => {
    if (!streamUrl || !imgRef.current) return;
    
    const img = new Image();
    const timestamp = Date.now();
    
    img.onload = () => {
      if (imgRef.current) {
        imgRef.current.src = img.src;
        setIsStreaming(true);
        setStreamError('');
        setLastUpdate(new Date());
        setFrameCount(prev => prev + 1);
      }
    };
    
    img.onerror = () => {
      setStreamError('Failed to load frame');
      setIsStreaming(false);
    };
    
    img.src = `${streamUrl}?t=${timestamp}`;
  }, [streamUrl]);

  // Start streaming
  const startStream = useCallback(() => {
    if (!streamUrl) {
      setStreamError('No stream URL configured');
      return;
    }
    
    // Load first frame immediately
    loadFrame();
    
    // Set up interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(loadFrame, refreshInterval);
    setIsStreaming(true);
  }, [streamUrl, refreshInterval, loadFrame]);

  // Stop streaming
  const stopStream = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Save custom URL
  const saveCustomUrl = async () => {
    const urlToSave = customUrl || cfUrl;
    if (!urlToSave) return;
    
    try {
      const res = await fetch('/api/cf-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToSave })
      });
      const data = await res.json();
      if (data.ok) {
        setCfUrl(urlToSave);
        setStreamUrl(`${urlToSave}/capture`);
        alert('URL saved successfully!');
        setShowSettings(false);
      }
    } catch (err) {
      alert(`Error saving URL: ${err}`);
    }
  };

  // Initialize
  useEffect(() => {
    fetchCfUrl();
    checkFireDetectStatus();
    
    // Poll status every 10 seconds
    const statusInterval = setInterval(checkFireDetectStatus, 10000);
    
    return () => {
      clearInterval(statusInterval);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchCfUrl, checkFireDetectStatus]);

  // Auto-start when URL is available
  useEffect(() => {
    if (streamUrl && !intervalRef.current) {
      startStream();
    }
  }, [streamUrl, startStream]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Camera className="w-8 h-8 text-blue-500" />
            Live Stream
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ESP32-CAM via Cloudflare Tunnel
          </p>
        </div>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">⚙️ Stream Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Cloudflare Tunnel URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customUrl || cfUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://xxx.trycloudflare.com"
                  className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                />
                <button
                  onClick={saveCustomUrl}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Run: cloudflared tunnel --url http://ESP32_IP:80
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Refresh Interval: {refreshInterval}ms
              </label>
              <input
                type="range"
                min="200"
                max="2000"
                step="100"
                value={refreshInterval}
                onChange={(e) => {
                  setRefreshInterval(Number(e.target.value));
                  if (isStreaming) {
                    stopStream();
                    setTimeout(startStream, 100);
                  }
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Fast (200ms)</span>
                <span>Slow (2000ms)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Stream */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            {/* Stream Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isStreaming && !streamError ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className={`font-medium ${isStreaming && !streamError ? 'text-green-600' : 'text-red-600'}`}>
                  {isStreaming && !streamError ? '🔴 LIVE' : 'OFFLINE'}
                </span>
                {frameCount > 0 && (
                  <span className="text-xs text-gray-500 ml-2">
                    {frameCount} frames
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                {!isStreaming ? (
                  <button
                    onClick={startStream}
                    disabled={!streamUrl}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Start
                  </button>
                ) : (
                  <button
                    onClick={stopStream}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                )}
                <button
                  onClick={() => { stopStream(); setTimeout(startStream, 200); }}
                  disabled={!streamUrl}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Stream Display */}
            <div className="relative bg-gray-900 aspect-video flex items-center justify-center min-h-[300px]">
              {streamUrl ? (
                <>
                  <img
                    ref={imgRef}
                    alt="ESP32-CAM Stream"
                    className="max-w-full max-h-full object-contain"
                  />
                  {streamError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/70">
                      <AlertTriangle className="w-12 h-12 text-yellow-500 mb-2" />
                      <p>{streamError}</p>
                      <button
                        onClick={startStream}
                        className="mt-4 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-white text-center p-8">
                  <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No Stream URL Configured</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Configure Cloudflare Tunnel URL in Settings
                  </p>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Open Settings
                  </button>
                </div>
              )}
            </div>
            
            {/* Stream Info */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900 text-sm border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Stream URL:</span>
                  <p className="font-mono text-xs truncate text-gray-700 dark:text-gray-300">
                    {streamUrl || 'Not configured'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Last Frame:</span>
                  <p className="text-gray-700 dark:text-gray-300">
                    {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fire Detection Control */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-red-500">
              <h3 className="font-semibold flex items-center gap-2 text-white">
                <Flame className="w-5 h-5" />
                Fire Detection (VPS)
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">Status:</span>
                <span className={`font-bold text-lg ${fireDetectRunning ? 'text-green-600' : 'text-gray-500'}`}>
                  {fireDetectRunning ? '🟢 RUNNING' : '⚫ STOPPED'}
                </span>
              </div>
              
              {/* Controls */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => toggleFireDetect('start')}
                  disabled={fireDetectLoading || fireDetectRunning}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {fireDetectLoading ? '⏳' : '▶️'} Start
                </button>
                <button
                  onClick={() => toggleFireDetect('stop')}
                  disabled={fireDetectLoading || !fireDetectRunning}
                  className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {fireDetectLoading ? '⏳' : '⏹️'} Stop
                </button>
              </div>
              
              {/* Refresh Status */}
              <button
                onClick={checkFireDetectStatus}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                ↻ Refresh Status
              </button>
            </div>
          </div>
          
          {/* Info Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">📋 How it works:</h4>
            <ol className="text-sm text-blue-600 dark:text-blue-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="bg-blue-200 dark:bg-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                <span>ESP32-CAM streams on local network</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-200 dark:bg-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                <span>Cloudflare tunnel exposes to internet</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-200 dark:bg-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                <span>VPS fetches frames via tunnel</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-200 dark:bg-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">4</span>
                <span>YOLO AI detects fire (83%+ confidence)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-200 dark:bg-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">5</span>
                <span>WhatsApp alert if fire detected</span>
              </li>
            </ol>
          </div>
          
          {/* Current Config */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-sm">
            <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Current Config:</h4>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-gray-600 dark:text-gray-400 truncate">
                CF: {cfUrl || 'Not set'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
