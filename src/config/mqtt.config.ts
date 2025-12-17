/**
 * MQTT Configuration
 * Topics structure: lab/zaks/#
 */

export const MQTT_CONFIG = {
  // Broker settings
  broker: {
    url: import.meta.env.VITE_MQTT_URL || 'ws://3.27.0.139:9001/mqtt',
    username: import.meta.env.VITE_MQTT_USERNAME || 'zaks',
    password: import.meta.env.VITE_MQTT_PASSWORD || 'enggangodinginmcu',
    port: 1883,
    host: '3.27.0.139',
  },

  // MQTT Topics
  topics: {
    EVENT: import.meta.env.VITE_TOPIC_EVENT || 'lab/zaks/event',
    LOG: import.meta.env.VITE_TOPIC_LOG || 'lab/zaks/log',
    STATUS: import.meta.env.VITE_TOPIC_STATUS || 'lab/zaks/status',
    ALERT: import.meta.env.VITE_TOPIC_ALERT || 'lab/zaks/alert',
    // Wildcard untuk subscribe semua topic
    ALL: 'lab/zaks/#',
  },
} as const;

// Export individual topics untuk kemudahan penggunaan
export const TOPIC_EVENT = MQTT_CONFIG.topics.EVENT;
export const TOPIC_LOG = MQTT_CONFIG.topics.LOG;
export const TOPIC_STATUS = MQTT_CONFIG.topics.STATUS;
export const TOPIC_ALERT = MQTT_CONFIG.topics.ALERT;
export const TOPIC_ALL = MQTT_CONFIG.topics.ALL;

// Export broker config
export const MQTT_BROKER = MQTT_CONFIG.broker;
