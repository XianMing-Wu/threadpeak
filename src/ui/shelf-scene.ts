import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { ShelfReflections } from './shelf-reflections'
import { bookPrint, brushedMetal, paperEdges } from './shelf-textures'
import { shelfDepth, shelfPlatform } from './shelf-platform'

type Status = 'three' | 'unavailable'
type BookModel = { element: HTMLElement; group: THREE.Group; x: number; baseY: number; amount: number }
type RowModel = { viewport: HTMLElement; books: BookModel[];group:THREE.Group;floor:number }

/** Architectural orthographic view, looking slightly down into a open metal shelving unit.
 * Layout is measured from native controls. One pixel at the front plane is one scene unit;
 * metal shelves and hardcover books therefore share depth, lighting and occlusion.
 */
export function mountShelfScene(cabinet: HTMLElement, canvas: HTMLCanvasElement, studio: ShelfReflections, status: (status: Status) => void) {
  const root = cabinet.closest<HTMLElement>('.knowledge-library')!
  let renderer: THREE.WebGLRenderer
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }) }
  catch { status('unavailable'); return () => {} }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  renderer.localClippingEnabled = true
  renderer.setClearColor(0xffffff, 0)
  const scene = new THREE.Scene()
  const reflections = new THREE.DataTexture(studio.pixels, studio.width, studio.height, THREE.RGBAFormat, THREE.HalfFloatType)
  reflections.mapping = THREE.CubeUVReflectionMapping
  reflections.minFilter = THREE.LinearFilter; reflections.magFilter = THREE.LinearFilter
  reflections.colorSpace = THREE.LinearSRGBColorSpace
  reflections.needsUpdate = true
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000)
  const angle = THREE.MathUtils.degToRad(9), cos = Math.cos(angle), sin = Math.sin(angle)
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xc3c6cb, 2.8)
  const fill = new THREE.AmbientLight(0xffffff, 1.0)
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.normalBias = .6; key.shadow.bias = -.00015
  key.shadow.radius = 12; key.shadow.blurSamples = 16
  key.shadow.camera.near = 1; key.shadow.camera.far = 4000
  scene.add(hemisphere, fill, key, key.target)
  const model = new THREE.Group(); model.name = 'open-knowledge-shelves'; scene.add(model)
  let rows: RowModel[] = [], frame = 0, disposed = false, contextLost = false, needsLayout = true, ready = false
  const geometryCache=new Map<string,THREE.BufferGeometry>(),usedGeometry=new Set<string>()
  const prints=new Map<HTMLElement,{key:string;print:ReturnType<typeof bookPrint>}>()
  const metalTexture=brushedMetal(),pageTexture=paperEdges()
  let printBuilds=0,layoutPasses=0,fontRevision=0
  function geometry(key:string,create:()=>THREE.BufferGeometry){usedGeometry.add(key);let value=geometryCache.get(key);if(!value){value=create();geometryCache.set(key,value)}return value}
  let width = 0, height = 0, viewHeight = 0, previousTime = 0
  let active: HTMLElement | null = null
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const material = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .03, ...extra })
  const box = (parent: THREE.Object3D, name: string, size: [number, number, number], position: [number, number, number], paint: THREE.Material, radius = 1) => {
    const shape = geometry(`box:${size.join(',')}:${radius}`,()=>new RoundedBoxGeometry(...size, 2, Math.min(radius, Math.min(...size) / 3)))
    const mesh = new THREE.Mesh(shape, paint); mesh.name = name; mesh.position.set(...position)
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh)
    return mesh
  }
  function releaseModel() {
    const sharedGeometry=new Set(geometryCache.values()),sharedTextures=new Set<THREE.Texture>([reflections,metalTexture,pageTexture,...[...prints.values()].map(p=>p.print.texture)])
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      geometries.add(object.geometry)
      for (const paint of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(paint)
        for (const value of Object.values(paint)) if (value instanceof THREE.Texture && !sharedTextures.has(value)) textures.add(value)
      }
    })
    geometries.forEach(value => {if(!sharedGeometry.has(value))value.dispose()}); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose())
    model.clear(); rows = []
  }
  function invalidate() { if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(render) }
  function layout() {
    releaseModel()
    usedGeometry.clear();const usedPrints=new Set<HTMLElement>();layoutPasses++
    const bounds = cabinet.getBoundingClientRect(), dark = document.documentElement.dataset.theme === 'dark'
    width = bounds.width; height = bounds.height; viewHeight = Math.min(root.clientHeight, height)
    renderer.setSize(width, viewHeight, false); canvas.style.height = `${viewHeight}px`
    const side = parseFloat(getComputedStyle(cabinet).paddingLeft)
    const depth = shelfDepth(width)
    const metal = new THREE.MeshPhysicalMaterial({ color: dark ? '#b6b7b9' : '#eeeeee', map: metalTexture, metalness: .85, roughness: .22, anisotropy: .7, envMap: reflections, envMapIntensity: 1.6 })
    const top = material(dark ? '#8e9296' : '#c4c6c8', { roughness: .64, metalness: .32, envMap: reflections, envMapIntensity: .9 })
    const edge = material('#ececec', { roughness: .18, metalness: .9, envMap: reflections, envMapIntensity: 1.5 })
    // Transparent shadow catcher: there is no visible cabinet back, side or frame.
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height / cos), new THREE.ShadowMaterial({ color: dark ? '#05090d' : '#3c4248', opacity: dark ? .24 : .18 }))
    wall.position.set(0, -height / cos / 2, -depth - 12); wall.receiveShadow = true; model.add(wall)
    const opening = cabinet.querySelector('.knowledge-shelf-viewport')!.getBoundingClientRect()
    const leftLimit = opening.left - bounds.left - width / 2, rightLimit = opening.right - bounds.left - width / 2
    const clips = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -leftLimit), new THREE.Plane(new THREE.Vector3(-1, 0, 0), rightLimit)]
    const pages = material('#ffffff', { map: pageTexture, roughness: 1, clippingPlanes: clips, clipShadows: true })
    const binding = material('#b3c1c9', { roughness: .78, clippingPlanes: clips, clipShadows: true })
    rows = Array.from(cabinet.querySelectorAll<HTMLElement>('.knowledge-shelf')).map((element, rowIndex) => {
      const viewport = element.querySelector<HTMLElement>('.knowledge-shelf-viewport')!
      const plank = element.querySelector<HTMLElement>('.knowledge-shelf-plank')!, beamRect = plank.getBoundingClientRect()
      const floor = -(beamRect.top - bounds.top) / cos, beamHeight = beamRect.height / cos
      const row = new THREE.Group(); row.name = `route:${element.dataset.shelfId}`; model.add(row)
      const platform = new THREE.Mesh(geometry(`shelf:${width-side*2}:${beamHeight}:${depth}`,()=>shelfPlatform(width - side * 2, beamHeight, depth)), [top, metal])
      platform.name = 'metal-shelf'; platform.position.y = floor; platform.castShadow = true; platform.receiveShadow = true; row.add(platform)
      box(row, 'polished-front-edge', [width - side * 2 - 1, 1.2, 1], [0, floor - .7, .35], edge, .25)
      const books = Array.from(element.querySelectorAll<HTMLElement>('.knowledge-book')).map((button, bookIndex) => {
        const slot = button.parentElement!, rect = slot.getBoundingClientRect(), bookWidth = rect.width, bookHeight = rect.height / cos
        usedPrints.add(button)
        const key=JSON.stringify([fontRevision,button.offsetWidth,button.offsetHeight,getComputedStyle(button).fontFamily,button.textContent,button.querySelector('img')?.currentSrc||button.querySelector('img')?.src])
        let cached=prints.get(button)
        if(cached?.key!==key){cached?.print.dispose();cached={key,print:bookPrint(button,invalidate)};prints.set(button,cached);printBuilds++}
        const print=cached.print
        print.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
        const group = new THREE.Group(); group.name = `concept:${button.dataset.bookId}`
        const x = rect.left - bounds.left + rect.width / 2 - width / 2 + viewport.scrollLeft
        group.position.set(x - viewport.scrollLeft, floor + bookHeight / 2 + 1.5, -depth * .26)
        group.rotation.y = THREE.MathUtils.degToRad(-9 - (bookIndex % 3) * 1.3)
        row.add(group)
        const thickness = 13 + bookIndex % 3 * 2
        box(group, 'paper-block', [bookWidth - 4, bookHeight - 5, thickness], [1, 0, -thickness / 2 - 1.5], pages, 1)
        box(group, 'back-hardcover', [bookWidth, bookHeight, 1.6], [0, 0, -thickness - 3], binding, .5)
        box(group, 'front-hardcover', [bookWidth, bookHeight, 1.8], [0, 0, 0], binding, .5)
        box(group, 'cloth-spine', [4, bookHeight, thickness + 3], [-bookWidth / 2 + 1.3, 0, -thickness / 2 - 1], binding, 1.3)
        // Printed sRGB artwork already contains its own lighting. Studio light and tone mapping
        // belong to the modeled book edges and metal, otherwise the print becomes overexposed.
        const ink = new THREE.MeshBasicMaterial({ map: print.texture, toneMapped: false, clippingPlanes: clips, clipShadows: true })
        const face = new THREE.Mesh(geometry(`cover:${bookWidth}:${bookHeight}`,()=>new THREE.PlaneGeometry(bookWidth - 1, bookHeight - 1)), ink)
        face.name = 'printed-cover'; face.position.z = 1; face.castShadow = true; group.add(face)
        return { element: button, group, x, baseY: group.position.y, amount: 0 }
      })
      row.userData.index = rowIndex
      return { viewport, books,group:row,floor }
    })
    let bookCount = 0, shelfCount = 0
    model.traverse(object => {
      if (object.name.startsWith('concept:')) bookCount++
      if (object.name === 'metal-shelf') shelfCount++
    })
    canvas.dataset.models = String(bookCount)
    canvas.dataset.shelves = String(shelfCount)
    for(const [element,cached] of prints)if(!usedPrints.has(element)){cached.print.dispose();prints.delete(element)}
    for(const [key,shape] of geometryCache)if(!usedGeometry.has(key)){shape.dispose();geometryCache.delete(key)}
    canvas.dataset.geometries=String(geometryCache.size);canvas.dataset.printBuilds=String(printBuilds);canvas.dataset.layoutPasses=String(layoutPasses)
    if (!bookCount) { pages.dispose(); binding.dispose() }
    needsLayout = false
  }
  function render(time: number) {
    frame = 0
    if (disposed || contextLost || document.hidden || cabinet.hidden || !cabinet.offsetWidth) return
    if (needsLayout) layout()
    const bounds = cabinet.getBoundingClientRect(), view = canvas.getBoundingClientRect()
    const centerY = -(view.top - bounds.top + viewHeight / 2) / cos
    camera.left = -width / 2; camera.right = width / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2
    camera.position.set(0, centerY + 2000 * sin, 2000 * cos); camera.lookAt(0, centerY, 0); camera.updateProjectionMatrix()
    key.position.set(-width * .18, centerY + 350, 1500); key.target.position.set(0, centerY, -60)
    const shadowSize = Math.max(width, viewHeight) * .78
    Object.assign(key.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize }); key.shadow.camera.updateProjectionMatrix()
    const delta = Math.min(.05, (time - previousTime) / 1000 || .016); previousTime = time
    let moving = false
    for (const row of rows) {
      row.group.visible=row.floor>centerY-viewHeight/2-500&&row.floor<centerY+viewHeight/2+200
      if(!row.group.visible)continue
      for (const book of row.books) {
        const target = !reduced.matches && active === book.element && !row.viewport.classList.contains('is-dragging') ? 1 : 0
        book.amount += (target - book.amount) * Math.min(1, delta * 14)
        if (Math.abs(target - book.amount) < .002) book.amount = target; else moving = true
        book.group.position.x = book.x - row.viewport.scrollLeft
        book.group.position.z = -shelfDepth(width) * .26 + book.amount * 12
        book.group.position.y = book.baseY + book.amount * 3
        const within = book.group.position.x > -width / 2 - 120 && book.group.position.x < width / 2 + 120
        book.group.visible = within
      }
    }
    renderer.render(scene, camera)
    if (!ready) { ready = true; status('three') }
    if (moving) invalidate()
  }
  function resize() { needsLayout = true; invalidate() }
  function interaction(event: Event) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.knowledge-book') : null
    if (event.type === 'pointerout' || event.type === 'focusout') active = null
    else if (target) active = target
    invalidate()
  }
  function lost(event: Event) { event.preventDefault(); contextLost = true; ready = false; status('unavailable'); cancelAnimationFrame(frame); frame = 0 }
  function restored() {
    // Source-backed studio and cover textures are uploaded again by Three.js on restoration.
    contextLost = false; resize()
  }
  const observer = new ResizeObserver(resize); observer.observe(cabinet); observer.observe(root)
  const themeObserver = new MutationObserver(resize); themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const contentObserver = new MutationObserver(resize); contentObserver.observe(cabinet, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] })
  root.addEventListener('scroll', invalidate, { passive: true, capture: true })
  for (const event of ['pointerover', 'pointerout', 'focusin', 'focusout']) cabinet.addEventListener(event, interaction)
  document.addEventListener('visibilitychange', invalidate)
  reduced.addEventListener('change', invalidate)
  canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored)
  void document.fonts.ready.then(() => { if (!disposed) {fontRevision++;resize()} })
  invalidate()
  return () => {
    disposed = true; cancelAnimationFrame(frame)
    observer.disconnect(); themeObserver.disconnect(); contentObserver.disconnect()
    root.removeEventListener('scroll', invalidate, true)
    for (const event of ['pointerover', 'pointerout', 'focusin', 'focusout']) cabinet.removeEventListener(event, interaction)
    document.removeEventListener('visibilitychange', invalidate); reduced.removeEventListener('change', invalidate)
    canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored)
    releaseModel();prints.forEach(value=>value.print.dispose());prints.clear();geometryCache.forEach(value=>value.dispose());geometryCache.clear();metalTexture.dispose();pageTexture.dispose();reflections.dispose(); key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss()
  }
}
