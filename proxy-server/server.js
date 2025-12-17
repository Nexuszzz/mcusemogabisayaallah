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

// ================================================================================
// GOWA (GO-WHATSAPP) AUTO NOTIFICATION SYSTEM
// ================================================================================
const GOWA_SERVER_URL = process.env.GOWA_SERVER_URL || 'http://localhost:3000'
const RECIPIENTS_FILE = path.join(__dirname, 'whatsapp-recipients.json')
const GAS_DANGER_THRESHOLD = 4095  // ADC max = bahaya gas
const NOTIFICATION_COOLDOWN = 60000  // 60 detik cooldown antara notifikasi

// In-memory recipients storage
let whatsappRecipients = []
let lastNotificationTime = 0
let notificationStats = {
  totalSent: 0,
  lastSent: null,
  failures: []
}

// Load recipients from file
function loadRecipients() {
  try {
    if (fs.existsSync(RECIPIENTS_FILE)) {
      const data = fs.readFileSync(RECIPIENTS_FILE, 'utf8')
      whatsappRecipients = JSON.parse(data)
      console.log(`📱 Loaded ${whatsappRecipients.length} WhatsApp recipients`)
    }
  } catch (error) {
    console.error('❌ Failed to load recipients:', error.message)
    whatsappRecipients = []
  }
}

// Save recipients to file
function saveRecipients() {
  try {
    fs.writeFileSync(RECIPIENTS_FILE, JSON.stringify(whatsappRecipients, null, 2))
    console.log(`💾 Saved ${whatsappRecipients.length} recipients to file`)
  } catch (error) {
    console.error('❌ Failed to save recipients:', error.message)
  }
}

