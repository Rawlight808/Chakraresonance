import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import chakraBodyReference from '../assets/chakra-body-reference.png'
import { chakraProfiles } from '../data/chakraProfiles'
import type { ChakraId, ChakraProfile } from '../data/chakraProfiles'
import { chakraScreensavers } from '../data/chakraScreensavers'
import './ChakraVisualizer.css'

type ChakraDetailsPanelProps = {
  chakra: ChakraProfile
  expanded: boolean
  panelId: string
  descriptionId: string
  onToggleExpand: () => void
  onOpenColorImmersion?: () => void
  onClose?: () => void
}

function ChakraDetailsPanel({
  chakra,
  expanded,
  panelId,
  descriptionId,
  onToggleExpand,
  onOpenColorImmersion,
  onClose,
}: ChakraDetailsPanelProps) {
  return (
    <div
      className="chakra-visualizer__details"
      id={panelId}
      aria-labelledby={`${panelId}-title`}
    >
      <div className="chakra-visualizer__details-top">
        <div>
          <p className="chakra-visualizer__eyebrow">Selected chakra</p>
          <h3 className="chakra-visualizer__details-title" id={`${panelId}-title`}>
            {chakra.name}
          </h3>
          <p className="chakra-visualizer__details-subtitle">{chakra.sanskritName}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="chakra-visualizer__close"
            onClick={onClose}
            aria-label="Close chakra details"
            autoFocus
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="chakra-visualizer__meta-grid">
        <div className="chakra-visualizer__meta-card">
          <span className="chakra-visualizer__meta-label">Color</span>
          <span className="chakra-visualizer__meta-value">{chakra.colorLabel}</span>
        </div>
        <div className="chakra-visualizer__meta-card">
          <span className="chakra-visualizer__meta-label">Location</span>
          <span className="chakra-visualizer__meta-value">{chakra.location}</span>
        </div>
      </div>

      <div className="chakra-visualizer__meaning">
        <span className="chakra-visualizer__meta-label">Meaning</span>
        <p>{chakra.meaning}</p>
      </div>

      <div className="chakra-visualizer__expandable">
        {onOpenColorImmersion ? (
          <button
            type="button"
            className="chakra-visualizer__expand-btn"
            onClick={onOpenColorImmersion}
          >
            View Full-Screen {chakra.name} Screensaver
          </button>
        ) : null}

        <button
          type="button"
          className="chakra-visualizer__expand-btn"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls={descriptionId}
        >
          {expanded ? 'Hide deeper insight' : 'Read deeper insight'}
        </button>
        <div
          id={descriptionId}
          className={[
            'chakra-visualizer__expand-panel',
            expanded ? 'chakra-visualizer__expand-panel--open' : '',
          ].join(' ').trim()}
        >
          <p>{chakra.description}</p>
        </div>
      </div>
    </div>
  )
}

type ChakraVisualizerProps = {
  showScreensaverOption?: boolean
}

