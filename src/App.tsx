import { Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import Dashboard from './pages/Dashboard'
import LiveStream from './pages/LiveStream'
import WhatsApp from './pages/WhatsApp'
import Login from './pages/Login'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useMqttClient } from './hooks/useMqttClient'

function App() {
  // Initialize MQTT client
  useMqttClient()

  return (
    <Routes>
      {/* Login Page - No Header */}
      <Route path="/login" element={<Login />} />
      
      {/* Main App with Header - Protected */}
      <Route path="/*" element={
        <ProtectedRoute>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Header />

            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/live-stream" element={<LiveStream />} />
              <Route path="/whatsapp" element={<WhatsApp />} />
            </Routes>

            {/* Footer */}
            <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mt-12">
              <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  <p>IoT Fire Detection Dashboard v1.0.0</p>
                  <p className="mt-1">Built with React + Vite + TypeScript + MQTT</p>
                </div>
              </div>
            </footer>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default App
