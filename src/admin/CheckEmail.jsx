import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import bgimg from './assets/AdminLoginBG.png'

// "student@saranay.com" -> "st*@saranay.com"
const maskEmail = (email = '') => {
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 2)}*@${domain}`
}

export default function CheckEmail() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const email = state?.email ?? ''
  const [resent, setResent] = useState(false)

  const handleResend = () => {
    // TODO: call your resend-link API here
    console.log('resend reset link to', email)
    setResent(true)
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
      <div
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
          }}
        >
          Check your email
        </h1>

        {/* Envelope icon */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '22px 0 18px' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              backgroundColor: '#CCFF00',
              border: '3px solid #121212',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#121212" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 6l10 7 10-7" />
            </svg>
          </div>
        </div>

        <p style={{ margin: '0 0 22px', fontSize: 13, lineHeight: 1.5, color: '#666', textAlign: 'center' }}>
          To protect your information, reset emails are only sent if an account exists.
          {email ? ` If ${maskEmail(email)} is in our system, your link is on its way.` : ' If your email is in our system, your link is on its way.'}
        </p>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#121212' }}>
          <div>
            {resent ? 'Link resent. ' : "Didn't get it? "}
            <button
              type="button"
              onClick={handleResend}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
                fontSize: 13,
                color: '#121212',
                textDecoration: 'underline',
              }}
            >
              Resend link
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              marginTop: 4,
              fontFamily: 'inherit',
              fontSize: 13,
              color: '#121212',
            }}
          >
            ← Re-enter email address
          </button>
        </div>
      </div>
    </div>
  )
}