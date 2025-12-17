// Temporary fix - simple ESP32CamStream without MQTT integration
import { useState, useRef } from 'react';

export default function ESP32CamStream() {
  const [streamUrl, setStreamUrl] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamRef = useRef<HTMLImageElement>(null);

  const startStream = () => {
    if (!streamUrl.trim()) {
      setStreamError('Please enter ESP32-CAM IP or URL');
      return;
    }

    let url = streamUrl.trim();
    // Auto-format IP to stream URL
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(url)) {
      url = `http://${url}:81/stream`;
    }

    setStreamError(null);
    setIsStreaming(true);
    
    if (streamRef.current) {
      streamRef.current.src = url;
    }
  };

  const stopStream = () => {
    setIsStreaming(false);
    if (streamRef.current) {
      streamRef.current.src = '';
    }
  };

  const handleError = () => {
    setStreamError('Failed to load stream. Check ESP32-CAM connection.');
    setIsStreaming(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📹 ESP32-CAM Live Stream
        </h3>

        {/* URL Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ESP32-CAM IP Address:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="e.g., 10.148.218.219"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={isStreaming ? stopStream : startStream}
              className={`px-4 py-2 rounded-lg font-medium ${
                isStreaming
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isStreaming ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {streamError && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-red-700 dark:text-red-300 text-sm">{streamError}</p>
          </div>
        )}

        {/* Stream Display */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          {isStreaming ? (
            <img
              ref={streamRef}
              alt="ESP32-CAM Stream"
              onError={handleError}
              onLoad={() => setStreamError(null)}
              className="w-full h-auto max-h-96 object-contain"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📹</div>
                <p>Enter ESP32-CAM IP and click Start to view stream</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>💡 <strong>Tips:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Just enter IP address (e.g., 10.148.218.219)</li>
            <li>Make sure ESP32-CAM is connected to same network</li>
            <li>Stream URL will be auto-formatted to http://IP:81/stream</li>
          </ul>
        </div>
      </div>
    </div>
  );
}