// api/proxy.js - Vercel Edge Function to proxy API calls to EC2
// This solves the Mixed Content issue by making server-to-server calls

export default async function handler(request, response) {
  // Enable CORS for frontend
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const { searchParams } = new URL(request.url, `https://${request.headers.host}`);
    const endpoint = searchParams.get('endpoint') || '/health';
    
    // EC2 backend URL
    const backendUrl = `http://3.27.0.139:8080${endpoint}`;
    
    console.log(`Proxying request to: ${backendUrl}`);
    
    // Forward request to EC2 backend
    const backendResponse = await fetch(backendUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: request.method !== 'GET' ? JSON.stringify(request.body) : undefined,
    });

    if (!backendResponse.ok) {
      return response.status(backendResponse.status).json({
        error: `Backend error: ${backendResponse.status}`,
        endpoint: endpoint
      });
    }

    const data = await backendResponse.json();
    
    return response.status(200).json({
      success: true,
      data: data,
      proxied_from: backendUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return response.status(500).json({
      error: 'Proxy failed',
      message: error.message,
      backend: '3.27.0.139:8080'
    });
  }
}