// Send WhatsApp notification via GOWA
async function sendGowaNotification(message, alertType = 'general') {
  const now = Date.now()
  
  // Check cooldown
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
    console.log(`⏳ Notification cooldown active (${Math.round((NOTIFICATION_COOLDOWN - (now - lastNotificationTime)) / 1000)}s remaining)`)
    return { success: false, reason: 'cooldown' }
  }
  
  if (whatsappRecipients.length === 0) {
    console.log('⚠️ No WhatsApp recipients configured')
    return { success: false, reason: 'no_recipients' }
  }
  
  const results = []
  lastNotificationTime = now
  
  for (const recipient of whatsappRecipients) {
    if (!recipient.enabled) continue
    
    // Format phone number (ensure 628xxx format)
    let phone = recipient.phone.replace(/[^0-9]/g, '')
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1)
    }
    if (!phone.startsWith('62')) {
      phone = '62' + phone
    }
    
    try {
      console.log(`📤 Sending ${alertType} alert to ${recipient.name} (${phone})...`)
      
      const response = await fetch(`${GOWA_SERVER_URL}/send/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          message: message
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        console.log(`✅ Sent to ${recipient.name}: ${data.message || 'OK'}`)
        results.push({ phone, name: recipient.name, success: true })
        notificationStats.totalSent++
        notificationStats.lastSent = new Date().toISOString()
      } else {
        console.error(`❌ Failed to send to ${recipient.name}:`, data)
        results.push({ phone, name: recipient.name, success: false, error: data })
        notificationStats.failures.push({
          phone,
          error: data.message || 'Unknown error',
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error(`❌ Error sending to ${recipient.name}:`, error.message)
      results.push({ phone, name: recipient.name, success: false, error: error.message })
    }
    
    // Small delay between messages to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  return { success: true, results }
}

// Create alert message based on type
function createAlertMessage(alertType, data) {
  const timestamp = new Date().toLocaleString('id-ID', { 
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  
  switch (alertType) {
    case 'fire':
      return `🔥 *PERINGATAN KEBAKARAN!*\n\n` +
             `⚠️ Sensor mendeteksi api!\n\n` +
             `📍 Lokasi: Lab IoT\n` +
             `📅 Waktu: ${timestamp}\n` +
             `🔢 Device: ${data.deviceId || 'ESP32'}\n\n` +
             `_Segera periksa lokasi dan ambil tindakan!_\n\n` +
             `🤖 _Pesan otomatis dari Fire Detection System_`
    
    case 'gas':
      return `⚠️ *PERINGATAN KEBOCORAN GAS!*\n\n` +
             `💨 Level gas BERBAHAYA terdeteksi!\n\n` +
             `📊 Level: ${data.gasValue || 4095} ADC (MAX)\n` +
             `📍 Lokasi: Lab IoT\n` +
             `📅 Waktu: ${timestamp}\n` +
             `🔢 Device: ${data.deviceId || 'ESP32'}\n\n` +
             `⚡ _Tindakan: Segera ventilasi area dan matikan sumber gas!_\n\n` +
             `🤖 _Pesan otomatis dari Fire Detection System_`
    
    case 'fire_camera':
      return `🔥 *KEBAKARAN TERDETEKSI - AI VISION!*\n\n` +
             `📸 Kamera ESP32-CAM mendeteksi api!\n\n` +
             `📊 Confidence: ${((data.confidence || 0) * 100).toFixed(0)}%\n` +
             `📍 Camera: ${data.cameraIp || 'Unknown'}\n` +
             `📅 Waktu: ${timestamp}\n\n` +
             `${data.geminiVerified ? '✅ Terverifikasi Gemini AI' : '⚠️ Belum diverifikasi AI'}\n\n` +
             `_Segera periksa lokasi!_\n\n` +
             `🤖 _Pesan otomatis dari AI Fire Detection System_`
    
    default:
      return `⚠️ *ALERT: ${alertType.toUpperCase()}*\n\n` +
             `📅 Waktu: ${timestamp}\n` +
             `📊 Data: ${JSON.stringify(data, null, 2)}\n\n` +
             `🤖 _Pesan otomatis dari Fire Detection System_`
  }
}

// Process MQTT event for alerts
async function processAlertEvent(topic, payload) {
  try {
    let data
    try {
      data = JSON.parse(payload)
    } catch {
      data = { raw: payload }
    }
    
    console.log(`🔍 Processing alert event from ${topic}:`, data)
    
    // Check for fire detection event
    if (data.event === 'flame_on' || data.type === 'fire' || data.flame === true) {
      console.log('🔥 FIRE DETECTED! Sending notifications...')
      const message = createAlertMessage('fire', { deviceId: data.id || data.deviceId })
      await sendGowaNotification(message, 'fire')
      return
    }
    
    // Check for gas leak (gasA >= 4095)
    if (data.gasA !== undefined && data.gasA >= GAS_DANGER_THRESHOLD) {
      console.log(`💨 GAS DANGER! Level: ${data.gasA} (threshold: ${GAS_DANGER_THRESHOLD})`)
      const message = createAlertMessage('gas', { gasValue: data.gasA, deviceId: data.id })
      await sendGowaNotification(message, 'gas')
      return
    }
    
    // Check for alarm state
    if (data.alarm === true || data.alarm === 1) {
      console.log('🚨 ALARM TRIGGERED! Checking reason...')
      if (data.gasA && data.gasA >= GAS_DANGER_THRESHOLD) {
        const message = createAlertMessage('gas', { gasValue: data.gasA, deviceId: data.id })
        await sendGowaNotification(message, 'gas')
      } else {
        const message = createAlertMessage('fire', { deviceId: data.id })
        await sendGowaNotification(message, 'fire')
      }
      return
    }
    
  } catch (error) {
    console.error('❌ Error processing alert event:', error.message)
  }
}

// Initialize recipients on startup
loadRecipients()

// ================================================================================


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
// PROXY ROUTES FOR GO-WHATSAPP (GOWA) API
// These routes forward requests to the Go-WhatsApp REST API server
// GitHub: https://github.com/aldinokemal/go-whatsapp-web-multidevice
// ================================================================================

// GOWA_SERVER_URL already defined above in auto notification section

// Helper function to proxy requests with support for multipart
async function proxyRequest(targetUrl, req, res, options = {}) {
  try {
    const headers = {}
    
    // Copy content-type if exists
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type']
    }
    
    const fetchOptions = {
      method: req.method,
      headers,
    }
    
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (req.headers['content-type']?.includes('application/json')) {
        fetchOptions.body = JSON.stringify(req.body)
        headers['Content-Type'] = 'application/json'
      }
    }
    
    console.log(`🔄 Proxying to: ${targetUrl}`)
    const response = await fetch(targetUrl, fetchOptions)
    const data = await response.json()
    
    res.status(response.status).json(data)
  } catch (error) {
    console.error(`Proxy error to ${targetUrl}:`, error.message)
    res.status(503).json({
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      error: `Service unavailable: ${error.message}`,
      target: targetUrl
    })
  }
}

// ====================
// GOWA API Proxy Routes
// ====================

// App routes (login, logout, reconnect, devices)
app.get('/gowa/app/login', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/app/login`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/app/login-with-code', async (req, res) => {
  const phone = req.query.phone
  const targetUrl = `${GOWA_SERVER_URL}/app/login-with-code?phone=${phone}`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/app/logout', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/app/logout`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/app/reconnect', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/app/reconnect`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/app/devices', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/app/devices`
  await proxyRequest(targetUrl, req, res)
})

