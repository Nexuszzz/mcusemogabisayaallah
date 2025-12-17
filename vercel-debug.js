// Browser console test script for Vercel production
// Copy and paste this into browser console on https://rtsp-main-krj3w64cm-nexuszzzs-projects.vercel.app

console.log('🧪 Testing API connections from Vercel production...');

// Test 1: Check API config
console.log('Current API_CONFIG:', window.location);

// Test 2: Direct API call
fetch('http://3.27.0.139:8080/health')
  .then(response => {
    console.log('✅ Health response:', response.status);
    return response.json();
  })
  .then(data => console.log('Health data:', data))
  .catch(error => console.log('❌ Health error:', error));

// Test 3: Status API call  
fetch('http://3.27.0.139:8080/api/status')
  .then(response => {
    console.log('✅ Status response:', response.status);
    return response.json();
  })
  .then(data => console.log('Status data:', data))
  .catch(error => console.log('❌ Status error:', error));

// Test 4: CORS preflight
fetch('http://3.27.0.139:8080/health', {
  method: 'OPTIONS',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(response => {
    console.log('CORS preflight status:', response.status);
    console.log('CORS headers:', {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods')
    });
  })
  .catch(error => console.log('CORS error:', error));

// Test 5: Check current environment detection
console.log('Environment check:', {
  hostname: window.location.hostname,
  protocol: window.location.protocol,
  isProduction: window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
});