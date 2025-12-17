/**
 * API Configuration
 * Automatically detects production vs development environment
 */

// Check if running in production (Vercel or other production host)
const isProduction = 
  typeof window !== 'undefined' && 
  (window.location.hostname.includes('vercel.app') ||
   window.location.hostname.includes('netlify.app') ||
   (window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.startsWith('192.168') &&
    !window.location.hostname.startsWith('10.')));

// EC2 Server Configuration
const EC2_HOST = '3.27.0.139';
const EC2_PORT = '8080';

// Production URLs (EC2 Server) - ALL services via EC2 proxy
const PRODUCTION_CONFIG = {
  API_BASE: `http://${EC2_HOST}:${EC2_PORT}`,
  WS_URL: `ws://${EC2_HOST}:${EC2_PORT}/ws`,
  VIDEO_API: `http://${EC2_HOST}:${EC2_PORT}/api/video`,
  WA_API: `http://${EC2_HOST}:${EC2_PORT}/api/whatsapp`,      // Via EC2 proxy
  VOICE_CALL_API: `http://${EC2_HOST}:${EC2_PORT}/api/voice-call`, // Via EC2 proxy
};

// Development URLs (localhost services)
const DEVELOPMENT_CONFIG = {
  API_BASE: 'http://localhost:8080',
  WS_URL: 'ws://localhost:8080/ws',
  VIDEO_API: 'http://localhost:8080/api/video',
  WA_API: 'http://localhost:3001/api/whatsapp',      // Direct to local WhatsApp server
  VOICE_CALL_API: 'http://localhost:3002/api/voice-call', // Direct to local Voice server
};

// Export the appropriate config based on environment
export const API_CONFIG = isProduction ? PRODUCTION_CONFIG : DEVELOPMENT_CONFIG;

// Individual exports for convenience
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || API_CONFIG.API_BASE;
export const WS_URL = import.meta.env.VITE_WS_URL || API_CONFIG.WS_URL;
export const VIDEO_API_URL = import.meta.env.VITE_VIDEO_API_URL || API_CONFIG.VIDEO_API;
export const WA_API_URL = import.meta.env.VITE_WA_API_URL || API_CONFIG.WA_API;
export const VOICE_CALL_API_URL = import.meta.env.VITE_VOICE_CALL_API_URL || API_CONFIG.VOICE_CALL_API;

// Debug logging for both environments
console.log('🔧 Environment Detection:', {
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'server-side',
  isProduction,
  NODE_ENV: import.meta.env.NODE_ENV,
  selectedConfig: isProduction ? 'PRODUCTION (EC2)' : 'DEVELOPMENT (localhost)'
});

// Log configuration for debugging
console.log('🔧 API Config:', API_CONFIG); else {
  console.log('🚀 API Config (Production):', API_CONFIG);
}
