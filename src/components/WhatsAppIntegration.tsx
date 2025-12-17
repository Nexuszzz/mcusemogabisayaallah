import { useState, useEffect } from 'react';
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
  Shield,
  Users,
  Phone,
  Bell,
  QrCode,
  Scan,
} from 'lucide-react';
import { useTelemetryStore } from '../store/useTelemetryStore';
import VoiceCallManager from './VoiceCallManager';

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
}

interface Recipient {
  id: string;
  phoneNumber: string;
  name: string;
  addedAt: number;
}

// Runtime detection - executed at runtime, not build time
const getWaApiRuntime = (): string => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  console.log('📱 WhatsApp API hostname:', hostname);
  
  if (hostname === 'latom.flx.web.id') {
    return 'https://api.latom.flx.web.id/api/whatsapp';
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api/whatsapp';
  }
  // IP access fallback
  return 'http://3.27.0.139:8080/api/whatsapp';
};

// Use function call to get URL at runtime
const API_BASE = getWaApiRuntime();

export default function WhatsAppIntegration() {
  const { preferences } = useTelemetryStore();
  const isDark = preferences.theme === 'dark';
  
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

  // Phone number validation
  const validatePhoneNumber = (phone: string): boolean => {
    // Indonesian phone format: 628xxxxxxxxxx (10-13 digits after 62)
    const regex = /^628\d{8,11}$/;
    return regex.test(phone);
  };

  // Fetch status periodically
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recipients
  useEffect(() => {
    fetchRecipients();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      
      // Auto-clear error after successful status fetch
      if (data && error) {
        setError(null);
      }
      
      setConnectionState(data);
    } catch (err) {
      console.error('Failed to fetch status:', err);
      // Don't show error for status check failures (could be server starting up)
    }
  }

  async function fetchRecipients() {
    try {
      const res = await fetch(`${API_BASE}/recipients`);
      const data = await res.json();
      setRecipients(data.recipients || []);
    } catch (err) {
      console.error('Failed to fetch recipients:', err);
    }
  }

  async function handleStart() {
    setError(null);
    
    if (authMethod === 'pairing') {
      if (!phoneNumber) {
        setError('Masukkan nomor WhatsApp terlebih dahulu!');
        return;
      }
      if (!validatePhoneNumber(phoneNumber)) {
        setError('Format nomor salah! Gunakan format: 628xxxxxxxxxx (contoh: 628123456789)');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: authMethod === 'pairing' ? phoneNumber : null,
          method: authMethod 
        }),
      });
      
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        console.log('✅ Connection started successfully');
        setError(null);
        // Force immediate status refresh
        setTimeout(() => fetchStatus(), 500);
      } else {
        setError(data.error || 'Gagal memulai koneksi');
      }
    } catch (err) {
      console.error('Start error:', err);
      setError('Gagal menghubungi server WhatsApp. Pastikan server berjalan di port 3001.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/stop`, { method: 'POST' });
      if (res.ok) {
        console.log('✅ WhatsApp stopped successfully');
        // Force immediate status refresh
        setTimeout(() => fetchStatus(), 500);
      }
    } catch (err) {
      console.error('Stop error:', err);
      setError('Gagal menghentikan koneksi WhatsApp');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSession() {
    if (!confirm('⚠️ Hapus sesi WhatsApp?\n\nAnda akan logout dari WhatsApp Web dan perlu pairing ulang dengan QR Code atau Pairing Code.')) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/delete-session`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        console.log('✅ Session deleted successfully');
        setPhoneNumber('');
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
        // Force immediate status refresh after deletion
        setTimeout(() => fetchStatus(), 1000);
      } else {
        setError(data.error || 'Gagal menghapus session');
      }
    } catch (err) {
      console.error('Delete session error:', err);
      setError('Gagal menghapus session WhatsApp');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRecipient() {
    if (!newRecipient.phone) {
      alert('Masukkan nomor WhatsApp!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: newRecipient.phone,
          name: newRecipient.name || newRecipient.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRecipients([...recipients, data.recipient]);
        setNewRecipient({ phone: '', name: '' });
        setShowAddRecipient(false);
      }
    } catch (err) {
      console.error('Add recipient error:', err);
      alert('Gagal menambah penerima');
    }
  }

  async function handleRemoveRecipient(id: string) {
    if (!confirm('Hapus penerima ini?')) return;

    try {
      await fetch(`${API_BASE}/recipients/${id}`, { method: 'DELETE' });
      setRecipients(recipients.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Remove recipient error:', err);
    }
  }

  async function handleTestSend(recipient: Recipient) {
    try {
      const res = await fetch(`${API_BASE}/test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: recipient.phoneNumber }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Pesan test berhasil dikirim ke ${recipient.name}`);
      } else {
        alert('❌ Gagal mengirim pesan');
      }
    } catch (err) {
      console.error('Test send error:', err);
      alert('Error mengirim pesan');
    }
  }

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
          text: `Syncing... ${connectionState.syncProgress}%`,
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
              <Smartphone className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                WhatsApp Integration
              </h1>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                Baileys API • QR Code / Pairing Code • Fire Alerts
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-3 px-6 py-3 rounded-xl border ${statusConfig.bg} ${statusConfig.border} backdrop-blur-sm transition-all duration-300`}
          >
            {statusConfig.pulse && (
              <div className="relative">
                <div className="absolute inset-0 animate-ping bg-green-400 rounded-full opacity-30"></div>
                <div className="relative w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
            )}
            <StatusIcon
              className={`w-5 h-5 ${statusConfig.color} ${connectionState.status === 'connecting' || connectionState.status === 'syncing' ? 'animate-spin' : ''}`}
            />
            <span className={`font-semibold ${statusConfig.color}`}>
              {statusConfig.text}
            </span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Connection Panel */}
          <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-2xl ${
            isDark 
              ? 'bg-gray-800/50 border border-gray-700/50' 
              : 'bg-white border border-gray-200'
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
              <div className="space-y-4 animate-fade-in">
                {/* Auth Method Selector */}
                <div>
                  <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Authentication Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAuthMethod('qr')}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        authMethod === 'qr'
                          ? 'bg-purple-500/20 border-purple-500 shadow-lg'
                          : isDark 
                            ? 'bg-gray-900/50 border-gray-600/50 hover:border-gray-500'
                            : 'bg-gray-50 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <QrCode className={`w-7 h-7 ${authMethod === 'qr' ? 'text-purple-400' : 'text-gray-400'}`} />
                      <div className={`font-semibold text-sm ${authMethod === 'qr' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        QR Code
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Scan HP</div>
                      {authMethod === 'qr' && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                      )}
                    </button>

                    <button
                      onClick={() => setAuthMethod('pairing')}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        authMethod === 'pairing'
                          ? 'bg-green-500/20 border-green-500 shadow-lg'
                          : isDark 
                            ? 'bg-gray-900/50 border-gray-600/50 hover:border-gray-500'
                            : 'bg-gray-50 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Scan className={`w-7 h-7 ${authMethod === 'pairing' ? 'text-green-400' : 'text-gray-400'}`} />
                      <div className={`font-semibold text-sm ${authMethod === 'pairing' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Pairing Code
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>8 digit</div>
                      {authMethod === 'pairing' && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Phone Number Input (only for pairing) */}
                {authMethod === 'pairing' && (
                  <div className="animate-slide-down">
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Nomor WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="628123456789"
                        className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
                          isDark 
                            ? 'bg-gray-900/50 border border-gray-600/50 text-white placeholder-gray-500'
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>
                    <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Format: 628xxx (tanpa + atau spasi)
                    </p>
                  </div>
                )}

                {/* QR Method Instructions */}
                {authMethod === 'qr' && (
                  <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/30 animate-slide-down">
                    <div className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <QrCode className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">QR Code Method:</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Click Start → Scan QR dengan WhatsApp di HP</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-slide-down">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStart}
                  disabled={loading || (authMethod === 'pairing' && !phoneNumber)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-green-500/30"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Power className="w-5 h-5" />
                      Start WhatsApp
                    </>
                  )}
                </button>

                {connectionState.hasSession && (
                  <button
                    onClick={handleDeleteSession}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-xl border border-red-500/30 transition-all duration-300"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Saved Session
                  </button>
                )}
              </div>
            )}

            {/* QR Code Display */}
            {connectionState.qrCode && connectionState.authMethod === 'qr' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-6 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/30">
                  <div className="flex items-center gap-3 mb-4">
                    <QrCode className="w-6 h-6 text-purple-400 animate-pulse" />
                    <h3 className="text-lg font-bold text-white">
                      Scan QR Code
                    </h3>
                  </div>
                  <div className="flex justify-center p-4 bg-white rounded-xl mb-4">
                    <img
                      src={connectionState.qrCode}
                      alt="QR Code"
                      className="w-56 h-56"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-300 mb-2">
                      Scan dengan WhatsApp di HP Anda
                    </p>
                    <p className="text-xs text-gray-400">
                      WhatsApp → Settings → Linked Devices → Link a Device
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pairing Code Display */}
            {connectionState.pairingCode && connectionState.authMethod === 'pairing' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                  <div className="flex items-center gap-3 mb-4">
                    <Key className="w-6 h-6 text-green-400 animate-pulse" />
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Pairing Code Ready!
                    </h3>
                  </div>
                  
                  {/* Large Code Display */}
                  <div className="text-center mb-4">
                    <p className="text-5xl font-mono font-bold text-green-400 tracking-widest mb-3 animate-pulse">
                      {connectionState.pairingCode}
                    </p>
                    <p className="text-xs text-yellow-400">
                      ⏱️ Kode akan expired dalam 2 menit
                    </p>
                  </div>

                  {/* Step-by-step Instructions */}
                  <div className={`rounded-lg p-4 space-y-2 ${isDark ? 'bg-gray-900/30' : 'bg-white/50'}`}>
                    <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      📱 Langkah-langkah di WhatsApp HP:
                    </p>
                    <div className={`space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">1.</span>
                        <span>Buka <strong>WhatsApp</strong> di HP Anda</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">2.</span>
                        <span>Tap <strong>⚙️ Settings</strong> (atau Menu <strong>☰</strong>)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">3.</span>
                        <span>Tap <strong>Linked Devices</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">4.</span>
                        <span>Tap <strong>Link a Device</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">5.</span>
                        <span>Pilih <strong>"Link with phone number instead"</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">6.</span>
                        <span>Masukkan kode: <strong className="text-green-400 font-mono">{connectionState.pairingCode}</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">7.</span>
                        <span>Tap <strong>Link</strong> dan tunggu konfirmasi ✅</span>
                      </div>
                    </div>
                  </div>

                  {/* Important Note */}
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      ⚠️ <strong>PENTING:</strong> Kode ini ditampilkan di WEB, bukan dikirim ke HP Anda. 
                      Anda harus buka WhatsApp dan masukkan kode secara manual.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {connectionState.status === 'syncing' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white mb-2">
                    Syncing Messages...
                  </p>
                  <p className="text-sm text-gray-400">
                    {connectionState.syncProgress}% Complete
                  </p>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${connectionState.syncProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {connectionState.status === 'connected' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="font-semibold text-white">Connected</p>
                      <p className="text-sm text-gray-400">
                        Phone: {connectionState.phone}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-xl border border-red-500/30 transition-all duration-300"
                >
                  <PowerOff className="w-5 h-5" />
                  Stop Connection
                </button>

                <button
                  onClick={handleDeleteSession}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 font-semibold rounded-xl border border-gray-600/30 transition-all duration-300"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete Session
                </button>
              </div>
            )}
          </div>

          {/* Recipients Panel */}
          <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-2xl ${
            isDark 
              ? 'bg-gray-800/50 border border-gray-700/50' 
              : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Recipients ({recipients.length})
                </h2>
              </div>
              <button
                onClick={() => setShowAddRecipient(!showAddRecipient)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg border border-purple-500/30 transition-all duration-300"
              >
                <UserPlus className="w-4 h-4" />
                Add
              </button>
            </div>

            {showAddRecipient && (
              <div className={`mb-4 p-4 rounded-xl space-y-3 animate-slide-down ${
                isDark 
                  ? 'bg-gray-900/50 border border-gray-700/50' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <input
                  type="text"
                  value={newRecipient.phone}
                  onChange={(e) =>
                    setNewRecipient({ ...newRecipient, phone: e.target.value })
                  }
                  placeholder="628123456789"
                  className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isDark 
                      ? 'bg-gray-800/50 border border-gray-600/50 text-white placeholder-gray-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
                <input
                  type="text"
                  value={newRecipient.name}
                  onChange={(e) =>
                    setNewRecipient({ ...newRecipient, name: e.target.value })
                  }
                  placeholder="Name (optional)"
                  className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isDark 
                      ? 'bg-gray-800/50 border border-gray-600/50 text-white placeholder-gray-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddRecipient}
                    className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all"
                  >
                    Add Recipient
                  </button>
                  <button
                    onClick={() => setShowAddRecipient(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {recipients.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    Belum ada penerima notifikasi
                  </p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Tambahkan nomor untuk menerima alert kebakaran
                  </p>
                </div>
              ) : (
                recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className={`p-4 rounded-xl transition-all duration-300 group ${
                      isDark 
                        ? 'bg-gray-900/50 border border-gray-700/50 hover:border-gray-600/50'
                        : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {recipient.name}
                        </p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          +{recipient.phoneNumber}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          Added: {new Date(recipient.addedAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleTestSend(recipient)}
                          disabled={connectionState.status !== 'connected'}
                          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Test send"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveRecipient(recipient.id)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Emergency Voice Call Manager - NEW SECTION */}
        <div className="animate-fade-in">
          <VoiceCallManager isDark={isDark} />
        </div>

        {/* Alert Status Info */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-2xl border border-green-500/30 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Shield className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Status Aman</h3>
                <p className="text-sm text-gray-300 mt-1">
                  Notifikasi akan dikirim jika tidak ada deteksi kebakaran
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-red-500/10 to-orange-600/10 rounded-2xl border border-red-500/30 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl animate-pulse">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Status Beresiko</h3>
                <p className="text-sm text-gray-300 mt-1">
                  Alert otomatis dengan data sensor (suhu, kelembapan, gas)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(75, 85, 99, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.7);
        }
      `}</style>
    </div>
  );
}
