/**
 * WhatsApp Integration Component using Go-WhatsApp (GOWA) REST API
 * 
 * This component integrates with aldinokemal/go-whatsapp-web-multidevice
 * Supports: QR Code & Pairing Code authentication
 * 
 * GOWA API Endpoints (default port 3000):
 * - GET  /app/login          - QR Code login
 * - GET  /app/login-with-code?phone=xxx - Pairing code login
 * - GET  /app/logout         - Logout
 * - GET  /app/reconnect      - Reconnect
 * - GET  /app/devices        - Get connected devices
 * - POST /send/message       - Send text message
 * - POST /send/image         - Send image
 * - POST /send/file          - Send file
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Key,
  Power,
  PowerOff,
  Trash2,
  UserPlus,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Users,
  Phone,
  QrCode,
  Scan,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { getGowaApiUrl } from '../config/api.config';

type AuthMethod = 'qr' | 'pairing';

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'syncing' | 'connected' | 'error';
  phone: string | null;
  syncProgress: number;
  lastActivity: number | null;
  authMethod: AuthMethod;
  pairingCode: string | null;
  qrCode: string | null;
  hasSession: boolean;
  deviceName?: string;
}

interface Recipient {
  id: string;
  phoneNumber: string;
  name: string;
  addedAt: number;
}

interface GowaDevice {
  device: string;
  name: string;
}

export default function WhatsAppIntegration() {
  const { preferences } = useTelemetryStore();
  const isDark = preferences.theme === 'dark';
  
  // Get API URL dynamically - no hardcoded URLs
  const GOWA_API = getGowaApiUrl();
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    phone: null,
    syncProgress: 0,
    lastActivity: null,
    authMethod: 'pairing',
    pairingCode: null,
    qrCode: null,
    hasSession: false,
  });
  const [authMethod, setAuthMethod] = useState<AuthMethod>('pairing');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [newRecipient, setNewRecipient] = useState({ phone: '', name: '' });
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devices, setDevices] = useState<GowaDevice[]>([]);

  // Phone number validation (Indonesian format)
  const validatePhoneNumber = (phone: string): boolean => {
    const regex = /^628\d{8,11}$/;
    return regex.test(phone.replace(/[^0-9]/g, ''));
  };

  // Format phone number for GOWA API (628xxx -> 628xxx@s.whatsapp.net)
  const formatPhoneForGowa = (phone: string): string => {
    const clean = phone.replace(/[^0-9]/g, '');
    return `${clean}@s.whatsapp.net`;
  };

  // Check GOWA connection status
  const checkConnectionStatus = useCallback(async () => {
    try {
      const res = await fetch(`${GOWA_API}/app/devices`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.code === 'SUCCESS' && data.results?.length > 0) {
          setConnectionState(prev => ({
            ...prev,
            status: 'connected',
            hasSession: true,
            phone: data.results[0]?.name || 'Connected',
            deviceName: data.results[0]?.device,
          }));
          setDevices(data.results);
          setError(null);
        } else {
          setConnectionState(prev => ({
            ...prev,
            status: 'disconnected',
            hasSession: false,
            phone: null,
          }));
        }
      } else {
        setConnectionState(prev => ({
          ...prev,
          status: 'disconnected',
          hasSession: false,
        }));
      }
    } catch (err) {
      console.error('Status check error:', err);
      setConnectionState(prev => ({
        ...prev,
        status: 'error',
      }));
    }
  }, [GOWA_API]);

  // Poll connection status
  useEffect(() => {
    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 5000);
    return () => clearInterval(interval);
  }, [checkConnectionStatus]);

  // Load recipients from server on mount
  useEffect(() => {
    async function loadRecipientsFromServer() {
      try {
        const res = await fetch(`${getProxyApiUrl()}/api/recipients`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.recipients?.length > 0) {
            // Convert server format to frontend format
            const converted = data.recipients.map((r: { id: string; phone: string; name: string; enabled: boolean; createdAt: string }) => ({
              id: r.id,
              phoneNumber: r.phone,
              name: r.name,
              addedAt: new Date(r.createdAt).getTime(),
              enabled: r.enabled
            }));
            setRecipients(converted);
            localStorage.setItem('gowa_recipients', JSON.stringify(converted));
            console.log(`✅ Loaded ${converted.length} recipients from server`);
          }
        }
      } catch (e) {
        console.log('Failed to load from server, using localStorage');
        // Fallback to localStorage
        const saved = localStorage.getItem('gowa_recipients');
        if (saved) {
          try {
            setRecipients(JSON.parse(saved));
          } catch (err) {
            console.error('Failed to load recipients:', err);
          }
        }
      }
    }
    loadRecipientsFromServer();
  }, []);

  // Helper function to get proxy API URL
  function getProxyApiUrl(): string {
    if (typeof window === 'undefined') return 'http://localhost:8080';
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    if (hostname === 'latom.flx.web.id') {
      return 'https://api.latom.flx.web.id';
    }
    return 'http://3.27.11.106:8080';
  }

  // Login with QR Code
  async function handleQRLogin() {
    setError(null);
    setLoading(true);
    setConnectionState(prev => ({ ...prev, status: 'connecting', qrCode: null }));
    
    try {
      const res = await fetch(`${GOWA_API}/app/login`, {
        headers: { 'Accept': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.code === 'SUCCESS' && data.results?.qr_link) {
        setConnectionState(prev => ({
          ...prev,
          status: 'connecting',
          qrCode: data.results.qr_link,
          authMethod: 'qr',
        }));
        setSuccess('QR Code generated! Scan dengan WhatsApp HP Anda');
        pollForConnection();
      } else if (data.code === 'SUCCESS' && data.results?.status === 'already connected') {
        setConnectionState(prev => ({
          ...prev,
          status: 'connected',
          hasSession: true,
        }));
        setSuccess('Sudah terhubung ke WhatsApp!');
      } else {
        throw new Error(data.message || 'Failed to generate QR code');
      }
    } catch (err: any) {
      console.error('QR Login error:', err);
      setError(`Gagal login QR: ${err.message}`);
      setConnectionState(prev => ({ ...prev, status: 'error' }));
    } finally {
      setLoading(false);
    }
  }

  // Login with Pairing Code
  async function handlePairingLogin() {
    setError(null);
    
    if (!phoneNumber) {
      setError('Masukkan nomor WhatsApp terlebih dahulu!');
      return;
    }
    
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (!validatePhoneNumber(cleanPhone)) {
      setError('Format nomor salah! Gunakan format: 628xxxxxxxxxx');
      return;
    }
    
    setLoading(true);
    setConnectionState(prev => ({ ...prev, status: 'connecting', pairingCode: null }));
    
    try {
      const res = await fetch(`${GOWA_API}/app/login-with-code?phone=${cleanPhone}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.code === 'SUCCESS' && data.results?.pair_code) {
        setConnectionState(prev => ({
          ...prev,
          status: 'connecting',
          pairingCode: data.results.pair_code,
          authMethod: 'pairing',
        }));
        setSuccess(`Pairing Code: ${data.results.pair_code} - Masukkan di WhatsApp > Linked Devices`);
        pollForConnection();
      } else if (data.code === 'SUCCESS' && data.results?.status === 'already connected') {
        setConnectionState(prev => ({
          ...prev,
          status: 'connected',
          hasSession: true,
        }));
        setSuccess('Sudah terhubung ke WhatsApp!');
      } else {
        throw new Error(data.message || 'Failed to generate pairing code');
      }
    } catch (err: any) {
      console.error('Pairing Login error:', err);
      setError(`Gagal login pairing: ${err.message}`);
      setConnectionState(prev => ({ ...prev, status: 'error' }));
    } finally {
      setLoading(false);
    }
  }

  // Poll for successful connection after QR/Pairing
  function pollForConnection() {
    let attempts = 0;
    const maxAttempts = 60;
    
    const poll = setInterval(async () => {
      attempts++;
      
      try {
        const res = await fetch(`${GOWA_API}/app/devices`, {
          headers: { 'Accept': 'application/json' }
        });
        
        const data = await res.json();
        
        if (data.code === 'SUCCESS' && data.results?.length > 0) {
          clearInterval(poll);
          setConnectionState(prev => ({
            ...prev,
            status: 'connected',
            hasSession: true,
            phone: data.results[0]?.name || 'Connected',
            qrCode: null,
            pairingCode: null,
          }));
          setDevices(data.results);
          setSuccess('✅ WhatsApp berhasil terhubung!');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(poll);
        setError('Timeout - silakan coba lagi');
        setConnectionState(prev => ({ ...prev, status: 'disconnected' }));
      }
    }, 2000);
  }

  // Logout
  async function handleLogout() {
    if (!confirm('⚠️ Logout dari WhatsApp?\n\nAnda perlu scan QR/Pairing ulang untuk terhubung kembali.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${GOWA_API}/app/logout`, {
        headers: { 'Accept': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.code === 'SUCCESS') {
        setConnectionState({
          status: 'disconnected',
          phone: null,
          syncProgress: 0,
          lastActivity: null,
          authMethod: 'pairing',
          pairingCode: null,
          qrCode: null,
          hasSession: false,
        });
        setDevices([]);
        setSuccess('Berhasil logout dari WhatsApp');
      } else {
        throw new Error(data.message || 'Logout failed');
      }
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(`Gagal logout: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Reconnect
  async function handleReconnect() {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${GOWA_API}/app/reconnect`, {
        headers: { 'Accept': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.code === 'SUCCESS') {
        setSuccess('Reconnecting ke WhatsApp...');
        setTimeout(checkConnectionStatus, 2000);
      } else {
        throw new Error(data.message || 'Reconnect failed');
      }
    } catch (err: any) {
      console.error('Reconnect error:', err);
      setError(`Gagal reconnect: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Add recipient - directly to backend server
  async function handleAddRecipient() {
    if (!newRecipient.phone) {
      setError('Masukkan nomor WhatsApp!');
      return;
    }
    
    const cleanPhone = newRecipient.phone.replace(/[^0-9]/g, '');
    if (!validatePhoneNumber(cleanPhone)) {
      setError('Format nomor salah! Gunakan format: 628xxxxxxxxxx');
      return;
    }
    
    setLoading(true);
    try {
      // Add directly to backend server
      const res = await fetch(`${getProxyApiUrl()}/api/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRecipient.name || cleanPhone,
          phone: cleanPhone,
          enabled: true
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Add to local state
        const recipient: Recipient = {
          id: data.recipient?.id || Date.now().toString(),
          phoneNumber: cleanPhone,
          name: newRecipient.name || cleanPhone,
          addedAt: Date.now(),
        };
        
        const updated = [...recipients, recipient];
        setRecipients(updated);
        localStorage.setItem('gowa_recipients', JSON.stringify(updated));
        
        setNewRecipient({ phone: '', name: '' });
        setShowAddRecipient(false);
        setSuccess(`✅ Penerima ${recipient.name} ditambahkan dan tersimpan ke server`);
      } else {
        throw new Error(data.error || 'Gagal menambahkan recipient');
      }
    } catch (err: any) {
      console.error('Add recipient error:', err);
      setError(`Gagal menambahkan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Remove recipient - directly from backend server
  async function handleRemoveRecipient(id: string) {
    if (!confirm('Hapus penerima ini?')) return;
    
    try {
      // Remove from backend
      const res = await fetch(`${getProxyApiUrl()}/api/recipients/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        const updated = recipients.filter(r => r.id !== id);
        setRecipients(updated);
        localStorage.setItem('gowa_recipients', JSON.stringify(updated));
        setSuccess('✅ Penerima berhasil dihapus');
      } else {
        // Still remove from local if backend fails
        const updated = recipients.filter(r => r.id !== id);
        setRecipients(updated);
        localStorage.setItem('gowa_recipients', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Failed to delete from server:', e);
      // Remove locally anyway
      const updated = recipients.filter(r => r.id !== id);
      setRecipients(updated);
      localStorage.setItem('gowa_recipients', JSON.stringify(updated));
    }
  }

  // Send test message
  async function handleTestSend(recipient: Recipient) {
    if (connectionState.status !== 'connected') {
      setError('WhatsApp belum terhubung!');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${GOWA_API}/send/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          phone: formatPhoneForGowa(recipient.phoneNumber),
          message: `🔥 *Test Alert - Fire Detection System*\n\nIni adalah pesan test dari sistem deteksi kebakaran.\n\n📅 ${new Date().toLocaleString('id-ID')}\n✅ Sistem berfungsi dengan baik`,
        }),
      });
      
      const data = await res.json();
      
      if (data.code === 'SUCCESS') {
        setSuccess(`✅ Pesan test berhasil dikirim ke ${recipient.name}`);
      } else {
        throw new Error(data.message || 'Failed to send message');
      }
    } catch (err: any) {
      console.error('Send error:', err);
      setError(`Gagal kirim pesan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Get status config for UI
  const getStatusConfig = () => {
    switch (connectionState.status) {
      case 'connected':
        return {
          color: 'text-green-400',
          bg: 'bg-green-500/10',
          border: 'border-green-500/50',
          icon: CheckCircle2,
          text: 'WhatsApp Connected',
          pulse: true,
        };
      case 'connecting':
        return {
          color: 'text-yellow-400',
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/50',
          icon: Loader2,
          text: 'Connecting...',
          pulse: false,
        };
      case 'syncing':
        return {
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/50',
          icon: Loader2,
          text: 'Syncing...',
          pulse: false,
        };
      case 'error':
        return {
          color: 'text-red-400',
          bg: 'bg-red-500/10',
          border: 'border-red-500/50',
          icon: XCircle,
          text: 'Connection Error',
          pulse: false,
        };
      default:
        return {
          color: 'text-gray-400',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/50',
          icon: PowerOff,
          text: 'Disconnected',
          pulse: false,
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className={`min-h-screen p-6 transition-colors ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
              <Smartphone className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                WhatsApp Integration
              </h1>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                Go-WhatsApp API • QR Code / Pairing Code • Fire Alerts
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-3 px-6 py-3 rounded-xl border ${statusConfig.bg} ${statusConfig.border} backdrop-blur-sm transition-all duration-300`}>
            {statusConfig.pulse && (
              <div className="relative">
                <div className="absolute inset-0 animate-ping bg-green-400 rounded-full opacity-30"></div>
                <div className="relative w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
            )}
            <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${connectionState.status === 'connecting' ? 'animate-spin' : ''}`} />
            <span className={`font-semibold ${statusConfig.color}`}>
              {statusConfig.text}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300 text-sm whitespace-pre-wrap">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-300">{success}</p>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-300">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Connection Panel */}
          <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-2xl ${
            isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Key className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Connection Control
              </h2>
            </div>

            {connectionState.status === 'disconnected' && (
              <div className="space-y-4">
                {/* Auth Method Selector */}
                <div>
                  <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Authentication Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAuthMethod('qr')}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        authMethod === 'qr'
                          ? 'bg-purple-500/20 border-purple-500 shadow-lg'
                          : isDark ? 'bg-gray-900/50 border-gray-600/50 hover:border-gray-500' : 'bg-gray-50 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <QrCode className={`w-8 h-8 ${authMethod === 'qr' ? 'text-purple-400' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${authMethod === 'qr' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        QR Code
                      </span>
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Scan dengan HP</span>
                    </button>

                    <button
                      onClick={() => setAuthMethod('pairing')}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        authMethod === 'pairing'
                          ? 'bg-green-500/20 border-green-500 shadow-lg'
                          : isDark ? 'bg-gray-900/50 border-gray-600/50 hover:border-gray-500' : 'bg-gray-50 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Scan className={`w-8 h-8 ${authMethod === 'pairing' ? 'text-green-400' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${authMethod === 'pairing' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Pairing Code
                      </span>
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>8 digit code</span>
                    </button>
                  </div>
                </div>

                {/* Phone Input for Pairing */}
                {authMethod === 'pairing' && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Nomor WhatsApp
                    </label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="628123456789"
                      className={`w-full px-4 py-3 rounded-xl border ${
                        isDark 
                          ? 'bg-gray-900/50 border-gray-600 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-green-500`}
                    />
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      Format: 628xxxxxxxxxx (tanpa + atau spasi)
                    </p>
                  </div>
                )}

                {/* Connect Button */}
                <button
                  onClick={authMethod === 'qr' ? handleQRLogin : handlePairingLogin}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Power className="w-5 h-5" />
                  )}
                  {loading ? 'Connecting...' : 'Connect WhatsApp'}
                </button>
              </div>
            )}

            {/* QR Code Display */}
            {connectionState.status === 'connecting' && connectionState.qrCode && (
              <div className="text-center space-y-4">
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Scan QR Code dengan WhatsApp di HP Anda
                </p>
                <div className="inline-block p-4 bg-white rounded-xl">
                  <img 
                    src={connectionState.qrCode} 
                    alt="WhatsApp QR Code" 
                    className="w-64 h-64"
                  />
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  WhatsApp {'>'} Linked Devices {'>'} Link a Device
                </p>
              </div>
            )}

            {/* Pairing Code Display */}
            {connectionState.status === 'connecting' && connectionState.pairingCode && (
              <div className="text-center space-y-4">
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Masukkan kode ini di WhatsApp HP Anda
                </p>
                <div className="inline-block px-8 py-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl border border-green-500/30">
                  <span className="text-4xl font-mono font-bold text-green-400 tracking-widest">
                    {connectionState.pairingCode}
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  WhatsApp {'>'} Linked Devices {'>'} Link a Device {'>'} Link with phone number
                </p>
              </div>
            )}

            {/* Connected State */}
            {connectionState.status === 'connected' && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-center gap-3">
                    <Wifi className="w-6 h-6 text-green-400" />
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                        Connected
                      </p>
                      <p className={`text-sm ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                        {connectionState.phone || 'WhatsApp Active'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connected Devices */}
                {devices.length > 0 && (
                  <div>
                    <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Connected Devices:
                    </p>
                    <div className="space-y-2">
                      {devices.map((device, idx) => (
                        <div key={idx} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {device.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {device.device}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleReconnect}
                    disabled={loading}
                    className={`py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                      isDark 
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Reconnect
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className={`py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                      isDark 
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    <PowerOff className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}

            {/* Error State */}
            {connectionState.status === 'error' && (
              <div className="text-center space-y-4">
                <div className={`p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                  <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <p className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                    Connection Error
                  </p>
                  <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                    Go-WhatsApp server tidak dapat dihubungi
                  </p>
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Pastikan GOWA server berjalan di port 3000
                </p>
              </div>
            )}
          </div>

          {/* Recipients Panel */}
          <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-2xl ${
            isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Alert Recipients
                </h2>
              </div>
              <button
                onClick={() => setShowAddRecipient(true)}
                className="p-2 bg-green-500/20 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            </div>

            {/* Add Recipient Form */}
            {showAddRecipient && (
              <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newRecipient.name}
                    onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nama (opsional)"
                    className={`w-full px-3 py-2 rounded-lg ${
                      isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } border`}
                  />
                  <input
                    type="text"
                    value={newRecipient.phone}
                    onChange={(e) => setNewRecipient(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="628123456789"
                    className={`w-full px-3 py-2 rounded-lg ${
                      isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } border`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddRecipient}
                      className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddRecipient(false);
                        setNewRecipient({ phone: '', name: '' });
                      }}
                      className={`py-2 px-4 rounded-lg font-medium ${
                        isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recipients List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recipients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className={`w-12 h-12 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                    Belum ada penerima alert
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    Tambahkan nomor untuk menerima notifikasi kebakaran
                  </p>
                </div>
              ) : (
                recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'} flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDark ? 'bg-gray-600' : 'bg-gray-300'
                      }`}>
                        <Phone className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {recipient.name}
                        </p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          +{recipient.phoneNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestSend(recipient)}
                        disabled={connectionState.status !== 'connected' || loading}
                        className={`p-2 rounded-lg transition-colors ${
                          connectionState.status === 'connected'
                            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                            : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                        }`}
                        title="Send test message"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveRecipient(recipient.id)}
                        className={`p-2 rounded-lg ${
                          isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'
                        } transition-colors`}
                        title="Remove recipient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* API Info Card */}
        <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-2xl ${
          isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Settings className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              GOWA API Configuration
            </h2>
          </div>
          <div className={`p-4 rounded-xl font-mono text-sm ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              <span className="text-purple-400">API URL:</span> {GOWA_API}
            </p>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="text-green-400">Status:</span>{' '}
              <span className={connectionState.status === 'connected' ? 'text-green-400' : 'text-yellow-400'}>
                {connectionState.status}
              </span>
            </p>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="text-blue-400">Recipients:</span> {recipients.length}
            </p>
          </div>
          <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Powered by{' '}
            <a 
              href="https://github.com/aldinokemal/go-whatsapp-web-multidevice" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-400 hover:underline"
            >
              go-whatsapp-web-multidevice
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
