import { useState, useEffect } from 'react'
import { Flame, X, CheckCircle, AlertTriangle, Clock, Camera, Zap, Brain, Eye } from 'lucide-react'
import type { FireDetectionData } from '../types/telemetry'
import { API_BASE_URL } from '../config/api.config'

const API_BASE = API_BASE_URL;

interface FireDetectionGalleryProps {
  maxItems?: number
}

export default function FireDetectionGallery({ maxItems = 20 }: FireDetectionGalleryProps) {
  const [detections, setDetections] = useState<FireDetectionData[]>([])
  const [selectedDetection, setSelectedDetection] = useState<FireDetectionData | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'verified' | 'rejected'>('all')
  const [loading, setLoading] = useState(true)

  // Fetch detections from API
  useEffect(() => {
    fetchDetections()
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchDetections, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchDetections = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/fire-detections?limit=${maxItems}`)
      const data = await response.json()
      
      if (data.success) {
        // Convert timestamp strings to Date objects
        const parsedDetections = data.detections.map((det: any) => ({
          ...det,
          timestamp: new Date(det.timestamp)
        }))
        setDetections(parsedDetections)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch fire detections:', error)
      setLoading(false)
    }
  }

  const updateDetectionStatus = async (id: string, status: 'resolved' | 'false_positive') => {
    try {
      const response = await fetch(`${API_BASE}/api/fire-detection/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setDetections(prev => prev.map(det => 
          det.id === id ? { ...det, status } : det
        ))
        setSelectedDetection(null)
      }
    } catch (error) {
      console.error('Failed to update detection status:', error)
    }
  }

  const deleteDetection = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/fire-detection/${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setDetections(prev => prev.filter(det => det.id !== id))
        setSelectedDetection(null)
      }
    } catch (error) {
      console.error('Failed to delete detection:', error)
    }
  }

  const filteredDetections = detections.filter(det => {
    if (filter === 'all') return true
    if (filter === 'active') return det.status === 'active'
    if (filter === 'verified') return det.geminiVerified
    if (filter === 'rejected') return det.status === 'false_positive'
    return true
  })

  const getStatusBadge = (det: FireDetectionData) => {
    if (det.status === 'resolved') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Resolved
        </span>
      )
    }
    if (det.status === 'false_positive') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 flex items-center gap-1">
          <X className="w-3 h-3" />
          False Alarm
        </span>
      )
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center gap-1 animate-pulse">
        <Flame className="w-3 h-3" />
        Active
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading fire detections...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Fire Detection Gallery
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {filteredDetections.length} detection{filteredDetections.length !== 1 ? 's' : ''} • Real-time AI verification
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {['all', 'active', 'verified', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredDetections.length === 0 && (
        <div className="text-center py-12">
          <Flame className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            No fire detections yet
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Detections will appear here when fire is detected by ESP32-CAM
          </p>
        </div>
      )}

      {/* Detection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredDetections.map((det) => (
          <div
            key={det.id}
            onClick={() => setSelectedDetection(det)}
            className="group relative bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02]"
          >
            {/* Snapshot Image */}
            <div className="aspect-video relative overflow-hidden bg-gray-900">
              {det.snapshotUrl ? (
                <img
                  src={`${API_BASE}${det.snapshotUrl}`}
                  alt="Fire detection"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-12 h-12 text-gray-400" />
                </div>
              )}
              
              {/* Status Badge Overlay */}
              <div className="absolute top-2 right-2">
                {getStatusBadge(det)}
              </div>

              {/* Confidence Badge */}
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                {(det.confidence * 100).toFixed(0)}%
              </div>

              {/* Gemini Badge */}
              {det.geminiVerified && det.geminiScore && (
                <div className="absolute bottom-2 right-2 bg-green-500/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  {(det.geminiScore * 100).toFixed(0)}%
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  {det.timestamp.toLocaleTimeString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {det.cameraIp}
                </div>
              </div>

              {det.geminiReason && (
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                  {det.geminiReason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedDetection && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDetection(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500" />
                  Fire Detection Details
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedDetection.timestamp.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetection(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Snapshot */}
              <div className="mb-6 rounded-lg overflow-hidden bg-gray-900">
                {selectedDetection.snapshotUrl ? (
                  <img
                    src={`${API_BASE}${selectedDetection.snapshotUrl}`}
                    alt="Fire detection"
                    className="w-full"
                  />
                ) : (
                  <div className="aspect-video flex items-center justify-center">
                    <Camera className="w-24 h-24 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-medium">YOLO Confidence</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(selectedDetection.confidence * 100).toFixed(1)}%
                  </p>
                </div>

                {selectedDetection.geminiVerified && selectedDetection.geminiScore && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                      <Brain className="w-4 h-4" />
                      <span className="text-xs font-medium">Gemini AI</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(selectedDetection.geminiScore * 100).toFixed(1)}%
                    </p>
                  </div>
                )}

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Camera className="w-4 h-4" />
                    <span className="text-xs font-medium">Camera</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedDetection.cameraIp}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-xs font-medium">Model</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedDetection.yoloModel}
                  </p>
                </div>
              </div>

              {/* Gemini Analysis */}
              {selectedDetection.geminiReason && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Gemini AI Analysis
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedDetection.geminiReason}
                  </p>
                </div>
              )}

              {/* Technical Details */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Technical Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Detection ID:</span>
                    <p className="font-mono text-xs text-gray-900 dark:text-white">{selectedDetection.id}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">{selectedDetection.status}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Bounding Box:</span>
                    <p className="font-mono text-xs text-gray-900 dark:text-white">
                      [{selectedDetection.bbox.x1}, {selectedDetection.bbox.y1}, {selectedDetection.bbox.x2}, {selectedDetection.bbox.y2}]
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Timestamp:</span>
                    <p className="font-mono text-xs text-gray-900 dark:text-white">
                      {selectedDetection.timestamp.toISOString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedDetection.status === 'active' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => updateDetectionStatus(selectedDetection.id, 'resolved')}
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Mark as Resolved
                  </button>
                  <button
                    onClick={() => updateDetectionStatus(selectedDetection.id, 'false_positive')}
                    className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    False Alarm
                  </button>
                </div>
              )}

              {selectedDetection.status !== 'active' && (
                <button
                  onClick={() => deleteDetection(selectedDetection.id)}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                  Delete Detection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
