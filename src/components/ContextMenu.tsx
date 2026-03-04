import { useEffect, useRef, useState } from 'react'
import { groupedRegistry } from '../nodes/registry'

interface Props {
  x: number
  y: number
  onSelect: (type: string) => void
  onClose: () => void
}

export function ContextMenu({ x, y, onSelect, onClose }: Props) {
  const groups = groupedRegistry()
  const [expanded, setExpanded] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 4,
        minWidth: 160,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 1000,
        fontSize: 12,
        color: '#cbd5e1',
        userSelect: 'none',
      }}
    >
      {Object.entries(groups).map(([category, entries]) => (
        <div key={category}>
          {/* Category header */}
          <div
            onClick={() => setExpanded((c) => (c === category ? null : category))}
            style={{
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #1e293b',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: 10,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#1e293b')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            {category}
            <span style={{ opacity: 0.6 }}>{expanded === category ? '▾' : '▸'}</span>
          </div>

          {/* Entries — shown when category is expanded */}
          {expanded === category &&
            entries.map((entry) => (
              <div
                key={entry.type}
                onClick={() => { onSelect(entry.type); onClose() }}
                style={{ padding: '5px 10px 5px 18px', cursor: 'pointer' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#1e3a5f')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                {entry.label}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}
