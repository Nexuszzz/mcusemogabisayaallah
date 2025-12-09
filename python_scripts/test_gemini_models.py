"""Test all available Gemini models to find which one has quota"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    print("❌ ERROR: GOOGLE_API_KEY not found in environment variables!")
    print("   Please set GOOGLE_API_KEY in .env file")
    exit(1)

models = [
    # Latest generation (2025)
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    
    # Alias (points to latest)
    "gemini-flash-latest",
    
    # Second generation
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    
    # Experimental
    "gemini-2.0-flash-exp",
]

print("="*80)
print("TESTING GEMINI MODELS - QUOTA CHECK")
print("="*80)
print(f"\nAPI Key: {API_KEY[:20]}...{API_KEY[-10:]}\n")

for i, model in enumerate(models, 1):
    print(f"{i}. Testing {model}...", end=" ")
    
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        
        response = requests.post(
            url,
            headers={
                "Content-Type": "application/json",
                "X-goog-api-key": API_KEY
            },
            json={
                "contents": [{
                    "parts": [{"text": "Hello"}]
                }]
            },
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ AVAILABLE - Quota OK!")
        elif response.status_code == 429:
            print("❌ QUOTA EXCEEDED")
        elif response.status_code == 403:
            print("❌ FORBIDDEN - API key invalid/leaked")
        elif response.status_code == 404:
            print("❌ NOT FOUND - Model doesn't exist")
        else:
            error_msg = response.json().get("error", {}).get("message", "Unknown error")[:80]
            print(f"❌ HTTP {response.status_code} - {error_msg}")
            
    except requests.exceptions.Timeout:
        print("❌ TIMEOUT")
    except Exception as e:
        print(f"❌ ERROR: {str(e)[:50]}")

print("\n" + "="*80)
print("RECOMMENDATION:")
print("Use the first model with ✅ AVAILABLE status")
print("="*80)
