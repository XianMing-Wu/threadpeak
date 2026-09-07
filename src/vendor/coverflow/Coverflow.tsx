// Adapted from ashishgogula/coverflow (MIT). See SOURCE.md and LICENSE.
import './coverflow.css'

import { memo, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type PanInfo,
  type MotionValue,
} from 'motion/react'

type Direction = 'left' | 'right'

const AudioCtx: typeof AudioContext | null =
  typeof window !== 'undefined'
    ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null)
    : null

function useTickAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); ctxRef.current = null }, [])

  useEffect(() => {
    if (!enabled || !AudioCtx) return
    const warm = () => {
      if (!ctxRef.current) ctxRef.current = new AudioCtx!()
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {})
    }
    window.addEventListener('pointerdown', warm, { once: true })
    return () => window.removeEventListener('pointerdown', warm)
  }, [enabled])

  return useCallback(
    (direction: Direction, velocity = 1) => {
      if (!enabled || !AudioCtx) return

      const getCtx = async () => {
        if (!ctxRef.current) ctxRef.current = new AudioCtx!()
        if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
        return ctxRef.current
      }

      getCtx().then((ctx) => {
        const t = ctx.currentTime
        const vn = Math.min(Math.abs(velocity) / 300, 1)
        const peakGain = 0.28 * (0.55 + vn * 0.45)
        const freq = 1600 * (0.88 + vn * 0.24)
        const bodyDur = 0.022 - vn * 0.008
        const clickDur = bodyDur * 0.3
        const panStart = direction === 'left' ? 0.7 : -0.7
        const panEnd = direction === 'left' ? -0.7 : 0.7

        const panner = ctx.createStereoPanner()
        panner.pan.setValueAtTime(panStart, t)
        panner.pan.linearRampToValueAtTime(panEnd, t + bodyDur)
        panner.connect(ctx.destination)

        const bodyGain = ctx.createGain()
        bodyGain.gain.setValueAtTime(peakGain, t)
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + bodyDur)
        bodyGain.connect(panner)

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = freq
        filter.Q.value = 6
        filter.connect(bodyGain)

        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq * 1.25, t)
        osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + bodyDur)
        osc.connect(filter)
        osc.start(t)
        osc.stop(t + bodyDur)

        const nSamples = Math.ceil(ctx.sampleRate * clickDur)
        const noiseBuf = ctx.createBuffer(1, nSamples, ctx.sampleRate)
        const d = noiseBuf.getChannelData(0)
        for (let i = 0; i < nSamples; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nSamples * 0.2))

        const noiseGain = ctx.createGain()
        noiseGain.gain.setValueAtTime(peakGain * 0.35, t)
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + clickDur)
        noiseGain.connect(panner)

        const noiseHp = ctx.createBiquadFilter()
        noiseHp.type = 'highpass'
        noiseHp.frequency.value = 2400
        noiseHp.connect(noiseGain)

        const noise = ctx.createBufferSource()
        noise.buffer = noiseBuf
        noise.connect(noiseHp)
        noise.start(t)
        noise.stop(t + clickDur)
      }).catch(() => {})
    },
    [enabled],
  )
}

export interface CoverFlowItem {
  id: string | number
  image: string
  title: string
  subtitle?: string
}

export interface RenderImageProps {
  src: string
  alt: string
  width: number
  height: number
  className: string
  draggable: boolean
  sizes: string
  priority?: boolean
  loading?: 'eager' | 'lazy'
}

export interface CoverFlowProps {
  items: CoverFlowItem[]
  itemWidth?: number
  itemHeight?: number
  stackSpacing?: number
  centerGap?: number
  rotation?: number
  index?: number
  initialIndex?: number
  enableReflection?: boolean
  enableClickToSnap?: boolean
  enableScroll?: boolean
  enableAudio?: boolean
  scrollThreshold?: number
  className?: string
  onItemClick?: (item: CoverFlowItem, index: number) => void
  onIndexChange?: (index: number) => void
  renderImage?: (props: RenderImageProps) => ReactNode
}

