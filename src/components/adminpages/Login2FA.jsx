import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import bgimg from './assets/AdminLoginBG.png'

const LENGTH = 6

// "juan@email.com" -> "ju***@email.com"
const maskEmail = (email = '') => {
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 2)}***@${domain}`
}

export default function Login2FA() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const email = state?.email ?? ''

  const [digits, setDigits] = useState(Array(LENGTH).fill(''))
  const [error, setError] = useState('')
  const inputsRef = useRef([])

  // focus the first box when the page opens
  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const handleChange = (i, value) => {
    const digit = value.replace(/\D/g, '').slice(-1) // digits only, keep the last one typed
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    setError('')
    if (digit && i < LENGTH - 1) inputsRef.current[i + 1].focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1].focus()          // empty box + backspace -> go back
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputsRef.current[i - 1].focus()
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      inputsRef.current[i + 1].focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    const next = Array(LENGTH).fill('')
    pasted.split('').forEach((d, idx) => (next[idx] = d))
    setDigits(next)
    inputsRef.current[Math.min(pasted.length, LENGTH - 1)].focus()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < LENGTH) {
      setError('Enter the 6-digit code.')
      return
    }
    // TODO: call your verify-code API here
    console.log('verify code', code)
    navigate('/reports', { replace: true })
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
          maxWidth: 'clamp(380px, 28vw, 480px)',
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
          }}
        >
          Two-factor authentication
        </h1>

        <p style={{ margin: '12px 0 24px', fontSize: 13, lineHeight: 1.5, color: '#666' }}>
          Two-factor authentication is enabled for this account. Enter the 6-digit code sent to{' '}
          {email ? maskEmail(email) : 'your email'}.
        </p>

        {/* Code boxes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              aria-label={`Digit ${i + 1}`}
              style={{
                width: '100%',
                minWidth: 0,
                maxWidth: 48,
                height: 64,
                textAlign: 'center',
                fontSize: 24,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#121212',
                backgroundColor: 'white',
                border: `1.5px solid ${error ? '#C62828' : '#D4C9A8'}`,
                borderRadius: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#C62828' }}>{error}</p>
        )}

        {/* Verify */}
        <button
          type="submit"
          style={{
            width: '100%',
            height: 44,
            marginTop: 32,
            backgroundColor: '#CCFF00',
            color: '#000',
            border: '1px solid #000',
            borderRadius: 10,
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Verify
        </button>
      </form>
    </div>
  )
}