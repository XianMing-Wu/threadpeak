export function parseTimelineJSON(source) {
  const data = typeof source === 'string' ? JSON.parse(source) : source
  return validateTimeline(data)
}

export function validateTimeline(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('时间线 JSON 必须是对象')
  const title = String(raw.title || '').trim()
  const titleZh = String(raw.titleZh || raw.title || '').trim()
  if (!title) throw new TypeError('时间线缺少 title')
  if (!Array.isArray(raw.events) || !raw.events.length) throw new TypeError('时间线 events 不能为空')
  const events = raw.events.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`events[${index}] 无效`)
    const year = Number(item.year)
    if (!Number.isFinite(year)) throw new TypeError(`events[${index}].year 必须是数字`)
    const eventTitle = String(item.title || '').trim()
    if (!eventTitle) throw new TypeError(`events[${index}] 缺少 title`)
    return {
      year,
      title: eventTitle,
      titleZh: String(item.titleZh || eventTitle).trim(),
      lead: String(item.lead || '').trim(),
      leadZh: String(item.leadZh || '').trim(),
      caption: String(item.caption || raw.image?.caption || '').trim(),
      captionZh: String(item.captionZh || raw.image?.captionZh || '').trim(),
      row: Number.isInteger(item.row) ? item.row : index % 3,
    }
  }).sort((a, b) => a.year - b.year)
  const years = events.map((item) => item.year)
  const minYear = Number(raw.range?.minYear ?? Math.min(...years) - 200)
  const maxYear = Number(raw.range?.maxYear ?? Math.max(...years) + 200)
  if (maxYear <= minYear) throw new TypeError('range.maxYear 必须大于 minYear')
  return {
    title,
    titleZh,
    lead: String(raw.lead || '').trim(),
    leadZh: String(raw.leadZh || '').trim(),
    minYear,
    maxYear,
    defaultYear: Number(raw.defaultYear ?? events[Math.floor(events.length / 2)].year),
    image: {
      src: String(raw.image?.src || ''),
      alt: String(raw.image?.alt || titleZh || title),
      caption: String(raw.image?.caption || ''),
      captionZh: String(raw.image?.captionZh || ''),
    },
    events,
  }
}

