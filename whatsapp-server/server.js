/**
 * WhatsApp Baileys Server for Fire Detection System
 * Supports pairing code authentication & fire alerts
 */

import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import mqtt from 'mqtt';
import twilio from 'twilio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// For HTTP fetching (built-in in Node.js 18+)
const fetch = globalThis.fetch || (await import('node-fetch')).default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the same directory as this file
config({ path: path.join(__dirname, '.env') });

const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) {
      callback(null, true);
      return;
    }
    // Allow all localhost and 127.0.0.1 origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
      return;
    }
    // Allow Vercel deployments
    if (origin.includes('vercel.app')) {
      callback(null, true);
      return;
    }
    // Check against allowed origins list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Global state
let sock = null;
let qrCodeData = null;
let pairingCode = null;
let authMethod = 'pairing'; // 'qr' or 'pairing'
let connectionState = {
  status: 'disconnected', // disconnected, connecting, syncing, connected, error
  phone: null,
  syncProgress: 0,
  lastActivity: null,
  authMethod: 'pairing',
  qrCode: null,
  pairingCode: null,
  error: null,
};
let recipients = [];
let emergencyCallNumbers = []; // Phone numbers for emergency voice calls
let mqttClient = null;
let lastSensorData = null; // Track latest sensor readings
let lastAlertSent = 0; // Prevent spam alerts
let lastVoiceCallTime = 0; // Prevent spam voice calls
let qrRefreshTimer = null; // QR code expiration timer
const ALERT_COOLDOWN = 60000; // 1 minute cooldown between alerts
const VOICE_CALL_COOLDOWN = 120000; // 2 minutes cooldown between voice calls

// Load recipients from file
function loadRecipients() {
  try {
    const recipientsFile = path.join(__dirname, 'recipients.json');
    if (fs.existsSync(recipientsFile)) {
      const data = fs.readFileSync(recipientsFile, 'utf8');
      recipients = JSON.parse(data);
      console.log(`📋 Loaded ${recipients.length} recipients`);
    }
  } catch (err) {
    console.error('Error loading recipients:', err.message);
  }
}

// Save recipients to file
function saveRecipients() {
  try {
    const recipientsFile = path.join(__dirname, 'recipients.json');
    fs.writeFileSync(recipientsFile, JSON.stringify(recipients, null, 2));
  } catch (err) {
    console.error('Error saving recipients:', err.message);
  }
}

// Load emergency call numbers from file
function loadEmergencyCallNumbers() {
  try {
    const callNumbersFile = path.join(__dirname, 'emergency-call-numbers.json');
    if (fs.existsSync(callNumbersFile)) {
      const data = fs.readFileSync(callNumbersFile, 'utf8');
      emergencyCallNumbers = JSON.parse(data);
      console.log(`📞 Loaded ${emergencyCallNumbers.length} emergency call numbers`);
    }
  } catch (err) {
    console.error('Error loading emergency call numbers:', err.message);
  }
}

// Save emergency call numbers to file
function saveEmergencyCallNumbers() {
  try {
    const callNumbersFile = path.join(__dirname, 'emergency-call-numbers.json');
    fs.writeFileSync(callNumbersFile, JSON.stringify(emergencyCallNumbers, null, 2));
  } catch (err) {
    console.error('Error saving emergency call numbers:', err.message);
  }
}

// Logger
const logger = P({ level: process.env.LOG_LEVEL || 'silent' });

// MQTT Configuration
const MQTT_CONFIG = {
  host: process.env.MQTT_HOST,
  port: parseInt(process.env.MQTT_PORT || '1883'),
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASSWORD,
  topic_event: process.env.MQTT_TOPIC_EVENT || 'lab/zaks/event',
  topic_alert: process.env.MQTT_TOPIC_ALERT || 'lab/zaks/alert',
  topic_log: process.env.MQTT_TOPIC_LOG || 'lab/zaks/log',
  topic_status: process.env.MQTT_TOPIC_STATUS || 'lab/zaks/status',
};

// Validate required environment variables
if (!MQTT_CONFIG.host || !MQTT_CONFIG.username || !MQTT_CONFIG.password) {
  console.error('❌ ERROR: Missing required MQTT environment variables!');
  console.error('Please create a .env file based on .env.example');
  process.exit(1);
}

// Twilio Configuration
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  voiceUrl: process.env.TWILIO_VOICE_URL || 'https://demo.twilio.com/welcome/voice/',
};

// Initialize Twilio Client
let twilioClient = null;
let twilioEnabled = false;

if (TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken && TWILIO_CONFIG.phoneNumber) {
  try {
    twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
    twilioEnabled = true;
    console.log('✅ Twilio Voice Call initialized');
    console.log(`   Phone: ${TWILIO_CONFIG.phoneNumber}`);
  } catch (err) {
    console.error('⚠️  Twilio initialization failed:', err.message);
    twilioEnabled = false;
  }
} else {
  console.log('⚠️  Twilio Voice Call disabled (missing credentials in .env)');
}

