import express from 'express'
import { WebSocketServer } from 'ws'
import mqtt from 'mqtt'
import cors from 'cors'
import { config } from 'dotenv'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import video routes (ES module)
import videoRoutes from './routes/video.js'

// Import auth routes (ES module)
import authRoutes from './routes/auth.js'

// Load environment variables
config()

const PORT = process.env.PORT || 8080
const MQTT_HOST = process.env.MQTT_HOST || 'localhost'
const MQTT_PORT = process.env.MQTT_PORT || 1883
const MQTT_USERNAME = process.env.MQTT_USERNAME || ''
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || ''
const TOPIC_EVENT = process.env.TOPIC_EVENT || 'lab/zaks/event'
const TOPIC_LOG = process.env.TOPIC_LOG || 'lab/zaks/log'
const TOPIC_STATUS = process.env.TOPIC_STATUS || 'lab/zaks/status'
const TOPIC_ALERT = process.env.TOPIC_ALERT || 'lab/zaks/alert'
const TOPIC_STREAM = process.env.TOPIC_STREAM || 'lab/zaks/stream'
const TOPIC_ESP32CAM_IP = process.env.TOPIC_ESP32CAM_IP || 'lab/zaks/esp32cam/ip'
const TOPIC_ALL = 'lab/zaks/#'

// Create Express app
const app = express()

// COMPREHENSIVE CORS CONFIGURATION for Vercel compatibility
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'https://rtsp-main.vercel.app',
    'https://rtsp-main-krj3w64cm-nexuszzzs-projects.vercel.app',
    /.*\.vercel\.app$/,  // Allow all Vercel domains
    'http://3.27.0.139:3000',
    'http://3.27.0.139:5173',
    'http://3.27.0.139:8080',
    'http://3.27.0.139',
    'https://latom.flx.web.id',
    'https://api.latom.flx.web.id',
    /.*\.flx\.web\.id$/  // Allow all flx.web.id subdomains
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))

// Additional CORS headers for preflight
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (corsOptions.origin.some(o => 
    (typeof o === 'string' && o === origin) || 
    (o instanceof RegExp && o.test(origin))
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

app.use(express.json())

// Create uploads directory for fire detection snapshots
const uploadsDir = path.join(__dirname, 'uploads', 'fire-detections')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  console.log(`📁 Created uploads directory: ${uploadsDir}`)
}

// Serve static files from uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Serve static files from recordings (for video playback)
const recordingsDir = path.join(__dirname, 'recordings')
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true })
  console.log(`📁 Created recordings directory: ${recordingsDir}`)
}
app.use('/recordings', express.static(recordingsDir))

// Mount video routes
app.use('/api/video', videoRoutes)

// Mount auth routes
app.use('/api/auth', authRoutes)

// ================================================================================
// PROXY ROUTES FOR WHATSAPP AND VOICE CALL SERVERS
// These routes forward requests to separate WhatsApp and Voice Call services
// ================================================================================

const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL || 'http://localhost:3001'
const VOICE_CALL_SERVER_URL = process.env.VOICE_CALL_SERVER_URL || 'http://localhost:3002'

// Helper function to proxy requests
async function proxyRequest(targetUrl, req, res) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    }
    
    const fetchOptions = {
      method: req.method,
      headers,
    }
    
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body)
    }
    
    const response = await fetch(targetUrl, fetchOptions)
    const data = await response.json()
    
    res.status(response.status).json(data)
  } catch (error) {
    console.error(`Proxy error to ${targetUrl}:`, error.message)
    res.status(503).json({
      success: false,
      error: `Service unavailable: ${error.message}`,
      target: targetUrl
    })
  }
}

// WhatsApp API Proxy Routes
app.all('/api/whatsapp/*', async (req, res) => {
  const path = req.path.replace('/api/whatsapp', '')
  const targetUrl = `${WHATSAPP_SERVER_URL}/api/whatsapp${path}`
  console.log(`📱 Proxying WhatsApp request: ${req.method} ${targetUrl}`)
  await proxyRequest(targetUrl, req, res)
})

// Voice Call API Proxy Routes
app.all('/api/voice-call/*', async (req, res) => {
  const path = req.path.replace('/api/voice-call', '')
  const targetUrl = `${VOICE_CALL_SERVER_URL}/api/voice-call${path}`
  console.log(`📞 Proxying Voice Call request: ${req.method} ${targetUrl}`)
  await proxyRequest(targetUrl, req, res)
})

// Direct status endpoints for backwards compatibility
app.get('/api/whatsapp/status', async (req, res) => {
  const targetUrl = `${WHATSAPP_SERVER_URL}/api/whatsapp/status`
  console.log(`📱 Proxying WhatsApp status request: ${targetUrl}`)
  await proxyRequest(targetUrl, req, res)
})

