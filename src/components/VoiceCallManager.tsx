import { useState, useEffect } from 'react';
import {
  Phone,
  UserPlus,
  Trash2,
  PhoneCall,
  AlertCircle,
  CheckCircle2,
  Loader2,
  PhoneForwarded,
  Bell,
  Shield,
  PhoneOutgoing,
  CheckCheck,
} from 'lucide-react';

interface EmergencyNumber {
  id: string;
  phoneNumber: string;
  name: string;
  addedAt: number;
}

interface VoiceCallConfig {
  enabled: boolean;
  configured: boolean;
  phoneNumber: string | null;
  voiceUrl: string;
  emergencyNumbersCount: number;
}

import { VOICE_CALL_API_URL } from '../config/api.config';
const VOICE_CALL_API = VOICE_CALL_API_URL;

interface TestCallResult {
  callSid: string;
  status: string;
  timestamp: number;
  testMethod?: number;
  testDescription?: string;
}

interface Props {
  isDark: boolean;
}

export default function VoiceCallManager({ isDark }: Props) {
  const [config, setConfig] = useState<VoiceCallConfig | null>(null);
  const [numbers, setNumbers] = useState<EmergencyNumber[]>([]);
  const [newNumber, setNewNumber] = useState({ phone: '', name: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestCallResult>>({});
  const [showAdvancedTest, setShowAdvancedTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchNumbers();
  }, []);

  async function fetchConfig() {
    try {
      console.log('🔹 Fetching config from:', `${VOICE_CALL_API}/config`);
      const res = await fetch(`${VOICE_CALL_API}/config`);
      
      if (!res.ok) {
        console.error('❌ Config fetch failed:', res.status, res.statusText);
        setError(
          `❌ Voice Call Server Error\n\n` +
          `Cannot connect to voice-call-server.\n` +
          `Status: ${res.status} ${res.statusText}\n\n` +
          `Please ensure voice-call-server is running on port 3002.\n` +
          `Run: cd voice-call-server && npm start`
        );
        return;
      }
      
      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Expected JSON but got:', contentType);
        const text = await res.text();
        console.error('Response:', text.substring(0, 200));
        setError(
          `❌ Voice Call Server Error\n\n` +
          `Server returned HTML instead of JSON.\n` +
          `This usually means the server is not running properly.\n\n` +
          `Fix:\n` +
          `1. Stop all servers\n` +
          `2. cd d:\\IotCobwengdev-backup-20251103-203857\n` +
          `3. Run: 🚀-START-HERE-SEPARATED.bat\n` +
          `4. Wait for "Voice Call Server running on port 3002"\n` +
          `5. Refresh dashboard`
        );
        return;
      }
      
      const data = await res.json();
      console.log('✅ Config loaded:', data);
      setConfig(data);
    } catch (err: any) {
      console.error('❌ Failed to fetch voice call config:', err);
      setError(
        `❌ Connection Error\n\n` +
        `Failed to connect to voice call server.\n` +
        `Error: ${err.message || 'Network error'}\n\n` +
        `Please ensure:\n` +
        `1. Voice-call-server is running (port 3002)\n` +
        `2. No firewall blocking the connection\n` +
        `3. Run: 🚀-START-HERE-SEPARATED.bat`
      );
    }
  }

  async function fetchNumbers() {
    try {
      console.log('🔹 Fetching numbers from:', `${VOICE_CALL_API}/numbers`);
      const res = await fetch(`${VOICE_CALL_API}/numbers`);
      
      if (!res.ok) {
        console.error('❌ Numbers fetch failed:', res.status, res.statusText);
        return;
      }
      
      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Expected JSON but got:', contentType);
        return;
      }
      
      const data = await res.json();
      console.log('✅ Numbers loaded:', data.numbers?.length || 0, 'numbers');
      setNumbers(data.numbers || []);
    } catch (err: any) {
      console.error('❌ Failed to fetch emergency numbers:', err);
    }
  }

  async function handleAddNumber() {
    if (!newNumber.phone.trim()) {
      setError('Phone number required!');
      return;
    }

    // More lenient validation - just check if it has numbers
    const cleanPhone = newNumber.phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      setError('Phone number too short! Minimum 10 digits');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    console.log('🔹 Adding emergency number:', {
      phone: newNumber.phone.trim(),
      name: newNumber.name.trim(),
      apiUrl: VOICE_CALL_API
    });

    try {
      const res = await fetch(`${VOICE_CALL_API}/numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: newNumber.phone.trim(),
          name: newNumber.name.trim() || newNumber.phone.trim(),
        }),
      });

      console.log('🔹 Response status:', res.status);
      const data = await res.json();
      console.log('🔹 Response data:', data);

      if (res.ok && data.success) {
        setSuccess(`✅ Added: ${data.number.name}`);
        setNewNumber({ phone: '', name: '' });
        setShowAddForm(false);
        await fetchNumbers(); // Refresh list
        await fetchConfig(); // Update count
      } else {
        console.error('❌ Failed to add number:', data);
        setError(data.error || 'Failed to add number');
      }
    } catch (err: any) {
      console.error('❌ Network error:', err);
      setError(`Failed to connect: ${err.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveNumber(id: string, name: string) {
    if (!confirm(`Remove ${name} from emergency contacts?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${VOICE_CALL_API}/numbers/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(`✅ Removed: ${name}`);
        fetchNumbers();
      } else {
        setError(data.error || 'Failed to remove number');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Remove number error:', err);
    }
  }

  async function handleTestCall(phoneNumber: string, name: string) {
    // Confirmation with more details
    const confirmMessage = `🔔 Test Emergency Call\n\nThis will make a real phone call to:\n${name}\n${phoneNumber}\n\nYou will hear:\n"This is a test call from the Fire Detection Voice Call Server. If you can hear this message, the system is working correctly."\n\nProceed?`;
    
    if (!confirm(confirmMessage)) return;

    setTestLoading(phoneNumber);
    setError(null);
    setSuccess(null);

    console.log(`📞 Initiating test call to ${name} (${phoneNumber})...`);

    try {
      const res = await fetch(`${VOICE_CALL_API}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();
      console.log('📞 Test call response:', data);

      if (res.ok && data.success) {
        // Store test result
        setTestResults(prev => ({
          ...prev,
          [phoneNumber]: {
            callSid: data.callSid,
            status: data.status,
            timestamp: Date.now()
          }
        }));
        
        setSuccess(
          `✅ Test call initiated successfully!\n` +
          `📞 Calling ${name}...\n` +
          `🆔 Call SID: ${data.callSid}\n` +
          `📊 Status: ${data.status}\n\n` +
          `⏳ Please wait for the call on ${phoneNumber}\n` +
          `If you don't receive it within 30 seconds, check if the number is verified (trial accounts).`
        );
        
        console.log('✅ Test call success:', {
          to: name,
          phone: phoneNumber,
          callSid: data.callSid,
          status: data.status
        });
      } else {
        console.error('❌ Test call failed:', data);
        const errorMsg = data.error || 'Test call failed';
        
        // Enhanced error messages
        if (errorMsg.includes('unverified') || errorMsg.includes('verify')) {
          setError(
            `❌ Number Not Verified (Trial Account)\n\n` +
            `${errorMsg}\n\n` +
            `📋 To verify this number:\n` +
            `1. Go to: console.twilio.com\n` +
            `2. Navigate to: Phone Numbers → Manage → Verified Caller IDs\n` +
            `3. Click "Add a new Caller ID"\n` +
            `4. Enter: ${phoneNumber}\n` +
            `5. Verify via SMS code\n\n` +
            `Or upgrade to a paid Twilio account to call any number.`
          );
        } else {
          setError(`❌ Test Call Failed\n\n${errorMsg}`);
        }
      }
    } catch (err: any) {
      console.error('❌ Test call network error:', err);
      setError(
        `❌ Connection Error\n\n` +
        `Failed to connect to voice call server.\n` +
        `Error: ${err.message || 'Network error'}\n\n` +
        `Please ensure voice-call-server is running on port 3002.`
      );
    } finally {
      setTestLoading(null);
    }
  }

  async function handleAdvancedTestCall(phoneNumber: string, name: string, testMethod: number) {
    setTestLoading(phoneNumber);
    setError(null);
    setSuccess(null);
    setShowAdvancedTest(null);

    const testDescriptions = [
      'Basic TwiML String - Emergency Fire Alert',
      'TwiML URL - Demo Twilio Voice',
      'TwiML with Status Callbacks',
      'Call with Recording Enabled',
      'Extended Timeout (120 seconds)'
    ];

    console.log(`📞 Advanced Test Call - Method ${testMethod}`);
    console.log(`   To: ${name} (${phoneNumber})`);
    console.log(`   Test: ${testDescriptions[testMethod - 1]}`);

    try {
      const res = await fetch(`${VOICE_CALL_API}/test-advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber,
          testMethod 
        }),
      });

      const data = await res.json();
      console.log('📞 Advanced test response:', data);

      if (res.ok && data.success) {
        // Store test result
        setTestResults(prev => ({
          ...prev,
          [phoneNumber]: {
            callSid: data.callSid,
            status: data.status,
            timestamp: Date.now(),
            testMethod: data.testMethod,
            testDescription: data.testDescription
          }
        }));
        
        setSuccess(
          `✅ Advanced Test Call Successful!\n` +
          `📞 Calling ${name}...\n` +
          `🧪 Test Method ${testMethod}: ${data.testDescription}\n` +
          `🆔 Call SID: ${data.callSid}\n` +
          `📊 Status: ${data.status}\n\n` +
          `⏳ Please wait for the call on ${phoneNumber}\n` +
          `Check the voice message to verify the test method.`
        );
        
        console.log('✅ Advanced test success:', {
          to: name,
          phone: phoneNumber,
          callSid: data.callSid,
          testMethod: data.testMethod,
          testDescription: data.testDescription
        });
      } else {
        console.error('❌ Advanced test failed:', data);
        const errorMsg = data.error || 'Advanced test call failed';
        
        if (errorMsg.includes('unverified') || errorMsg.includes('verify')) {
          setError(
            `❌ Number Not Verified (Trial Account)\n\n` +
            `${errorMsg}\n\n` +
            `📋 To verify this number:\n` +
            `1. Go to: console.twilio.com\n` +
            `2. Navigate to: Phone Numbers → Manage → Verified Caller IDs\n` +
            `3. Click "Add a new Caller ID"\n` +
            `4. Enter: ${phoneNumber}\n` +
            `5. Verify via SMS code`
          );
        } else {
          setError(`❌ Advanced Test Failed\n\n${errorMsg}`);
        }
      }
    } catch (err: any) {
      console.error('❌ Advanced test network error:', err);
      setError(
        `❌ Connection Error\n\n` +
        `Failed to connect to voice call server.\n` +
        `Error: ${err.message || 'Network error'}`
      );
    } finally {
      setTestLoading(null);
    }
  }

  const bgColor = isDark ? 'bg-gray-800' : 'bg-white';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-900';
  const mutedColor = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`${bgColor} rounded-xl shadow-lg p-6 border ${borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
            <PhoneCall className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${textColor}`}>Emergency Voice Calls</h2>
            <p className={`text-sm ${mutedColor}`}>Automatic phone calls via Twilio</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:from-red-600 hover:to-orange-600 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Number</span>
        </button>
      </div>

      {/* Twilio Status */}
      {config && (
        <div className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {config.enabled ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className={`font-semibold ${textColor}`}>Twilio Enabled</p>
                    <p className={`text-xs ${mutedColor}`}>From: {config.phoneNumber}</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className={`font-semibold ${textColor}`}>Twilio Not Configured</p>
                    <p className={`text-xs ${mutedColor}`}>Add credentials to .env file</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="text-right">
              <p className={`text-2xl font-bold ${textColor}`}>{numbers.length}</p>
              <p className={`text-xs ${mutedColor}`}>Emergency Numbers</p>
            </div>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start space-x-2">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-500 text-sm">{success}</p>
        </div>
      )}

      {/* Add Number Form */}
      {showAddForm && (
        <div className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-100'} border ${borderColor}`}>
          <h3 className={`text-sm font-semibold mb-3 ${textColor}`}>Add Emergency Contact</h3>
          
          <div className="space-y-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${mutedColor}`}>
                Phone Number (with country code)
              </label>
              <input
                type="text"
                placeholder="+628123456789 or +12125551234"
                value={newNumber.phone}
                onChange={(e) => setNewNumber({ ...newNumber, phone: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} focus:ring-2 focus:ring-red-500 outline-none`}
              />
              <p className={`text-xs mt-1 ${mutedColor}`}>
                Format: +[country code][number] (e.g., +62 for Indonesia, +1 for USA)
              </p>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${mutedColor}`}>
                Name (optional)
              </label>
              <input
                type="text"
                placeholder="Security Team"
                value={newNumber.name}
                onChange={(e) => setNewNumber({ ...newNumber, name: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} focus:ring-2 focus:ring-red-500 outline-none`}
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleAddNumber}
                disabled={loading || !config?.enabled}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:from-red-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Add Number'
                )}
              </button>
              
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewNumber({ phone: '', name: '' });
                  setError(null);
                }}
                className={`px-4 py-2 rounded-lg border ${borderColor} ${textColor} hover:bg-gray-100 dark:hover:bg-gray-700 transition-all`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Numbers List */}
      <div className="space-y-3">
        {numbers.length === 0 ? (
          <div className={`text-center py-12 ${mutedColor}`}>
            <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No emergency numbers added yet</p>
            <p className="text-xs mt-1">Click "Add Number" to configure emergency contacts</p>
          </div>
        ) : (
          numbers.map((num) => (
            <div
              key={num.id}
              className={`p-4 rounded-lg border ${borderColor} ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} hover:border-red-500/30 transition-all`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="p-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
                    <PhoneForwarded className="w-4 h-4 text-white" />
                  </div>
                  
                  <div className="flex-1">
                    <p className={`font-semibold ${textColor}`}>{num.name}</p>
                    <p className={`text-sm ${mutedColor}`}>{num.phoneNumber}</p>
                    <p className={`text-xs ${mutedColor}`}>
                      Added: {new Date(num.addedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Test Call Button - Enhanced */}
                  <button
                    onClick={() => handleTestCall(num.phoneNumber, num.name)}
                    disabled={testLoading === num.phoneNumber || !config?.enabled}
                    className={
                      `group relative px-3 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        testResults[num.phoneNumber] 
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`
                    }
                    title={testResults[num.phoneNumber] ? `Last tested: ${new Date(testResults[num.phoneNumber].timestamp).toLocaleString()}` : 'Test emergency call'}
                  >
                    <div className="flex items-center space-x-2">
                      {testLoading === num.phoneNumber ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden sm:inline">Calling...</span>
                        </>
                      ) : testResults[num.phoneNumber] ? (
                        <>
                          <CheckCheck className="w-4 h-4" />
                          <span className="hidden sm:inline">Tested</span>
                        </>
                      ) : (
                        <>
                          <PhoneOutgoing className="w-4 h-4" />
                          <span className="hidden sm:inline">Test Call</span>
                        </>
                      )}
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {testResults[num.phoneNumber] ? (
                        <div className="text-center">
                          <div>Last Test: {new Date(testResults[num.phoneNumber].timestamp).toLocaleString()}</div>
                          <div className="text-green-400">Call SID: {testResults[num.phoneNumber].callSid.slice(-8)}</div>
                          {testResults[num.phoneNumber].testMethod && (
                            <div className="text-yellow-400">Method {testResults[num.phoneNumber].testMethod}</div>
                          )}
                        </div>
                      ) : (
                        <div>
                          🔔 Click to make a test call<br/>
                          Voice message will be played
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Advanced Test Button */}
                  <button
                    onClick={() => setShowAdvancedTest(showAdvancedTest === num.phoneNumber ? null : num.phoneNumber)}
                    disabled={testLoading === num.phoneNumber || !config?.enabled}
                    className="group relative px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Advanced test with 5 methods"
                  >
                    <div className="flex items-center space-x-1">
                      <Bell className="w-4 h-4" />
                      <span className="hidden sm:inline">5 Tests</span>
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      🧪 Advanced Test<br/>
                      5 Different Methods
                    </div>
                  </button>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveNumber(num.id, num.name)}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                    title="Remove from emergency contacts"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Advanced Test Panel */}
              {showAdvancedTest === num.phoneNumber && (
                <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-purple-50'} border ${isDark ? 'border-purple-500/30' : 'border-purple-200'}`}>
                  <h4 className={`text-sm font-bold mb-3 ${textColor} flex items-center`}>
                    <Bell className="w-4 h-4 mr-2 text-purple-500" />
                    Advanced Test - Choose Method
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-2 mb-3">
                    {[
                      { id: 1, name: '1. Basic TwiML - Emergency Fire Alert', desc: 'Simple inline message' },
                      { id: 2, name: '2. TwiML URL - Demo Twilio', desc: 'External TwiML from Twilio demo' },
                      { id: 3, name: '3. Status Callbacks', desc: 'Track call lifecycle events' },
                      { id: 4, name: '4. Call Recording', desc: 'Record the test call' },
                      { id: 5, name: '5. Extended Timeout', desc: '120 seconds timeout' }
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => {
                          if (confirm(`🧪 Test Method ${method.id}\n\n${method.name}\n${method.desc}\n\nThis will call ${num.name} at ${num.phoneNumber}.\n\nProceed?`)) {
                            handleAdvancedTestCall(num.phoneNumber, num.name, method.id);
                          }
                        }}
                        disabled={testLoading === num.phoneNumber}
                        className={`text-left p-3 rounded-lg transition-all ${
                          isDark 
                            ? 'bg-gray-800 hover:bg-purple-900/50 border-gray-700' 
                            : 'bg-white hover:bg-purple-100 border-purple-200'
                        } border disabled:opacity-50`}
                      >
                        <div className={`font-semibold text-sm ${textColor}`}>{method.name}</div>
                        <div className={`text-xs ${mutedColor} mt-1`}>{method.desc}</div>
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => setShowAdvancedTest(null)}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} transition-all`}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} border ${isDark ? 'border-blue-500/30' : 'border-blue-200'}`}>
        <div className="flex items-start space-x-2">
          <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
              How it works
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
              When fire is detected, system will automatically call all numbers listed above. 
              Calls are made via Twilio Voice API with pre-recorded emergency message. 
              Cooldown: 2 minutes between calls to prevent spam.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