// Initialize MQTT
function initMQTT() {
  mqttClient = mqtt.connect(`mqtt://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`, {
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    clientId: `whatsapp-server-${Date.now()}`,
  });

  mqttClient.on('connect', () => {
    console.log('✅ MQTT Connected');
    // Subscribe to all relevant topics
    mqttClient.subscribe([
      MQTT_CONFIG.topic_event,
      MQTT_CONFIG.topic_alert,
      MQTT_CONFIG.topic_log,
      MQTT_CONFIG.topic_status,
      'lab/zaks/fire_photo' // NEW: Subscribe to fire detection with photo
    ], (err) => {
      if (err) {
        console.error('❌ Subscription error:', err);
      } else {
        console.log('📥 Subscribed to topics:');
        console.log(`   - ${MQTT_CONFIG.topic_event} (events)`);
        console.log(`   - ${MQTT_CONFIG.topic_alert} (fire alerts)`);
        console.log(`   - ${MQTT_CONFIG.topic_log} (sensor telemetry)`);
        console.log(`   - ${MQTT_CONFIG.topic_status} (device status)`);
        console.log(`   - lab/zaks/fire_photo (fire detection photos)`);
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());

      // Handle fire detection with photo
      if (topic === 'lab/zaks/fire_photo' && sock && connectionState.status === 'connected') {
        await handleFireDetectionWithPhoto(data);

        // ALSO trigger emergency voice calls
        if (twilioEnabled && emergencyCallNumbers.length > 0) {
          await handleFireDetectionWithVoiceCall(data);
        }
      }

      // Handle fire alerts
      if (topic === MQTT_CONFIG.topic_alert && sock && connectionState.status === 'connected') {
        await handleFireAlert(data);
      }

      // Handle sensor telemetry
      if (topic === MQTT_CONFIG.topic_log) {
        lastSensorData = data;
        await handleSensorData(data);
      }

      // Handle events
      if (topic === MQTT_CONFIG.topic_event) {
        await handleSensorEvent(data);
      }

      // Handle status updates
      if (topic === MQTT_CONFIG.topic_status) {
        console.log('📊 Device status:', data.status);
      }
    } catch (err) {
      console.error('MQTT message error:', err);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT Error:', err);
  });
}

// Handle Sensor Data (Telemetry)
async function handleSensorData(sensorData) {
  if (!sock || connectionState.status !== 'connected' || recipients.length === 0) {
    return;
  }

  const { id, t, h, gasA, gasMv, gasD, flame, alarm, forceAlarm } = sensorData;

  // Check if alert conditions are met and cooldown passed
  const now = Date.now();
  if ((alarm || forceAlarm || flame || gasD) && (now - lastAlertSent) > ALERT_COOLDOWN) {
    lastAlertSent = now;

    // Determine alert type
    let alertType = '';
    let alertEmoji = '';
    if (flame) {
      alertType = 'API TERDETEKSI';
      alertEmoji = '🔥';
    } else if (gasD || alarm) {
      alertType = 'GAS BERBAHAYA';
      alertEmoji = '☁️';
    } else if (forceAlarm) {
      alertType = 'ALARM MANUAL';
      alertEmoji = '🚨';
    }

    // Build alert message
    let message = `*${alertEmoji} ${alertType} - PERINGATAN!*\n\n`;
    message += `⚠️ *KONDISI BERBAHAYA TERDETEKSI*\n\n`;
    message += `📊 *Data Sensor Saat Ini:*\n`;
    message += `🌡️ Suhu: *${t}°C*\n`;
    message += `💧 Kelembapan: *${h}%*\n`;
    message += `☁️ Gas ADC: *${gasA}* (${gasMv}mV)\n`;
    message += `🔥 Flame: *${flame ? 'TERDETEKSI ⚠️' : 'Normal ✓'}*\n`;
    message += `💨 Gas Digital: *${gasD ? 'BAHAYA ⚠️' : 'Aman ✓'}*\n\n`;
    message += `🆔 Device ID: \`${id}\`\n`;
    message += `⏰ Waktu: ${new Date().toLocaleString('id-ID')}\n\n`;
    message += `*⚠️ HARAP SEGERA PERIKSA LOKASI SENSOR!*`;

    // Send to all recipients
    for (const recipient of recipients) {
      try {
        const jid = recipient.phoneNumber.includes('@') ? recipient.phoneNumber : `${recipient.phoneNumber}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        console.log(`✅ Sensor alert sent to ${recipient.name || recipient.phoneNumber}`);
      } catch (err) {
        console.error(`❌ Failed to send sensor alert to ${recipient.phoneNumber}:`, err.message);
      }
    }
  }
}

// Handle Sensor Events (flame_on, etc)
async function handleSensorEvent(eventData) {
  if (!sock || connectionState.status !== 'connected' || recipients.length === 0) {
    return;
  }

  const { event, data } = eventData;

  // Only send critical events
  if (event === 'flame_on' || event === 'gas_alert' || event === 'alarm_triggered') {
    const now = Date.now();
    if ((now - lastAlertSent) > ALERT_COOLDOWN) {
      lastAlertSent = now;

      let message = `*🚨 EVENT KRITIS*\n\n`;
      message += `📢 *Event:* ${event}\n`;

      if (lastSensorData) {
        message += `\n📊 *Data Sensor Terkini:*\n`;
        message += `🌡️ Suhu: ${lastSensorData.t}°C\n`;
        message += `💧 Kelembapan: ${lastSensorData.h}%\n`;
        message += `☁️ Gas: ${lastSensorData.gasA} ADC\n`;
        message += `🔥 Flame: ${lastSensorData.flame ? 'Terdeteksi ⚠️' : 'Normal'}\n`;
      }

      message += `\n⏰ ${new Date().toLocaleString('id-ID')}`;
      message += `\n\n*⚠️ SEGERA CEK RUANGAN!*`;

      for (const recipient of recipients) {
        try {
          const jid = recipient.phoneNumber.includes('@') ? recipient.phoneNumber : `${recipient.phoneNumber}@s.whatsapp.net`;
          await sock.sendMessage(jid, { text: message });
          console.log(`✅ Event alert sent to ${recipient.name || recipient.phoneNumber}`);
        } catch (err) {
          console.error(`❌ Failed to send event alert to ${recipient.phoneNumber}:`, err.message);
        }
      }
    }
  }
}

// Handle Fire Alert
async function handleFireAlert(alertData) {
  if (recipients.length === 0) {
    console.log('⚠️  No recipients configured');
    return;
  }

  const { alert, conf, level, bbox, gemini, ts, temperature, humidity, gas } = alertData;

  // Determine risk level
  const riskStatus = level === 'CRITICAL' ? '🔴 BAHAYA!' : level === 'HIGH' ? '🟠 BERESIKO TINGGI' : '🟡 BERESIKO';

  // Build message
  let message = `*🔥 DETEKSI KEBAKARAN ${riskStatus}*\n\n`;
  message += `📊 *Data Sensor:*\n`;
  message += `🌡️ Suhu: ${temperature || 'N/A'}°C\n`;
  message += `💧 Kelembapan: ${humidity || 'N/A'}%\n`;
  message += `☁️ Gas: ${gas || 'N/A'} ppm\n\n`;
  message += `🎯 *Deteksi:*\n`;
  message += `• Confidence: ${(conf * 100).toFixed(1)}%\n`;
  message += `• Level: ${level}\n`;
  message += `• ${gemini ? '✅ Verified by AI' : '⏳ Pending verification'}\n\n`;
  message += `⏰ Waktu: ${new Date(ts * 1000).toLocaleString('id-ID')}\n\n`;
  message += `⚠️ *SEGERA CEK RUANGAN!*`;

  // Send to all recipients
  for (const recipient of recipients) {
    try {
      // recipient is object {phoneNumber, name, id}
      const phoneNumber = recipient.phoneNumber || recipient;
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

      // Send message
      await sock.sendMessage(jid, { text: message });

      const displayName = recipient.name || phoneNumber;
      console.log(`✅ Fire alert sent to ${displayName}`);
    } catch (err) {
      const displayName = recipient.name || recipient.phoneNumber || recipient;
      console.error(`❌ Failed to send to ${displayName}:`, err);
    }
  }
}

// Handle Fire Detection with Photo (NEW FEATURE!)
async function handleFireDetectionWithPhoto(data) {
  if (recipients.length === 0) {
    console.log('⚠️  No recipients configured for fire photo alert');
    return;
  }

  console.log('📸 Handling fire detection with photo...');
  console.log('   Detection ID:', data.detection?.id);
  console.log('   Snapshot data:', JSON.stringify(data.snapshot, null, 2));

  const { detection, snapshot } = data;

  // Check cooldown to prevent spam
  const now = Date.now();
  if ((now - lastAlertSent) < ALERT_COOLDOWN) {
    console.log(`⏳ Cooldown active. Skipping alert (${Math.round((ALERT_COOLDOWN - (now - lastAlertSent)) / 1000)}s remaining)`);
    return;
  }
  lastAlertSent = now;

  // Build detailed alert message
  const confidencePercent = (detection.confidence * 100).toFixed(1);
  const geminiPercent = detection.geminiScore ? (detection.geminiScore * 100).toFixed(1) : 'N/A';

  let message = `*🔥 DETEKSI API DENGAN BUKTI FOTO!*\n\n`;
  message += `⚠️ *PERINGATAN: API TERDETEKSI*\n\n`;

  message += `📊 *Tingkat Keyakinan:*\n`;
  message += `🎯 YOLO Detection: *${confidencePercent}%*\n`;
  if (detection.geminiVerified) {
    message += `🤖 Gemini AI Verification: *${geminiPercent}%* ✅\n`;
    if (detection.geminiReason) {
      message += `💭 AI Analysis: _${detection.geminiReason}_\n`;
    }
  }
  message += `\n`;

  message += `📷 *Sumber:*\n`;
  message += `📍 Camera: ${detection.cameraId}\n`;
  message += `🌐 IP Address: ${detection.cameraIp}\n`;
  message += `🤖 Model: ${detection.yoloModel}\n`;
  message += `\n`;

  message += `📐 *Lokasi Api di Frame:*\n`;
  message += `• X: ${detection.bbox.x1.toFixed(0)} - ${detection.bbox.x2.toFixed(0)}\n`;
  message += `• Y: ${detection.bbox.y1.toFixed(0)} - ${detection.bbox.y2.toFixed(0)}\n`;
  message += `• Size: ${detection.bbox.width.toFixed(0)}×${detection.bbox.height.toFixed(0)}px\n`;
  message += `\n`;

  message += `⏰ *Waktu Deteksi:*\n`;
  message += `${new Date(detection.timestamp).toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}\n\n`;

  message += `*⚠️ TINDAKAN YANG HARUS DILAKUKAN:*\n`;
  message += `1️⃣ Periksa lokasi kamera SEGERA\n`;
  message += `2️⃣ Pastikan tidak ada asap atau api\n`;
  message += `3️⃣ Hubungi petugas keamanan jika perlu\n`;
  message += `4️⃣ Evakuasi jika situasi berbahaya\n\n`;

  message += `🆔 Detection ID: \`${detection.id}\``;

  // Send to all recipients
  for (const recipient of recipients) {
    try {
      const jid = recipient.phoneNumber.includes('@')
        ? recipient.phoneNumber
        : `${recipient.phoneNumber}@s.whatsapp.net`;

      // Try multiple path resolution strategies
      let photoPath = null;
      let photoBuffer = null;

      // Strategy 1: Try fullPath from MQTT (absolute path from proxy-server)
      if (snapshot.fullPath) {
        const fullPath = snapshot.fullPath.replace(/\//g, path.sep); // Normalize slashes
        console.log(`   Trying fullPath: ${fullPath}`);

        if (fs.existsSync(fullPath)) {
          photoPath = fullPath;
          console.log(`   ✅ Found photo at fullPath`);
        } else {
          console.log(`   ❌ Photo not found at fullPath`);
        }
      }

      // Strategy 2: Try relative path from parent directory
      if (!photoPath && snapshot.filename) {
        const parentDir = path.resolve(__dirname, '..');
        const relativePath = path.join(parentDir, 'proxy-server', 'uploads', 'fire-detections', snapshot.filename);
        console.log(`   Trying relativePath: ${relativePath}`);

        if (fs.existsSync(relativePath)) {
          photoPath = relativePath;
          console.log(`   ✅ Found photo at relativePath`);
        } else {
          console.log(`   ❌ Photo not found at relativePath`);
        }
      }

      // Strategy 3: Fetch via HTTP from proxy server
      if (!photoPath && snapshot.url) {
        try {
          console.log(`   Trying HTTP fetch: http://localhost:8080${snapshot.url}`);
          const response = await fetch(`http://localhost:8080${snapshot.url}`);

          if (response.ok) {
            photoBuffer = Buffer.from(await response.arrayBuffer());
            console.log(`   ✅ Downloaded photo via HTTP (${photoBuffer.length} bytes)`);
          } else {
            console.log(`   ❌ HTTP fetch failed: ${response.status}`);
          }
        } catch (httpError) {
          console.log(`   ❌ HTTP fetch error: ${httpError.message}`);
        }
      }

      // Read photo buffer if we have a valid path
      if (photoPath && !photoBuffer) {
        try {
          photoBuffer = fs.readFileSync(photoPath);
          console.log(`   ✅ Read photo from disk (${photoBuffer.length} bytes)`);
        } catch (readError) {
          console.log(`   ❌ Failed to read photo: ${readError.message}`);
          photoBuffer = null;
        }
      }

      // Send message with photo if available
      if (photoBuffer && photoBuffer.length > 0) {
        console.log(`   📤 Sending photo to ${recipient.name || recipient.phoneNumber}...`);

        // Send image with caption
        await sock.sendMessage(jid, {
          image: photoBuffer,
          caption: message,
          mimetype: 'image/jpeg',
        });

        console.log(`✅ Fire photo alert sent to ${recipient.name || recipient.phoneNumber}`);
      } else {
        // Fallback: send text only if photo not available
        console.log(`   ⚠️ Photo not available, sending text only to ${recipient.name || recipient.phoneNumber}...`);
        const textMessage = message + `\n\n⚠️ _Foto tidak tersedia pada saat pengiriman_`;

        await sock.sendMessage(jid, { text: textMessage });
        console.log(`✅ Fire text alert sent to ${recipient.name || recipient.phoneNumber}`);
      }
    } catch (err) {
      console.error(`❌ Failed to send fire photo alert to ${recipient.phoneNumber}:`, err.message);
    }
  }

  console.log('✅ Fire detection photo alerts completed');
}

// Handle Fire Detection with Emergency Voice Call (NEW FEATURE!)
async function handleFireDetectionWithVoiceCall(data) {
  if (!twilioEnabled || !twilioClient) {
    console.log('⚠️  Twilio not enabled - skipping voice calls');
    return;
  }

  if (emergencyCallNumbers.length === 0) {
    console.log('⚠️  No emergency call numbers configured');
    return;
  }

  console.log('📞 Handling fire detection with emergency voice calls...');

  const { detection } = data;

  // Check cooldown to prevent spam
  const now = Date.now();
  if ((now - lastVoiceCallTime) < VOICE_CALL_COOLDOWN) {
    console.log(`⏳ Voice call cooldown active. Skipping call (${Math.round((VOICE_CALL_COOLDOWN - (now - lastVoiceCallTime)) / 1000)}s remaining)`);
    return;
  }
  lastVoiceCallTime = now;

  // Build TwiML for voice message
  const confidencePercent = (detection.confidence * 100).toFixed(0);
  const location = detection.cameraId || 'Unknown location';

  // Create custom TwiML for fire alert message
  const twimlMessage = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Emergency Alert! Fire detected with ${confidencePercent} percent confidence at ${location}. Please check the location immediately. This is an automated emergency call from the Fire Detection System.</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-US">Repeating: Emergency! Fire detected at ${location}. Confidence level: ${confidencePercent} percent.</Say>
</Response>`;

  // Make calls to all emergency numbers
  for (const callNumber of emergencyCallNumbers) {
    try {
      const toNumber = callNumber.phoneNumber.startsWith('+')
        ? callNumber.phoneNumber
        : `+${callNumber.phoneNumber}`;

      console.log(`📞 Calling ${callNumber.name || toNumber}...`);

      const call = await twilioClient.calls.create({
        to: toNumber,
        from: TWILIO_CONFIG.phoneNumber,
        url: TWILIO_CONFIG.voiceUrl,
        // Alternative: use TwiML directly
        // twiml: twimlMessage,
        statusCallback: `http://localhost:${process.env.WA_PORT || 3001}/api/twilio/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      });

      console.log(`✅ Emergency call initiated to ${callNumber.name || toNumber}`);
      console.log(`   Call SID: ${call.sid}`);
      console.log(`   Status: ${call.status}`);
    } catch (err) {
      console.error(`❌ Failed to call ${callNumber.phoneNumber}:`, err.message);
    }
  }

  console.log('✅ Emergency voice calls completed');
}

// Send Safe Status
async function sendSafeStatus(recipient) {
  const message = `*✅ STATUS AMAN*\n\n`;
  message += `Sistem fire detection aktif dan tidak mendeteksi ancaman.\n`;
  message += `Semua sensor dalam kondisi normal.\n\n`;
  message += `⏰ ${new Date().toLocaleString('id-ID')}`;

  try {
    const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    return true;
  } catch (err) {
    console.error('Failed to send safe status:', err);
    return false;
  }
}

// Connect to WhatsApp (supports both QR and Pairing)
async function connectToWhatsApp(phoneNumber = null, method = 'pairing') {
  console.log(`\n📞 connectToWhatsApp() called with:`);
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Method: ${method}\n`);

  try {
    connectionState.status = 'connecting';
    connectionState.authMethod = method;
    authMethod = method;

    // Multi-file auth state
    const authDir = path.join(__dirname, 'auth_info');
    const hasSession = fs.existsSync(authDir);

    // If QR mode requested, always start fresh to prevent 401 errors
    if (method === 'qr' && hasSession) {
      console.log('📱 QR Code mode requested - removing old session for fresh start');
      console.log('   This prevents 401 auto-logout errors\n');
      await deleteSession();
      // Session deleted, will create fresh connection
    }

    // Validate existing session before connecting (for pairing mode)
    if (fs.existsSync(authDir) && method !== 'qr') {
      console.log('📁 Existing session detected - validating...');

      const credsFile = path.join(authDir, 'creds.json');
      if (!fs.existsSync(credsFile)) {
        console.log('   ❌ creds.json missing - session invalid');
        console.log('   🗑️  Auto-deleting invalid session...\n');
        await deleteSession();
      } else {
        try {
          const credsData = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
          if (!credsData.me || !credsData.me.id) {
            console.log('   ❌ Session data incomplete/corrupted');
            console.log('   🗑️  Auto-deleting corrupted session...\n');
            await deleteSession();
          } else {
            console.log('   ✅ Session file validated');
            console.log(`   📱 Previous phone: ${credsData.me.id.split(':')[0]}\n`);
          }
        } catch (err) {
          console.log('   ❌ Cannot read/parse session file:', err.message);
          console.log('   🗑️  Auto-deleting corrupted session...\n');
          await deleteSession();
        }
      }
    }

    // Create auth directory if doesn't exist
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
      console.log(`📁 Created auth directory: ${authDir}\n`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    console.log(`✅ Auth state loaded`);

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📦 Using Baileys version: ${version.join('.')}, Latest: ${isLatest}`);

    // Create socket with proper configuration
    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: true, // Enable terminal QR display
      browser: ['Fire Detection System', 'Chrome', '110.0.0'],
      defaultQueryTimeoutMs: undefined,
      getMessage: async (key) => {
        return { conversation: '' };
      },
    });

    console.log(`✅ Socket created`);

    // Handle authentication based on method
    if (!sock.authState.creds.registered) {
      console.log('📋 Device not registered yet, starting authentication...');

      if (method === 'pairing' && phoneNumber) {
        // Pairing Code Method
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        connectionState.phone = cleanPhone;

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📱 PAIRING CODE MODE ACTIVATED`);
        console.log(`${'='.repeat(70)}`);
        console.log(`📞 Phone Number: +${cleanPhone}`);
        console.log(`⏳ Initializing secure connection...\n`);

        // Aggressive retry mechanism
        let attempts = 0;
        const maxAttempts = 20;
        let pairingInterval;

        const requestPairing = async () => {
          attempts++;
          console.log(`[Attempt ${attempts}/${maxAttempts}] Checking socket readiness...`);

          try {
            // Check socket exists
            if (!sock) {
              throw new Error('Socket is null - connection failed');
            }

            // Check if requestPairingCode method exists
            if (typeof sock.requestPairingCode !== 'function') {
              if (attempts < maxAttempts) {
                console.log(`   ⏳ Socket not ready yet, waiting 1 second...`);
                return; // Continue interval
              } else {
                throw new Error('Socket.requestPairingCode() not available after 20 seconds');
              }
            }

            // Method is available, try to request pairing code
            console.log(`   ✅ Socket ready! Requesting pairing code...`);
            clearInterval(pairingInterval); // Stop retry loop

            pairingCode = await sock.requestPairingCode(cleanPhone);

            if (!pairingCode) {
              throw new Error('Pairing code returned empty');
            }

            // Success! Display the code
            console.log(`\n${'='.repeat(70)}`);
            console.log(`✅ PAIRING CODE GENERATED SUCCESSFULLY!`);
            console.log(`${'='.repeat(70)}`);
            console.log(`\n🔑 YOUR PAIRING CODE: *${pairingCode}*\n`);
            console.log(`📱 Phone Number: +${cleanPhone}`);
            console.log(`⏰ Code expires in: 60 seconds`);
            console.log(`\n${'─'.repeat(70)}`);
            console.log(`📋 HOW TO USE THIS CODE:\n`);
            console.log(`   1️⃣  Open WhatsApp on your phone`);
            console.log(`   2️⃣  Tap Menu (⋮) → Settings`);
            console.log(`   3️⃣  Tap "Linked Devices"`);
            console.log(`   4️⃣  Tap "Link a Device"`);
            console.log(`   5️⃣  Tap "Link with phone number instead"`);
            console.log(`   6️⃣  Enter this code: *${pairingCode}*`);
            console.log(`   7️⃣  Wait for connection...\n`);
            console.log(`${'─'.repeat(70)}`);
            console.log(`⚠️  IMPORTANT:`);
            console.log(`   • Don't share this code with anyone`);
            console.log(`   • Code is valid for 1 minute only`);
            console.log(`   • Make sure you have internet connection`);
            console.log(`${'='.repeat(70)}\n`);

            connectionState.pairingCode = pairingCode;
            connectionState.status = 'waiting_pairing';

          } catch (err) {
            clearInterval(pairingInterval);

            console.error('\n' + '='.repeat(70));
            console.error('❌ PAIRING CODE GENERATION FAILED');
            console.error('='.repeat(70));
            console.error(`Error Type: ${err.name}`);
            console.error(`Error Message: ${err.message}`);

            if (err.stack) {
              console.error(`\nDetailed Error:\n${err.stack.split('\n').slice(0, 5).join('\n')}`);
            }

            console.error('\n📋 TROUBLESHOOTING STEPS:');
            console.error('   1. Check phone number format: 628xxxxxxxxxx (no +, spaces, or dashes)');
            console.error('   2. Delete old session: curl -X POST http://localhost:3001/api/whatsapp/delete-session');
            console.error('   3. Restart server: Ctrl+C then start again');
            console.error('   4. Check Baileys version compatibility');
            console.error('   5. Try QR code method instead');
            console.error('='.repeat(70) + '\n');

            connectionState.status = 'error';
            connectionState.error = err.message;
          }
        };

        // Start retry loop - check every 1 second
        console.log(`Starting pairing code request loop...\n`);
        pairingInterval = setInterval(requestPairing, 1000);

        // Initial attempt after 2 seconds
        setTimeout(requestPairing, 2000);

      } else if (method === 'qr') {
        // QR Code Method
        console.log('\n' + '='.repeat(70));
        console.log('📱 QR CODE MODE ACTIVATED');
        console.log('='.repeat(70));
        console.log('⏳ Generating QR code...');
        console.log('   QR will appear in ~2 seconds');
        console.log('   Valid for 60 seconds only\n');
        console.log('📋 HOW TO SCAN:');
        console.log('   1. Open WhatsApp on your phone');
        console.log('   2. Tap Menu (⋮) → Settings');
        console.log('   3. Tap "Linked Devices"');
        console.log('   4. Tap "Link a Device"');
        console.log('   5. Scan the QR code that will appear below\n');
        console.log('='.repeat(70) + '\n');

        connectionState.status = 'waiting_qr';
      }
    } else {
      console.log('\n✅ Device already registered!');
      console.log('   Connecting to existing session...\n');
      connectionState.status = 'connecting';
    }

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Terminal display for server operators
          console.log('\\n📱 QR CODE GENERATED!\\n');
          console.log('='.repeat(70));
          qrcodeTerminal.generate(qr, { small: true });  // ASCII QR in terminal
          console.log('='.repeat(70));
          console.log('📱 Scan with WhatsApp: Settings → Linked Devices → Link a Device\\n');

          // Data URL for dashboard/API
          qrCodeData = await qrcode.toDataURL(qr);
          connectionState.qrCode = qrCodeData;
          connectionState.qrGeneratedAt = Date.now();  // Track when generated

          console.log('✅ QR Code ready (valid for 60 seconds)');
          console.log(`📊 QR Data URL length: ${qrCodeData.length} characters\\n`);

          // Clear previous timer
          if (qrRefreshTimer) {
            clearTimeout(qrRefreshTimer);
          }

          // Set expiration warning
          qrRefreshTimer = setTimeout(() => {
            console.log('\\n⚠️  QR Code EXPIRED (60 seconds passed)');
            console.log('   Please reconnect to get new QR code\\n');
            connectionState.qrCode = null;  // Clear expired QR
            connectionState.status = 'qr_expired';
          }, 60000);  // 60 seconds
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const reason = statusCode;

          console.log(`\n⚠️  Connection closed!`);
          console.log(`   Status Code: ${statusCode}`);
          console.log(`   Reason: ${getDisconnectReasonText(statusCode)}`);

          // Check if it's a logout or session invalid
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isSessionInvalid = statusCode === DisconnectReason.connectionClosed ||
            statusCode === DisconnectReason.badSession ||
            statusCode === DisconnectReason.connectionLost;

          if (isLoggedOut) {
            // User explicitly logged out OR WhatsApp auto-kicked us
            console.log('🔴 Logged out (possibly auto-kicked by WhatsApp)');
            console.log('   This can happen if:');
            console.log('   1. Session credentials became invalid');
            console.log('   2. WhatsApp detected suspicious activity');
            console.log('   3. Too many connection attempts');
            console.log('   4. Multi-device limit reached\n');
            console.log('   💡 SOLUTION: Delete session and connect fresh with new pairing code\n');

            // CRITICAL: Close socket first to prevent reconnection attempts
            if (sock) {
              try {
                sock.end();
              } catch (e) {
                console.log('   Socket already closed');
              }
              sock = null;
            }

            // Auto-delete invalid session
            console.log('🗑️  Auto-deleting invalid session...');
            await deleteSession();

            // Reset all state
            connectionState.status = 'disconnected';
            connectionState.error = 'Session invalid. Please reconnect with fresh pairing code.';
            connectionState.phone = null;
            pairingCode = null;
            qrCodeData = null;
            connectionState.pairingCode = null;
            connectionState.qrCode = null;

            console.log('   ✅ Session cleaned - ready for fresh connection\n');
          } else if (isSessionInvalid) {
            // Session is invalid - clean up and allow new connection
            console.log('🔴 Session invalid - cleaning up for fresh connection');

            // Close socket
            if (sock) {
              try {
                sock.end();
              } catch (e) {
                console.log('   Socket already closed');
              }
              sock = null;
            }

            // Auto-delete invalid session
            console.log('🗑️  Auto-deleting invalid session...');
            await deleteSession();

            connectionState.status = 'disconnected';
            connectionState.error = 'Session invalid. Please reconnect.';
            pairingCode = null;
            qrCodeData = null;
            connectionState.pairingCode = null;
            connectionState.qrCode = null;

            console.log('   ✅ Session cleanup complete - ready for new connection\n');
          } else {
            // Temporary disconnect - try to reconnect ONLY if not manually disconnected
            const shouldReconnect = lastDisconnect?.error instanceof Boom;
            console.log(`   Should reconnect: ${shouldReconnect}`);

            if (shouldReconnect && connectionState.status !== 'disconnected') {
              console.log('🔄 Attempting to reconnect in 5 seconds...');
              connectionState.status = 'connecting';
              setTimeout(() => {
                // Double-check state hasn't changed
                if (sock && (connectionState.phone || authMethod === 'qr')) {
                  connectToWhatsApp(connectionState.phone, authMethod);
                } else {
                  console.log('   ⏭️  Reconnect cancelled - socket or state changed');
                }
              }, 5000);
            } else {
              connectionState.status = 'disconnected';
              connectionState.error = 'Connection failed';
              if (sock) {
                try {
                  sock.end();
                } catch (e) { }
                sock = null;
              }
            }
          }
        } else if (connection === 'connecting') {
          connectionState.status = 'connecting';
          console.log('🔄 Connecting to WhatsApp...');
        } else if (connection === 'open') {
          console.log('\n' + '='.repeat(60));
          console.log('✅ WhatsApp Connected Successfully!');
          console.log('🎉 Ready to send fire alerts');
          console.log('='.repeat(60) + '\n');

          connectionState.status = 'connected';
          connectionState.lastActivity = Date.now();
          connectionState.error = null;

          // Clear auth data after successful connection
          pairingCode = null;
          qrCodeData = null;
          connectionState.pairingCode = null;
          connectionState.qrCode = null;
        }
      } catch (err) {
        console.error('❌ Error in connection.update handler:', err);
        connectionState.status = 'error';
        connectionState.error = err.message;
      }
    });

    // Handle message sync
    sock.ev.on('messaging-history.set', ({ messages, chats, contacts, isLatest }) => {
      try {
        console.log(`📥 Syncing... Messages: ${messages.length}, Chats: ${chats.length}`);
        connectionState.status = 'syncing';
        connectionState.syncProgress = isLatest ? 100 : 50;
      } catch (err) {
        console.error('❌ Error in messaging-history.set handler:', err);
      }
    });

    // Handle messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type === 'notify') {
          for (const msg of messages) {
            if (!msg.key.fromMe && msg.message) {
              console.log('📨 Message received:', msg.key.remoteJid);
            }
          }
        }
      } catch (err) {
        console.error('❌ Error in messages.upsert handler:', err);
      }
    });

    return { success: true };
  } catch (err) {
    console.error('❌ Connection error:', err);
    connectionState.status = 'error';
    return { success: false, error: err.message };
  }
}

