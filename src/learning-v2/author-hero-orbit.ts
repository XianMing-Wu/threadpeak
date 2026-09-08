/** A circular X/Z orbit. Only the near arc is visible; the rear arc returns faster. */
export function createAuthorOrbit(deck: HTMLElement) {
  const cards = [...deck.querySelectorAll<HTMLElement>('.au-orbit-card')]
  const perspective = 650, interval = 3600, period = interval * cards.length
  let radius = 900, frontAngle = 0.85, frontDuration = 36000

  function resize(width: number) {
    radius = Math.max(350, width * 1.02)
    const cardWidth = cards[0]?.offsetWidth || 136
    const halfCard = cardWidth * 1.055 / 2
    // Solve the point where the trailing edge has completely left the viewport.
    // Acceleration and the hidden return cannot affect a still-visible card.
    let low = 0, high = Math.acos(radius / (radius + perspective))
    for (let i = 0; i < 30; i++) {
      const angle = (low + high) / 2
      const x = radius * Math.sin(angle), z = radius * (Math.cos(angle) - 1)
      const edges = [-1, 1].map(sign => (x + sign * halfCard * Math.cos(angle)) * perspective / (perspective - z + sign * halfCard * Math.sin(angle)))
      if (Math.min(...edges) < width / 2 + 12) low = angle
      else high = angle
    }
    frontAngle = high
    const angularSpeed = cardWidth * 1.105 / radius / interval
    frontDuration = 2 * frontAngle / angularSpeed
  }

  function draw(elapsed: number) {
    const rearDuration = period - frontDuration
    cards.forEach((card, index) => {
      // Equal time offsets give a steady stream on the visible arc even though
      // the same cards move faster along the hidden return arc.
      const phase = (elapsed + frontDuration / 2 + index * interval) % period
      const inFront = phase <= frontDuration
      const angle = inFront
        ? -frontAngle + phase / frontDuration * 2 * frontAngle
        : frontAngle + (phase - frontDuration) / rearDuration * (Math.PI * 2 - frontAngle * 2)
      const x = radius * Math.sin(angle), z = radius * (Math.cos(angle) - 1)
      // The card's horizontal axis follows the circle's tangent. Its projected
      // width and spacing therefore compress together, without large edge gaps.
      // Perspective supplies the size change; extra scaling would break spacing.
      card.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${angle}rad)`
      card.style.opacity = inFront ? '1' : '0'
      card.style.zIndex = String(Math.round(z))
    })
  }
  return { resize, draw }
}
