"""
🔥 FIRE DETECTION + AUTO VIDEO RECORDING + WEB LOGGING - GEMINI-FOCUSED
==========================================================================
HYBRID SYSTEM: YOLO (Fast Candidate Detection) + Gemini AI (Accurate Verification)

Architecture:
- YOLO YOLOv8: Fast initial screening (low threshold, catches more candidates)
- Gemini 2.0 Flash: Deep verification (strict threshold, high accuracy)
- Auto Video Recording: Only when Gemini confirms real fire
- Real-time Web Dashboard: WebSocket logging + video gallery
- MQTT Alerts: ESP32 DevKit buzzer/LED activation

Detection Flow:
1. YOLO detects potential fire (threshold: 0.20, sensitive)
2. Submit to Gemini AI for verification (async, non-blocking)
3. Gemini analyzes with detailed prompt (threshold: 0.50, strict)
4. If verified → Start recording + MQTT alert + WebSocket log
5. Record 30s video → Upload to web server
6. Cooldown 60s before next recording

Features:
✅ Gemini-focused verification (better accuracy than YOLO-only)
✅ Async Gemini processing (non-blocking, no FPS drop)
✅ Detailed verification prompt (reduce false positives)
✅ Auto-record only verified fires (prevent spam)
✅ Real-time stats: YOLO detections, Gemini verified/rejected, accuracy %
✅ Fallback mode: High-confidence YOLO if Gemini unavailable (0.70+)
✅ WebSocket logging to dashboard (real-time updates)
✅ MQTT alerts to ESP32 DevKit (buzzer/LED control)

Configuration:
- YOLO Threshold: 0.20 (catch more candidates)
- Gemini Threshold: 0.50 (strict verification)
- Process Every Frame: Yes (better coverage)
- Fallback YOLO Threshold: 0.70 (very high confidence only)

Author: GitHub Copilot
Date: December 9, 2025
Version: 2.0 (Gemini-Focused)
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
import websocket

# Optional imports
try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("⚠️  paho-mqtt not installed - MQTT disabled")

try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

# Import WhatsApp helper
try:
    sys.path.insert(0, "D:/zakaiot")  # Add zakaiot to path
    from fire_whatsapp_helper import send_fire_photo_to_whatsapp
    WHATSAPP_HELPER_AVAILABLE = True
    print("✅ WhatsApp helper loaded successfully")
except ImportError as e:
    WHATSAPP_HELPER_AVAILABLE = False
    print(f"⚠️  WhatsApp helper not available: {e}")
    print("   Photo will only be sent to web dashboard")

print("\n" + "="*80)
print("🔥 FIRE DETECTION + AUTO VIDEO RECORDING + WEB LOGGING")
print("="*80)
print()

# ============================================================================
# CONFIGURATION
# ============================================================================

# ESP32-CAM Configuration (will be set from user input or .env)
ESP32_CAM_IP = None  # Will be set later
STREAM_URL = None  # Will be set later

# Model Configuration
MODEL_PATH = "D:/zakaiot/fire_yolov8s_ultra_best.pt"
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "D:/zakaiot/fire_training/fire_yolov8n_best.pt"
    if not os.path.exists(MODEL_PATH):
        print(f"❌ Model not found! Please check path.")
        exit(1)

# Detection Parameters (Gemini-focused)
CONF_THRESHOLD = 0.35  # YOLO threshold - balanced for accuracy (was 0.20)
MIN_AREA = 200  # Minimum detection area to filter noise (was 100)
GEMINI_SCORE_THRESHOLD = 0.50  # Higher Gemini threshold for stricter verification
GEMINI_COOLDOWN = 0.8  # Faster verification (reduced from 1.0)

# Color-based Fire Validation (reduce false positives from lights)
ENABLE_COLOR_VALIDATION = True  # Enable color-based fire validation
MIN_ORANGE_RED_RATIO = 0.15  # Minimum ratio of orange/red pixels in detection (15%)
MAX_WHITE_RATIO = 0.60  # Maximum ratio of white/bright pixels (60%) - lights are mostly white

# Fallback Recording (when Gemini unavailable)
FALLBACK_RECORD_ENABLED = True  # Record with YOLO-only if Gemini fails
FALLBACK_CONF_THRESHOLD = 0.80  # Very high confidence required for YOLO-only (was 0.70)

# Gemini Configuration
GEMINI_MODEL = "gemini-2.5-flash-lite"  # Lighter model with more quota available
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyAGX6tPV18q3xaVMsu2wSeJ6_8TcJapFm0")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# Video Recording Configuration
ENABLE_AUTO_RECORD = True  # Auto-record when fire detected
RECORD_SAVE_DIR = "D:/fire_recordings"  # Local save directory
RECORD_DURATION = 30  # seconds per recording
RECORD_FPS = 20
RECORD_FOURCC = cv2.VideoWriter_fourcc(*'mp4v')
RECORD_COOLDOWN = 60  # Seconds between recordings (prevent spam)

# Upload Configuration
UPLOAD_API = "http://localhost:8080/api/video/upload"
AUTO_UPLOAD_AFTER_RECORD = True

# Web Logging Configuration
WEB_LOG_ENABLED = True
WEB_LOG_WS_URL = "ws://localhost:8080/ws"
PROXY_SERVER_URL = "http://localhost:8080"

# MQTT Configuration
MQTT_ENABLED = MQTT_AVAILABLE
MQTT_BROKER = "3.27.0.139"
MQTT_PORT = 1883
MQTT_USER = "zaks"
MQTT_PASSWORD = "enggangodinginmcu"
MQTT_TOPIC_ALERT = "lab/zaks/alert"
MQTT_TOPIC_LOG = "lab/zaks/log"
MQTT_TOPIC_EVENT = "lab/zaks/event"

# Performance Settings
PROCESS_EVERY_N_FRAMES = 1  # Process every frame for better Gemini coverage
DISPLAY_SCALE = 1.0

# Alert Configuration
ALERT_COOLDOWN = 5.0
WHATSAPP_COOLDOWN = 60

# Web Dashboard Fire Detection Gallery API
WEB_API_URL = "http://localhost:8080/api/fire-detection"
SEND_TO_WEB = True  # Enable sending to Fire Detection Gallery
SEND_TO_WHATSAPP = True  # Enable sending to WhatsApp

# Create directories
os.makedirs(RECORD_SAVE_DIR, exist_ok=True)
print(f"📁 Recording directory: {RECORD_SAVE_DIR}")

# ============================================================================
# WEB LOGGER CLASS
# ============================================================================

class WebLogger:
    """Send real-time logs to web dashboard via WebSocket"""
    
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self.connected = False
        self.log_queue = Queue()
        self.worker_thread = None
        self.running = False
        
    def connect(self):
        """Connect to WebSocket server"""
        try:
            print(f"📡 Connecting to WebSocket: {self.ws_url}")
            self.ws = websocket.create_connection(self.ws_url, timeout=5)
            self.connected = True
            print(f"✅ WebSocket connected!")
            
            # Start worker thread
            self.running = True
            self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.worker_thread.start()
            
            # Send initial log
            self.log("system", "Fire Detection System Started", "info")
            return True
            
        except Exception as e:
            print(f"⚠️  WebSocket connection failed: {e}")
            self.connected = False
            return False
    
    def _worker_loop(self):
        """Worker thread to send queued logs"""
        while self.running:
            try:
                log_data = self.log_queue.get(timeout=0.5)
                if self.connected and self.ws:
                    self.ws.send(json.dumps(log_data))
            except Empty:
                continue
            except Exception as e:
                print(f"⚠️  WebSocket send error: {e}")
                self.connected = False
                break
    
    def log(self, category, message, level="info", metadata=None):
        """
        Send log to web dashboard
        
        Args:
            category: Log category (fire_detection, recording, system, etc.)
            message: Log message
            level: Log level (info, warning, error, success)
            metadata: Additional data (dict)
        """
        log_data = {
            "topic": MQTT_TOPIC_LOG,
            "type": "log",
            "category": category,
            "level": level,
            "message": message,
            "timestamp": int(time.time() * 1000),
            "source": "fire_detection_ultimate"
        }
        
        if metadata:
            log_data["metadata"] = metadata
        
        try:
            self.log_queue.put_nowait(log_data)
        except:
            pass  # Queue full, skip log
    
    def disconnect(self):
        """Disconnect from WebSocket"""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=1)
        
        if self.ws:
            try:
                self.log("system", "Fire Detection System Stopped", "info")
                time.sleep(0.2)
                self.ws.close()
            except:
                pass
        
        self.connected = False
        print("📡 WebSocket disconnected")

# ============================================================================
# COLOR-BASED FIRE VALIDATION (Reduce False Positives)
# ============================================================================

def validate_fire_by_color(frame_roi):
    """
    Validate if detected region looks like fire based on color analysis.
    Fire typically has orange/red/yellow colors, while lights are mostly white/bright.
    
    Args:
        frame_roi: Cropped region of interest (BGR format)
    
    Returns:
        tuple: (is_valid, reason, color_stats)
    """
    if frame_roi is None or frame_roi.size == 0:
        return False, "Empty ROI", {}
    
    try:
        # Convert to HSV for better color analysis
        hsv = cv2.cvtColor(frame_roi, cv2.COLOR_BGR2HSV)
        
        # Get total pixels
        total_pixels = frame_roi.shape[0] * frame_roi.shape[1]
        if total_pixels == 0:
            return False, "Zero pixels", {}
        
        # Define color ranges for fire (in HSV)
        # Orange/Red: H=0-25 or H=160-180, S>50, V>50
        # Yellow: H=25-35, S>50, V>50
        
        # Lower red (H: 0-10)
        lower_red1 = np.array([0, 80, 80])
        upper_red1 = np.array([10, 255, 255])
        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        
        # Upper red (H: 160-180)
        lower_red2 = np.array([160, 80, 80])
        upper_red2 = np.array([180, 255, 255])
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        
        # Orange (H: 10-25)
        lower_orange = np.array([10, 80, 80])
        upper_orange = np.array([25, 255, 255])
        mask_orange = cv2.inRange(hsv, lower_orange, upper_orange)
        
        # Yellow (H: 25-35)
        lower_yellow = np.array([25, 80, 80])
        upper_yellow = np.array([35, 255, 255])
        mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
        
        # White/Bright detection (low saturation, high value)
        lower_white = np.array([0, 0, 200])
        upper_white = np.array([180, 60, 255])
        mask_white = cv2.inRange(hsv, lower_white, upper_white)
        
        # Calculate pixel counts
        red_pixels = cv2.countNonZero(mask_red1) + cv2.countNonZero(mask_red2)
        orange_pixels = cv2.countNonZero(mask_orange)
        yellow_pixels = cv2.countNonZero(mask_yellow)
        white_pixels = cv2.countNonZero(mask_white)
        
        # Calculate ratios
        fire_color_pixels = red_pixels + orange_pixels + yellow_pixels
        fire_ratio = fire_color_pixels / total_pixels
        white_ratio = white_pixels / total_pixels
        
        color_stats = {
            "red_ratio": red_pixels / total_pixels,
            "orange_ratio": orange_pixels / total_pixels,
            "yellow_ratio": yellow_pixels / total_pixels,
            "fire_ratio": fire_ratio,
            "white_ratio": white_ratio,
            "total_pixels": total_pixels
        }
        
        # Validation logic
        # Reject if too much white (likely a lamp/LED)
        if white_ratio > MAX_WHITE_RATIO:
            return False, f"Too white ({white_ratio:.1%}) - likely lamp/LED", color_stats
        
        # Reject if not enough fire colors
        if fire_ratio < MIN_ORANGE_RED_RATIO:
            return False, f"Low fire colors ({fire_ratio:.1%}) - not fire-like", color_stats
        
        # Accept if good fire color ratio
        return True, f"Fire colors: {fire_ratio:.1%}, White: {white_ratio:.1%}", color_stats
        
    except Exception as e:
        return False, f"Color analysis error: {e}", {}

# ============================================================================
# WEB DASHBOARD SENDER (Fire Detection Gallery)
# ============================================================================

def send_detection_to_web(frame, bbox, confidence, gemini_score=None, gemini_reason=None, 
                          gemini_verified=False, camera_ip="unknown"):
    """
    Send fire detection snapshot to web dashboard Fire Detection Gallery
    
    Args:
        frame: OpenCV frame (BGR)
        bbox: Bounding box [x1, y1, x2, y2]
        confidence: YOLO confidence score
        gemini_score: Gemini verification score (optional)
        gemini_reason: Gemini reason text (optional)
        gemini_verified: Boolean verification status
        camera_ip: ESP32-CAM IP address
    
    Returns:
        bool: True if sent successfully
    """
    if not SEND_TO_WEB:
        return False
    
    try:
        # Draw bounding box on frame copy
        frame_copy = frame.copy()
        if bbox:
            x1, y1, x2, y2 = map(int, bbox)
            color = (0, 255, 0) if gemini_verified else (0, 0, 255)  # Green if verified, Red otherwise
            cv2.rectangle(frame_copy, (x1, y1), (x2, y2), color, 3)
            
            # Add label
            status = "VERIFIED" if gemini_verified else "DETECTED"
            label = f"Fire {status} {confidence*100:.1f}%"
            cv2.putText(frame_copy, label, (x1, y1 - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            # Add timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(frame_copy, timestamp, (10, frame_copy.shape[0] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        # Encode frame as JPEG
        ok, jpg = cv2.imencode('.jpg', frame_copy, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not ok:
            print("⚠️  Failed to encode snapshot")
            return False
        
        # Prepare multipart form data
        files = {
            'snapshot': ('fire_detection.jpg', jpg.tobytes(), 'image/jpeg')
        }
        
        data = {
            'confidence': str(confidence),
            'bbox': json.dumps([int(v) for v in bbox]) if bbox else '[]',
            'cameraIp': camera_ip,
            'cameraId': f'esp32cam_{camera_ip.replace(".", "_")}',
            'yoloModel': 'yolov8s',
        }
        
        if gemini_score is not None:
            data['geminiScore'] = str(gemini_score)
        
        if gemini_reason:
            data['geminiReason'] = gemini_reason[:200]
        
        data['geminiVerified'] = 'true' if gemini_verified else 'false'
        
        # Send POST request
        response = requests.post(
            WEB_API_URL,
            files=files,
            data=data,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                detection_id = result.get('detection', {}).get('id', 'unknown')
                print(f"📤 Snapshot sent to Fire Detection Gallery: {detection_id}")
                return True
            else:
                print(f"⚠️  Web API error: {result.get('error')}")
                return False
        else:
            print(f"⚠️  Web API HTTP {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("⚠️  Web API timeout")
        return False
    except requests.exceptions.ConnectionError:
        print("⚠️  Web API connection refused (is proxy-server running?)")
        return False
    except Exception as e:
        print(f"⚠️  Web API error: {e}")
        return False

# ============================================================================
# VIDEO RECORDER CLASS
# ============================================================================

class FireVideoRecorder:
    """Auto-record video when fire detected"""
    
    def __init__(self, save_dir, fps, duration, upload_api, web_logger):
        self.save_dir = save_dir
        self.fps = fps
        self.duration = duration
        self.upload_api = upload_api
        self.web_logger = web_logger
        
        self.is_recording = False
        self.writer = None
        self.record_start_time = None
        self.current_filepath = None
        self.frame_count = 0
        self.last_record_time = 0
    
    def can_start_recording(self):
        """Check if can start new recording (cooldown check)"""
        return (time.time() - self.last_record_time) >= RECORD_COOLDOWN
    
    def start_recording(self, first_frame, detection_info):
        """Start recording video"""
        if self.is_recording:
            return False
        
        if not self.can_start_recording():
            remaining = int(RECORD_COOLDOWN - (time.time() - self.last_record_time))
            self.web_logger.log("recording", f"Recording cooldown active ({remaining}s remaining)", "warning")
            return False
        
        try:
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"fire_detection_{timestamp}.mp4"
            self.current_filepath = os.path.join(self.save_dir, filename)
            
            # Get frame dimensions
            height, width = first_frame.shape[:2]
            
            # Create video writer
            self.writer = cv2.VideoWriter(
                self.current_filepath,
                RECORD_FOURCC,
                self.fps,
                (width, height)
            )
            
            if not self.writer.isOpened():
                self.web_logger.log("recording", "Failed to create video writer", "error")
                return False
            
            self.is_recording = True
            self.record_start_time = time.time()
            self.frame_count = 0
            self.last_record_time = time.time()
            
            log_msg = f"🎬 Recording started: {filename} ({self.duration}s)"
            print(f"\n{log_msg}")
            self.web_logger.log("recording", log_msg, "success", {
                "filename": filename,
                "duration": self.duration,
                "detection": detection_info
            })
            
            return True
            
        except Exception as e:
            self.web_logger.log("recording", f"Recording start error: {e}", "error")
            return False
    
    def write_frame(self, frame):
        """Write frame to video"""
        if not self.is_recording or not self.writer:
            return
        
        try:
            self.writer.write(frame)
            self.frame_count += 1
            
            # Check if duration reached
            elapsed = time.time() - self.record_start_time
            if elapsed >= self.duration:
                self.stop_recording()
        except Exception as e:
            print(f"⚠️  Frame write error: {e}")
    
    def stop_recording(self):
        """Stop recording and optionally upload"""
        if not self.is_recording:
            return
        
        try:
            # Close writer
            if self.writer:
                self.writer.release()
                self.writer = None
            
            elapsed = time.time() - self.record_start_time
            file_size = os.path.getsize(self.current_filepath) / (1024 * 1024)  # MB
            
            log_msg = f"✅ Recording complete: {os.path.basename(self.current_filepath)} ({elapsed:.1f}s, {file_size:.2f}MB, {self.frame_count} frames)"
            print(f"\n{log_msg}")
            self.web_logger.log("recording", log_msg, "success", {
                "filepath": self.current_filepath,
                "duration": elapsed,
                "file_size_mb": file_size,
                "frames": self.frame_count
            })
            
            # Upload to server (async)
            if AUTO_UPLOAD_AFTER_RECORD:
                threading.Thread(
                    target=self._upload_video,
                    args=(self.current_filepath, elapsed),
                    daemon=True
                ).start()
            
            self.is_recording = False
            self.current_filepath = None
            self.frame_count = 0
            
        except Exception as e:
            self.web_logger.log("recording", f"Recording stop error: {e}", "error")
    
    def _upload_video(self, filepath, duration):
        """Upload video to server"""
        try:
            self.web_logger.log("upload", f"📤 Uploading: {os.path.basename(filepath)}", "info")
            
            with open(filepath, 'rb') as f:
                files = {'video': (os.path.basename(filepath), f, 'video/mp4')}
                data = {
                    'cameraIp': ESP32_CAM_IP,
                    'startTime': int((time.time() - duration) * 1000),
                    'duration': int(duration)
                }
                
                response = requests.post(
                    self.upload_api,
                    files=files,
                    data=data,
                    timeout=300  # 5 minutes timeout for large files
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        log_msg = f"✅ Upload successful: {result['filename']}"
                        self.web_logger.log("upload", log_msg, "success", {
                            "filename": result['filename'],
                            "size": result.get('size', 0)
                        })
                        print(f"\n{log_msg}")
                    else:
                        raise Exception(result.get('error', 'Upload failed'))
                else:
                    raise Exception(f"HTTP {response.status_code}")
                    
        except Exception as e:
            log_msg = f"❌ Upload failed: {e}"
            print(f"\n{log_msg}")
            self.web_logger.log("upload", log_msg, "error")

# ============================================================================
# GEMINI VERIFIER (from zakaiot)
# ============================================================================

class GeminiVerifier:
    """Async Gemini verifier dengan threading untuk non-blocking"""
    
    def __init__(self, api_key, api_url, web_logger):
        self.api_key = api_key
        self.api_url = api_url
        self.web_logger = web_logger
        self.request_queue = Queue(maxsize=2)
        self.result_queue = Queue()
        self.running = False
        self.worker_thread = None
        
        # Statistics tracking
        self.verified_count = 0
        self.rejected_count = 0
        self.error_count = 0
        self.total_requests = 0
        self.avg_response_time = 0
    
    def start(self):
        self.running = True
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        self.web_logger.log("system", "Gemini AI verification started", "info")
    
    def stop(self):
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=2)
    
    def _worker_loop(self):
        """Background worker thread for async Gemini verification"""
        while self.running:
            try:
                req_id, frame_bgr, yolo_conf = self.request_queue.get(timeout=0.5)
                
                print(f"   🔍 Processing req#{req_id} (YOLO: {yolo_conf:.2f})...")
                start_time = time.time()
                
                try:
                    result = self._verify_fire(frame_bgr, yolo_conf)
                    print(f"   ✓ req#{req_id} completed in {time.time()-start_time:.2f}s: {result.get('status', 'unknown')}")
                except Exception as verify_error:
                    print(f"   ⚠️  Verify error (req#{req_id}): {verify_error}")
                    result = {"status": "error", "reason": str(verify_error)[:100]}
                
                response_time = time.time() - start_time
                
                # Update average response time
                self.avg_response_time = (self.avg_response_time * self.total_requests + response_time) / (self.total_requests + 1)
                self.total_requests += 1
                
                result["response_time"] = response_time
                self.result_queue.put((req_id, result))
                
            except Empty:
                continue
            except Exception as e:
                print(f"   ⚠️  Worker loop error: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(0.1)
    
    def _verify_fire(self, frame_bgr, yolo_conf):
        try:
            h, w = frame_bgr.shape[:2]
            if w > 400 or h > 400:
                scale = min(400/w, 400/h)
                frame_bgr = cv2.resize(frame_bgr, (int(w*scale), int(h*scale)))
            
            ok, jpg = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            if not ok:
                return {"status": "error", "reason": "Encode failed"}
            
            img_b64 = base64.b64encode(jpg.tobytes()).decode('utf-8')
            print(f"      → Sending to Gemini API...")
            
            prompt = f"""Analyze for REAL FIRE/FLAMES (YOLO: {yolo_conf:.2f}).