// Disconnect WhatsApp
async function disconnectWhatsApp() {
  console.log('\n🔌 Disconnecting WhatsApp...');

  try {
    if (sock) {
      // Try to send logout signal first
      try {
        console.log('   Sending logout signal...');
        await sock.logout();
        console.log('   ✅ Logout signal sent');
      } catch (err) {
        console.log('   ⚠️  Logout signal failed (continuing cleanup):', err.message);
        // Continue with cleanup even if logout fails
      }

      // Always close socket connection
      try {
        console.log('   Closing socket connection...');
        sock.end();
        console.log('   ✅ Socket closed');
      } catch (err) {
        console.log('   ⚠️  Socket close failed:', err.message);
      }

      // Clear socket reference
      sock = null;
    } else {
      console.log('   ℹ️  No active socket to disconnect');
    }

    // Reset ALL connection state variables
    console.log('   Resetting connection state...');
    connectionState.status = 'disconnected';
    connectionState.phone = null;
    connectionState.error = null;
    connectionState.lastActivity = null;
    pairingCode = null;
    qrCodeData = null;
    connectionState.pairingCode = null;
    connectionState.qrCode = null;

    // Clear QR refresh timer
    if (qrRefreshTimer) {
      clearTimeout(qrRefreshTimer);
      qrRefreshTimer = null;
    }

    console.log('✅ WhatsApp disconnected successfully\n');
    return { success: true };
  } catch (err) {
    console.error('❌ Error during disconnect:', err);
    // Force cleanup even on error
    sock = null;
    connectionState.status = 'disconnected';
    return { success: false, error: err.message };
  }
}

