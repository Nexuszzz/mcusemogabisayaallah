"""
🔥 FIRE DETECTION + AUTO IP DETECTION VIA MQTT + VIDEO RECORDING
=================================================================
FITUR AUTO IP:
- Subscribe ke MQTT topic lab/zaks/esp32cam/ip
- ESP32-CAM broadcast IP secara otomatis setiap 30 detik
- Python auto-connect ke stream URL tanpa input manual!

ALUR:
1. Jalankan script
2. Script tunggu broadcast IP dari ESP32-CAM via MQTT
3. Setelah dapat IP → auto-connect ke stream
4. Fire detection dengan YOLO + Gemini verification

Author: GitHub Copilot
Version: 3.0 (Auto IP Detection)
"""

import cv2
import numpy as np
from ultralytics import YOLO
import time
import os
import json
import requests
import base64
import threading
from queue import Queue, Empty
from datetime import datetime
import urllib.request
import socket
import uuid
import sys

# Optional imports
try:
    import paho.mqtt.client as mqtt
    # Check for paho-mqtt v2.0+ API
    try:
        from paho.mqtt.enums import CallbackAPIVersion
        MQTT_V2 = True
    except ImportError:
        MQTT_V2 = False
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("❌ paho-mqtt not installed! Run: pip install paho-mqtt")
    print("   MQTT is REQUIRED for auto IP detection")
    sys.exit(1)

try:
    import websocket
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False
    print("⚠️  websocket-client not installed - Web logging disabled")

try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

# Import WhatsApp helper
try:
    sys.path.insert(0, "D:/zekk/zakaiot")
    from fire_whatsapp_helper import send_fire_photo_to_whatsapp
    WHATSAPP_HELPER_AVAILABLE = True
    print("✅ WhatsApp helper loaded")
except ImportError as e:
    WHATSAPP_HELPER_AVAILABLE = False
    print(f"⚠️  WhatsApp helper not available: {e}")

print("\n" + "="*80)
print("🔥 FIRE DETECTION + AUTO IP DETECTION VIA MQTT")
print("="*80)
print()

# ============================================================================
# CONFIGURATION
# ============================================================================

# MQTT Configuration (PENTING!)
MQTT_BROKER = "3.27.0.139"
MQTT_PORT = 1883
MQTT_USER = "zaks"
MQTT_PASSWORD = "enggangodinginmcu"
MQTT_TOPIC_IP = "lab/zaks/esp32cam/ip"
MQTT_TOPIC_ALERT = "lab/zaks/alert"
MQTT_TOPIC_LOG = "lab/zaks/log"
MQTT_TOPIC_EVENT = "lab/zaks/event"

# ESP32-CAM (akan di-set otomatis dari MQTT)
available_cameras = {}  # {cam_id: {ip, stream_url, ...}}
selected_camera = None
stream_url = None

# Model Path
MODEL_PATH = None
model_paths = [
    "D:/zekk/zakaiot/fire_yolov8s_ultra_best.pt",
    "D:/zakaiot/fire_yolov8s_ultra_best.pt",
    "D:/zekk/zakaiot/fire_training/fire_yolov8n_best.pt",
    os.path.join(os.path.dirname(__file__), "fire_yolov8s_ultra_best.pt"),
    os.path.join(os.path.dirname(__file__), "fire_yolov8n_best.pt"),
]

for path in model_paths:
    if os.path.exists(path):
        MODEL_PATH = path
        print(f"✅ Model: {path}")
        break

if MODEL_PATH is None:
    print("❌ Model not found!")
    sys.exit(1)

# Detection Parameters
CONF_THRESHOLD = 0.35
MIN_AREA = 200
ENABLE_COLOR_VALIDATION = True
MIN_ORANGE_RED_RATIO = 0.15
MAX_WHITE_RATIO = 0.60

# Gemini Configuration
GEMINI_MODEL = "gemini-2.5-flash-lite"
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyAGX6tPV18q3xaVMsu2wSeJ6_8TcJapFm0")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
GEMINI_SCORE_THRESHOLD = 0.50

# Recording Configuration
ENABLE_AUTO_RECORD = True
RECORD_SAVE_DIR = "D:/fire_recordings"
RECORD_DURATION = 30
RECORD_FPS = 20
RECORD_COOLDOWN = 60