✅ FIRE = visible flames, combustion, burning (lighter/candle/match)
❌ NOT FIRE = LED lights, screens, colored objects, ambient light

Respond ONLY in this exact JSON format (keep reason under 50 chars):
{{"is_fire": true/false, "score": 0.0-1.0, "reason": "brief description"}}

If unsure but could be fire: mark true, score 0.5-0.7."""
            
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 500  # Increased to prevent MAX_TOKENS truncation
                    # Removed responseMimeType - not supported by gemini-2.5-flash
                }
            }
            
            response = requests.post(
                self.api_url,
                headers={"Content-Type": "application/json", "X-goog-api-key": self.api_key},
                json=payload,
                timeout=15
            )
            
            print(f"      → Gemini responded: HTTP {response.status_code}")
            
            if response.status_code == 429:
                print(f"      ⚠️  QUOTA EXCEEDED - Switching to YOLO-only fallback mode")
                self.error_count += 1
                return {"status": "quota_exceeded", "reason": "Quota exceeded - use YOLO fallback"}
            
            if response.status_code != 200:
                error_msg = response.text[:200] if response.text else "No response body"
                print(f"      ⚠️  HTTP {response.status_code}: {error_msg}")
                return {"status": "error", "reason": f"HTTP {response.status_code}"}
            
            resp_json = response.json()
            
            # Debug: Print raw response structure
            print(f"      → Response keys: {list(resp_json.keys())}")
            if "candidates" in resp_json and len(resp_json["candidates"]) > 0:
                print(f"      → Candidate finishReason: {resp_json['candidates'][0].get('finishReason', 'none')}")
            
            # Robust response parsing
            if "candidates" not in resp_json or len(resp_json["candidates"]) == 0:
                return {"status": "error", "reason": "No candidates"}
            
            candidate = resp_json["candidates"][0]
            finish_reason = candidate.get("finishReason", "")
            
            if finish_reason == "SAFETY":
                return {"status": "error", "reason": "Safety block"}
            
            if finish_reason == "MAX_TOKENS":
                print(f"      ⚠️  Response truncated (MAX_TOKENS) - increase maxOutputTokens")
                return {"status": "error", "reason": "Response truncated"}
            
            if "content" not in candidate:
                return {"status": "error", "reason": f"No content ({finish_reason})"}
            
            content = candidate["content"]
            
            if "parts" not in content or len(content["parts"]) == 0:
                return {"status": "error", "reason": "No parts"}
            
            text = content["parts"][0].get("text", "")
            
            if not text:
                return {"status": "error", "reason": "Empty text"}
            
            # Clean JSON from markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            result = json.loads(text)
            is_fire = bool(result.get("is_fire", False))
            score = float(result.get("score", 0.0))
            reason = str(result.get("reason", ""))[:150]
            
            if is_fire and score >= GEMINI_SCORE_THRESHOLD:
                self.verified_count += 1
                return {"status": "verified", "score": score, "reason": reason}
            else:
                self.rejected_count += 1
                return {"status": "rejected", "score": score, "reason": reason}
                
        except Exception as e:
            self.error_count += 1
            return {"status": "error", "reason": str(e)[:100]}
    
    def submit_verification(self, req_id, frame_bgr, yolo_conf):
        try:
            self.request_queue.put_nowait((req_id, frame_bgr.copy(), yolo_conf))
            return True
        except:
            return False
    
    def get_result(self):
        try:
            return self.result_queue.get_nowait()
        except Empty:
            return None, None

# ============================================================================
# MQTT MANAGER (from zakaiot)
# ============================================================================

class MQTTManager:
    """MQTT connection manager"""
    
    def __init__(self, broker, port, user, password, web_logger):
        self.broker = broker
        self.port = port
        self.user = user
        self.password = password
        self.web_logger = web_logger
        self.client_id = f"fire_detector_{uuid.getnode():x}"
        self.client = None
        self.connected = False
        self.running = False
        self.alerts_sent = 0
    
    def connect(self):
        try:
            if not MQTT_AVAILABLE:
                return False
            
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self.client_id
            )
            self.client.username_pw_set(self.user, self.password)
            self.client.on_connect = self._on_connect
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
            self.running = True
            
            timeout = 10
            start = time.time()
            while not self.connected and (time.time() - start) < timeout:
                time.sleep(0.1)
            
            if self.connected:
                self.web_logger.log("system", f"MQTT connected: {self.broker}", "success")
            
            return self.connected
        except Exception as e:
            self.web_logger.log("system", f"MQTT connection error: {e}", "error")
            return False
    
    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
        else:
            self.connected = False
    
    def publish_alert(self, confidence, bbox, gemini_score=None, gemini_reason=None):
        if not self.connected:
            return False
        
        payload = {
            "id": self.client_id,
            "src": "fire_detector_ultimate",
            "alert": "flame_detected",
            "conf": float(confidence),
            "bbox": [int(v) for v in bbox],
            "gemini_score": float(gemini_score) if gemini_score else None,
            "gemini_reason": gemini_reason,
            "ts": int(time.time())
        }
        
        try:
            self.client.publish(MQTT_TOPIC_ALERT, json.dumps(payload), qos=1)
            self.alerts_sent += 1
            self.web_logger.log("alert", f"🚨 MQTT Alert sent (YOLO: {confidence:.2f}, Gemini: {gemini_score:.2f})", "warning", payload)
            return True
        except Exception as e:
            self.web_logger.log("alert", f"MQTT publish error: {e}", "error")
            return False
    
    def disconnect(self):
        if self.client and self.running:
            self.client.loop_stop()
            self.client.disconnect()
            self.running = False

# ============================================================================
# MAIN SYSTEM
# ============================================================================

def main():
    global ESP32_CAM_IP, STREAM_URL
    
    # Get ESP32-CAM IP from user input or environment variable
    print(f"\n{'='*80}")
    print("ESP32-CAM CONFIGURATION")
    print(f"{'='*80}")
    
    # Try to get from environment variable first
    env_ip = os.getenv("ESP32_CAM_IP", "")
    
    if env_ip:
        print(f"Found IP in .env: {env_ip}")
        use_env = input(f"Use this IP? (Y/n): ").strip().lower()
        if use_env != 'n':
            ESP32_CAM_IP = env_ip
    
    # If not set, ask user for input
    if not ESP32_CAM_IP:
        print("\nEnter ESP32-CAM IP address")
        print("Examples:")
        print("  - 10.148.218.219")
        print("  - 192.168.1.100")
        print("  - 192.168.43.1")
        print()
        
        while True:
            user_ip = input("ESP32-CAM IP: ").strip()
            if user_ip:
                # Validate IP format (basic)
                parts = user_ip.split('.')
                if len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
                    ESP32_CAM_IP = user_ip
                    break
                else:
                    print("❌ Invalid IP format! Please enter valid IPv4 address (e.g., 192.168.1.100)")
            else:
                print("❌ IP address required!")
    
    # Set stream URL
    STREAM_URL = f"http://{ESP32_CAM_IP}:81/stream"
    
    print(f"\n✅ ESP32-CAM IP set to: {ESP32_CAM_IP}")
    print(f"📡 Stream URL: {STREAM_URL}")
    print(f"{'='*80}\n")
    
    # Initialize Web Logger
    web_logger = WebLogger(WEB_LOG_WS_URL) if WEB_LOG_ENABLED else None
    if web_logger:
        web_logger.connect()
        web_logger.log("system", f"ESP32-CAM IP configured: {ESP32_CAM_IP}", "info")
    
    # Load YOLO model
    print(f"📦 Loading YOLO model: {MODEL_PATH}")
    if web_logger:
        web_logger.log("system", f"Loading YOLO model: {os.path.basename(MODEL_PATH)}", "info")
    
    model = YOLO(MODEL_PATH)
    print(f"✅ YOLO model loaded successfully!")
    if web_logger:
        web_logger.log("system", "YOLO model loaded", "success")
    
    # Initialize Gemini
    gemini_verifier = None
    try:
        print(f"🤖 Initializing Gemini AI ({GEMINI_MODEL})...")
        print(f"   Testing API connection...")
        
        test_response = requests.post(
            GEMINI_API_URL,
            headers={"Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY},
            json={"contents": [{"parts": [{"text": "Hello"}]}]},
            timeout=10
        )
        
        if test_response.status_code == 200:
            print(f"✅ Gemini {GEMINI_MODEL} ready!")
            gemini_verifier = GeminiVerifier(GEMINI_API_KEY, GEMINI_API_URL, web_logger) if web_logger else GeminiVerifier(GEMINI_API_KEY, GEMINI_API_URL, WebLogger(WEB_LOG_WS_URL))
            gemini_verifier.start()
            print("\n" + "="*80)
            print("🎯 GEMINI-FOCUSED DETECTION STRATEGY")
            print("="*80)
            print(f"YOLO Role: Fast candidate detection (threshold: {CONF_THRESHOLD})")
            print(f"Gemini Role: Accurate verification (threshold: {GEMINI_SCORE_THRESHOLD})")
            print()
            print("Detection Flow:")
            print("  1. YOLO detects potential fire → Submit to Gemini")
            print("  2. Gemini analyzes with detailed prompt")
            print("  3. If Gemini score ≥ 0.50 → ✅ VERIFIED → Start recording")
            print("  4. If Gemini score < 0.50 → ❌ REJECTED → No recording")
            print()
            print(f"Fallback: YOLO-only if Gemini unavailable (conf ≥ {FALLBACK_CONF_THRESHOLD})")
            print("="*80 + "\n")
        else:
            print(f"\n⚠️  Gemini API test failed - HTTP {test_response.status_code}")
            if test_response.status_code == 403:
                print(f"   Error: API key reported as leaked or invalid")
                print(f"   Solution: Get new API key from https://aistudio.google.com/apikey")
            elif test_response.status_code == 429:
                print(f"   Error: Quota exceeded - Free tier limit reached")
                print(f"   Solution: Wait for quota reset or upgrade plan")
            else:
                print(f"   Response: {test_response.text[:200]}")
            print(f"   Falling back to YOLO-only mode")
            print(f"   Recording threshold: {FALLBACK_CONF_THRESHOLD}\n")
    except requests.exceptions.Timeout:
        print(f"\n⚠️  Gemini API timeout - check internet connection")
        print(f"   Falling back to YOLO-only mode")
        print(f"   Recording threshold: {FALLBACK_CONF_THRESHOLD}\n")
    except requests.exceptions.ConnectionError:
        print(f"\n⚠️  Gemini API connection error - check internet")
        print(f"   Falling back to YOLO-only mode")
        print(f"   Recording threshold: {FALLBACK_CONF_THRESHOLD}\n")
    except Exception as e:
        print(f"\n⚠️  Gemini error: {e}")
        print(f"   Fallback to YOLO-only mode (threshold: {FALLBACK_CONF_THRESHOLD})\n")
    
    # Initialize MQTT
    mqtt_manager = None
    if MQTT_ENABLED:
        mqtt_manager = MQTTManager(MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASSWORD, web_logger) if web_logger else None
        if mqtt_manager:
            mqtt_manager.connect()
    
    # Initialize Video Recorder
    video_recorder = None
    if ENABLE_AUTO_RECORD:
        video_recorder = FireVideoRecorder(
            RECORD_SAVE_DIR,
            RECORD_FPS,
            RECORD_DURATION,
            UPLOAD_API,
            web_logger if web_logger else WebLogger(WEB_LOG_WS_URL)
        )
        print(f"📹 Auto-recording enabled: {RECORD_DURATION}s clips")
        if web_logger:
            web_logger.log("system", f"Auto-recording enabled ({RECORD_DURATION}s clips)", "info")
    
    # Connect to ESP32-CAM
    print(f"\n{'='*80}")
    print(f"Connecting to ESP32-CAM: {ESP32_CAM_IP}")
    print(f"Stream URL: {STREAM_URL}")
    print(f"{'='*80}\n")
    
    if web_logger:
        web_logger.log("system", f"Connecting to ESP32-CAM: {ESP32_CAM_IP}", "info")
    
    # Detection loop variables
    pending_verifications = {}
    next_req_id = 0
    last_gemini_time = 0
    last_alert_time = 0
    last_whatsapp_time = 0  # WhatsApp cooldown tracker
    whatsapp_sent = 0  # Count WhatsApp messages sent
    yolo_count = 0
    fps = 0
    frame_count = 0
    start_time = time.time()
    frame_skip_counter = 0
    latest_detections = []
    
    # Open stream with retry
    max_retries = 3
    retry_count = 0
    stream = None
    
    while retry_count < max_retries and stream is None:
        try:
            if retry_count > 0:
                print(f"🔄 Retry {retry_count}/{max_retries}...")
                time.sleep(2)
            
            stream = urllib.request.urlopen(STREAM_URL, timeout=10)
            break  # Success
        except urllib.error.URLError as e:
            retry_count += 1
            if retry_count >= max_retries:
                print(f"❌ Failed to connect after {max_retries} attempts: {e}")
                if web_logger:
                    web_logger.log("system", f"Stream connection failed: {e}", "error")
                # Cleanup and exit
                if gemini_verifier:
                    gemini_verifier.stop()
                if mqtt_manager:
                    mqtt_manager.disconnect()
                if web_logger:
                    web_logger.disconnect()
                return
        except socket.timeout:
            retry_count += 1
            if retry_count >= max_retries:
                print(f"❌ Connection timeout after {max_retries} attempts")
                if web_logger:
                    web_logger.log("system", "Stream connection timeout", "error")
                # Cleanup and exit
                if gemini_verifier:
                    gemini_verifier.stop()
                if mqtt_manager:
                    mqtt_manager.disconnect()
                if web_logger:
                    web_logger.disconnect()
                return
    
    if stream is None:
        print(f"❌ Could not establish stream connection")
        return
    
    try:
        bytes_data = b''
        
        print("✅ Stream connected! Press 'q' to quit\n")
        if web_logger:
            web_logger.log("system", "ESP32-CAM stream connected", "success")
        
        while True:
            chunk = stream.read(8192)
            if not chunk:
                break
            
            bytes_data += chunk
            a = bytes_data.find(b'\xff\xd8')
            b = bytes_data.find(b'\xff\xd9')
            
            if a != -1 and b != -1:
                jpg = bytes_data[a:b+2]
                bytes_data = bytes_data[b+2:]
                
                nparr = np.frombuffer(jpg, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    continue
                
                frame_count += 1
                frame_skip_counter += 1
                
                # Write frame to video if recording
                if video_recorder and video_recorder.is_recording:
                    video_recorder.write_frame(frame)
                
                # Process Gemini results
                if gemini_verifier:
                    req_id, result = gemini_verifier.get_result()
                    if req_id is not None and req_id in pending_verifications:
                        det_info = pending_verifications[req_id]
                        
                        if result and result["status"] == "verified":
                            det_info["is_verified"] = True
                            det_info["gemini_score"] = result["score"]
                            det_info["gemini_reason"] = result["reason"]
                            
                            log_msg = f"✅ Fire VERIFIED! Gemini: {result['score']:.2f} - {result['reason']}"
                            print(log_msg)
                            if web_logger:
                                web_logger.log("fire_detection", log_msg, "warning", {
                                    "yolo_conf": det_info["conf"],
                                    "gemini_score": result["score"],
                                    "bbox": det_info["bbox"],
                                    "reason": result["reason"]
                                })
                            
                            # Start recording if not already
                            if video_recorder and not video_recorder.is_recording:
                                video_recorder.start_recording(frame.copy(), det_info)
                            
                            # MQTT alert
                            current_time = time.time()
                            if mqtt_manager and (current_time - last_alert_time) > ALERT_COOLDOWN:
                                mqtt_manager.publish_alert(
                                    det_info["conf"],
                                    det_info["bbox"],
                                    result["score"],
                                    result["reason"]
                                )
                                last_alert_time = current_time
                            
                            # Send to Fire Detection Gallery (Web Dashboard)
                            if SEND_TO_WEB:
                                send_detection_to_web(
                                    frame=frame,
                                    bbox=det_info["bbox"],
                                    confidence=det_info["conf"],
                                    gemini_score=result["score"],
                                    gemini_reason=result["reason"],
                                    gemini_verified=True,
                                    camera_ip=ESP32_CAM_IP
                                )
                            
                            # Send to WhatsApp
                            if SEND_TO_WHATSAPP and WHATSAPP_HELPER_AVAILABLE:
                                if (current_time - last_whatsapp_time) > WHATSAPP_COOLDOWN:
                                    try:
                                        success, msg = send_fire_photo_to_whatsapp(
                                            frame=frame,
                                            confidence=det_info["conf"],
                                            bbox=det_info["bbox"],
                                            camera_ip=ESP32_CAM_IP,
                                            gemini_score=result["score"],
                                            gemini_verified=True
                                        )
                                        if success:
                                            print(f"📱 WhatsApp notification sent!")
                                            last_whatsapp_time = current_time
                                            whatsapp_sent += 1
                                        else:
                                            print(f"⚠️  WhatsApp failed: {msg}")
                                    except Exception as wa_err:
                                        print(f"⚠️  WhatsApp error: {wa_err}")
                        
                        elif result and result["status"] == "rejected":
                            log_msg = f"❌ Fire REJECTED: {result['score']:.2f} - {result['reason']}"
                            print(log_msg)
                        
                        elif result and result["status"] == "quota_exceeded":
                            # Quota exceeded - use YOLO fallback for high confidence detections
                            if det_info["conf"] >= FALLBACK_CONF_THRESHOLD:
                                log_msg = f"🔥 YOLO FALLBACK ({det_info['conf']:.2f}) - Gemini quota exceeded"
                                print(log_msg)
                                current_time = time.time()
                                
                                if video_recorder and not video_recorder.is_recording:
                                    video_recorder.start_recording(frame.copy(), det_info)
                                if web_logger:
                                    web_logger.log("fire_detection", log_msg, "warning", {
                                        "yolo_conf": det_info["conf"],
                                        "bbox": det_info["bbox"],
                                        "fallback_mode": True
                                    })
                                
                                # Send to Fire Detection Gallery (YOLO fallback)
                                if SEND_TO_WEB:
                                    send_detection_to_web(
                                        frame=frame,
                                        bbox=det_info["bbox"],
                                        confidence=det_info["conf"],
                                        gemini_score=None,
                                        gemini_reason="Gemini quota exceeded - YOLO fallback",
                                        gemini_verified=False,
                                        camera_ip=ESP32_CAM_IP
                                    )
                                
                                # Send to WhatsApp (YOLO fallback)
                                if SEND_TO_WHATSAPP and WHATSAPP_HELPER_AVAILABLE:
                                    if (current_time - last_whatsapp_time) > WHATSAPP_COOLDOWN:
                                        try:
                                            success, msg = send_fire_photo_to_whatsapp(
                                                frame=frame,
                                                confidence=det_info["conf"],
                                                bbox=det_info["bbox"],
                                                camera_ip=ESP32_CAM_IP,
                                                gemini_score=None,
                                                gemini_verified=False
                                            )
                                            if success:
                                                print(f"📱 WhatsApp notification sent (YOLO fallback)!")
                                                last_whatsapp_time = current_time
                                                whatsapp_sent += 1
                                        except Exception as wa_err:
                                            print(f"⚠️  WhatsApp error: {wa_err}")
                        
                        del pending_verifications[req_id]
                
                # YOLO detection
                should_process = (frame_skip_counter >= PROCESS_EVERY_N_FRAMES)
                if should_process:
                    frame_skip_counter = 0
                    results = model(frame, conf=CONF_THRESHOLD, verbose=False)
                    current_detections = []
                    
                    for r in results:
                        for box in r.boxes:
                            conf = float(box.conf[0])
                            bbox = [int(v) for v in box.xyxy[0].tolist()]
                            x1, y1, x2, y2 = bbox
                            area = (x2 - x1) * (y2 - y1)
                            
                            if area < MIN_AREA:
                                continue
                            
                            # Color validation to filter out lights/LEDs
                            if ENABLE_COLOR_VALIDATION:
                                roi = frame[y1:y2, x1:x2]
                                is_fire_color, color_reason, color_stats = validate_fire_by_color(roi)
                                if not is_fire_color:
                                    # Skip this detection - not fire-like colors
                                    print(f"   ❌ Color filter rejected (YOLO: {conf:.2f}): {color_reason}")
                                    continue
                                else:
                                    # Color validation passed
                                    print(f"   ✅ Color validated (YOLO: {conf:.2f}): {color_reason}")
                            
                            yolo_count += 1
                            det_info = {
                                "bbox": bbox,
                                "conf": conf,
                                "is_verified": False,
                                "show": True,
                                "color_validated": True if ENABLE_COLOR_VALIDATION else None
                            }
                            
                            # Submit to Gemini
                            submitted_to_gemini = False
                            if gemini_verifier:
                                current_time = time.time()
                                if current_time - last_gemini_time > GEMINI_COOLDOWN:
                                    roi = frame[y1:y2, x1:x2]
                                    if roi.size > 0:
                                        if gemini_verifier.submit_verification(next_req_id, roi, conf):
                                            pending_verifications[next_req_id] = det_info
                                            last_gemini_time = current_time
                                            next_req_id += 1
                                            submitted_to_gemini = True
                                            # Log submission with detail
                                            print(f"📤 Submitted to Gemini verification (YOLO: {conf:.2f}, queue: {len(pending_verifications)})")
                            
                            # FALLBACK: Record with high-confidence YOLO if Gemini unavailable
                            if FALLBACK_RECORD_ENABLED and not gemini_verifier and conf >= FALLBACK_CONF_THRESHOLD:
                                if video_recorder and not video_recorder.is_recording:
                                    current_time = time.time()
                                    if current_time - video_recorder.last_record_time > RECORD_COOLDOWN:
                                        log_msg = f"🔥 High-confidence YOLO detection ({conf:.2f}) - Starting recording (Gemini unavailable)"
                                        print(log_msg)
                                        if web_logger:
                                            web_logger.log("fire_detection", log_msg, "warning", {
                                                "yolo_conf": conf,
                                                "bbox": bbox,
                                                "fallback_mode": True
                                            })
                                        video_recorder.start_recording(frame.copy(), det_info)
                                        
                                        # Send to Fire Detection Gallery (YOLO-only mode)
                                        if SEND_TO_WEB:
                                            send_detection_to_web(
                                                frame=frame,
                                                bbox=bbox,
                                                confidence=conf,
                                                gemini_score=None,
                                                gemini_reason="YOLO-only mode (Gemini unavailable)",
                                                gemini_verified=False,
                                                camera_ip=ESP32_CAM_IP
                                            )
                                        
                                        # Send to WhatsApp (YOLO-only mode)
                                        if SEND_TO_WHATSAPP and WHATSAPP_HELPER_AVAILABLE:
                                            if (current_time - last_whatsapp_time) > WHATSAPP_COOLDOWN:
                                                try:
                                                    success, msg = send_fire_photo_to_whatsapp(
                                                        frame=frame,
                                                        confidence=conf,
                                                        bbox=bbox,
                                                        camera_ip=ESP32_CAM_IP,
                                                        gemini_score=None,
                                                        gemini_verified=False
                                                    )
                                                    if success:
                                                        print(f"📱 WhatsApp notification sent (YOLO-only)!")
                                                        last_whatsapp_time = current_time
                                                        whatsapp_sent += 1
                                                except Exception as wa_err:
                                                    print(f"⚠️  WhatsApp error: {wa_err}")
                            
                            current_detections.append(det_info)
                    
                    latest_detections = current_detections
                else:
                    current_detections = latest_detections
                
                # Draw detections with better labels
                for det in current_detections:
                    if not det["show"]:
                        continue
                    
                    x1, y1, x2, y2 = det["bbox"]
                    
                    # Color and label based on verification status
                    if det["is_verified"]:
                        label = f"\ud83d\udd25 VERIFIED ({det.get('gemini_score', 0):.2f})"
                        color = (0, 255, 0)  # Green - Gemini verified
                        thick = 3
                    elif det.get("submitted_to_gemini", False):
                        label = f"FIRE {det['conf']:.2f} (verifying...)"
                        color = (0, 165, 255)  # Orange - Waiting for Gemini
                        thick = 2
                    else:
                        label = f"FIRE {det['conf']:.2f}"
                        color = (0, 255, 255)  # Yellow - YOLO only
                        thick = 2
                    
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, thick)
                    
                    # Label background for better readability
                    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 8, y1), color, -1)
                    cv2.putText(frame, label, (x1 + 4, y1 - 4),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                
                # Info overlay
                h, w = frame.shape[:2]
                cv2.rectangle(frame, (0, 0), (w, 120), (0, 0, 0), -1)
                
                # FPS
                elapsed = time.time() - start_time
                if elapsed > 1.0:
                    fps = frame_count / elapsed
                    frame_count = 0
                    start_time = time.time()
                
                # Title with IP
                cv2.putText(frame, f"Fire Detection + Recording [{ESP32_CAM_IP}] | FPS: {fps:.0f}", (10, 25), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                # YOLO stats
                cv2.putText(frame, f"YOLO Detections: {yolo_count} (threshold: {CONF_THRESHOLD})", 
                           (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 200, 255), 1)
                
                # Gemini stats with detailed info
                if gemini_verifier:
                    verified = gemini_verifier.verified_count
                    rejected = gemini_verifier.rejected_count
                    total = verified + rejected
                    accuracy = (verified / total * 100) if total > 0 else 0
                    avg_time = gemini_verifier.avg_response_time
                    
                    gemini_text = f"Gemini: ✅ {verified} | ❌ {rejected} | Acc: {accuracy:.0f}% | Queue: {len(pending_verifications)} | Avg: {avg_time:.1f}s"
                    cv2.putText(frame, gemini_text, (10, 74), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)
                else:
                    cv2.putText(frame, "Gemini: DISABLED (YOLO-only mode)", (10, 74), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 255), 1)
                
                rec_status = "🔴 RECORDING" if (video_recorder and video_recorder.is_recording) else "⚪ Standby"
                rec_color = (0, 0, 255) if (video_recorder and video_recorder.is_recording) else (200, 200, 200)
                cv2.putText(frame, rec_status, (10, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.5, rec_color, 2)
                
                web_status = "WebLog: 🟢 ON" if (web_logger and web_logger.connected) else "WebLog: 🔴 OFF"
                cv2.putText(frame, web_status, (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                
                cv2.imshow(f"Fire Detection [{ESP32_CAM_IP}]", frame)
                
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
    
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        if web_logger:
            web_logger.log("system", f"Fatal error: {e}", "error")
    finally:
        # Cleanup
        print("\n🛑 Shutting down...")
        
        if video_recorder and video_recorder.is_recording:
            video_recorder.stop_recording()
        
        if gemini_verifier:
            gemini_verifier.stop()
        
        if mqtt_manager:
            mqtt_manager.disconnect()
        
        if web_logger:
            web_logger.disconnect()
        
        cv2.destroyAllWindows()
        
        # Print final statistics
        print("\n" + "="*80)
        print("📊 FINAL STATISTICS - GEMINI-FOCUSED DETECTION")
        print("="*80)
        print(f"\nYOLO Detections (candidates): {yolo_count}")
        
        if gemini_verifier:
            verified = gemini_verifier.verified_count
            rejected = gemini_verifier.rejected_count
            errors = gemini_verifier.error_count
            total = verified + rejected
            
            print(f"\nGemini Verification:")
            print(f"  ✅ Verified: {verified}")
            print(f"  ❌ Rejected: {rejected}")
            print(f"  ⚠️  Errors: {errors}")
            print(f"  📊 Total Processed: {total}")
            
            if total > 0:
                accuracy = (verified / total * 100)
                precision = (verified / yolo_count * 100) if yolo_count > 0 else 0
                print(f"\nAccuracy Metrics:")
                print(f"  Verification Rate: {accuracy:.1f}% (verified / processed)")
                print(f"  Precision: {precision:.1f}% (verified / YOLO detections)")
                print(f"  False Positive Reduction: {100 - precision:.1f}%")
            
            if gemini_verifier.total_requests > 0:
                print(f"\nPerformance:")
                print(f"  Avg Response Time: {gemini_verifier.avg_response_time:.2f}s")
                print(f"  Total Requests: {gemini_verifier.total_requests}")
        else:
            print("\nGemini: Not used (YOLO-only mode)")
        
        # Notification stats
        print(f"\nNotifications:")
        print(f"  📤 Web Dashboard: {'Enabled' if SEND_TO_WEB else 'Disabled'}")
        print(f"  📱 WhatsApp Sent: {whatsapp_sent}")
        if WHATSAPP_HELPER_AVAILABLE:
            print(f"  📱 WhatsApp: Enabled (cooldown: {WHATSAPP_COOLDOWN}s)")
        else:
            print(f"  📱 WhatsApp: Disabled (helper not loaded)")
        
        print(f"\n{'='*80}")
        print("\n✅ Shutdown complete")
        print("\nInterpretation:")
        print("  • High verification rate = Gemini confirms most YOLO detections")
        print("  • Low precision = Many false positives filtered by Gemini")
        print("  • Low verification rate = Gemini effectively filtering false positives")
        print(f"{'='*80}\n")

if __name__ == "__main__":
    main()