// Helper function to get disconnect reason text
function getDisconnectReasonText(code) {
  const reasons = {
    [DisconnectReason.connectionClosed]: 'Connection Closed',
    [DisconnectReason.connectionLost]: 'Connection Lost',
    [DisconnectReason.connectionReplaced]: 'Connection Replaced (logged in elsewhere)',
    [DisconnectReason.timedOut]: 'Connection Timed Out',
    [DisconnectReason.loggedOut]: 'Logged Out',
    [DisconnectReason.badSession]: 'Bad Session File',
    [DisconnectReason.restartRequired]: 'Restart Required',
    [DisconnectReason.multideviceMismatch]: 'Multi-device Mismatch'
  };
  return reasons[code] || `Unknown (${code})`;
}

// Delete session
async function deleteSession() {
  console.log('\n🗑️  Deleting WhatsApp session...');

  try {
    // STEP 1: Close socket connection FIRST (most critical!)
    if (sock) {
      console.log('   [1/4] Closing socket connection...');
      try {
        // Try graceful logout first
        await sock.logout().catch(() => {
          console.log('      Logout signal failed (socket may be dead)');
        });

        // Force close socket
        sock.end();
        console.log('      ✅ Socket closed');
      } catch (err) {
        console.log('      ⚠️  Socket close error:', err.message);
      }
      sock = null;
    } else {
      console.log('   [1/4] No active socket');
    }

    // STEP 2: Delete auth directory
    const authDir = path.join(__dirname, 'auth_info');
    console.log('   [2/4] Deleting auth_info directory...');
    if (fs.existsSync(authDir)) {
      try {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log('      ✅ Auth directory deleted');
      } catch (err) {
        console.error('      ❌ Error deleting auth directory:', err.message);
        throw err; // Rethrow if directory deletion fails
      }
    } else {
      console.log('      ℹ️  No auth directory to delete');
    }

    // STEP 3: Reset ALL connection state variables
    console.log('   [3/4] Resetting connection state...');
    sock = null;
    connectionState = {
      status: 'disconnected',
      phone: null,
      syncProgress: 0,
      lastActivity: null,
      authMethod: 'pairing',
      pairingCode: null,
      qrCode: null,
      error: null,
    };
    authMethod = 'pairing';
    pairingCode = null;
    qrCodeData = null;
    console.log('      ✅ State reset complete');

    // STEP 4: Preserve recipients (don't delete!)
    console.log('   [4/4] Preserving recipients...');
    console.log(`      ✅ ${recipients.length} recipients preserved`);
    // recipients = []; // NEVER DO THIS!

    console.log('\n✅ Session deleted successfully!\n');
    console.log('   📋 Summary:');
    console.log('      • Socket closed and cleaned');
    console.log('      • Auth files removed');
    console.log('      • State reset to fresh');
    console.log(`      • ${recipients.length} recipients preserved`);
    console.log('\n   🆕 Ready for new connection with different number\n');

    return { success: true };
  } catch (err) {
    console.error('\n❌ Error during session deletion:', err);
    console.log('   Forcing cleanup...\n');

    // Force cleanup even on error
    sock = null;
    connectionState.status = 'disconnected';
    pairingCode = null;
    qrCodeData = null;

    return { success: false, error: err.message };
  }
  console.log('   Recipients list preserved\n');
}