// Send routes
app.post('/gowa/send/message', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/send/message`
  await proxyRequest(targetUrl, req, res)
})

app.post('/gowa/send/image', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/send/image`
  await proxyRequest(targetUrl, req, res)
})

app.post('/gowa/send/file', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/send/file`
  await proxyRequest(targetUrl, req, res)
})

app.post('/gowa/send/video', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/send/video`
  await proxyRequest(targetUrl, req, res)
})

app.post('/gowa/send/audio', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/send/audio`
  await proxyRequest(targetUrl, req, res)
})

app.post('/gowa/send/contact', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/send/contact`
  await proxyRequest(targetUrl, req, res)
})

app.post('/gowa/send/location', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/send/location`
  await proxyRequest(targetUrl, req, res)
})

// User routes
app.get('/gowa/user/info', async (req, res) => {
  const phone = req.query.phone
  const targetUrl = `${GOWA_SERVER_URL}/user/info?phone=${phone}`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/user/avatar', async (req, res) => {
  const phone = req.query.phone
  const targetUrl = `${GOWA_SERVER_URL}/user/avatar?phone=${phone}`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/user/my/contacts', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/user/my/contacts`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/user/my/groups', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/user/my/groups`
  await proxyRequest(targetUrl, req, res)
})

// Chat routes
app.get('/gowa/chat/list', async (req, res) => {
  const targetUrl = `${GOWA_SERVER_URL}/chat/list`
  await proxyRequest(targetUrl, req, res)
})

app.get('/gowa/chat/messages', async (req, res) => {
  const { phone, limit } = req.query
  const targetUrl = `${GOWA_SERVER_URL}/chat/messages?phone=${phone}&limit=${limit || 50}`
  await proxyRequest(targetUrl, req, res)
})

// Catch-all for other GOWA routes
app.all('/gowa/*', async (req, res) => {
  const path = req.path.replace('/gowa', '')
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : ''
  const targetUrl = `${GOWA_SERVER_URL}${path}${queryString ? '?' + queryString : ''}`
  console.log(`📱 Proxying GOWA request: ${req.method} ${targetUrl}`)
  await proxyRequest(targetUrl, req, res)
})

// ================================================================================
// WHATSAPP RECIPIENTS MANAGEMENT API
// These endpoints manage notification recipients stored on server
// ================================================================================

// Get all recipients
app.get('/api/recipients', (req, res) => {
  res.json({
    success: true,
    recipients: whatsappRecipients,
    stats: notificationStats
  })
})

