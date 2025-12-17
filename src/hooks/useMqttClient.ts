import { useEffect, useRef, useCallback } from 'react'
import { useTelemetryStore } from '../store/useTelemetryStore'
import { parseTelemetryPayload } from '../utils/validation'
import type { MqttConfig } from '../types/telemetry'
import { WS_URL } from '../config/api.config'

const MQTT_CONFIG: MqttConfig = {
  url: import.meta.env.VITE_MQTT_URL || WS_URL,
  username: import.meta.env.VITE_MQTT_USERNAME || '',
  password: import.meta.env.VITE_MQTT_PASSWORD || '',
  topicPub: import.meta.env.VITE_TOPIC_LOG || 'lab/zaks/log',
  // Command topic harus sesuai dengan ESP32 subscribe
  topicCmd: import.meta.env.VITE_TOPIC_CMD || 'nimak/deteksi-api/cmd',
  topicStatus: import.meta.env.VITE_TOPIC_STATUS || 'lab/zaks/status',
}

export function useMqttClient() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  const {
    addTelemetryData,
    addFireDetection,
    setConnectionStatus,
    setClientId,
    setError,
    setFireAlert,
    preferences,
  } = useTelemetryStore()

  const showAlarmNotification = useCallback((deviceId: string) => {
    const { muteAlarms, muteUntil } = preferences
    
    // Check if muted
    if (muteAlarms && muteUntil && Date.now() < muteUntil) {
      return
    }

    // Show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⚠️ ALARM KEBAKARAN!', {
        body: `Alarm terdeteksi pada perangkat ${deviceId}`,
        icon: '/fire-icon.svg',
        tag: 'fire-alarm',
        requireInteraction: true,
      })
    }
  }, [preferences])

  const handleMessage = useCallback((message: MessageEvent) => {
    try {
      const data = JSON.parse(message.data)
      
      // Handle connection confirmation
      if (data.type === 'connected') {
        console.log('✅ Proxy connection confirmed:', data.message)
        return
      }
      
      // Handle fire detection from proxy server
      if (data.type === 'fire-detection') {
        console.log('🔥 Fire detection received from Python:', data.data)
        
        // Convert timestamp string to Date
        const detection = {
          ...data.data,
          timestamp: new Date(data.data.timestamp)
        }
        
        addFireDetection(detection)
        
        // Show alert notification
        setFireAlert({
          message: `Fire detected! Confidence: ${(detection.confidence * 100).toFixed(0)}%`,
          type: 'fire',
          timestamp: new Date(),
        })
        
        // Clear alert after 3 seconds
        setTimeout(() => {
          setFireAlert(null)
        }, 3000)
        
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🔥 FIRE DETECTED!', {
            body: `ESP32-CAM detected fire with ${(detection.confidence * 100).toFixed(0)}% confidence`,
            icon: '/fire-icon.svg',
            tag: 'fire-detection',
            requireInteraction: true,
          })
        }
        
        return
      }
      
      // Handle fire detection update
      if (data.type === 'fire-detection-update') {
        console.log('🔄 Fire detection updated:', data.data)
        // The FireDetectionGallery component polls for updates, so no action needed here
        return
      }
      
      // Handle MQTT messages relayed from proxy
      if (data.topic && data.payload) {
        const payloadString = data.payload
        const topic = data.topic as string
        
        // Handle event messages (lab/zaks/event)
        if (topic.includes('/event')) {
          try {
            const eventData = JSON.parse(payloadString)
            console.log('📢 Event received:', {
              topic,
              event: eventData.event,
              payload: eventData,
              timestamp: new Date().toISOString()
            })
            
            if (eventData.event === 'flame_on') {
              console.log('🔥 FLAME DETECTED! Showing notification...')
              setFireAlert({
                message: 'Api terdeteksi! Segera periksa lokasi sensor.',
                type: 'fire',
                timestamp: new Date(),
              })
              // Clear alert after 1 second to prevent re-trigger
              setTimeout(() => {
                setFireAlert(null)
              }, 1000)
              
              // Show browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('🔥 INDIKASI KEBAKARAN!', {
                  body: 'Sensor flame mendeteksi api. Mohon segera cek lokasi!',
                  icon: '/fire-icon.svg',
                  tag: 'fire-alert',
                  requireInteraction: true,
                })
              }
            }
          } catch (err) {
            console.error('Error parsing event:', err)
          }
          return
        }
        
        // Handle telemetry/log messages (lab/zaks/log)
        if (topic.includes('/log') || topic.includes('/telemetry')) {
          console.log('📊 Telemetry data received:', payloadString.substring(0, 100))
          
          // Parse and validate payload
          const result = parseTelemetryPayload(payloadString)
          
          if (!result.success) {
            console.error(`Invalid telemetry payload: ${result.error}`, payloadString)
            return
          }

          if (!result.data) return

          console.log('✅ Parsed telemetry:', result.data)

          // Create telemetry data entry
          const telemetryData = {
            ...result.data,
            timestamp: new Date(),
            rawJson: payloadString,
          }

          // Add to store
          addTelemetryData(telemetryData)
          console.log('💾 Telemetry data added to store')

          // Show alarm notification for high gas
          if (result.data.alarm) {
            showAlarmNotification(result.data.id)
            setFireAlert({
              message: `Gas berbahaya terdeteksi! Level: ${result.data.gasA || 'N/A'}`,
              type: 'gas',
              timestamp: new Date(),
            })
          }
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error)
    }
  }, [addTelemetryData, showAlarmNotification, setFireAlert])

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected')
      return
    }

    setConnectionStatus('connecting')
    console.log('Connecting to proxy server:', MQTT_CONFIG.url)

    try {
      const ws = new WebSocket(MQTT_CONFIG.url)
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected to proxy')
        console.log('📍 Connected to:', MQTT_CONFIG.url)
        setConnectionStatus('connected')
        const clientId = `dashboard-${Math.random().toString(16).slice(2, 10)}`
        setClientId(clientId)
      }

      ws.onmessage = handleMessage

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setError('WebSocket connection error')
      }

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected')
        setConnectionStatus('disconnected')
        
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...')
          connect()
        }, 3000)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setError(error instanceof Error ? error.message : 'Connection failed')
    }
  }, [setConnectionStatus, setClientId, setError, handleMessage])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (wsRef.current) {
      console.log('Disconnecting WebSocket')
      wsRef.current.close()
      wsRef.current = null
      setConnectionStatus('disconnected')
    }
  }, [setConnectionStatus])

  const publish = useCallback((topic: string, message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected')
      return false
    }

    try {
      const payload = JSON.stringify({
        type: 'publish',
        topic,
        payload: message,
      })
      
      wsRef.current.send(payload)
      console.log(`📤 Published to ${topic}:`, message)
      return true
    } catch (error) {
      console.error('Publish error:', error)
      setError(error instanceof Error ? error.message : 'Failed to publish')
      return false
    }
  }, [setError])

  const sendCommand = useCallback((command: string) => {
    return publish(MQTT_CONFIG.topicCmd, command)
  }, [publish])

  const setBuzzer = useCallback((state: boolean) => {
    const command = state ? 'BUZZER_ON' : 'BUZZER_OFF'
    return sendCommand(command)
  }, [sendCommand])

  const setGasThreshold = useCallback((threshold: number) => {
    const command = `THR=${threshold}`
    return sendCommand(command)
  }, [sendCommand])

  // Auto-connect on mount
  useEffect(() => {
    connect()

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      disconnect()
    }
  }, [connect, disconnect])

  // Graceful disconnect on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnect()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [disconnect])

  return {
    isConnected: useTelemetryStore.getState().connectionStatus === 'connected',
    connect,
    disconnect,
    publish,
    sendCommand,
    setBuzzer,
    setGasThreshold,
    config: MQTT_CONFIG,
  }
}