// ==================== API ROUTES ====================

// Get connection status
app.get('/api/whatsapp/status', (req, res) => {
  const hasSession = fs.existsSync(path.join(__dirname, 'auth_info'));
  res.json({
    ...connectionState,
    pairingCode: pairingCode,
    qrCode: qrCodeData,
    hasSession: hasSession,
    connected: connectionState.status === 'connected',
    recipientCount: recipients.length,
  });
});

// Start WhatsApp connection
app.post('/api/whatsapp/start', async (req, res) => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📞 API /start called');
    console.log('='.repeat(70));
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { phoneNumber, method = 'pairing' } = req.body;

    // Validation
    if (method === 'pairing') {
      if (!phoneNumber) {
        console.log('❌ Validation failed: Phone number required for pairing method');
        return res.status(400).json({
          success: false,
          error: 'Phone number required for pairing code method'
        });
      }

      // Validate phone format (should start with country code, e.g., 628xxx)
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        console.log('❌ Validation failed: Invalid phone number length');
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format. Use format: 628xxxxxxxxx (10-15 digits)'
        });
      }

      console.log(`✅ Validation passed: ${cleanPhone}`);
    }

    // Check if already connected
    if (sock && connectionState.status === 'connected') {
      console.log('⚠️  Already connected to WhatsApp');
      return res.json({
        success: true,
        message: 'Already connected',
        status: connectionState.status,
        phone: connectionState.phone
      });
    }

    // Check if connection in progress
    if (connectionState.status === 'connecting') {
      console.log('⚠️  Connection already in progress');
      return res.json({
        success: false,
        error: 'Connection already in progress. Please wait.'
      });
    }

    console.log(`🚀 Starting connection with method: ${method}`);
    const result = await connectToWhatsApp(phoneNumber, method);

    console.log('✅ Connection result:', result.success ? 'SUCCESS' : 'FAILED');
    if (!result.success) {
      console.log('   Error:', result.error);
    }
    console.log('='.repeat(70) + '\n');

    res.json(result);
  } catch (err) {
    console.error('❌ Error in /start endpoint:', err);
    console.log('='.repeat(70) + '\n');
    res.status(500).json({
      success: false,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Connect endpoint (alias for start)
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    console.log('📞 API /connect called with body:', req.body);
    const { phoneNumber, method = 'pairing' } = req.body;

    // Validate based on method
    if (method === 'pairing' && !phoneNumber) {
      return res.status(400).json({ error: 'Phone number required for pairing code method' });
    }

    const result = await connectToWhatsApp(phoneNumber, method);
    console.log('✅ connectToWhatsApp result:', result);
    res.json(result);
  } catch (err) {
    console.error('❌ Error in /connect endpoint:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Stop WhatsApp connection
app.post('/api/whatsapp/stop', async (req, res) => {
  try {
    console.log('\n📴 API /stop called - Disconnecting WhatsApp...');

    // Check if there's a connection to stop
    if (!sock && connectionState.status === 'disconnected') {
      console.log('ℹ️  Already disconnected');
      return res.json({
        success: true,
        message: 'Already disconnected'
      });
    }

    const result = await disconnectWhatsApp();
    console.log('✅ Disconnect result:', result.success ? 'SUCCESS' : 'FAILED');
    res.json(result);
  } catch (err) {
    console.error('❌ Error in /stop endpoint:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Delete session
app.post('/api/whatsapp/delete-session', async (req, res) => {
  try {
    console.log('\n🗑️  API /delete-session called');

    // First disconnect if connected
    if (sock || connectionState.status === 'connected') {
      console.log('   Disconnecting active connection first...');
      await disconnectWhatsApp();
    }

    // Then delete session
    const result = await deleteSession();

    if (result.success) {
      console.log('✅ Session deletion: SUCCESS');
      res.json({
        success: true,
        message: 'Session deleted successfully',
        recipientsPreserved: recipients.length
      });
    } else {
      console.log('❌ Session deletion: FAILED');
      res.status(500).json(result);
    }
  } catch (err) {
    console.error('❌ Error in /delete-session endpoint:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get recipients
app.get('/api/whatsapp/recipients', (req, res) => {
  res.json({ recipients });
});

// Add recipient
app.post('/api/whatsapp/recipients', (req, res) => {
  const { phoneNumber, name } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

  // Check if already exists
  const exists = recipients.find(r => r.phoneNumber === cleanPhone);
  if (exists) {
    return res.status(400).json({ error: 'Phone number already added' });
  }

  const recipient = {
    id: Date.now().toString(),
    phoneNumber: cleanPhone,
    name: name || cleanPhone,
    addedAt: Date.now(),
  };

  recipients.push(recipient);
  saveRecipients();
  res.json({ success: true, recipient });
});

// Remove recipient
app.delete('/api/whatsapp/recipients/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = recipients.length;
  recipients = recipients.filter((r) => r.id !== id);

  if (recipients.length < initialLength) {
    saveRecipients();
    res.json({ success: true, message: 'Recipient removed' });
  } else {
    res.status(404).json({ error: 'Recipient not found' });
  }
});

// Test send message
app.post('/api/whatsapp/test-send', async (req, res) => {
  const { recipient } = req.body;

  if (!sock || connectionState.status !== 'connected') {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }

  const success = await sendSafeStatus(recipient);
  res.json({ success });
});

// Get latest sensor data
app.get('/api/whatsapp/sensor-status', (req, res) => {
  if (!lastSensorData) {
    return res.json({
      success: false,
      message: 'No sensor data available yet'
    });
  }

  res.json({
    success: true,
    data: lastSensorData,
    timestamp: new Date(),
    mqttConnected: mqttClient?.connected || false,
    whatsappConnected: connectionState.status === 'connected'
  });
});

// ==================== TWILIO VOICE CALL ENDPOINTS ====================

// Get emergency call numbers
app.get('/api/voice-call/numbers', (req, res) => {
  res.json({
    success: true,
    numbers: emergencyCallNumbers,
    twilioEnabled,
    cooldown: VOICE_CALL_COOLDOWN / 1000
  });
});

// Add emergency call number
app.post('/api/voice-call/numbers', (req, res) => {
  const { phoneNumber, name } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  if (!twilioEnabled) {
    return res.status(400).json({ error: 'Twilio not configured. Please add credentials to .env file' });
  }

  // Clean and validate phone number (should include country code)
  let cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');

  // Add + if not present and starts with number
  if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone;
  }

  // Check if already exists
  const exists = emergencyCallNumbers.find(n => n.phoneNumber === cleanPhone);
  if (exists) {
    return res.status(400).json({ error: 'Phone number already added' });
  }

  const callNumber = {
    id: Date.now().toString(),
    phoneNumber: cleanPhone,
    name: name || cleanPhone,
    addedAt: Date.now(),
  };

  emergencyCallNumbers.push(callNumber);
  saveEmergencyCallNumbers();

  console.log(`📞 Added emergency call number: ${callNumber.name} (${callNumber.phoneNumber})`);

  res.json({ success: true, number: callNumber });
});

// Remove emergency call number
app.delete('/api/voice-call/numbers/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = emergencyCallNumbers.length;
  emergencyCallNumbers = emergencyCallNumbers.filter((n) => n.id !== id);

  if (emergencyCallNumbers.length < initialLength) {
    saveEmergencyCallNumbers();
    console.log(`📞 Removed emergency call number: ${id}`);
    res.json({ success: true, message: 'Emergency call number removed' });
  } else {
    res.status(404).json({ error: 'Number not found' });
  }
});

// Test emergency call
app.post('/api/voice-call/test', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!twilioEnabled || !twilioClient) {
    return res.status(400).json({ error: 'Twilio not enabled' });
  }

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  try {
    const toNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    const call = await twilioClient.calls.create({
      to: toNumber,
      from: TWILIO_CONFIG.phoneNumber,
      url: TWILIO_CONFIG.voiceUrl,
      statusCallback: `http://localhost:${process.env.WA_PORT || 3001}/api/twilio/call-status`,
    });

    console.log(`📞 Test call initiated to ${toNumber}`);
    console.log(`   Call SID: ${call.sid}`);

    res.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: toNumber,
      from: TWILIO_CONFIG.phoneNumber
    });
  } catch (err) {
    console.error('❌ Test call failed:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }
});

// Twilio webhook for call status updates
app.post('/api/twilio/call-status', (req, res) => {
  const { CallSid, CallStatus, To, From } = req.body;

  console.log(`📞 Call Status Update:`);
  console.log(`   SID: ${CallSid}`);
  console.log(`   Status: ${CallStatus}`);
  console.log(`   To: ${To}`);
  console.log(`   From: ${From}`);

  res.sendStatus(200);
});

// Get Twilio configuration status
app.get('/api/voice-call/config', (req, res) => {
  res.json({
    enabled: twilioEnabled,
    configured: !!(TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken && TWILIO_CONFIG.phoneNumber),
    phoneNumber: twilioEnabled ? TWILIO_CONFIG.phoneNumber : null,
    voiceUrl: TWILIO_CONFIG.voiceUrl,
    emergencyNumbersCount: emergencyCallNumbers.length
  });
});

// Send current sensor status to specific recipient
app.post('/api/whatsapp/send-sensor-status', async (req, res) => {
  const { recipient } = req.body;

  if (!sock || connectionState.status !== 'connected') {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }

  if (!recipient) {
    return res.status(400).json({ error: 'Recipient required' });
  }

  if (!lastSensorData) {
    return res.status(400).json({ error: 'No sensor data available' });
  }

  try {
    const { id, t, h, gasA, gasMv, gasD, flame, alarm } = lastSensorData;

    let message = `*📊 STATUS SENSOR TERKINI*\n\n`;
    message += `🆔 Device: \`${id}\`\n\n`;
    message += `*Pembacaan Sensor:*\n`;
    message += `🌡️ Suhu: *${t}°C*\n`;
    message += `💧 Kelembapan: *${h}%*\n`;
    message += `☁️ Gas ADC: *${gasA}* (${gasMv}mV)\n`;
    message += `🔥 Flame: *${flame ? 'Terdeteksi ⚠️' : 'Normal ✓'}*\n`;
    message += `💨 Gas Digital: *${gasD ? 'Bahaya ⚠️' : 'Aman ✓'}*\n`;
    message += `🚨 Alarm: *${alarm ? 'AKTIF ⚠️' : 'Tidak Aktif ✓'}*\n\n`;

    // Status keseluruhan
    if (flame || gasD || alarm) {
      message += `⚠️ *STATUS: PERINGATAN*\n`;
    } else {
      message += `✅ *STATUS: AMAN*\n`;
    }

    message += `\n⏰ ${new Date().toLocaleString('id-ID')}`;

    const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });

    res.json({ success: true, message: 'Sensor status sent successfully' });
  } catch (err) {
    console.error('Failed to send sensor status:', err);
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

// ==================== START SERVER ====================

const PORT = process.env.WA_PORT || 3001;

// Health check endpoint (before server start)
app.get('/health', (req, res) => {
  const hasSession = fs.existsSync(path.join(__dirname, 'auth_info'));
  const uptime = process.uptime();

  res.json({
    status: 'ok',
    service: 'whatsapp-baileys-server',
    port: PORT,
    uptime: Math.floor(uptime),
    connection: {
      status: connectionState.status,
      hasSession,
      connected: connectionState.status === 'connected',
      phone: connectionState.phone,
    },
    recipients: recipients.length,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Baileys Server',
    version: '2.0.0',
    description: 'Fire Detection System - WhatsApp Integration',
    endpoints: {
      health: '/health',
      status: '/api/whatsapp/status',
      start: 'POST /api/whatsapp/start',
      stop: 'POST /api/whatsapp/stop',
      deleteSession: 'POST /api/whatsapp/delete-session',
      recipients: '/api/whatsapp/recipients',
    }
  });
});

app.listen(PORT, async () => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 WhatsApp Baileys Server - STARTED`);
  console.log(`${'='.repeat(70)}`);
  console.log(`📡 Server URL: http://localhost:${PORT}`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 API Status: http://localhost:${PORT}/api/whatsapp/status`);
  console.log(`${'='.repeat(70)}\n`);

  // Load saved data
  console.log('📋 Loading saved data...');
  loadRecipients();
  loadEmergencyCallNumbers();
  console.log(`   ✅ ${recipients.length} recipients loaded`);
  console.log(`   ✅ ${emergencyCallNumbers.length} emergency numbers loaded\n`);

  // Initialize MQTT
  console.log('🔌 Initializing MQTT connection...');
  initMQTT();

  // Check for existing session and auto-reconnect
  const hasSession = fs.existsSync(path.join(__dirname, 'auth_info'));
  if (hasSession) {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 EXISTING SESSION DETECTED');
    console.log('='.repeat(70));
    console.log('📁 Session file: auth_info/ exists');
    console.log('� Auto-reconnecting to WhatsApp...\n');

    try {
      // Auto-reconnect with existing session (no phone number needed)
      const result = await connectToWhatsApp(null, 'pairing');
      if (result.success) {
        console.log('✅ Auto-reconnect: SUCCESS');
      } else {
        console.log('⚠️  Auto-reconnect: FAILED');
        console.log('   Error:', result.error);
        console.log('   You may need to scan QR code or enter pairing code again');
      }
    } catch (err) {
      console.log('⚠️  Auto-reconnect error:', err.message);
      console.log('   Session may be invalid. Delete session and reconnect.');
    }
    console.log('='.repeat(70) + '\n');
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('ℹ️  NO EXISTING SESSION');
    console.log('='.repeat(70));
    console.log('📝 To connect WhatsApp:');
    console.log('   1. Open dashboard: http://localhost:5173');
    console.log('   2. Go to "WhatsApp Integration" page');
    console.log('   3. Choose method: QR Code or Pairing Code');
    console.log('   4. Follow on-screen instructions');
    console.log('='.repeat(70) + '\n');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received - shutting down gracefully...');
  console.log('Call stack:', new Error().stack);
  await disconnectWhatsApp();
  if (mqttClient) mqttClient.end();
  process.exit(0);
});

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('\n' + '='.repeat(70));
  console.error('💥 UNCAUGHT EXCEPTION');
  console.error('='.repeat(70));
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('='.repeat(70) + '\n');
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n' + '='.repeat(70));
  console.error('💥 UNHANDLED PROMISE REJECTION');
  console.error('='.repeat(70));
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('='.repeat(70) + '\n');
  // Don't exit - keep server running
});
