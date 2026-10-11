import logo from "./assets/LogoBG.png"
import bgimg from "./assets/AdminLoginBG.png"
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login({}) {
  const [show, setShow] = useState(false)
  const passwordRef = useRef(null)
  const navigate = useNavigate()

  return (
    <>
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
          className="bg-olive-50"
          style={{
            width: '100%',
            minHeight: '58vh',
            maxWidth: 'clamp(420px, 28vw, 520px)',  
            border: '1px solid #D4C9A8',
            borderRadius: 8,
            padding: 'clamp(18px, 1.6vw, 28px)',
            boxSizing: 'border-box',
            paddingBottom: 20,
            caretColor: 'transparent'
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              userSelect: 'none'
            }}
          >
            <img src={logo} alt="" style={{ width: '95%' }} />
            <p
              style={{
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontSize: 'clamp(22px, 1.6vw, 30px)',
                fontWeight: 800,
                margin: 0,
                cursor: 'default',
                userSelect: 'none'
              }}
            >
              Management Access
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '0 12px', marginTop: 'clamp(18px, 2vh, 28px)' }}>
            <p style={{ cursor: 'default', fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: 14, color: '#121212' }}>
              Email Address
            </p>

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
                marginBottom: 20,
              }}
            >
              <input
                type="email"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()          // stops the default Enter behavior
                    passwordRef.current.focus() // jumps to the password field
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,          // lets the input shrink instead of overflowing
                  border: 'none',
                  outline: 'none',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  background: 'transparent',
                }}
              />
            </div>

            <p style={{ cursor: 'default', fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: 14, color: '#121212' }}>
              Password
            </p>

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
              }}
            >
              <input
                ref={passwordRef}
                type={show ? 'text' : 'password'}
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

              {/* eye toggle */}
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Hide password' : 'Show password'}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {show && <line x1="3" y1="3" x2="21" y2="21" />}
                </svg>
              </button>
            </div>

            {/* forgot password link */}
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <button type="button" onClick={() => navigate('/forgot-password')} 
                    style={{ cursor: 'pointer', color: '#222', fontSize: 15, textDecoration: 'none' }}>
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                height: 39,
                backgroundColor: '#CCFF00',
                color: '#000',
                border: '2px solid #000',
                borderRadius: 10,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                marginTop: 'clamp(20px, 3vh, 30px)',
                userSelect: 'none'
              }}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </>
  )
}