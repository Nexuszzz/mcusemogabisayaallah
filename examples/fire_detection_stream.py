"""
ESP32-CAM Fire Detection Stream Integration
Combines live streaming with YOLOv10 fire detection and MQTT publishing
"""

import cv2
import numpy as np
from ultralytics import YOLO
import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime
import os

# ===== CONFIGURATION =====
# ESP32-CAM
STREAM_URL = "http://10.75.111.108:81/stream"  # Update with your ESP32-CAM IP

# MQTT Config
MQTT_BROKER = "3.27.0.139"
MQTT_PORT = 1883
MQTT_USER = "zaks"
MQTT_PASS = "enggangodinginmcu"
MQTT_TOPIC_DETECTION = "lab/zaks/fire-detection"
MQTT_TOPIC_ALERT = "lab/zaks/alert"
MQTT_TOPIC_EVENT = "lab/zaks/event"

# Fire Detection Config
MODEL_PATH = "models/fire.pt"  # Path to YOLO model
CONFIDENCE_THRESHOLD = 0.5
DETECTION_COOLDOWN = 5  # seconds between alerts

# Storage
SAVE_DETECTIONS = True
DETECTIONS_DIR = "detections"
LOGS_DIR = "logs"

# Display Config
SHOW_PREVIEW = True
PREVIEW_SIZE = (800, 600)