# Web Dashboard
WEB_LOG_WS_URL = "ws://localhost:8080/ws"
WEB_API_URL = "http://localhost:8080/api/fire-detection"

# Alert Configuration
ALERT_COOLDOWN = 5.0
WHATSAPP_COOLDOWN = 60

os.makedirs(RECORD_SAVE_DIR, exist_ok=True)

# ============================================================================
# GLOBAL STATE
# ============================================================================

mqtt_client = None
camera_discovered = threading.Event()
detection_running = False
last_alert_time = 0
last_whatsapp_time = 0
last_record_time = 0

# Stats
stats = {
    "yolo_detections": 0,
    "gemini_verified": 0,
    "gemini_rejected": 0,
    "recordings": 0,
    "whatsapp_sent": 0
}

# ============================================================================
# MQTT AUTO IP DETECTION
# ============================================================================

def on_mqtt_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        print(f"✅ MQTT Connected to {MQTT_BROKER}")
        # Subscribe ke topic IP broadcast
        client.subscribe(MQTT_TOPIC_IP)
        print(f"📡 Subscribed to: {MQTT_TOPIC_IP}")
        print(f"⏳ Waiting for ESP32-CAM IP broadcast...")
    else:
        print(f"❌ MQTT Connection failed: {rc}")

def on_mqtt_message(client, userdata, msg):
    """Callback when receiving MQTT message"""
    global available_cameras, selected_camera, stream_url
    
    try:
        if msg.topic == MQTT_TOPIC_IP:
            payload = json.loads(msg.payload.decode())
            
            cam_id = payload.get("id", payload.get("chipId", "unknown"))
            cam_ip = payload.get("ip")
            cam_stream = payload.get("stream_url")
            
            if cam_ip and cam_stream:
                # Update available cameras
                available_cameras[cam_id] = {
                    "ip": cam_ip,
                    "stream_url": cam_stream,
                    "snapshot_url": payload.get("snapshot_url"),
                    "ssid": payload.get("ssid", "N/A"),
                    "rssi": payload.get("rssi", 0),
                    "uptime": payload.get("uptime", 0),
                    "last_seen": time.time()
                }
                
                print(f"\n📸 Camera Discovered: {cam_id}")
                print(f"   IP: {cam_ip}")
                print(f"   Stream: {cam_stream}")
                print(f"   WiFi: {payload.get('ssid', 'N/A')} ({payload.get('rssi', 0)} dBm)")
                
                # Auto-select first camera
                if selected_camera is None:
                    selected_camera = cam_id
                    stream_url = cam_stream
                    print(f"\n✅ Auto-selected camera: {cam_id}")
                    camera_discovered.set()
                    
    except Exception as e:
        print(f"⚠️  Error parsing MQTT message: {e}")

