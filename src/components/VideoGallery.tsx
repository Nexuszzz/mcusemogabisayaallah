import { useState, useEffect } from 'react';
import {
  Video,
  Download,
  Trash2,
  Play,
  Square,
  Clock,
  HardDrive,
  Calendar,
  Camera,
  AlertCircle,
  CheckCircle,
  Loader2,
  Film,
  Upload
} from 'lucide-react';

interface Recording {
  id: string;
  cameraIp: string;
  filename: string;
  size: number;
  startTime: number;
  endTime: number;
  duration: number;
  path: string;
  status: 'completed' | 'uploaded' | 'recording';
}

interface ActiveRecording {
  id: string;
  cameraIp: string;
  startTime: number;
  duration: number | null;
  status: 'recording';
}

import { VIDEO_API_URL, API_BASE_URL } from '../config/api.config';
const API_BASE = VIDEO_API_URL;

export default function VideoGallery() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeRecordings, setActiveRecordings] = useState<ActiveRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Recording | null>(null);

  // Recording controls
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [cameraIp, setCameraIp] = useState(
    localStorage.getItem('esp32cam_ip') || '10.148.218.219'
  );
  const [recordDuration, setRecordDuration] = useState(60); // seconds

  // Fetch recordings
  useEffect(() => {
    fetchRecordings();
    const interval = setInterval(fetchRecordings, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function fetchRecordings() {
    try {
      const res = await fetch(`${API_BASE}/recordings`);
      const data = await res.json();

      if (data.success) {
        setRecordings(data.recordings || []);
        setActiveRecordings(data.activeRecordings || []);
        
        // Check if our recording is still active
        const ourRecording = data.activeRecordings?.find((r: ActiveRecording) => r.id === recordingId);
        if (!ourRecording && isRecording) {
          setIsRecording(false);
          setRecordingId(null);
        }
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch recordings:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  async function startRecording() {
    if (!cameraIp) {
      setError('Camera IP required');
      return;
    }

    setError(null);
    setIsRecording(true);

    try {
      const res = await fetch(`${API_BASE}/start-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraIp,
          duration: recordDuration > 0 ? recordDuration : null,
          quality: 'medium'
        })
      });

      const data = await res.json();

      if (data.success) {
        setRecordingId(data.recordingId);
        console.log('✅ Recording started:', data.recordingId);
        
        // Auto-stop after duration
        if (recordDuration > 0) {
          setTimeout(() => {
            stopRecording(data.recordingId);
          }, recordDuration * 1000);
        }
      } else {
        setError(data.error || 'Failed to start recording');
        setIsRecording(false);
      }
    } catch (err: any) {
      console.error('Start recording error:', err);
      setError(err.message);
      setIsRecording(false);
    }
  }

  async function stopRecording(id?: string) {
    const targetId = id || recordingId;
    if (!targetId) return;

    try {
      const res = await fetch(`${API_BASE}/stop-recording/${targetId}`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        console.log('⏹️ Recording stopped:', targetId);
        setIsRecording(false);
        setRecordingId(null);
        setTimeout(fetchRecordings, 2000); // Refresh after 2s
      }
    } catch (err: any) {
      console.error('Stop recording error:', err);
      setError(err.message);
    }
  }

  async function deleteVideo(id: string) {
    if (!confirm('Delete this video recording?')) return;

    try {
      const res = await fetch(`${API_BASE}/recordings/${id}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        setRecordings(prev => prev.filter(r => r.id !== id));
        if (selectedVideo?.id === id) {
          setSelectedVideo(null);
        }
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message);
    }
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  function formatFileSize(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    if (mb >= 1000) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Video Recordings
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ESP32-CAM MJPEG Stream Recordings
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {recordings.length}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Videos</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatFileSize(recordings.reduce((sum, r) => sum + r.size, 0))}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Size</p>
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700/30 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Film className="w-5 h-5" />
            Recording Controls
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Camera IP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ESP32-CAM IP
              </label>
              <input
                type="text"
                value={cameraIp}
                onChange={(e) => {
                  setCameraIp(e.target.value);
                  localStorage.setItem('esp32cam_ip', e.target.value);
                }}
                disabled={isRecording}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono disabled:opacity-50"
                placeholder="10.148.218.219"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={recordDuration}
                onChange={(e) => setRecordDuration(parseInt(e.target.value) || 60)}
                disabled={isRecording}
                min="10"
                max="3600"
                step="10"
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                10s - 1 hour (0 = unlimited)
              </p>
            </div>

            {/* Start/Stop Button */}
            <div className="flex items-end">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={() => stopRecording()}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 animate-pulse"
                >
                  <Square className="w-4 h-4" />
                  Stop Recording
                </button>
              )}
            </div>
          </div>

          {/* Active Recordings */}
          {activeRecordings.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                🔴 Active Recordings ({activeRecordings.length})
              </p>
              {activeRecordings.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between text-xs text-red-600 dark:text-red-400">
                  <span>{rec.cameraIp}</span>
                  <span>{Math.floor((Date.now() - rec.startTime) / 1000)}s</span>
                </div>
              ))}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Error</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => setSelectedVideo(recording)}
          >
            {/* Video Thumbnail */}
            <div className="aspect-video bg-gray-900 relative group">
              <video
                src={`${API_BASE_URL}${recording.path}`}
                className="w-full h-full object-cover"
                preload="metadata"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-16 h-16 text-white" />
              </div>

              {/* Status Badge */}
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-bold flex items-center gap-1">
                {recording.status === 'completed' ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <Upload className="w-3 h-3 text-blue-400" />
                )}
                {recording.status}
              </div>
            </div>

            {/* Video Info */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Camera className="w-4 h-4" />
                  {recording.cameraIp}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatDuration(recording.duration)}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(recording.startTime).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatFileSize(recording.size)}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`${API_BASE_URL}${recording.path}`, '_blank');
                  }}
                  className="flex-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteVideo(recording.id);
                  }}
                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {recordings.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
          <Video className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            No recordings yet
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Click "Start Recording" to save ESP32-CAM video
          </p>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Video Playback
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(selectedVideo.startTime).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="text-2xl text-gray-600 dark:text-gray-400">×</span>
              </button>
            </div>

            {/* Video Player */}
            <div className="p-6">
              <video
                src={`${API_BASE_URL}${selectedVideo.path}`}
                controls
                autoPlay
                className="w-full rounded-lg bg-black"
              />

              {/* Video Details */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Camera</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedVideo.cameraIp}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Duration</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatDuration(selectedVideo.duration)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">File Size</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatFileSize(selectedVideo.size)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Filename</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono truncate">
                    {selectedVideo.filename}
                  </p>
                </div>
              </div>

              {/* Download Button */}
              <div className="mt-4">
                <a
                  href={`${API_BASE_URL}${selectedVideo.path}`}
                  download
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
