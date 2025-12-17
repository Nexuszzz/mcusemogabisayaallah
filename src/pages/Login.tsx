import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

type AuthMode = 'login' | 'register'

interface FormData {
  fullname: string
  username: string
  email: string
  password: string
  confirmPassword: string
}

interface Message {
  type: 'error' | 'success'
  text: string
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [formData, setFormData] = useState<FormData>({
    fullname: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('fireforce_token')
    if (token) {
      verifyToken(token)
    }
  }, [])

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        navigate('/')
      }
    } catch {
      localStorage.removeItem('fireforce_token')
      localStorage.removeItem('fireforce_user')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (mode === 'register') {
      if (formData.password !== formData.confirmPassword) {
        setMessage({ type: 'error', text: 'Passwords do not match!' })
        return
      }
      if (formData.password.length < 6) {
        setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
        return
      }
    }

    setIsLoading(true)

    try {
      // For demo/static hosting: use hardcoded credentials
      if (mode === 'login') {
        // Check if credentials match
        if (formData.username === 'admin' && formData.password === 'admin123') {
          // Success! Set mock token and user
          const mockToken = 'demo-token-' + Date.now()
          const mockUser = {
            id: '1',
            username: 'admin',
            fullname: 'Administrator',
            email: 'admin@fireforce.com',
            role: 'admin'
          }
          
          localStorage.setItem('authToken', mockToken)
          localStorage.setItem('fireforce_token', mockToken)
          localStorage.setItem('fireforce_user', JSON.stringify(mockUser))
          
          setMessage({ type: 'success', text: '🔥 Login successful! Redirecting...' })
          setTimeout(() => navigate('/'), 1500)
        } else {
          setMessage({ type: 'error', text: 'Invalid username or password' })
          setIsLoading(false)
          return
        }
      } else {
        // Register mode - for demo, just save to localStorage
        const users = JSON.parse(localStorage.getItem('demo_users') || '[]')
        
        // Check if username exists
        if (users.find((u: any) => u.username === formData.username)) {
          setMessage({ type: 'error', text: 'Username already exists' })
          setIsLoading(false)
          return
        }
        
        // Add new user
        users.push({
          id: Date.now().toString(),
          fullname: formData.fullname,
          username: formData.username,
          email: formData.email,
          password: formData.password, // In real app, would be hashed
          role: 'user'
        })
        
        localStorage.setItem('demo_users', JSON.stringify(users))
        
        setMessage({ type: 'success', text: '🔥 Account created! You can now login.' })
        setTimeout(() => {
          setMode('login')
          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
        }, 2000)
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setMessage(null)
    setFormData({
      fullname: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    })
  }

  return (
    <div className="login-container">
      {/* Anime Background with Blue Fire Effect */}
      <div className="anime-background">
        {/* Dark overlay with blue fire gradient */}
        <div className="fire-overlay" />
        
        {/* Animated blue fire embers */}
        <div className="embers-container">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="ember"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
                width: `${3 + Math.random() * 6}px`,
                height: `${3 + Math.random() * 6}px`,
              }}
            />
          ))}
        </div>

        {/* Blue flame waves at bottom */}
        <div className="flame-waves">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
            <defs>
              <linearGradient id="flameGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="flameGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path className="flame-path-1" fill="url(#flameGrad1)" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L0,320Z" />
            <path className="flame-path-2" fill="url(#flameGrad2)" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L0,320Z" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="login-content">
        <div className="login-card-wrapper">
          {/* Glowing border effect */}
          <div className="card-glow" />
          
          {/* Main Card */}
          <div className="login-card">
            {/* Top fire accent */}
            <div className="fire-accent-top" />
            
            {/* Corner decorations - Anime style */}
            <div className="corner-deco top-left" />
            <div className="corner-deco top-right" />
            <div className="corner-deco bottom-left" />
            <div className="corner-deco bottom-right" />

            <div className="card-content">
              {/* Logo Section */}
              <div className="logo-section">
                <div className="fire-icon-wrapper">
                  <div className="fire-icon-glow" />
                  <div className="fire-icon">
                    <Flame className="icon" />
                  </div>
                  {/* Spark effects */}
                  <div className="spark spark-1" />
                  <div className="spark spark-2" />
                  <div className="spark spark-3" />
                </div>
                
                <h1 className="title">FIRE FORCE</h1>
                <div className="subtitle-wrapper">
                  <span className="line-deco" />
                  <span className="japanese-text">炎炎ノ消防隊</span>
                  <span className="line-deco" />
                </div>
                <p className="description">Fire Detection & Monitoring System</p>
              </div>

              {/* Tab Switcher */}
              <div className="tab-switcher">
                <button
                  onClick={() => switchMode('login')}
                  className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
                >
                  🔥 LOGIN
                </button>
                <button
                  onClick={() => switchMode('register')}
                  className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
                >
                  ⚡ REGISTER
                </button>
              </div>

              {/* Message Display */}
              {message && (
                <div className={`message ${message.type}`}>
                  {message.type === 'error' ? (
                    <AlertCircle className="message-icon" />
                  ) : (
                    <CheckCircle className="message-icon" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="auth-form">
                {mode === 'register' && (
                  <>
                    <div className="form-group">
                      <label>Full Name</label>
                      <div className="input-wrapper">
                        <User className="input-icon" />
                        <input
                          type="text"
                          name="fullname"
                          value={formData.fullname}
                          onChange={handleInputChange}
                          placeholder="Enter your full name"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Email</label>
                      <div className="input-wrapper">
                        <Mail className="input-icon" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="Enter your email"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Username</label>
                  <div className="input-wrapper">
                    <User className="input-icon" />
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder={mode === 'login' ? "Enter your username" : "Choose a username"}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder={mode === 'login' ? "Enter your password" : "Create a password"}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="toggle-password"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirm your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="toggle-password"
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="submit-btn">
                  <span className="btn-shine" />
                  {isLoading ? (
                    <>
                      <Loader2 className="spinner" />
                      <span>PROCESSING...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="btn-icon" />
                      <span>{mode === 'login' ? 'IGNITE LOGIN' : 'CREATE ACCOUNT'}</span>
                    </>
                  )}
                </button>
              </form>

              {/* Footer Quote */}
              <div className="footer-quote">
                <p>"Látom" - May your soul return to the great flame</p>
              </div>
            </div>

            {/* Bottom fire accent */}
            <div className="fire-accent-bottom" />
          </div>
        </div>

        <p className="version-text">IoT Fire Detection Dashboard v1.0.0</p>
      </div>

      {/* Anime-style CSS */}
      <style>{`
        .login-container {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        /* ===== BACKGROUND ===== */
        .anime-background {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #050510 0%, #0a0a1a 30%, #0f0520 70%, #050510 100%);
        }

        .fire-overlay {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(ellipse at 20% 80%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, rgba(6, 182, 212, 0.2) 0%, transparent 40%);
        }

        .embers-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .ember {
          position: absolute;
          bottom: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, #38bdf8 0%, #0ea5e9 50%, transparent 70%);
          animation: rise-ember linear infinite;
          opacity: 0;
        }

        @keyframes rise-ember {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }

        .flame-waves {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 200px;
          opacity: 0.5;
        }

        .flame-waves svg {
          width: 100%;
          height: 100%;
        }

        .flame-path-1 {
          animation: wave1 4s ease-in-out infinite;
        }

        .flame-path-2 {
          animation: wave2 3s ease-in-out infinite;
        }

        @keyframes wave1 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-3%); }
        }

        @keyframes wave2 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3%); }
        }

        /* ===== MAIN CONTENT ===== */
        .login-content {
          position: relative;
          z-index: 10;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .login-card-wrapper {
          position: relative;
          width: 100%;
          max-width: 440px;
        }

        .card-glow {
          position: absolute;
          inset: -3px;
          background: linear-gradient(45deg, #0ea5e9, #3b82f6, #06b6d4, #8b5cf6);
          border-radius: 20px;
          opacity: 0.5;
          filter: blur(15px);
          animation: glow-pulse 3s ease-in-out infinite;
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.02); }
        }

        .login-card {
          position: relative;
          background: linear-gradient(180deg, rgba(15, 15, 25, 0.98) 0%, rgba(10, 10, 20, 0.99) 100%);
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(100, 150, 255, 0.1);
        }

        .fire-accent-top, .fire-accent-bottom {
          height: 3px;
          background: linear-gradient(90deg, #0ea5e9, #3b82f6, #8b5cf6, #3b82f6, #0ea5e9);
          background-size: 200% 100%;
          animation: fire-flow 2s linear infinite;
        }

        @keyframes fire-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        .corner-deco {
          position: absolute;
          width: 20px;
          height: 20px;
          border-color: rgba(59, 130, 246, 0.4);
          border-style: solid;
          border-width: 0;
        }

        .corner-deco.top-left { top: 12px; left: 12px; border-top-width: 2px; border-left-width: 2px; }
        .corner-deco.top-right { top: 12px; right: 12px; border-top-width: 2px; border-right-width: 2px; }
        .corner-deco.bottom-left { bottom: 12px; left: 12px; border-bottom-width: 2px; border-left-width: 2px; }
        .corner-deco.bottom-right { bottom: 12px; right: 12px; border-bottom-width: 2px; border-right-width: 2px; }

        .card-content {
          padding: 40px 32px;
        }

        /* ===== LOGO SECTION ===== */
        .logo-section {
          text-align: center;
          margin-bottom: 24px;
        }

        .fire-icon-wrapper {
          position: relative;
          display: inline-block;
          margin-bottom: 16px;
        }

        .fire-icon-glow {
          position: absolute;
          inset: -10px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
          border-radius: 50%;
          animation: icon-glow 2s ease-in-out infinite;
        }

        @keyframes icon-glow {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }

        .fire-icon {
          position: relative;
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #8b5cf6 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
          animation: icon-float 3s ease-in-out infinite;
        }

        @keyframes icon-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }

        .fire-icon .icon {
          width: 40px;
          height: 40px;
          color: white;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        .spark {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: spark-anim 1.5s ease-in-out infinite;
        }

        .spark-1 { top: -5px; right: -5px; background: #a5f3fc; }
        .spark-2 { top: 0; left: -8px; background: #38bdf8; animation-delay: 0.3s; }
        .spark-3 { bottom: -3px; right: -8px; background: #818cf8; animation-delay: 0.6s; }

        @keyframes spark-anim {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }

        .title {
          font-size: 36px;
          font-weight: 900;
          letter-spacing: 3px;
          background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 40px rgba(59, 130, 246, 0.3);
          margin: 0;
        }

        .subtitle-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 8px;
        }

        .line-deco {
          width: 40px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.6), transparent);
        }

        .japanese-text {
          color: rgba(96, 165, 250, 0.7);
          font-size: 13px;
          letter-spacing: 4px;
        }

        .description {
          color: rgba(150, 150, 160, 0.8);
          font-size: 13px;
          margin-top: 10px;
        }

        /* ===== COMPANY BADGE ===== */
        .company-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 10px 20px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 30px;
          margin-bottom: 24px;
        }

        .badge-text {
          color: rgba(180, 180, 190, 0.8);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .badge-number {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #0ea5e9, #3b82f6);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 900;
          font-size: 14px;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }

        /* ===== TAB SWITCHER ===== */
        .tab-switcher {
          display: flex;
          background: rgba(30, 30, 40, 0.5);
          border: 1px solid rgba(60, 60, 70, 0.5);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 20px;
        }

        .tab-btn {
          flex: 1;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: rgba(150, 150, 160, 0.8);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .tab-btn.active {
          background: linear-gradient(135deg, #0ea5e9, #3b82f6);
          color: white;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }

        .tab-btn:not(.active):hover {
          color: #3b82f6;
        }

        /* ===== MESSAGE ===== */
        .message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 500;
          animation: shake 0.4s ease;
        }

        .message.error {
          background: rgba(220, 50, 50, 0.15);
          border: 1px solid rgba(220, 50, 50, 0.3);
          color: #ff6b6b;
        }

        .message.success {
          background: rgba(50, 200, 100, 0.15);
          border: 1px solid rgba(50, 200, 100, 0.3);
          color: #6bff8b;
        }

        .message-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-3px); }
          40%, 80% { transform: translateX(3px); }
        }

        /* ===== FORM ===== */
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group label {
          display: block;
          color: #3b82f6;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          width: 18px;
          height: 18px;
          color: rgba(100, 100, 110, 0.8);
          transition: color 0.3s ease;
          pointer-events: none;
        }

        .input-wrapper:focus-within .input-icon {
          color: #3b82f6;
        }

        .input-wrapper input {
          width: 100%;
          padding: 14px 14px 14px 46px;
          background: rgba(25, 25, 35, 0.6);
          border: 2px solid rgba(60, 60, 70, 0.5);
          border-radius: 10px;
          color: white;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .input-wrapper input::placeholder {
          color: rgba(100, 100, 110, 0.6);
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: #3b82f6;
          background: rgba(30, 30, 40, 0.8);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .toggle-password {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: rgba(100, 100, 110, 0.8);
          cursor: pointer;
          padding: 4px;
          display: flex;
          transition: color 0.3s ease;
        }

        .toggle-password:hover {
          color: #3b82f6;
        }

        .toggle-password svg {
          width: 18px;
          height: 18px;
        }

        /* ===== SUBMIT BUTTON ===== */
        .submit-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px 24px;
          margin-top: 8px;
          background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #0ea5e9 100%);
          background-size: 200% 100%;
          border: 2px solid rgba(100, 150, 255, 0.3);
          border-radius: 12px;
          color: white;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 2px;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.35);
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(59, 130, 246, 0.5);
          background-position: 100% 0;
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-shine {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.6s ease;
        }

        .submit-btn:hover .btn-shine {
          left: 100%;
        }

        .btn-icon {
          width: 20px;
          height: 20px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        /* ===== FOOTER ===== */
        .footer-quote {
          text-align: center;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(60, 60, 70, 0.3);
        }

        .footer-quote p {
          color: rgba(100, 100, 110, 0.6);
          font-size: 12px;
          font-style: italic;
          margin: 0;
        }

        .version-text {
          color: rgba(80, 80, 90, 0.6);
          font-size: 11px;
          margin-top: 20px;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 480px) {
          .card-content {
            padding: 32px 20px;
          }
          
          .title {
            font-size: 28px;
          }
        }
      `}</style>
    </div>
  )
}
