import { CanvasTexture, SRGBColorSpace } from 'three'

function surface(width: number, height: number, ratio = 2) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio)
  const context = canvas.getContext('2d')!
  context.scale(ratio, ratio)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { canvas, context, texture }
}

function textLines(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, limit: number) {
  const lines: string[] = []
  let line = ''
  const tokens = (text.match(/[A-Za-z0-9]+(?:[\s、，,./_-]*[A-Za-z0-9]+)*|./gu) || []).flatMap(token => context.measureText(token).width > width ? Array.from(token) : [token])
  for (const token of tokens) {
    if (context.measureText(line + token).width > width && line && !/^[，。、：；！？）】]/u.test(token)) {
      lines.push(line.trim()); line = token.trimStart()
    } else line += token
  }
  if (line) lines.push(line)
  if (lines.length > limit) {
    let last = lines[limit - 1]
    while (context.measureText(last + '…').width > width) last = last.slice(0, -1)
    lines[limit - 1] = last + '…'
  }
  lines.slice(0, limit).forEach((value, index) => context.fillText(value, x, y + index * lineHeight))
  return Math.min(lines.length, limit)
}

/** The existing local artwork and actual concept text are printed on the hardcover, not overlaid in HTML. */
export function bookPrint(element: HTMLElement, invalidate: () => void) {
  const width = element.offsetWidth, height = element.offsetHeight
  const { context: ctx, texture } = surface(width, height, 3)
  const image = element.querySelector('img')!
  const font = getComputedStyle(element).fontFamily
  const small = width < 150
  function paint() {
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#f1f5f6'; ctx.fillRect(0, 0, width, height)
    if (image.complete && image.naturalWidth) {
      const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      ctx.drawImage(image, (width - image.naturalWidth * ratio) / 2, (height - image.naturalHeight * ratio) / 2, image.naturalWidth * ratio, image.naturalHeight * ratio)
    }
    const wash = ctx.createLinearGradient(0, 0, 0, height * .58)
    wash.addColorStop(0, '#f3f7f8'); wash.addColorStop(.68, '#f3f7f8f5'); wash.addColorStop(1, '#f3f7f800')
    ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height * .58)
    const margin = small ? 15 : 19
    ctx.textBaseline = 'top'
    ctx.font = `400 ${small ? 9 : 10}px ${font}`; ctx.fillStyle = '#456071'
    const carrierY = small ? 16 : 20, carrierLine = small ? 13 : 15
    const carrierLines = textLines(ctx, element.querySelector('.knowledge-book-carrier')!.textContent!, margin, carrierY, width - margin * 1.7, carrierLine, 2)
    ctx.font = `600 ${small ? 14 : 17}px ${font}`; ctx.fillStyle = '#233440'
    textLines(ctx, element.querySelector('.knowledge-book-title')!.textContent!, margin, carrierY + carrierLines * carrierLine + 9, width - margin * 1.7, small ? 20 : 25, 3)
    const footerHeight = small ? 36 : 40
    ctx.fillStyle = '#f4f7f9'; ctx.fillRect(0, height - footerHeight, width, footerHeight)
    ctx.fillStyle = '#61778538'; ctx.fillRect(margin, height - footerHeight, 22, .6)
    ctx.font = `400 ${small ? 9 : 10}px ${font}`; ctx.fillStyle = '#425969'
    textLines(ctx, element.querySelector('.knowledge-book-route')!.textContent!, margin, height - footerHeight + 7, width - margin * 1.7, small ? 12 : 14, 2)
    const origin = element.querySelector('.knowledge-book-origin')?.textContent
    if (origin) {
      ctx.font = `400 9px ${font}`
      ctx.fillStyle = '#f7fafbea'; ctx.fillRect(margin, height - footerHeight - 23, ctx.measureText(origin).width + 10, 16)
      ctx.fillStyle = '#526676'; ctx.fillText(origin, margin + 5, height - footerHeight - 19)
    }
    // A narrow printed hinge sits below the physically modeled spine; artwork keeps its ink colors.
    const hinge = ctx.createLinearGradient(0, 0, 12, 0)
    hinge.addColorStop(0, '#52657338'); hinge.addColorStop(.3, '#ffffff50'); hinge.addColorStop(.6, '#344d6018'); hinge.addColorStop(1, '#ffffff00')
    ctx.fillStyle = hinge; ctx.fillRect(0, 0, 12, height)
    texture.needsUpdate = true; invalidate()
  }
  image.addEventListener('load', paint)
  image.addEventListener('error', paint)
  paint()
  return { texture, dispose: () => { image.removeEventListener('load', paint); image.removeEventListener('error', paint); texture.dispose() } }
}

export function paperEdges() {
  const { context: ctx, texture } = surface(64, 256, 1)
  ctx.fillStyle = '#f4f3ef'; ctx.fillRect(0, 0, 64, 256)
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = y % 9 ? '#dbdedc' : '#c5cece'; ctx.fillRect(0, y, 64, .6)
  }
  return texture
}

/** Fine horizontal brushing and broad silver variations catch the studio reflection. */
export function brushedMetal() {
  const { context: ctx, texture } = surface(1024, 64, 1)
  const silver = ctx.createLinearGradient(0, 0, 1024, 0)
  for (const [offset, color] of [[0, '#909294'], [.012, '#f3f3f3'], [.03, '#a1a2a3'], [.28, '#b6b6b7'], [.54, '#dedede'], [.82, '#a7a7a8'], [.97, '#b9babb'], [.989, '#f5f5f5'], [1, '#929496']] as const) silver.addColorStop(offset, color)
  ctx.fillStyle = silver; ctx.fillRect(0, 0, 1024, 64)
  for (let row = 0; row < 64; row++) {
    ctx.fillStyle = row % 3 ? '#ffffff12' : '#596c8010'; ctx.fillRect(0, row, 1024, .5)
  }
  return texture
}
