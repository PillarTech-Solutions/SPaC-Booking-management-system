import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import bgimg from './assets/AdminLoginBG.png'

// One password box with its own show/hide eye
function PasswordInput({ placeholder, value, onChange }) {
  const [show, setShow] = useState(false)

  return (
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
        marginBottom: 14,
      }}
    >
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          fontSize: 14,
          fontFamily: 'inherit',
          background: 'transparent',
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
          {show && <line x1="3" y1="3" x2="21" y2="21" />}
        </svg>
      </button>
    </div>
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    // TODO: call your reset-password API here
    console.log('password reset')
    navigate('/login', { replace: true })
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
        <h1
          style={{
            margin: 0,
            paddingBottom: 6,
            fontSize: 'clamp(18px, 1.3vw, 22px)',
            fontWeight: 800,
            color: '#121212',
            textTransform: 'uppercase',
            borderBottom: '1px solid #999',
            cursor: 'default'
          }}
        >
          Reset your password
        </h1>

        <p style={{ margin: '12px 0 20px', fontSize: 13, lineHeight: 1.5, color: '#666', cursor: 'default' }}>
          Create a secure password to keep your account safe.
        </p>

        <PasswordInput
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordInput
          placeholder="Confirm New Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#C62828' }}>{error}</p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            height: 44,
            marginTop: 6,
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
          Reset password
        </button>
      </form>
    </div>
  )
}