const defaultRenderImage = (props: RenderImageProps) => (
  <img
    src={props.src}
    alt={props.alt}
    width={props.width}
    height={props.height}
    className={props.className}
    draggable={props.draggable}
    sizes={props.sizes}
    loading={props.loading}
  />
)

function clampIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0))
}

export function CoverFlow({
  items,
  itemWidth = 400,
  itemHeight = 400,
  stackSpacing = 100,
  centerGap = 250,
  rotation = 50,
  index: controlledIndex,
  initialIndex = 0,
  enableReflection = false,
  enableClickToSnap = true,
  enableScroll = true,
  enableAudio = false,
  scrollThreshold = 100,
  className,
  onItemClick,
  onIndexChange,
  renderImage,
}: CoverFlowProps) {
  const safeInitial = clampIndex(controlledIndex ?? initialIndex, items.length)
  const [localIndex, setLocalIndex] = useState(safeInitial)
  const activeIndex = clampIndex(controlledIndex ?? localIndex, items.length)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceId = useId().replace(/:/g, 'x')
  const [isMounted, setIsMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    const apply = () => setIsMobile(mql.matches)
    apply()
    mql.addEventListener?.('change', apply)
    return () => mql.removeEventListener?.('change', apply)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsSafari(/^((?!chrome|android).)*safari/i.test(window.navigator.userAgent))
  }, [])
  const scale = containerWidth > 0 && itemWidth > 0 ? Math.min(1, (containerWidth * 0.78) / itemWidth) : 1
  const effectiveWidth = Math.round(itemWidth * scale)
  const effectiveHeight = Math.round(itemHeight * scale)
  const effectiveStackSpacing = Math.round(stackSpacing * scale)
  const effectiveCenterGap = Math.round(centerGap * scale)

  const reflectionFilterId = (isMounted && enableReflection && !isMobile && !isSafari) ? `${instanceId}-rf` : undefined
  const showReflection = isMounted && enableReflection
  const activeIndexRef = useRef(activeIndex)
  const enableScrollRef = useRef(enableScroll)
  const scrollThresholdRef = useRef(scrollThreshold)
  const onItemClickRef = useRef(onItemClick)
  const enableClickToSnapRef = useRef(enableClickToSnap)
  const onIndexChangeRef = useRef(onIndexChange)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)

  activeIndexRef.current = activeIndex
  enableScrollRef.current = enableScroll
  scrollThresholdRef.current = scrollThreshold
  onItemClickRef.current = onItemClick
  enableClickToSnapRef.current = enableClickToSnap
  onIndexChangeRef.current = onIndexChange

  const prefersReducedMotion = useReducedMotion()
  const scrollX = useMotionValue(safeInitial)
  const springX = useSpring(scrollX, { stiffness: 150, damping: 30, mass: 1 })
  const effectiveScrollX = prefersReducedMotion ? scrollX : springX
  const tick = useTickAudio(enableAudio)

  // Only selection is synchronized. User callbacks run in event handlers, never
  // in an effect that can feed an old index back into a controlled parent.
  useEffect(() => {
    if (!draggingRef.current) scrollX.set(activeIndex)
  }, [activeIndex, scrollX])
  const select = useCallback((next: number) => {
    const clamped = clampIndex(next, items.length)
    const previous = activeIndexRef.current
    activeIndexRef.current = clamped
    setLocalIndex(clamped)
    scrollX.set(clamped)
    if (clamped !== previous) onIndexChangeRef.current?.(clamped)
  }, [items.length, scrollX])

  const jumpToIndex = useCallback(
    (index: number, velocity = 0, direction?: Direction) => {
      const clamped = clampIndex(index, items.length)
      const prev = activeIndexRef.current
      if (clamped === prev) return
      const dir: Direction = direction ?? (clamped > prev ? 'right' : 'left')
      select(clamped)
      tick(dir, velocity)
    },
    [items.length, select, tick],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let accumulator = 0
    let lastTime = Date.now()
    let lastJump = 0

    const handleWheel = (e: WheelEvent) => {
      if (!enableScrollRef.current) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return
      e.preventDefault()

      const now = Date.now()
      if (now - lastTime > 200) accumulator = 0
      lastTime = now
      accumulator += e.deltaX

      const threshold = scrollThresholdRef.current
      const shouldJump =
        (accumulator > threshold || accumulator < -threshold) &&
        now - lastJump > 150

      if (shouldJump) {
        const dir = accumulator > 0 ? 'right' : 'left'
        jumpToIndex(Math.round(scrollX.get()) + (dir === 'right' ? 1 : -1), Math.abs(e.deltaX), dir)
        accumulator = 0
        lastJump = now
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [jumpToIndex, scrollX])

  const handleCardClick = useCallback(
    (item: CoverFlowItem, index: number) => {
      if (suppressClickRef.current) return
      if (index === activeIndexRef.current) {
        onItemClickRef.current?.(item, index)
      } else if (enableClickToSnapRef.current) {
        jumpToIndex(index)
      }
    },
    [jumpToIndex],
  )

  const onDragStart = useCallback(() => {
    draggingRef.current = true
    suppressClickRef.current = true
    setIsDragging(true)
    // Catch the visible position when a new gesture interrupts a settling spring.
    scrollX.set(effectiveScrollX.get())
  }, [scrollX, effectiveScrollX])

  const onDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      const position = Math.max(-0.15, Math.min(items.length - 0.85, scrollX.get() - info.delta.x / Math.max(1, effectiveCenterGap)))
      scrollX.set(position)
      // Direct manipulation follows the pointer; spring smoothing is for release.
      springX.jump(position)
    },
    [effectiveCenterGap, items.length, scrollX, springX],
  )

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      draggingRef.current = false
      setIsDragging(false)
      // Velocity uses the same card units as the position, with a bounded fling.
      const fling = Math.max(-0.65, Math.min(0.65, info.velocity.x / Math.max(1, effectiveCenterGap) * 0.12))
      const clamped = clampIndex(Math.round(scrollX.get() - fling), items.length)
      const previous = activeIndexRef.current
      select(clamped)
      if (clamped !== previous) tick(clamped > previous ? 'right' : 'left', Math.abs(info.velocity.x))
    },
    [items.length, effectiveCenterGap, scrollX, select, tick],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const index = activeIndexRef.current
        if (items[index]) onItemClickRef.current?.(items[index], index)
      }
      if (e.key === 'Home') { e.preventDefault(); jumpToIndex(0) }
      if (e.key === 'End') { e.preventDefault(); jumpToIndex(items.length - 1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); jumpToIndex(activeIndexRef.current - 1, 120, 'left') }
      if (e.key === 'ArrowRight') { e.preventDefault(); jumpToIndex(activeIndexRef.current + 1, 120, 'right') }
    },
    [jumpToIndex, items],
  )

  if (items.length === 0) return null

  return (
    <>
      {reflectionFilterId && (
        <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <defs>
            <filter id={reflectionFilterId} x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.018 0.065" numOctaves="3" seed="8" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur in="displaced" stdDeviation="0.4 1.8" />
            </filter>
          </defs>
        </svg>
      )}
      <motion.div
        ref={containerRef}
        className={`cf-root ${
          isDragging ? 'is-dragging cursor-grabbing' : 'cursor-grab'
        } ${className ?? ''}`}
        style={{ perspective: 1000 }}
        role="region"
        aria-label="博主卡片轮播"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDownCapture={() => { suppressClickRef.current = false }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onPointerCancel={() => { draggingRef.current = false; setIsDragging(false); select(Math.round(scrollX.get())) }}
      >
        <div
          className="cf-track"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {items.map((item, index) => (
            <CoverFlowItemCard
              key={item.id}
              item={item}
              index={index}
              scrollX={effectiveScrollX}
              width={effectiveWidth}
              height={effectiveHeight}
              stackSpacing={effectiveStackSpacing}
              centerGap={effectiveCenterGap}
              rotation={rotation}
              isActive={index === activeIndex}
              showReflection={showReflection}
              reflectionFilterId={reflectionFilterId}
              enableClickToSnap={enableClickToSnap}
              reduceMotion={prefersReducedMotion ?? false}
              renderImage={renderImage}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        <div className="cf-caption">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: 'easeOut' }}
              className="text-center"
            >
              <h3 className="text-2xl font-semibold text-foreground tracking-tight drop-shadow-md">
                {items[activeIndex]?.title}
              </h3>
              {items[activeIndex]?.subtitle && (
                <p className="text-foreground/60 text-sm mt-1 font-medium tracking-wide">
                  {items[activeIndex]?.subtitle}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}

interface CardProps {
  item: CoverFlowItem
  index: number
  scrollX: MotionValue<number>
  width: number
  height: number
  stackSpacing: number
  centerGap: number
  rotation: number
  isActive: boolean
  showReflection: boolean
  reflectionFilterId?: string
  enableClickToSnap: boolean
  reduceMotion: boolean
  renderImage?: (props: RenderImageProps) => ReactNode
  onCardClick: (item: CoverFlowItem, index: number) => void
}

const CoverFlowItemCard = memo(function CoverFlowItemCard({
  item,
  index,
  scrollX,
  width,
  height,
  stackSpacing,
  centerGap,
  rotation,
  isActive,
  showReflection,
  reflectionFilterId,
  enableClickToSnap,
  reduceMotion,
  renderImage,
  onCardClick,
}: CardProps) {
  const rotateY = useTransform(scrollX, (value) => {
    if (reduceMotion) return 0
    const pos = index - value
    const absPos = Math.abs(pos)
    return absPos < 0.5 ? -pos * (rotation * 2) : pos < 0 ? rotation : -rotation
  })

  const x = useTransform(scrollX, (value) => {
    const pos = index - value
    const absPos = Math.abs(pos)
    if (absPos < 1) return pos * centerGap
    return pos < 0
      ? -centerGap - (absPos - 1) * stackSpacing
      : centerGap + (absPos - 1) * stackSpacing
  })

  const z = useTransform(scrollX, (value) => {
    if (reduceMotion) return 0
    const absPos = Math.abs(index - value)
    return absPos > 0.5 ? -200 : absPos * -400
  })

  const zIndex = useTransform(scrollX, (value) => 1000 - Math.abs(index - value) * 10)

  const filterStyle = useTransform(
    scrollX,
    (value) => `brightness(${Math.abs(index - value) < 0.5 ? 1 : 0.88})`,
  )

  const imageRenderer = renderImage ?? defaultRenderImage
  const cursorClass = isActive || enableClickToSnap ? 'cursor-pointer' : 'cursor-grab'

  return (
    <motion.div
      className={`cf-card ${cursorClass}`}
      style={{
        width,
        height,
        marginTop: -height / 2,
        marginLeft: -width / 2,
        x,
        z,
        rotateY,
        zIndex,
        filter: filterStyle,
        pointerEvents: 'auto',
      }}
      data-active={isActive}
      onClick={() => onCardClick(item, index)}
    >
      <div className="cf-surface">
        <div className="cf-border" />
        <div className="cf-image">
          {imageRenderer({
            src: item.image,
            alt: item.title,
            width,
            height,
            className: 'cf-render',
            draggable: false,
            sizes: `${width}px`,
            priority: isActive,
            loading: isActive ? 'eager' : 'lazy',
          })}
          <div className="cf-shine" />
        </div>
      </div>

      {/* ThreadPeak: a 45-degree cast shadow, not a mirrored second portrait. */}
      {showReflection && <div aria-hidden="true" className="cf-shadow"/>}
    </motion.div>
  )
})