app.get('/api/voice-call/config', async (req, res) => {
  const targetUrl = `${VOICE_CALL_SERVER_URL}/api/voice-call/config`
  console.log(`📞 Proxying Voice Call config request: ${targetUrl}`)
  await proxyRequest(targetUrl, req, res)
})

// ================================================================================

// Serve static files from public folder (for login page)
const publicDir = path.join(__dirname, 'public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}
app.use(express.static(publicDir))

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    cb(null, `fire_${timestamp}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG allowed.'))
    }
  }
})

// In-memory storage for fire detection logs (max 100 recent detections)
const fireDetectionLogs = []
const MAX_FIRE_LOGS = 100

// ESP32-CAM livestream data
const esp32Streams = new Map() // cameraId -> { ip, streamUrl, lastSeen, status }
const streamClients = new Set() // WebSocket clients for stream
let currentStreamFrame = null // Current frame buffer for MJPEG stream

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
    clients: wsClients.size,
    fireDetections: fireDetectionLogs.length,
  })
})

// API Status endpoint (used by frontend)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
    clients: wsClients.size,
    fireDetections: fireDetectionLogs.length,
    esp32Cameras: esp32Streams.size,
    streamClients: streamClients.size,
    timestamp: new Date().toISOString(),
    server: 'EC2 Fire Detection API',
    version: '1.0.0'
  })
})

// ESP32-CAM stream endpoints
app.get('/api/stream/cameras', (req, res) => {
  const cameras = Array.from(esp32Streams.entries()).map(([id, data]) => ({
    id,
    ip: data.ip,
    streamUrl: data.streamUrl,
    status: data.status,
    lastSeen: data.lastSeen
  }))
  
  res.json({
    success: true,
    cameras: cameras,
    count: cameras.length
  })
})

// Proxy ESP32-CAM stream
app.get('/api/stream/:cameraId', async (req, res) => {
  const { cameraId } = req.params
  const camera = esp32Streams.get(cameraId)
  
  if (!camera) {
    return res.status(404).json({
      success: false,
      error: 'Camera not found'
    })
  }
  
  try {
    // Proxy MJPEG stream from ESP32-CAM
    const response = await fetch(camera.streamUrl)
    
    if (!response.ok) {
      throw new Error(`Stream unavailable: ${response.status}`)
    }
    
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    
    response.body.pipe(res)
    
  } catch (error) {
    console.error(`Stream proxy error for ${cameraId}:`, error.message)
    res.status(503).json({
      success: false,
      error: 'Stream unavailable',
      cameraId
    })
  }
})

// Fire Detection API - POST new detection with snapshot
app.post('/api/fire-detection', upload.single('snapshot'), (req, res) => {
  try {
    const {
      confidence,
      bbox,
      geminiScore,
      geminiReason,
      geminiVerified,
      cameraIp,
      cameraId,
      yoloModel,
    } = req.body

    // Validate required fields
    if (!confidence || !bbox || !cameraIp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: confidence, bbox, cameraIp'
      })
    }

    // Parse bbox (should be JSON string "[x1, y1, x2, y2]")
    let parsedBbox
    try {
      parsedBbox = typeof bbox === 'string' ? JSON.parse(bbox) : bbox
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bbox format. Expected array [x1, y1, x2, y2]'
      })
    }

    // Create detection log entry
    const detectionLog = {
      id: `fire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      confidence: parseFloat(confidence),
      bbox: {
        x1: parsedBbox[0],
        y1: parsedBbox[1],
        x2: parsedBbox[2],
        y2: parsedBbox[3],
        width: parsedBbox[2] - parsedBbox[0],
        height: parsedBbox[3] - parsedBbox[1],
      },
      geminiScore: geminiScore ? parseFloat(geminiScore) : null,
      geminiReason: geminiReason || null,
      geminiVerified: geminiVerified === 'true' || geminiVerified === true,
      snapshotUrl: req.file ? `/uploads/fire-detections/${req.file.filename}` : null,
      cameraId: cameraId || 'esp32cam_unknown',
      cameraIp: cameraIp,
      yoloModel: yoloModel || 'yolov8n',
      status: 'active',
    }

    // Add to logs (sliding window)
    fireDetectionLogs.unshift(detectionLog)
    if (fireDetectionLogs.length > MAX_FIRE_LOGS) {
      // Remove oldest detection and its snapshot file
      const removed = fireDetectionLogs.pop()
      if (removed.snapshotUrl) {
        const filePath = path.join(__dirname, removed.snapshotUrl)
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Failed to delete old snapshot: ${filePath}`)
        })
      }
    }

    console.log(`🔥 Fire detection logged: ${detectionLog.id}`)
    console.log(`   Confidence: ${detectionLog.confidence}`)
    console.log(`   Gemini: ${detectionLog.geminiVerified ? detectionLog.geminiScore : 'N/A'}`)
    console.log(`   Snapshot: ${detectionLog.snapshotUrl || 'N/A'}`)
    console.log(`   Camera: ${detectionLog.cameraIp}`)

    // Broadcast to WebSocket clients
    const wsMessage = {
      type: 'fire-detection',
      data: detectionLog,
      timestamp: new Date().toISOString(),
    }

    wsClients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(wsMessage))
      }
    })

    // Publish to MQTT for WhatsApp notification
    if (mqttClient?.connected) {
      const mqttPayload = {
        type: 'fire_detection_photo',
        detection: {
          id: detectionLog.id,
          timestamp: detectionLog.timestamp,
          confidence: detectionLog.confidence,
          bbox: detectionLog.bbox,
          geminiScore: detectionLog.geminiScore,
          geminiReason: detectionLog.geminiReason,
          geminiVerified: detectionLog.geminiVerified,
          cameraId: detectionLog.cameraId,
          cameraIp: detectionLog.cameraIp,
          yoloModel: detectionLog.yoloModel,
          status: detectionLog.status,
        },
        snapshot: {
          url: detectionLog.snapshotUrl,
          // Full path for WhatsApp server to read
          fullPath: req.file ? path.join(uploadsDir, req.file.filename) : null,
          filename: req.file ? req.file.filename : null,
        }
      }

      mqttClient.publish(
        'lab/zaks/fire_photo',
        JSON.stringify(mqttPayload),
        { qos: 1, retain: false },
        (err) => {
          if (err) {
            console.error('❌ Failed to publish fire photo to MQTT:', err)
          } else {
            console.log('✅ Fire photo published to MQTT topic: lab/zaks/fire_photo')
          }
        }
      )
    }

    res.json({
      success: true,
      detection: detectionLog,
      message: 'Fire detection logged successfully'
    })
  } catch (error) {
    console.error('❌ Error processing fire detection:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get all fire detection logs
app.get('/api/fire-detections', (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const status = req.query.status // 'active', 'resolved', 'false_positive'
  
  let logs = fireDetectionLogs
  
  if (status) {
    logs = logs.filter(log => log.status === status)
  }
  
  res.json({
    success: true,
    count: logs.length,
    detections: logs.slice(0, limit)
  })
})

// Update detection status
app.patch('/api/fire-detection/:id', (req, res) => {
  const { id } = req.params
  const { status } = req.body

  if (!['active', 'resolved', 'false_positive'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid status. Must be: active, resolved, or false_positive'
    })
  }

  const detection = fireDetectionLogs.find(log => log.id === id)
  
  if (!detection) {
    return res.status(404).json({
      success: false,
      error: 'Detection not found'
    })
  }

  detection.status = status
  detection.updatedAt = new Date().toISOString()

  console.log(`✅ Updated detection ${id} status to: ${status}`)

  // Broadcast update
  const wsMessage = {
    type: 'fire-detection-update',
    data: detection,
    timestamp: new Date().toISOString(),
  }

  wsClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(wsMessage))
    }
  })

  res.json({
    success: true,
    detection
  })
})

// Delete detection
app.delete('/api/fire-detection/:id', (req, res) => {
  const { id } = req.params
  const index = fireDetectionLogs.findIndex(log => log.id === id)
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Detection not found'
    })
  }

  const [removed] = fireDetectionLogs.splice(index, 1)
  
  // Delete snapshot file
  if (removed.snapshotUrl) {
    const filePath = path.join(__dirname, removed.snapshotUrl)
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Failed to delete snapshot: ${filePath}`)
    })
  }

  console.log(`🗑️  Deleted detection: ${id}`)

  res.json({
    success: true,
    message: 'Detection deleted successfully'
  })
})

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`)
  console.log(`📡 MQTT broker: ${MQTT_HOST}:${MQTT_PORT}`)
})

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' })
const wsClients = new Set()

// Connect to MQTT broker (TCP)
const mqttClient = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  keepalive: 30,
  reconnectPeriod: 2000,
})

mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT broker')
  
  // Subscribe to all lab/zaks topics using wildcard
  mqttClient.subscribe(TOPIC_ALL, (err) => {
    if (err) {
      console.error('❌ Subscription error:', err)
    } else {
      console.log(`📥 Subscribed to: ${TOPIC_ALL}`)
      console.log(`   Topics: event, log, status, alert`)
    }
  })
})

mqttClient.on('error', (error) => {
  console.error('❌ MQTT error:', error)
})

mqttClient.on('reconnect', () => {
  console.log('🔄 MQTT reconnecting...')
})

// Relay MQTT messages to all WebSocket clients
mqttClient.on('message', (topic, payload) => {
  const payloadString = payload.toString()
  const message = {
    topic,
    payload: payloadString,
    timestamp: new Date().toISOString(),
  }

  console.log(`📨 Received from MQTT: ${topic}`)
  
  // Handle ESP32-CAM IP announcements
  if (topic === TOPIC_ESP32CAM_IP) {
    try {
      const data = JSON.parse(payloadString)
      const cameraId = data.chipId || data.id || 'esp32cam-default'
      
      esp32Streams.set(cameraId, {
        ip: data.ip,
        streamUrl: data.stream_url || `http://${data.ip}:81/stream`,
        lastSeen: Date.now(),
        status: 'online',
        ...data
      })
      
      console.log(`📹 ESP32-CAM registered: ${cameraId} -> ${data.ip}`)
      
      // Broadcast to stream clients
      const streamMessage = {
        type: 'camera-registered',
        cameraId,
        data: data,
        timestamp: new Date().toISOString()
      }
      
      streamClients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(streamMessage))
        }
      })
      
    } catch (error) {
      console.error('Error parsing ESP32-CAM IP announcement:', error)
    }
  }
  
  // Handle stream data if needed
  if (topic === TOPIC_STREAM) {
    // Forward stream data to WebSocket clients
    const streamMessage = {
      type: 'stream-data',
      data: payloadString,
      timestamp: new Date().toISOString()
    }
    
    streamClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(streamMessage))
      }
    })
  }
  console.log(`   Payload: ${payloadString}`)
  console.log(`   Clients: ${wsClients.size} connected`)

  // Broadcast to all connected WebSocket clients
  let sentCount = 0
  wsClients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      client.send(JSON.stringify(message))
      sentCount++
    }
  })
  console.log(`   ✅ Sent to ${sentCount} WebSocket clients\n`)
})

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket client connected')
  
  // Check if this is a stream client
  const isStreamClient = req.url?.includes('stream') || false
  
  if (isStreamClient) {
    streamClients.add(ws)
    console.log('📹 Stream client connected')
    
    // Send available cameras
    const cameras = Array.from(esp32Streams.entries()).map(([id, data]) => ({
      id, ip: data.ip, streamUrl: data.streamUrl, status: data.status
    }))
    
    ws.send(JSON.stringify({
      type: 'cameras-list',
      cameras: cameras,
      timestamp: new Date().toISOString()
    }))
  } else {
    wsClients.add(ws)
    console.log('📡 MQTT client connected')
  }

  // Send connection success message
  ws.send(JSON.stringify({
    type: 'connected',
    message: isStreamClient ? 'Connected to Stream proxy' : 'Connected to MQTT proxy',
    timestamp: new Date().toISOString(),
  }))

  // Handle messages from WebSocket clients (commands)
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data)
      
      if (message.type === 'publish' && message.topic && message.payload) {
        console.log(`📤 Publishing to MQTT: ${message.topic}`)
        mqttClient.publish(message.topic, message.payload, { qos: 1 })
      }
      
      if (message.type === 'subscribe-stream' && message.cameraId) {
        console.log(`📹 Client subscribing to stream: ${message.cameraId}`)
        // Mark this client as interested in specific camera stream
        ws.subscribedCamera = message.cameraId
      }
      
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error)
    }
  })

  // Handle client disconnect
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected')
    wsClients.delete(ws)
    streamClients.delete(ws)
  })

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error)
    wsClients.delete(ws)
    streamClients.delete(ws)
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️  Shutting down gracefully...')
  
  wss.clients.forEach((client) => {
    client.close()
  })
  
  mqttClient.end()
  server.close(() => {
    console.log('👋 Server closed')
    process.exit(0)
  })
})

console.log(`
╔═══════════════════════════════════════════════════════════╗
║          MQTT WebSocket Proxy Server                      ║
║                                                           ║
║  WebSocket endpoint: ws://localhost:${PORT}/ws              ║
║  Health check: http://localhost:${PORT}/health             ║
║                                                           ║
║  Relaying topics (lab/zaks/#):                           ║
║  - ${TOPIC_EVENT.padEnd(48)} ║
║  - ${TOPIC_LOG.padEnd(48)} ║
║  - ${TOPIC_STATUS.padEnd(48)} ║
║  - ${TOPIC_ALERT.padEnd(48)} ║
╚═══════════════════════════════════════════════════════════╝
`)
