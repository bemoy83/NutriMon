import { useState } from 'react'

export interface WaterTrackerProps {
  date: string
  initialCups?: number
  onChange?: (cups: number) => void
}

const TOTAL = 8
const STORAGE_KEY = (date: string) => `water:${date}`

function readStoredCups(date: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(date))
    if (raw !== null) {
      const n = parseInt(raw, 10)
      if (!isNaN(n) && n >= 0 && n <= TOTAL) return n
    }
  } catch {
    // localStorage unavailable
  }
  return fallback
}

function DropIcon({ color, size }: { color: string; size: number }) {
  const isWhite = color === '#fff' || color === 'white' || color === '#ffffff'
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 1C6.5 1 2 5.5 2 8a4.5 4.5 0 009 0c0-2.5-4.5-7-4.5-7z"
        stroke={color}
        strokeWidth="1.5"
        fill={color}
        fillOpacity={isWhite ? '0.25' : '0.15'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function WaterTracker({ date, initialCups = 0, onChange }: WaterTrackerProps) {
  const [cups, setCups] = useState(() => readStoredCups(date, initialCups))
  const [pressedIndex, setPressedIndex] = useState<number | null>(null)

  function handleTap(i: number) {
    const next = i + 1 === cups ? i : i + 1
    setCups(next)
    try {
      localStorage.setItem(STORAGE_KEY(date), String(next))
    } catch {
      // localStorage unavailable
    }
    onChange?.(next)
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 22,
        padding: '14px 18px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DropIcon color="#5AC8FA" size={16} />
          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: 'var(--app-text-primary)',
            }}
          >
            Water
          </span>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--app-text-muted)',
          }}
        >
          {cups} of {TOTAL} cups
        </span>
      </div>

      {/* Cup tiles row */}
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: TOTAL }).map((_, i) => {
          const filled = i < cups
          const pressed = pressedIndex === i
          return (
            <button
              key={i}
              type="button"
              aria-label={`${filled ? 'Remove' : 'Add'} cup ${i + 1}`}
              onClick={() => handleTap(i)}
              onMouseDown={() => setPressedIndex(i)}
              onMouseUp={() => setPressedIndex(null)}
              onMouseLeave={() => setPressedIndex(null)}
              onTouchStart={() => setPressedIndex(i)}
              onTouchEnd={() => setPressedIndex(null)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: filled ? '#5AC8FA' : '#E8F5FD',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: pressed ? 'scale(0.9)' : 'scale(1)',
                transition: 'background 0.15s ease, transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                padding: 0,
              }}
            >
              {filled && <DropIcon color="#fff" size={11} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