// Add new recipient
app.post('/api/recipients', (req, res) => {
  const { name, phone, enabled = true } = req.body
  
  if (!name || !phone) {
    return res.status(400).json({
      success: false,
      error: 'Name and phone are required'
    })
  }
  
  // Validate phone format
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format'
    })
  }
  
  // Check for duplicates
  const exists = whatsappRecipients.find(r => 
    r.phone.replace(/[^0-9]/g, '') === cleanPhone
  )
  if (exists) {
    return res.status(409).json({
      success: false,
      error: 'Phone number already registered'
    })
  }
  
  const recipient = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name,
    phone: cleanPhone,
    enabled,
    createdAt: new Date().toISOString()
  }
  
  whatsappRecipients.push(recipient)
  saveRecipients()
  
  console.log(`📱 Added recipient: ${name} (${phone})`)
  
  res.json({
    success: true,
    recipient,
    message: 'Recipient added successfully'
  })
})

// Update recipient
app.put('/api/recipients/:id', (req, res) => {
  const { id } = req.params
  const { name, phone, enabled } = req.body
  
  const index = whatsappRecipients.findIndex(r => r.id === id)
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Recipient not found'
    })
  }
  
  if (name) whatsappRecipients[index].name = name
  if (phone) whatsappRecipients[index].phone = phone.replace(/[^0-9]/g, '')
  if (enabled !== undefined) whatsappRecipients[index].enabled = enabled
  whatsappRecipients[index].updatedAt = new Date().toISOString()
  
  saveRecipients()
  
  res.json({
    success: true,
    recipient: whatsappRecipients[index],
    message: 'Recipient updated successfully'
  })
})

// Delete recipient
app.delete('/api/recipients/:id', (req, res) => {
  const { id } = req.params
  const index = whatsappRecipients.findIndex(r => r.id === id)
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Recipient not found'
    })
  }
  
  const removed = whatsappRecipients.splice(index, 1)[0]
  saveRecipients()
  
  console.log(`🗑️ Removed recipient: ${removed.name}`)
  
  res.json({
    success: true,
    message: 'Recipient deleted successfully'
  })
})

// Toggle recipient enabled status
app.patch('/api/recipients/:id/toggle', (req, res) => {
  const { id } = req.params
  const recipient = whatsappRecipients.find(r => r.id === id)
  
  if (!recipient) {
    return res.status(404).json({
      success: false,
      error: 'Recipient not found'
    })
  }
  
  recipient.enabled = !recipient.enabled
  recipient.updatedAt = new Date().toISOString()
  saveRecipients()
  
  res.json({
    success: true,
    recipient,
    message: `Recipient ${recipient.enabled ? 'enabled' : 'disabled'}`
  })
})

// Sync recipients from frontend (bulk update)
app.post('/api/recipients/sync', (req, res) => {
  const { recipients: newRecipients } = req.body
  
  if (!Array.isArray(newRecipients)) {
    return res.status(400).json({
      success: false,
      error: 'Recipients must be an array'
    })
  }
  
  // Validate and transform recipients
  const validRecipients = newRecipients.map((r, index) => ({
    id: r.id || `rec_${Date.now()}_${index}`,
    name: r.name || `Recipient ${index + 1}`,
    phone: (r.phone || r.number || '').replace(/[^0-9]/g, ''),
    enabled: r.enabled !== false,
    createdAt: r.createdAt || new Date().toISOString()
  })).filter(r => r.phone.length >= 10)
  
  whatsappRecipients = validRecipients
  saveRecipients()
  
  console.log(`🔄 Synced ${validRecipients.length} recipients from frontend`)
  
  res.json({
    success: true,
    count: validRecipients.length,
    recipients: validRecipients
  })
})