def setup_mqtt():
    """Setup MQTT connection for auto IP detection"""
    global mqtt_client
    
    print(f"\n[MQTT] Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
    
    # Support both paho-mqtt v1.x and v2.x
    if MQTT_V2:
        mqtt_client = mqtt.Client(
            callback_api_version=CallbackAPIVersion.VERSION1,
            client_id=f"fire_detector_{uuid.uuid4().hex[:8]}"
        )
    else:
        mqtt_client = mqtt.Client(f"fire_detector_{uuid.uuid4().hex[:8]}")
    
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_message = on_mqtt_message
    
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        return True
    except Exception as e:
        print(f"❌ MQTT connection failed: {e}")
        return False

def wait_for_camera(timeout=60):
    """Wait until camera is discovered via MQTT"""
    print(f"\n⏳ Waiting for ESP32-CAM broadcast (timeout: {timeout}s)...")
    print("   Pastikan ESP32-CAM sudah nyala dan connected ke WiFi!")
    
    if camera_discovered.wait(timeout=timeout):
        return True
    else:
        print("\n❌ Timeout! No camera discovered.")
        print("   Cek:")
        print("   1. ESP32-CAM sudah connect ke WiFi?")
        print("   2. ESP32-CAM sudah connect ke MQTT?")
        print("   3. MQTT broker sudah running?")
        return False

def send_mqtt_alert(event_type, data=None):
    """Send alert via MQTT"""
    global mqtt_client
    
    if mqtt_client is None or not mqtt_client.is_connected():
        return False
    
    try:
        payload = {
            "event": event_type,
            "source": "fire_detector_python",
            "timestamp": int(time.time() * 1000),
            "camera": selected_camera
        }
        
        if data:
            payload.update(data)
        
        mqtt_client.publish(MQTT_TOPIC_EVENT, json.dumps(payload))
        return True
    except Exception as e:
        print(f"⚠️  MQTT send error: {e}")
        return False

# ============================================================================
# COLOR VALIDATION (Reduce False Positives)
# ============================================================================

def validate_fire_by_color(frame_roi):
    """
    Validate if detected region looks like fire based on color.
    Fire = orange/red/yellow, Lights = mostly white
    """
    if frame_roi is None or frame_roi.size == 0:
        return False, "Empty ROI", {}
    
    try:
        hsv = cv2.cvtColor(frame_roi, cv2.COLOR_BGR2HSV)
        total_pixels = frame_roi.shape[0] * frame_roi.shape[1]
        
        # Fire colors (orange/red/yellow in HSV)
        # Red: H=0-10 or 170-180
        # Orange: H=10-25
        # Yellow: H=25-35
        lower_red1 = np.array([0, 100, 100])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 100, 100])
        upper_red2 = np.array([180, 255, 255])
        lower_orange = np.array([10, 100, 100])
        upper_orange = np.array([25, 255, 255])
        lower_yellow = np.array([25, 100, 100])
        upper_yellow = np.array([35, 255, 255])
        
        # Create masks
        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_orange = cv2.inRange(hsv, lower_orange, upper_orange)
        mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
        
        fire_mask = mask_red1 | mask_red2 | mask_orange | mask_yellow
        fire_pixels = cv2.countNonZero(fire_mask)
        fire_ratio = fire_pixels / total_pixels
        
        # White/bright detection (lights)
        gray = cv2.cvtColor(frame_roi, cv2.COLOR_BGR2GRAY)
        _, white_mask = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
        white_pixels = cv2.countNonZero(white_mask)
        white_ratio = white_pixels / total_pixels
        
        # Saturation check (fire has high saturation, lights are low)
        avg_saturation = np.mean(hsv[:, :, 1])
        
        color_stats = {
            "fire_ratio": round(fire_ratio * 100, 1),
            "white_ratio": round(white_ratio * 100, 1),
            "avg_saturation": round(avg_saturation, 1)
        }
        
        # Rejection conditions
        if white_ratio > MAX_WHITE_RATIO:
            return False, f"Too white ({white_ratio*100:.0f}%) - likely lamp/LED", color_stats
        
        if fire_ratio < MIN_ORANGE_RED_RATIO:
            return False, f"Not enough fire colors ({fire_ratio*100:.0f}%)", color_stats
        
        if avg_saturation < 50:
            return False, f"Low saturation ({avg_saturation:.0f}) - likely artificial light", color_stats
        
        return True, f"Fire colors detected ({fire_ratio*100:.0f}%)", color_stats
        
    except Exception as e:
        return True, f"Color check error: {e}", {}

# ============================================================================
# GEMINI VERIFICATION
# ============================================================================

def verify_with_gemini(frame):
    """Send frame to Gemini AI for fire verification"""
    try:
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        prompt = """You are a fire detection expert. Analyze this image and determine if there is REAL FIRE.

IMPORTANT DISTINCTION:
- REAL FIRE: Actual flames with flickering motion, smoke, burning materials
- FALSE POSITIVE: LED lights, lamps, reflections, orange/red objects, sunset, decorative lights

Response in JSON format ONLY:
{
    "is_fire": true/false,
    "confidence": 0.0-1.0,
    "description": "brief description",
    "fire_type": "type if fire" or "none"
}"""
        
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_base64}}
                ]
            }],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200}
        }
        
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            text = data['candidates'][0]['content']['parts'][0]['text']
            
            # Parse JSON from response
            import re
            json_match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result.get("is_fire", False), result.get("confidence", 0), result.get("description", "")
        
        return None, None, "API Error"
        
    except Exception as e:
        return None, None, str(e)

# ============================================================================
# FIRE DETECTION MAIN LOOP
# ============================================================================