export function ChakraVisualizer({ showScreensaverOption = true }: ChakraVisualizerProps) {
  const chakraIds = useMemo(() => chakraProfiles.map((chakra) => chakra.id), [])
  const chakraMap = useMemo(
    () => new Map(chakraProfiles.map((chakra) => [chakra.id, chakra])),
    [],
  )
  const [activeId, setActiveId] = useState<ChakraId>('heart')
  const [expandedIds, setExpandedIds] = useState<Partial<Record<ChakraId, boolean>>>({
    heart: true,
  })
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia('(max-width: 900px)').matches
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isColorImmersionOpen, setIsColorImmersionOpen] = useState(false)
  const [isColorHintVisible, setIsColorHintVisible] = useState(false)
  const chakraButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const titleId = useId()
  const panelId = useId()
  const descriptionId = `${panelId}-description`

  const activeChakra = chakraMap.get(activeId) ?? chakraProfiles[0]
  const isExpanded = expandedIds[activeChakra.id] ?? false
  const activeScreensaver = showScreensaverOption
    ? chakraScreensavers[activeChakra.id]
    : null

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches)

      if (!event.matches) {
        setIsDialogOpen(false)
      }
    }

    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  useEffect(() => {
    if (!isDialogOpen) return

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDialogOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isDialogOpen])

  useEffect(() => {
    if (!isColorImmersionOpen) return

    const hintTimer = window.setTimeout(() => {
      setIsColorHintVisible(false)
    }, 2000)

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsColorImmersionOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.clearTimeout(hintTimer)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isColorImmersionOpen])

  const selectChakra = useCallback(
    (chakraId: ChakraId, shouldOpenDialog = false) => {
      setActiveId(chakraId)
      setExpandedIds((current) => ({
        ...current,
        [chakraId]: current[chakraId] ?? false,
      }))

      if (shouldOpenDialog && isCompact) {
        setIsDialogOpen(true)
      }
    },
    [isCompact],
  )

  const toggleExpanded = useCallback((chakraId: ChakraId) => {
    setExpandedIds((current) => ({
      ...current,
      [chakraId]: !current[chakraId],
    }))
  }, [])

  const moveSelection = useCallback(
    (offset: number) => {
      const currentIndex = chakraIds.indexOf(activeId)
      if (currentIndex === -1) return

      const nextIndex = (currentIndex + offset + chakraIds.length) % chakraIds.length
      const nextId = chakraIds[nextIndex]
      selectChakra(nextId)
      chakraButtonRefs.current[nextId]?.focus()
    },
    [activeId, chakraIds, selectChakra],
  )

  const handleNodeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, chakraId: ChakraId) => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        moveSelection(-1)
        break
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        moveSelection(1)
        break
      case 'Home':
        event.preventDefault()
        selectChakra(chakraIds[0])
        chakraButtonRefs.current[chakraIds[0]]?.focus()
        break
      case 'End':
        event.preventDefault()
        selectChakra(chakraIds[chakraIds.length - 1])
        chakraButtonRefs.current[chakraIds[chakraIds.length - 1]]?.focus()
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectChakra(chakraId, true)
        break
      default:
        break
    }
  }

  const openColorImmersion = useCallback(() => {
    setIsColorHintVisible(true)
    setIsColorImmersionOpen(true)
  }, [])

  return (
    <section className="chakra-visualizer" aria-labelledby={titleId}>
      <div className="chakra-visualizer__header">
        <div>
          <p className="chakra-visualizer__eyebrow">Interactive visualizer</p>
          <h2 id={titleId}>Explore the seven main chakras through color, placement, and meaning.</h2>
        </div>
        <p className="chakra-visualizer__intro">
          Tap a chakra on the body or choose from the list below.
          <span className="chakra-visualizer__intro-desktop">
            {' '}Use arrow keys to navigate, then Enter to open details.
          </span>
        </p>
      </div>

      <div className="chakra-visualizer__layout">
        <div className="chakra-visualizer__figure-card">
          <div className="chakra-visualizer__sky" aria-hidden="true" />
          <div
            className="chakra-visualizer__figure"
          >
            <div
              className="chakra-visualizer__body-map"
              role="list"
              aria-label="Vertical chakra visualizer"
            >
              <img
                src={chakraBodyReference}
                alt="Meditating human figure with chakra alignment points"
                className="chakra-visualizer__body-image"
                loading="lazy"
              />

              {chakraProfiles.map((chakra) => {
                const isActive = chakra.id === activeChakra.id

                return (
                  <button
                    key={chakra.id}
                    ref={(node) => {
                      chakraButtonRefs.current[chakra.id] = node
                    }}
                    type="button"
                    role="listitem"
                    className={[
                      'chakra-visualizer__node',
                      isActive ? 'chakra-visualizer__node--active' : '',
                    ].join(' ').trim()}
                    style={
                      {
                        '--chakra-color': chakra.color,
                        '--chakra-y': `${chakra.bodyPosition}%`,
                      } as CSSProperties
                    }
                    onClick={() => selectChakra(chakra.id, true)}
                    onFocus={() => selectChakra(chakra.id)}
                    onMouseEnter={() => selectChakra(chakra.id)}
                    onKeyDown={(event) => handleNodeKeyDown(event, chakra.id)}
                    aria-label={`${chakra.name} chakra, ${chakra.sanskritName}, ${chakra.location}`}
                    aria-pressed={isActive}
                    aria-controls={panelId}
                  >
                    <span className="chakra-visualizer__node-label">
                      {chakra.name}
                      <span>{chakra.sanskritName}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {isCompact && (
            <button
              type="button"
              className="chakra-visualizer__mobile-hint"
              onClick={() => selectChakra(activeChakra.id, true)}
              style={{ '--chakra-color': activeChakra.color } as CSSProperties}
            >
              <span className="chakra-visualizer__mobile-hint-dot" style={{ background: activeChakra.color }} aria-hidden="true" />
              About {activeChakra.name} Chakra →
            </button>
          )}

          <p className="chakra-visualizer__rail-heading">Choose a chakra</p>
          <div className="chakra-visualizer__rail" aria-label="Chakra quick select">
            {chakraProfiles.map((chakra) => {
              const isActive = chakra.id === activeChakra.id

              return (
                <button
                  key={`${chakra.id}-rail`}
                  type="button"
                  className={[
                    'chakra-visualizer__rail-item',
                    isActive ? 'chakra-visualizer__rail-item--active' : '',
                  ].join(' ').trim()}
                  style={{ '--chakra-color': chakra.color } as CSSProperties}
                  onClick={() => selectChakra(chakra.id, true)}
                  aria-label={`Open ${chakra.name} chakra details`}
                >
                  <span className="chakra-visualizer__rail-dot" aria-hidden="true" />
                  <span>{chakra.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="chakra-visualizer__panel" aria-live="polite">
          <ChakraDetailsPanel
            chakra={activeChakra}
            expanded={isExpanded}
            panelId={panelId}
            descriptionId={descriptionId}
            onToggleExpand={() => toggleExpanded(activeChakra.id)}
            onOpenColorImmersion={showScreensaverOption ? openColorImmersion : undefined}
          />
        </aside>
      </div>

      {isCompact && isDialogOpen ? (
        <div
          className="chakra-visualizer__dialog-backdrop"
          role="presentation"
          onClick={() => setIsDialogOpen(false)}
        >
          <div
            className="chakra-visualizer__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${panelId}-mobile-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <ChakraDetailsPanel
              chakra={activeChakra}
              expanded={isExpanded}
              panelId={`${panelId}-mobile`}
              descriptionId={`${descriptionId}-mobile`}
              onToggleExpand={() => toggleExpanded(activeChakra.id)}
              onOpenColorImmersion={showScreensaverOption ? openColorImmersion : undefined}
              onClose={() => setIsDialogOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {showScreensaverOption && isColorImmersionOpen && activeScreensaver ? (
        <button
          type="button"
          className="chakra-visualizer__color-immersion"
          aria-label={`Close ${activeChakra.name} full-screen screensaver`}
          onClick={() => setIsColorImmersionOpen(false)}
        >
          <video
            key={activeScreensaver}
            className="chakra-visualizer__color-immersion-video"
            src={activeScreensaver}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <span
            className={[
              'chakra-visualizer__color-hint',
              isColorHintVisible ? 'chakra-visualizer__color-hint--visible' : '',
            ].join(' ').trim()}
          >
            Tap or click anywhere to close
          </span>
        </button>
      ) : null}
    </section>
  )
}