function wrapTitle(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} B.C.  公元前 ${Math.abs(year)} 年`
  if (year === 0) return '0'
  return `${year} A.D.  公元 ${year} 年`
}

export class WineTimeline {
  constructor(root) {
    if (!(root instanceof Element)) throw new TypeError('时间线容器不存在')
    this.root = root
    this.data = null
    this.active = 0
    this.atTitle = false
    this.animationTimer = 0
    this.timelineState = { centerYear: 0, zoom: 1, drag: null, velocity: 0, inertiaFrame: 0 }
    this.listeners = []
    this.svgNs = 'http://www.w3.org/2000/svg'
    this.mount()
  }

  setData(raw) {
    this.data = validateTimeline(raw)
    const fallback = this.data.events.findIndex((item) => item.year === this.data.defaultYear)
    this.active = fallback >= 0 ? fallback : 0
    this.atTitle = false
    this.timelineState.centerYear = this.data.events[this.active].year
    this.timelineState.zoom = 1
    this.renderSlide()
    this.rebuildTimeline(false)
    return this
  }

  setJSON(source) {
    return this.setData(parseTimelineJSON(source))
  }

  static parseJSON(source) {
    return parseTimelineJSON(source)
  }

  static validate(raw) {
    return validateTimeline(raw)
  }

  mount() {
    this.root.classList.add('wine-timeline')
    this.root.innerHTML = `
      <header class="masthead">
        <h1 data-page-title></h1>
        <p data-page-title-zh></p>
      </header>
      <section class="story">
        <button class="story-arrow story-arrow--previous" type="button" aria-label="查看上一事件"></button>
        <button class="story-peek story-peek--previous" type="button" aria-label="查看上一事件">
          <b data-previous-year></b><span data-previous-title></span>
        </button>
        <article class="story-slide">
          <figure class="story-media">
            <img data-story-image alt="" />
            <figcaption data-story-caption></figcaption>
            <p class="caption-zh" data-story-caption-zh></p>
          </figure>
          <div class="story-copy">
            <p class="year" data-story-year></p>
            <h2 data-story-title></h2>
            <h3 data-story-title-zh></h3>
            <p class="lead" data-story-lead></p>
            <p class="lead lead--zh" data-story-lead-zh></p>
          </div>
        </article>
        <button class="story-peek story-peek--next" type="button" aria-label="查看下一事件">
          <b data-next-year></b><span data-next-title></span>
        </button>
        <button class="story-arrow story-arrow--next" type="button" aria-label="查看下一事件"></button>
      </section>
      <section class="timeline">
        <div class="timeline-toolbar">
          <button data-timeline-home type="button" aria-label="返回时间线标题页"><span class="timeline-sprite-icon"></span></button>
          <button data-zoom-in type="button" aria-label="放大时间线"><span class="timeline-sprite-icon"></span></button>
          <button data-zoom-out type="button" aria-label="缩小时间线"><span class="timeline-sprite-icon"></span></button>
        </div>
        <div class="timeline-viewport" data-timeline-viewport tabindex="0">
          <div class="timeline-plot"></div>
          <svg class="timeline-ruler" data-timeline-ruler></svg>
          <div class="timeline-track" data-timeline-track></div>
          <div class="timeline-cursor" aria-hidden="true"><i></i></div>
        </div>
      </section>
    `
    this.$ = (sel) => this.root.querySelector(sel)
    this.viewport = this.$('[data-timeline-viewport]')
    this.track = this.$('[data-timeline-track]')
    this.ruler = this.$('[data-timeline-ruler]')
    this.bind()
  }

  on(target, type, handler, options) {
    target.addEventListener(type, handler, options)
    this.listeners.push(() => target.removeEventListener(type, handler, options))
  }

  bind() {
    this.on(this.$('.story-arrow--previous'), 'click', () => this.selectEvent(this.atTitle ? this.data.events.length - 1 : this.active - 1))
    this.on(this.$('.story-arrow--next'), 'click', () => this.selectEvent(this.atTitle ? 0 : this.active + 1))
    this.on(this.$('.story-peek--previous'), 'click', () => this.selectEvent(this.atTitle ? this.data.events.length - 1 : this.active - 1))
    this.on(this.$('.story-peek--next'), 'click', () => this.selectEvent(this.atTitle ? 0 : this.active + 1))
    this.on(this.$('[data-zoom-in]'), 'click', () => this.zoomAt(1.25))
    this.on(this.$('[data-zoom-out]'), 'click', () => this.zoomAt(1 / 1.25))
    this.on(this.$('[data-timeline-home]'), 'click', () => this.showTitle())
    this.on(this.viewport, 'wheel', (event) => {
      event.preventDefault()
      this.zoomAt(event.deltaY < 0 ? 1.2 : 1 / 1.2, event.clientX)
    }, { passive: false })
    this.on(this.viewport, 'pointerdown', (event) => {
      if (this.timelineState.drag || (event.button !== undefined && event.button !== 0)) return
      if (event.target.closest('.timeline-event')) return
      event.preventDefault()
      this.stopInertia()
      this.setMotion(false)
      this.viewport.setPointerCapture(event.pointerId)
      this.viewport.classList.add('is-dragging')
      this.timelineState.drag = { pointerId: event.pointerId, x: event.clientX, time: performance.now(), center: this.timelineState.centerYear }
    })
    this.on(this.viewport, 'pointermove', (event) => {
      const drag = this.timelineState.drag
      if (!drag || drag.pointerId !== event.pointerId) return
      const now = performance.now()
      const nextCenter = this.clampCenter(drag.center - (event.clientX - drag.x) / this.pxPerYear())
      this.timelineState.velocity = (nextCenter - this.timelineState.centerYear) / Math.max(1, now - drag.time) * 16
      this.timelineState.centerYear = nextCenter
      drag.x = event.clientX
      drag.center = nextCenter
      drag.time = now
      this.updateTransform(false)
    })
    const release = (event) => {
      const drag = this.timelineState.drag
      if (!drag || drag.pointerId !== event.pointerId) return
      if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId)
      this.timelineState.drag = null
      this.viewport.classList.remove('is-dragging')
      const coast = () => {
        this.timelineState.velocity *= 0.91
        if (Math.abs(this.timelineState.velocity) < 0.02) return
        const next = this.clampCenter(this.timelineState.centerYear + this.timelineState.velocity)
        if (next === this.timelineState.centerYear) return
        this.timelineState.centerYear = next
        this.updateTransform(false)
        this.timelineState.inertiaFrame = requestAnimationFrame(coast)
      }
      this.timelineState.inertiaFrame = requestAnimationFrame(coast)
    }
    this.on(this.viewport, 'pointerup', release)
    this.on(this.viewport, 'pointercancel', release)
    this.on(this.viewport, 'keydown', (event) => {
      if (!this.data) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); this.selectEvent(this.active - 1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); this.selectEvent(this.active + 1) }
      if (event.key === 'Home') { event.preventDefault(); this.showTitle() }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoomAt(1.25) }
      if (event.key === '-') { event.preventDefault(); this.zoomAt(1 / 1.25) }
    })
    this.on(window, 'resize', () => this.updateTransform(false))
  }

  pxPerYear() { return 6.7 * this.timelineState.zoom }
  worldX(year) { return (year - this.data.minYear) * this.pxPerYear() }
  worldWidth() { return (this.data.maxYear - this.data.minYear) * this.pxPerYear() }
  clampCenter(value) {
    const half = this.viewport.clientWidth / this.pxPerYear() / 2
    return Math.min(this.data.maxYear - half, Math.max(this.data.minYear + half, value))
  }

  renderSlide() {
    if (!this.data) return
    const events = this.data.events
    const item = this.atTitle ? {
      year: this.data.titleZh,
      title: this.data.title,
      titleZh: this.data.titleZh,
      lead: this.data.lead,
      leadZh: this.data.leadZh,
      caption: this.data.image.caption,
      captionZh: this.data.image.captionZh,
    } : events[this.active]
    this.$('[data-page-title]').textContent = this.data.title
    this.$('[data-page-title-zh]').textContent = this.data.titleZh
    const image = this.$('[data-story-image]')
    if (this.data.image.src) {
      image.src = this.data.image.src
      image.alt = this.data.image.alt
      image.hidden = false
    } else {
      image.removeAttribute('src')
      image.hidden = true
    }
    this.$('[data-story-year]').textContent = typeof item.year === 'number' ? String(item.year) : item.year
    this.$('[data-story-title]').textContent = wrapTitle(item.title)
    this.$('[data-story-title-zh]').textContent = wrapTitle(item.titleZh)
    this.$('[data-story-lead]').textContent = item.lead
    this.$('[data-story-lead-zh]').textContent = item.leadZh
    this.$('[data-story-caption]').textContent = item.caption
    this.$('[data-story-caption-zh]').textContent = item.captionZh
    const previous = events[(this.active + events.length - 1) % events.length]
    const next = events[(this.active + 1) % events.length]
    this.$('[data-previous-year]').textContent = previous.year
    this.$('[data-previous-title]').textContent = wrapTitle(previous.title)
    this.$('[data-next-year]').textContent = next.year
    this.$('[data-next-title]').textContent = wrapTitle(next.title)
  }

  animateSlide(direction) {
    const slide = this.$('.story-slide')
    if (!slide.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    slide.getAnimations().forEach((animation) => animation.cancel())
    slide.animate([
      { transform: `translateX(${direction * 46}px)`, opacity: 0.15 },
      { transform: 'translateX(0)', opacity: 1 },
    ], { duration: 650, easing: 'cubic-bezier(.77, 0, .175, 1)' })
  }

  setMotion(animated) {
    clearTimeout(this.animationTimer)
    this.track.classList.toggle('is-animated', animated)
    this.ruler.classList.toggle('is-animated', animated)
    if (animated) this.animationTimer = window.setTimeout(() => this.setMotion(false), 680)
  }

  buildMarkers() {
    const fragment = document.createDocumentFragment()
    this.track.style.width = `${this.worldWidth()}px`
    this.data.events.forEach((item, index) => {
      const node = document.createElement('button')
      node.type = 'button'
      node.className = 'timeline-event'
      node.style.left = `${this.worldX(item.year) + 3}px`
      const rowTop = [1, 48, 96][item.row % 3]
      node.style.setProperty('--row-top', `${rowTop}px`)
      node.style.setProperty('--line-top', `${-rowTop}px`)
      node.style.setProperty('--dot-top', `${147 - rowTop}px`)
      node.setAttribute('aria-label', `${item.year}: ${wrapTitle(item.title)}`)
      node.innerHTML = `<span class="event-content"><span class="event-icon" aria-hidden="true"></span><b>${wrapTitle(item.title)}</b></span>`
      node.addEventListener('click', (event) => { event.stopPropagation(); this.selectEvent(index, true) })
      fragment.append(node)
    })
    this.track.replaceChildren(fragment)
    this.updateActiveMarker()
  }

  rulerSteps() {
    if (this.timelineState.zoom < 0.52) return { major: 500, fine: 50 }
    if (this.timelineState.zoom < 0.82) return { major: 200, fine: 20 }
    if (this.timelineState.zoom > 1.6) return { major: 50, fine: 5 }
    return { major: 100, fine: 10 }
  }

  renderRuler() {
    const { major, fine } = this.rulerSteps()
    const width = this.worldWidth()
    this.ruler.setAttribute('width', width)
    this.ruler.setAttribute('height', 216)
    this.ruler.setAttribute('viewBox', `0 0 ${width} 216`)
    const fragment = document.createDocumentFragment()
    for (let year = Math.ceil(this.data.minYear / fine) * fine; year <= this.data.maxYear; year += fine) {
      const x = this.worldX(year)
      const isMajor = year % major === 0
      const tick = document.createElementNS(this.svgNs, 'line')
      tick.setAttribute('x1', x)
      tick.setAttribute('x2', x)
      tick.setAttribute('y1', 148)
      tick.setAttribute('y2', isMajor ? 164 : 157)
      tick.setAttribute('stroke', '#b7d3fa')
      tick.setAttribute('stroke-width', isMajor ? '1' : '.7')
      fragment.append(tick)
      if (isMajor) {
        const text = document.createElementNS(this.svgNs, 'text')
        text.setAttribute('x', x)
        text.setAttribute('y', 181)
        text.setAttribute('fill', '#fff')
        text.setAttribute('font-size', '12')
        text.setAttribute('font-weight', '700')
        text.setAttribute('text-anchor', 'middle')
        text.textContent = formatYear(year)
        fragment.append(text)
      }
    }
    this.ruler.replaceChildren(fragment)
  }

  updateActiveMarker() {
    this.track.querySelectorAll('.timeline-event').forEach((node, index) => {
      const selected = !this.atTitle && index === this.active
      node.classList.toggle('is-active', selected)
      node.setAttribute('aria-selected', String(selected))
    })
  }

  updateTransform(animated = false) {
    if (!this.data) return
    this.timelineState.centerYear = this.clampCenter(this.timelineState.centerYear)
    this.setMotion(animated)
    const x = this.viewport.clientWidth / 2 - this.worldX(this.timelineState.centerYear)
    const transform = `translate3d(${x}px, 0, 0)`
    this.track.style.transform = transform
    this.ruler.style.transform = transform
  }

  rebuildTimeline(animated = false) {
    this.buildMarkers()
    this.renderRuler()
    this.updateTransform(animated)
  }

  selectEvent(index, recenter = true) {
    if (!this.data) return
    const previousActive = this.active
    this.atTitle = false
    this.active = (index + this.data.events.length) % this.data.events.length
    if (recenter) this.timelineState.centerYear = this.data.events[this.active].year
    this.renderSlide()
    if (this.active !== previousActive) this.animateSlide(this.active > previousActive ? 1 : -1)
    this.updateActiveMarker()
    this.updateTransform(recenter)
  }

  showTitle() {
    if (!this.data) return
    this.atTitle = true
    this.timelineState.zoom = 1
    this.timelineState.centerYear = this.data.events[this.active].year
    this.renderSlide()
    this.rebuildTimeline(true)
  }

  zoomAt(factor, clientX = this.viewport.getBoundingClientRect().left + this.viewport.clientWidth / 2) {
    if (!this.data) return
    const rect = this.viewport.getBoundingClientRect()
    const offset = clientX - rect.left - rect.width / 2
    const pointYear = this.timelineState.centerYear + offset / this.pxPerYear()
    this.timelineState.zoom = Math.max(0.35, Math.min(2.7, this.timelineState.zoom * factor))
    this.timelineState.centerYear = pointYear - offset / this.pxPerYear()
    this.rebuildTimeline(false)
  }

  stopInertia() {
    cancelAnimationFrame(this.timelineState.inertiaFrame)
    this.timelineState.velocity = 0
  }

  destroy() {
    this.stopInertia()
    this.listeners.forEach((off) => off())
    this.listeners = []
    this.root.replaceChildren()
  }
}
