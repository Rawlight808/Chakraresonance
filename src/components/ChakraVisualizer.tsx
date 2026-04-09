import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import chakraBodyReference from '../assets/chakra-body-reference.png'
import { chakraProfiles } from '../data/chakraProfiles'
import type { ChakraId, ChakraProfile } from '../data/chakraProfiles'
import { visualizerChakraScreensavers } from '../data/chakraScreensavers'
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
  const frontGradientId = `${panelId}-flow-front-gradient`
  const backGradientId = `${panelId}-flow-back-gradient`

  const activeChakra = chakraMap.get(activeId) ?? chakraProfiles[0]
  const isExpanded = expandedIds[activeChakra.id] ?? false
  const activeScreensaver = showScreensaverOption
    ? visualizerChakraScreensavers[activeChakra.id]
    : null
  const flowPoints = useMemo(
    () =>
      chakraProfiles.map((chakra) => ({
        x: 250,
        y: (chakra.bodyPosition / 100) * 500,
      })),
    [],
  )
  const frontFlowPath = useMemo(() => {
    if (flowPoints.length < 2) return ''

    let path = `M ${flowPoints[0].x} ${flowPoints[0].y}`
    for (let idx = 1; idx < flowPoints.length; idx += 1) {
      const prevPoint = flowPoints[idx - 1]
      const point = flowPoints[idx]
      const controlY = (prevPoint.y + point.y) / 2
      path += ` C ${prevPoint.x + 22} ${controlY} ${point.x + 22} ${controlY} ${point.x} ${point.y}`
    }

    return path
  }, [flowPoints])
  const backFlowPath = useMemo(() => {
    if (flowPoints.length < 2) return ''

    const descending = [...flowPoints].reverse()
    let path = `M ${descending[0].x} ${descending[0].y}`
    for (let idx = 1; idx < descending.length; idx += 1) {
      const prevPoint = descending[idx - 1]
      const point = descending[idx]
      const controlY = (prevPoint.y + point.y) / 2
      path += ` C ${prevPoint.x - 22} ${controlY} ${point.x - 22} ${controlY} ${point.x} ${point.y}`
    }

    return path
  }, [flowPoints])
  const fullFlowPath = `${frontFlowPath} ${backFlowPath}`.trim()

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
          Select a chakra on the body outline to reveal its meaning. Use arrow keys to move between
          energy centers, then press Enter or Space to open details.
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
              {/* Animated energy loop: up the front (root to crown), down the back (crown to root). */}
              <svg
                className="chakra-visualizer__flow"
                viewBox="0 0 500 500"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <linearGradient id={frontGradientId} x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#ff6a63" />
                    <stop offset="46%" stopColor="#6ce896" />
                    <stop offset="100%" stopColor="#d892ff" />
                  </linearGradient>
                  <linearGradient id={backGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#c38cff" />
                    <stop offset="52%" stopColor="#72b7ff" />
                    <stop offset="100%" stopColor="#ff6a63" />
                  </linearGradient>
                </defs>

                <path
                  className="chakra-visualizer__flow-track"
                  d={fullFlowPath}
                />
                <path
                  className="chakra-visualizer__flow-front"
                  d={frontFlowPath}
                  stroke={`url(#${frontGradientId})`}
                />
                <path
                  className="chakra-visualizer__flow-back"
                  d={backFlowPath}
                  stroke={`url(#${backGradientId})`}
                />

                <circle className="chakra-visualizer__flow-pulse chakra-visualizer__flow-pulse--front" r="6">
                  <animateMotion
                    dur="4.8s"
                    repeatCount="indefinite"
                    path={frontFlowPath}
                  />
                </circle>
                <circle className="chakra-visualizer__flow-pulse chakra-visualizer__flow-pulse--back" r="5">
                  <animateMotion
                    dur="4.8s"
                    repeatCount="indefinite"
                    path={backFlowPath}
                  />
                </circle>
              </svg>

              {/* Reuse the existing body image and layer interactive chakra nodes over it. */}
              <img
                src={chakraBodyReference}
                alt="Meditating human figure with chakra alignment points"
                className="chakra-visualizer__body-image"
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
                    <span className="chakra-visualizer__node-ring" aria-hidden="true" />
                    <span className="chakra-visualizer__node-core" aria-hidden="true" />
                    <span className="chakra-visualizer__node-label">
                      {chakra.name}
                      <span>{chakra.sanskritName}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

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