// Test notification to specific recipient
app.post('/api/recipients/:id/test', async (req, res) => {
  const { id } = req.params
  const recipient = whatsappRecipients.find(r => r.id === id)
  
  if (!recipient) {
    return res.status(404).json({
      success: false,
      error: 'Recipient not found'
    })
  }
  
  // Format phone
  let phone = recipient.phone.replace(/[^0-9]/g, '')
  if (phone.startsWith('0')) phone = '62' + phone.substring(1)
  if (!phone.startsWith('62')) phone = '62' + phone
  
  const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  const testMessage = `🧪 *TEST NOTIFIKASI*\n\n` +
                     `Ini adalah pesan test dari Fire Detection System.\n\n` +
                     `📱 Recipient: ${recipient.name}\n` +
                     `📅 Waktu: ${timestamp}\n\n` +
                     `✅ Jika Anda menerima pesan ini, sistem notifikasi berfungsi dengan baik!\n\n` +
                     `🤖 _Pesan otomatis dari Fire Detection System_`
  
  try {
    const response = await fetch(`${GOWA_SERVER_URL}/send/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: testMessage })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      res.json({
        success: true,
        message: 'Test message sent successfully',
        recipient: recipient.name
      })
    } else {
      res.status(response.status).json({
        success: false,
        error: data.message || 'Failed to send test message',
        details: data
      })
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      error: `Failed to send: ${error.message}`
    })
  }
})

// Manual trigger alert (for testing)
app.post('/api/alert/trigger', async (req, res) => {
  const { type = 'fire', data = {} } = req.body
  
  console.log(`🔔 Manual alert trigger: ${type}`)
  
  const message = createAlertMessage(type, data)
  const result = await sendGowaNotification(message, type)
  
  res.json({
    success: result.success,
    type,
    result
  })
})

// Get notification stats
app.get('/api/notifications/stats', (req, res) => {
  res.json({
    success: true,
    stats: notificationStats,
    recipientCount: whatsappRecipients.length,
    enabledCount: whatsappRecipients.filter(r => r.enabled).length,
    cooldownRemaining: Math.max(0, NOTIFICATION_COOLDOWN - (Date.now() - lastNotificationTime))
  })
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
  
  // ================================================================================
  // AUTO WHATSAPP NOTIFICATION ON FIRE/GAS EVENTS
  // ================================================================================
  
  // Check for event topic (lab/zaks/event) - fire detection events
  if (topic === TOPIC_EVENT || topic.includes('/event')) {
    try {
      const eventData = JSON.parse(payloadString)
      console.log(`🔍 Event data:`, eventData)
      
      // Fire/flame detection
      if (eventData.event === 'flame_on' || eventData.type === 'fire' || eventData.flame === true) {
        console.log('🔥 FIRE EVENT DETECTED! Triggering WhatsApp notification...')
        processAlertEvent(topic, payloadString)
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }
  
  // Check for log/telemetry topic (lab/zaks/log) - sensor data with gas readings
  if (topic === TOPIC_LOG || topic.includes('/log')) {
    try {
      const telemetryData = JSON.parse(payloadString)
      
      // Check for dangerous gas level (4095 = ADC max = saturated/dangerous)
      if (telemetryData.gasA !== undefined && telemetryData.gasA >= GAS_DANGER_THRESHOLD) {
        console.log(`💨 DANGEROUS GAS LEVEL DETECTED! gasA=${telemetryData.gasA} (threshold=${GAS_DANGER_THRESHOLD})`)
        processAlertEvent(topic, payloadString)
      }
      
      // Check for alarm flag
      if (telemetryData.alarm === true || telemetryData.alarm === 1) {
        console.log('🚨 ALARM FLAG DETECTED in telemetry!')
        processAlertEvent(topic, payloadString)
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }
  
  // Check for alert topic (lab/zaks/alert) - direct alerts
  if (topic === TOPIC_ALERT || topic.includes('/alert')) {
    console.log('🚨 ALERT TOPIC MESSAGE! Processing...')
    processAlertEvent(topic, payloadString)
  }
  
  // ================================================================================
  
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