# ===== SETUP =====
class FireDetectionStream:
    def __init__(self):
        self.model = None
        self.mqtt_client = None
        self.cap = None
        self.last_alert_time = 0
        self.detection_count = 0
        self.frame_count = 0
        self.fps = 0
        self.last_fps_time = time.time()
        
        # Create directories
        if SAVE_DETECTIONS:
            os.makedirs(DETECTIONS_DIR, exist_ok=True)
            os.makedirs(LOGS_DIR, exist_ok=True)
        
        print("🔥 Fire Detection Stream Initializing...")
        self.setup_mqtt()
        self.setup_camera()
        self.load_model()
        
    def setup_mqtt(self):
        """Setup MQTT connection"""
        try:
            self.mqtt_client = mqtt.Client()
            self.mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
            self.mqtt_client.on_connect = self.on_mqtt_connect
            self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
            self.mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.mqtt_client.loop_start()
            print(f"✅ MQTT connecting to {MQTT_BROKER}:{MQTT_PORT}")
        except Exception as e:
            print(f"❌ MQTT connection failed: {e}")
            
    def on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ MQTT Connected successfully!")
        else:
            print(f"❌ MQTT Connection failed with code {rc}")
            
    def on_mqtt_disconnect(self, client, userdata, rc):
        print(f"⚠️ MQTT Disconnected (code: {rc}). Reconnecting...")
        
    def setup_camera(self):
        """Setup ESP32-CAM stream"""
        print(f"📹 Connecting to camera: {STREAM_URL}")
        self.cap = cv2.VideoCapture(STREAM_URL)
        
        if not self.cap.isOpened():
            print("❌ Failed to open camera stream!")
            exit(1)
            
        print("✅ Camera stream connected!")
        
    def load_model(self):
        """Load YOLO model"""
        try:
            print(f"🤖 Loading YOLO model: {MODEL_PATH}")
            self.model = YOLO(MODEL_PATH)
            print("✅ Model loaded successfully!")
        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            exit(1)
            
    def calculate_fps(self):
        """Calculate FPS"""
        self.frame_count += 1
        current_time = time.time()
        elapsed = current_time - self.last_fps_time
        
        if elapsed >= 1.0:
            self.fps = self.frame_count / elapsed
            self.frame_count = 0
            self.last_fps_time = current_time
            
        return self.fps
        
    def reconnect_camera(self):
        """Reconnect to camera if stream lost"""
        print("🔄 Reconnecting to camera...")
        if self.cap:
            self.cap.release()
        
        time.sleep(2)
        self.cap = cv2.VideoCapture(STREAM_URL)
        
        if self.cap.isOpened():
            print("✅ Camera reconnected!")
            return True
        else:
            print("❌ Reconnection failed!")
            return False
            
    def save_detection(self, frame, bbox, confidence):
        """Save detection image and log"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save image
        if SAVE_DETECTIONS:
            filename = f"fire_{timestamp}.jpg"
            filepath = os.path.join(DETECTIONS_DIR, filename)
            cv2.imwrite(filepath, frame)
            print(f"💾 Saved: {filename}")
            
            # Save log
            log_file = os.path.join(LOGS_DIR, f"fire_mqtt_{datetime.now().strftime('%Y-%m-%d')}.log")
            with open(log_file, 'a') as f:
                log_entry = {
                    'timestamp': timestamp,
                    'confidence': float(confidence),
                    'bbox': bbox,
                    'filename': filename
                }
                f.write(json.dumps(log_entry) + '\n')
                
    def publish_mqtt(self, detection_data):
        """Publish detection to MQTT"""
        if not self.mqtt_client:
            return
            
        try:
            # Publish detection overlay data
            self.mqtt_client.publish(
                MQTT_TOPIC_DETECTION,
                json.dumps(detection_data),
                qos=1
            )
            
            # Publish alert (with cooldown)
            current_time = time.time()
            if current_time - self.last_alert_time >= DETECTION_COOLDOWN:
                alert_payload = {
                    'type': 'fire_detected',
                    'confidence': detection_data['confidence'],
                    'timestamp': detection_data['timestamp'],
                    'source': 'esp32cam_stream'
                }
                
                self.mqtt_client.publish(
                    MQTT_TOPIC_ALERT,
                    json.dumps(alert_payload),
                    qos=1
                )
                
                self.mqtt_client.publish(
                    MQTT_TOPIC_EVENT,
                    f"🔥 FIRE DETECTED! Confidence: {detection_data['confidence']:.2f}",
                    qos=1
                )
                
                self.last_alert_time = current_time
                print(f"📢 Alert published! (Detection #{self.detection_count})")
                
        except Exception as e:
            print(f"❌ MQTT publish error: {e}")
            
    def process_frame(self, frame):
        """Process frame for fire detection"""
        height, width = frame.shape[:2]
        
        # Run YOLO detection
        results = self.model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
        
        fire_detected = False
        
        for result in results:
            boxes = result.boxes
            
            for box in boxes:
                # Get box data
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())
                
                # Calculate normalized bbox (percentage)
                bbox = {
                    'x': float((x1 / width) * 100),
                    'y': float((y1 / height) * 100),
                    'width': float(((x2 - x1) / width) * 100),
                    'height': float(((y2 - y1) / height) * 100)
                }
                
                # Prepare detection data
                detection_data = {
                    'type': 'fire_detection',
                    'bbox': bbox,
                    'confidence': conf,
                    'timestamp': int(time.time() * 1000),
                    'frame_size': {'width': width, 'height': height}
                }
                
                # Publish to MQTT
                self.publish_mqtt(detection_data)
                
                # Save detection
                self.save_detection(frame, bbox, conf)
                
                # Draw on frame (for preview)
                if SHOW_PREVIEW:
                    color = (0, 0, 255)  # Red
                    thickness = 3
                    
                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, thickness)
                    
                    # Label
                    label = f"Fire {conf:.2f}"
                    label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                    
                    # Background for label
                    cv2.rectangle(frame,
                                (int(x1), int(y1) - label_size[1] - 10),
                                (int(x1) + label_size[0], int(y1)),
                                color, -1)
                    
                    cv2.putText(frame, label,
                              (int(x1), int(y1) - 5),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                fire_detected = True
                self.detection_count += 1
                print(f"🔥 Fire detected! Confidence: {conf:.2f} (Detection #{self.detection_count})")
                
        return frame, fire_detected
        
    def add_info_overlay(self, frame):
        """Add info overlay to frame"""
        fps = self.calculate_fps()
        
        # Info text
        info = [
            f"FPS: {fps:.1f}",
            f"Detections: {self.detection_count}",
            f"Time: {datetime.now().strftime('%H:%M:%S')}",
            f"Stream: ESP32-CAM"
        ]
        
        # Draw black background
        overlay = frame.copy()
        cv2.rectangle(overlay, (10, 10), (250, 10 + 30 * len(info)), (0, 0, 0), -1)
        frame = cv2.addWeighted(frame, 0.7, overlay, 0.3, 0)
        
        # Draw text
        for i, text in enumerate(info):
            cv2.putText(frame, text,
                       (20, 35 + i * 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                       
        return frame
        
    def run(self):
        """Main loop"""
        print("\n" + "="*60)
        print("🔥 FIRE DETECTION STREAM STARTED")
        print("="*60)
        print(f"📹 Stream: {STREAM_URL}")
        print(f"📡 MQTT: {MQTT_BROKER}:{MQTT_PORT}")
        print(f"🤖 Model: {MODEL_PATH}")
        print(f"💾 Save: {SAVE_DETECTIONS}")
        print(f"👁️  Preview: {SHOW_PREVIEW}")
        print("="*60)
        print("\nPress 'q' to quit, 's' to take snapshot")
        print("="*60 + "\n")
        
        retry_count = 0
        max_retries = 5
        
        while True:
            ret, frame = self.cap.read()
            
            if not ret:
                print("❌ Frame read failed!")
                retry_count += 1
                
                if retry_count >= max_retries:
                    print(f"❌ Max retries ({max_retries}) reached. Exiting...")
                    break
                    
                if not self.reconnect_camera():
                    time.sleep(5)
                    continue
                    
                retry_count = 0
                continue
                
            retry_count = 0
            
            # Process frame for fire detection
            processed_frame, fire_detected = self.process_frame(frame)
            
            # Add info overlay
            if SHOW_PREVIEW:
                display_frame = self.add_info_overlay(processed_frame)
                
                # Resize for display
                display_frame = cv2.resize(display_frame, PREVIEW_SIZE)
                
                # Show frame
                cv2.imshow('ESP32-CAM Fire Detection', display_frame)
                
            # Handle keyboard
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("\n⚠️ Quit requested...")
                break
            elif key == ord('s'):
                # Manual snapshot
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"snapshot_{timestamp}.jpg"
                filepath = os.path.join(DETECTIONS_DIR, filename)
                cv2.imwrite(filepath, frame)
                print(f"📸 Snapshot saved: {filename}")
                
        self.cleanup()
        
    def cleanup(self):
        """Cleanup resources"""
        print("\n🧹 Cleaning up...")
        
        if self.cap:
            self.cap.release()
            print("✅ Camera released")
            
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            print("✅ MQTT disconnected")
            
        cv2.destroyAllWindows()
        print("✅ Windows closed")
        
        print("\n" + "="*60)
        print(f"📊 Total Detections: {self.detection_count}")
        print("🎉 Fire Detection Stream Stopped!")
        print("="*60 + "\n")

# ===== MAIN =====
if __name__ == "__main__":
    try:
        detector = FireDetectionStream()
        detector.run()
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user (Ctrl+C)")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
