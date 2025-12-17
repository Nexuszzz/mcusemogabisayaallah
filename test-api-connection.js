// Test API connection to EC2 from browser
const testAPI = async () => {
    const EC2_HOST = '3.27.0.139';
    const testUrls = [
        `http://${EC2_HOST}`,
        `http://${EC2_HOST}:8080`,
        `http://${EC2_HOST}/api/status`,
        `http://${EC2_HOST}:8080/api/status`
    ];
    
    console.log('Testing API connections...');
    
    for (const url of testUrls) {
        try {
            console.log(`Testing: ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.text();
                console.log(`✅ SUCCESS ${url}:`, data);
            } else {
                console.log(`❌ FAILED ${url}: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`❌ ERROR ${url}:`, error.message);
        }
    }
};

// Run test
testAPI();

// Also test direct fetch to specific endpoint
fetch('http://3.27.0.139:8080/api/status')
    .then(response => response.json())
    .then(data => console.log('Direct test result:', data))
    .catch(error => console.log('Direct test error:', error));