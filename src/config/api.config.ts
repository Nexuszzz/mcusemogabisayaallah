/**
 * API Configuration
 * Automatically detects production vs development environment
 * 
 * Production Domains:
 * - Frontend: https://latom.flx.web.id
 * - Backend API: https://api.latom.flx.web.id
 */

// Runtime detection function - called when needed
const getHostname = () => typeof window !== 'undefined' ? window.location.hostname : 'localhost';

// Check if running in production (not localhost)
const isProduction = () => {
  const hostname = getHostname();
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
};

// Check if using domain (for HTTPS)
const isDomainAccess = () => {
  const hostname = getHostname();
  return hostname === 'latom.flx.web.id';
};

// Dynamic API Domain based on current access
const getApiDomain = () => isDomainAccess() ? 'api.latom.flx.web.id' : '3.27.0.139:8080';
const useHttps = () => isDomainAccess();

// GETTER FUNCTIONS - computed fresh every call
export const getApiConfig = () => {
  if (!isProduction()) {
    return {
      API_BASE: 'http://localhost:8080',
      WS_URL: 'ws://localhost:8080/ws',
      VIDEO_API: 'http://localhost:8080/api/video',
      WA_API: 'http://localhost:3001/api/whatsapp',
      VOICE_CALL_API: 'http://localhost:3002/api/voice-call',
    };
  }
  
  const apiDomain = getApiDomain();
  const https = useHttps();
  return {
    API_BASE: `${https ? 'https' : 'http'}://${apiDomain}`,
    WS_URL: `${https ? 'wss' : 'ws'}://${apiDomain}/ws`,
    VIDEO_API: `${https ? 'https' : 'http'}://${apiDomain}/api/video`,
    WA_API: `${https ? 'https' : 'http'}://${apiDomain}/api/whatsapp`,
    VOICE_CALL_API: `${https ? 'https' : 'http'}://${apiDomain}/api/voice-call`,
  };
};

// For backward compatibility - these will be evaluated at runtime
export const API_CONFIG = getApiConfig();

// Individual exports - use getters for dynamic values
export const getWsUrl = () => getApiConfig().WS_URL;
export const getApiBaseUrl = () => getApiConfig().API_BASE;
export const getVideoApiUrl = () => getApiConfig().VIDEO_API;
export const getWaApiUrl = () => getApiConfig().WA_API;
export const getVoiceCallApiUrl = () => getApiConfig().VOICE_CALL_API;

// Static exports (for backward compatibility, but prefer getters)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || getApiConfig().API_BASE;
export const WS_URL = import.meta.env.VITE_WS_URL || getApiConfig().WS_URL;
export const VIDEO_API_URL = import.meta.env.VITE_VIDEO_API_URL || getApiConfig().VIDEO_API;
export const WA_API_URL = import.meta.env.VITE_WA_API_URL || getApiConfig().WA_API;
export const VOICE_CALL_API_URL = import.meta.env.VITE_VOICE_CALL_API_URL || getApiConfig().VOICE_CALL_API;

// Log configuration
console.log(`🌐 Running on: ${getHostname()}`);
console.log(`📡 API Config:`, getApiConfig());