def run_detection():
    """Main detection loop"""
    global detection_running, last_alert_time, last_whatsapp_time, last_record_time
    global stats
    
    print(f"\n🎬 Starting fire detection...")
    print(f"   Stream URL: {stream_url}")
    
    # Load YOLO model
    print(f"   Loading YOLO model...")
    model = YOLO(MODEL_PATH)
    print(f"   ✅ Model loaded")
    
    # Connect to stream
    print(f"   Connecting to camera stream...")
    cap = cv2.VideoCapture(stream_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    
    if not cap.isOpened():
        print(f"❌ Failed to connect to stream: {stream_url}")
        return
    
    print(f"✅ Stream connected!")
    detection_running = True
    
    # Send MQTT event
    send_mqtt_alert("detection_started", {"stream_url": stream_url})
    
    frame_count = 0
    last_fps_time = time.time()
    fps = 0
    
    print("\n" + "="*60)
    print("🔥 FIRE DETECTION RUNNING")
    print("="*60)
    print("Press 'q' to quit, 'r' to reconnect, 'c' to switch camera")
    print("="*60 + "\n")
    
    while detection_running:
        ret, frame = cap.read()
        
        if not ret:
            print("⚠️  Stream read error, reconnecting...")
            cap.release()
            time.sleep(2)
            cap = cv2.VideoCapture(stream_url)
            continue
        
        frame_count += 1
        current_time = time.time()
        
        # Calculate FPS
        if current_time - last_fps_time >= 1.0:
            fps = frame_count / (current_time - last_fps_time)
            frame_count = 0
            last_fps_time = current_time
        
        # Run YOLO detection
        results = model(frame, conf=CONF_THRESHOLD, verbose=False)
        
        fire_detected = False
        best_detection = None
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                area = (x2 - x1) * (y2 - y1)
                
                if area < MIN_AREA:
                    continue
                
                stats["yolo_detections"] += 1
                
                # Color validation
                if ENABLE_COLOR_VALIDATION:
                    roi = frame[y1:y2, x1:x2]
                    is_valid, reason, color_stats = validate_fire_by_color(roi)
                    
                    if not is_valid:
                        # Draw rejected detection in gray
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (128, 128, 128), 2)
                        cv2.putText(frame, f"REJECTED: {reason[:30]}", (x1, y1-10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (128, 128, 128), 1)
                        continue
                
                # Valid detection
                fire_detected = True
                best_detection = {
                    "conf": conf,
                    "box": (x1, y1, x2, y2),
                    "area": area
                }
                
                # Draw detection
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                cv2.putText(frame, f"FIRE: {conf:.0%}", (x1, y1-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        # Handle fire detection
        if fire_detected and best_detection:
            if current_time - last_alert_time >= ALERT_COOLDOWN:
                print(f"\n🔥 FIRE DETECTED! Conf: {best_detection['conf']:.0%}")
                
                # Send MQTT alert
                send_mqtt_alert("fire_detected", {
                    "confidence": best_detection['conf'],
                    "area": best_detection['area']
                })
                
                # Gemini verification (optional)
                is_fire, gemini_conf, description = verify_with_gemini(frame)
                
                if is_fire is not None:
                    if is_fire and gemini_conf >= GEMINI_SCORE_THRESHOLD:
                        print(f"   ✅ Gemini VERIFIED: {gemini_conf:.0%} - {description}")
                        stats["gemini_verified"] += 1
                        
                        # WhatsApp notification
                        if WHATSAPP_HELPER_AVAILABLE and current_time - last_whatsapp_time >= WHATSAPP_COOLDOWN:
                            try:
                                send_fire_photo_to_whatsapp(frame, best_detection['conf'])
                                last_whatsapp_time = current_time
                                stats["whatsapp_sent"] += 1
                                print(f"   📱 WhatsApp sent!")
                            except Exception as e:
                                print(f"   ⚠️  WhatsApp error: {e}")
                        
                        # Start recording
                        if ENABLE_AUTO_RECORD and current_time - last_record_time >= RECORD_COOLDOWN:
                            threading.Thread(target=record_video, args=(stream_url,), daemon=True).start()
                            last_record_time = current_time
                            stats["recordings"] += 1
                    else:
                        print(f"   ❌ Gemini REJECTED: {gemini_conf:.0%} - {description}")
                        stats["gemini_rejected"] += 1
                else:
                    print(f"   ⚠️  Gemini unavailable, using YOLO-only")
                
                last_alert_time = current_time
        
        # Draw info overlay
        cv2.putText(frame, f"FPS: {fps:.1f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(frame, f"Camera: {selected_camera}", (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"YOLO: {stats['yolo_detections']} | Verified: {stats['gemini_verified']} | Rejected: {stats['gemini_rejected']}", 
                    (10, frame.shape[0]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Show frame
        cv2.imshow("Fire Detection", frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            print("\n🛑 Stopping detection...")
            break
        elif key == ord('r'):
            print("\n🔄 Reconnecting...")
            cap.release()
            cap = cv2.VideoCapture(stream_url)
        elif key == ord('c'):
            print("\n📸 Available cameras:")
            for i, (cam_id, info) in enumerate(available_cameras.items()):
                print(f"   {i+1}. {cam_id} - {info['ip']}")
    
    detection_running = False
    cap.release()
    cv2.destroyAllWindows()
    send_mqtt_alert("detection_stopped")
    print("\n✅ Detection stopped")

def record_video(url):
    """Record video clip"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"fire_{timestamp}.mp4"
        filepath = os.path.join(RECORD_SAVE_DIR, filename)
        
        print(f"   🎬 Recording started: {filename}")
        
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            print(f"   ❌ Failed to open stream for recording")
            return
        
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(filepath, fourcc, RECORD_FPS, (width, height))
        
        start_time = time.time()
        while time.time() - start_time < RECORD_DURATION:
            ret, frame = cap.read()
            if ret:
                out.write(frame)
            else:
                break
        
        cap.release()
        out.release()
        
        print(f"   ✅ Recording saved: {filepath}")
        
    except Exception as e:
        print(f"   ❌ Recording error: {e}")

# ============================================================================
# MAIN
# ============================================================================

def list_cameras():
    """List all discovered cameras"""
    if not available_cameras:
        print("\n📸 No cameras discovered yet")
        return
    
    print("\n" + "="*50)
    print("📸 AVAILABLE CAMERAS")
    print("="*50)
    for i, (cam_id, info) in enumerate(available_cameras.items(), 1):
        selected = "✅ " if cam_id == selected_camera else "   "
        print(f"{selected}{i}. {cam_id}")
        print(f"      IP: {info['ip']}")
        print(f"      Stream: {info['stream_url']}")
        print(f"      WiFi: {info['ssid']} ({info['rssi']} dBm)")
    print("="*50)

def select_camera(index):
    """Select camera by index"""
    global selected_camera, stream_url
    
    if not available_cameras:
        print("❌ No cameras available")
        return False
    
    cam_list = list(available_cameras.items())
    if 1 <= index <= len(cam_list):
        cam_id, info = cam_list[index - 1]
        selected_camera = cam_id
        stream_url = info['stream_url']
        print(f"✅ Selected: {cam_id} ({info['ip']})")
        return True
    else:
        print(f"❌ Invalid index. Choose 1-{len(cam_list)}")
        return False

def main():
    """Main entry point"""
    global stream_url
    
    print("\n" + "="*60)
    print("🔥 FIRE DETECTION - AUTO IP VIA MQTT")
    print("="*60)
    print()
    
    # Setup MQTT
    if not setup_mqtt():
        print("\n❌ MQTT setup failed. Trying manual mode...")
        
        # Manual fallback
        manual_url = input("\nEnter ESP32-CAM stream URL manually:\n> ").strip()
        if manual_url:
            stream_url = manual_url
        else:
            print("❌ No URL provided. Exiting.")
            return
    else:
        # Wait for camera discovery
        if not wait_for_camera(timeout=60):
            # No camera found, try manual
            print("\n💡 Try manual input:")
            manual_url = input("Enter ESP32-CAM stream URL (or press Enter to exit):\n> ").strip()
            if manual_url:
                stream_url = manual_url
            else:
                print("❌ Exiting.")
                return
    
    if stream_url:
        # List cameras
        list_cameras()
        
        # Start detection
        try:
            run_detection()
        except KeyboardInterrupt:
            print("\n\n🛑 Interrupted by user")
        finally:
            # Cleanup
            if mqtt_client:
                mqtt_client.loop_stop()
                mqtt_client.disconnect()
            cv2.destroyAllWindows()
            
            # Print stats
            print("\n" + "="*50)
            print("📊 SESSION STATS")
            print("="*50)
            for key, value in stats.items():
                print(f"   {key}: {value}")
            print("="*50)

if __name__ == "__main__":
    main()
