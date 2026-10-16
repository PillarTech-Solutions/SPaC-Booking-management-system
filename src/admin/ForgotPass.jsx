import { useState } from 'react'
import bgimg from './assets/AdminLoginBG.png'
import { useNavigate } from 'react-router-dom'

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    // TODO: call your reset-password API here
    console.log('send reset link to', email)
    navigate('/check-email', { state: { email } })
  }

  return (
    <div
      style={{
        backgroundImage: `url(${bgimg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 'clamp(380px, 26vw, 460px)',
          backgroundColor: 'white',
          border: '1px solid #D4C9A8',
          borderRadius: 8,
          padding: 'clamp(22px, 1.8vw, 30px)',
          boxSizing: 'border-box',
          fontFamily: "'Be Vietnam Pro', sans-serif",
        }}
      >
        {/* Title */}
        <h1
          style={{
            margin: 0,
            paddingBottom: 6,
            fontSize: 'clamp(18px, 1.3vw, 22px)',
            fontWeight: 800,
            color: '#121212',
            textTransform: 'uppercase',
            borderBottom: '1px solid #999',
            cursor: 'default',
            userSelect: 'none'
          }}
        >
          Forgot Password?
        </h1>

        {/* Description / confirmation */}
        <p style={{ margin: '12px 0 22px', fontSize: 13, lineHeight: 1.5, color: '#666' }}>
          {
            "Enter your staff email. If it matches an account on the system, we'll send a reset link to it."
          }
        </p>

        {/* Email */}
        <label
          htmlFor="reset-email"
          style={{ display: 'block', fontSize: 14, color: '#121212', marginBottom: 8 }}
        >
          Email Address
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: '1.5px solid #D4C9A8',
            borderRadius: 14,
            padding: '0 16px',
            height: 47,
            boxSizing: 'border-box',
            backgroundColor: 'white',
            marginBottom: 28,
          }}
        >
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              //setSent(false)
            }}
            required
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              fontSize: 16,
              fontFamily: 'inherit',
              background: 'transparent',
            }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          style={{
            width: '100%',
            height: 44,
            backgroundColor: '#CCFF00',
            color: '#000',
            border: '1px solid #000',
            borderRadius: 10,
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none'
          }}
        >
           {'Send reset link'}
        </button>

        {/* Back */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 13,
              color: '#222',
            }}
          >
            ← Back to Sign in
          </button>
        </div>
      </form>
    </div>
  )
}