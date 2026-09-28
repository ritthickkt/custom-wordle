import { useCallback, useEffect, useMemo, useState } from 'react'

const MIN_LEN = 3
const MAX_LEN = 10
const MAX_GUESSES = 6
const KEY = 'wordle-for-friends'

// Light obfuscation so the answer isn't readable straight from the link.
function encodeWord(word) {
  const bytes = [...word].map((c, i) => c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeWord(code) {
  try {
    const raw = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const word = [...raw].map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length))).join('')
    return /^[A-Z]+$/.test(word) && word.length >= MIN_LEN && word.length <= MAX_LEN ? word : null
  } catch {
    return null
  }
}

// Standard Wordle scoring, handling repeated letters correctly.
function scoreGuess(guess, answer) {
  const result = Array(answer.length).fill('absent')
  const remaining = {}
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) result[i] = 'correct'
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1
  }
  for (let i = 0; i < answer.length; i++) {
    if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
      result[i] = 'present'
      remaining[guess[i]]--
    }
  }
  return result
}

function Creator() {
  const [word, setWord] = useState('')
  const [copied, setCopied] = useState(false)
  const valid = word.length >= MIN_LEN && word.length <= MAX_LEN
  const link = valid ? `${window.location.origin}/?w=${encodeWord(word)}` : ''

  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="creator">
      <p className="subtitle">Pick a secret word, then send the link to your friends.</p>
      <input
        className="word-input"
        value={word}
        maxLength={MAX_LEN}
        placeholder="YOUR WORD"
        autoFocus
        onChange={(e) => {
          setWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
          setCopied(false)
        }}
      />
      <p className="hint">
        {word.length === 0
          ? `Letters only, ${MIN_LEN}–${MAX_LEN} long`
          : valid
            ? `${word.length}-letter word ✓`
            : `Needs at least ${MIN_LEN} letters`}
      </p>
      {valid && (
        <div className="link-box">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <div className="link-actions">
            <button onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
            <a className="button secondary" href={link} target="_blank" rel="noreferrer">
              Try it
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

const KEYBOARD = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const RANK = { absent: 1, present: 2, correct: 3 }
const EMOJI = { correct: '🟩', present: '🟨', absent: '⬛' }

function Game({ answer }) {
  const [guesses, setGuesses] = useState([])
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(false)

  const scores = useMemo(() => guesses.map((g) => scoreGuess(g, answer)), [guesses, answer])
  const won = guesses.at(-1) === answer
  const over = won || guesses.length >= MAX_GUESSES

  const keyStates = useMemo(() => {
    const states = {}
    guesses.forEach((g, gi) =>
      [...g].forEach((ch, i) => {
        const s = scores[gi][i]
        if (!states[ch] || RANK[s] > RANK[states[ch]]) states[ch] = s
      }),
    )
    return states
  }, [guesses, scores])

  const flash = (msg) => {
    setMessage(msg)
    setShake(true)
    setTimeout(() => setShake(false), 500)
    setTimeout(() => setMessage(''), 1500)
  }

  const press = useCallback(
    (key) => {
      if (over) return
      if (key === 'ENTER') {
        if (current.length !== answer.length) return flash('Not enough letters')
        const next = [...guesses, current]
        setGuesses(next)
        setCurrent('')
      } else if (key === 'BACK') {
        setCurrent((c) => c.slice(0, -1))
      } else if (/^[A-Z]$/.test(key) && current.length < answer.length) {
        setCurrent((c) => c + key)
      }
    },
    [over, current, answer, guesses],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter') press('ENTER')
      else if (e.key === 'Backspace') press('BACK')
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  const share = async () => {
    const grid = scores.map((row) => row.map((s) => EMOJI[s]).join('')).join('\n')
    const text = `Custom Wordle ${won ? guesses.length : 'X'}/${MAX_GUESSES}\n\n${grid}\n\n${window.location.href}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        /* fall back to clipboard */
      }
    }
    await navigator.clipboard.writeText(text)
    setMessage('Results copied!')
    setTimeout(() => setMessage(''), 1500)
  }

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r], states: scores[r] }
    if (r === guesses.length && !over) return { letters: current, active: true }
    return { letters: '' }
  })

  return (
    <div className="game">
      <div className="toast-area">{message && <div className="toast">{message}</div>}</div>
      <div className="board" style={{ '--cols': answer.length }}>
        {rows.map((row, r) => (
          <div key={r} className={`row ${row.active && shake ? 'shake' : ''}`}>
            {Array.from({ length: answer.length }, (_, i) => {
              const ch = row.letters[i] || ''
              const state = row.states?.[i] || (ch ? 'filled' : 'empty')
              return (
                <div key={i} className={`tile ${state}`} style={{ animationDelay: `${i * 0.12}s` }}>
                  {ch}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {over && (
        <div className="result">
          <p>{won ? `You got it in ${guesses.length}!` : <>The word was <strong>{answer}</strong></>}</p>
          <div className="link-actions">
            <button onClick={share}>Share results</button>
            <a className="button secondary" href="/">
              Make your own
            </a>
          </div>
        </div>
      )}

      <div className="keyboard">
        {KEYBOARD.map((row, i) => (
          <div key={row} className="key-row">
            {i === 2 && (
              <button className="key wide" onClick={() => press('ENTER')}>
                Enter
              </button>
            )}
            {[...row].map((k) => (
              <button key={k} className={`key ${keyStates[k] || ''}`} onClick={() => press(k)}>
                {k}
              </button>
            ))}
            {i === 2 && (
              <button className="key wide" onClick={() => press('BACK')} aria-label="Backspace">
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const code = new URLSearchParams(window.location.search).get('w')
  const answer = code ? decodeWord(code) : null

  return (
    <main>
      <header>
        <a href="/" className="title">
          Custom Wordle
        </a>
      </header>
      {code && !answer ? (
        <div className="creator">
          <p className="subtitle">This link looks broken.</p>
          <a className="button" href="/">
            Make a new one
          </a>
        </div>
      ) : answer ? (
        <Game answer={answer} />
      ) : (
        <Creator />
      )}
    </main>
  )
}
