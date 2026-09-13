import { loadRiveRuntime, loadRiveBytes } from '../../rive-loader.js';
import { character } from './config.js';
export { character };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Mount into a DOM container. Call destroy() when the host is unmounted. */
export function mountCharacter(target, options = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(host instanceof HTMLElement)) throw new TypeError('mountCharacter requires a DOM container.');
  const follow = options.follow ?? 'page';
  if (!['page', 'canvas', 'none'].includes(follow)) throw new TypeError('follow must be page, canvas or none.');
  const fit = options.fit ?? 'contain';
  if (!['contain', 'cover'].includes(fit)) throw new TypeError('fit must be contain or cover.');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;aspect-ratio:1;overflow:hidden;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label ?? character.label);
  wrapper.append(canvas);
  host.append(wrapper);
  const abort = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let destroyed = false, playing = options.autoplay !== false, visible = true;
  let runtime, file, artboard, machine, renderer, frameId = 0, lastTime = 0;
  let pointer = { x: 500, y: 500 }, clientPoint = null, pointerDirty = true;
  let viewportWidth = 0, viewportHeight = 0, lastDpr = 0;
  const reduced = () => options.respectReducedMotion !== false && motion.matches;
  const canAnimate = () => playing && visible && !document.hidden && !reduced();
  const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

  function resize() {
    if (destroyed) return;
    // Allocate for the final layout size, independent of an ancestor's entrance
    // transform. A transformed bounding rect would bake a small bitmap and then
    // stretch it as the character grows. Supersample on 1x preview displays too.
    viewportWidth = wrapper.clientWidth; viewportHeight = wrapper.clientHeight;
    const dpr = clamp(window.devicePixelRatio || 1, 2, 3);
    const width = Math.max(1, Math.round(viewportWidth * dpr));
    const height = Math.max(1, Math.round(viewportHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
    lastDpr = dpr;
    if (clientPoint) pointFromClient(clientPoint.x, clientPoint.y);
    schedule();
  }
  function pointFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = (fit === 'cover' ? Math.max : Math.min)(rect.width / 1000, rect.height / 1000);
    pointer = {
      x: clamp((clientX - rect.left - (rect.width - scale * 1000) / 2) / scale, -5000, 6000),
      y: clamp((clientY - rect.top - (rect.height - scale * 1000) / 2) / scale, -5000, 6000),
    };
    pointerDirty = true;
  }
  function onPointer(event) {
    if (destroyed || reduced() || !playing) return;
    clientPoint = { x: event.clientX, y: event.clientY };
    pointFromClient(event.clientX, event.clientY);
    schedule();
  }
  function center() {
    clientPoint = null; pointer = { x: 500, y: 500 }; pointerDirty = true; schedule();
  }
  function schedule() {
    if (!destroyed && runtime && renderer && !frameId) frameId = runtime.requestAnimationFrame(draw);
  }
  function draw(time) {
    try {
    frameId = 0;
    if (destroyed) return;
    if (lastDpr !== clamp(window.devicePixelRatio || 1, 2, 3)) resize();
    if (pointerDirty) {
      machine.pointerMove(pointer.x, pointer.y, 0);
      pointerDirty = false;
    }
    const elapsed = lastTime && canAnimate() ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = canAnimate() ? time : 0;
    machine.advance(elapsed);
    artboard.advance(elapsed);
    if (viewportWidth && viewportHeight) {
      renderer.clear(); renderer.save();
      renderer.align(fit === 'cover' ? runtime.Fit.cover : runtime.Fit.contain, runtime.Alignment.center,
        { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height }, bounds);
      artboard.draw(renderer); renderer.restore(); renderer.flush();
    }
    if (canAnimate()) schedule();
    } catch (error) {
      if (!destroyed) { destroy(); options.onError?.(error); }
    }
  }
  function visibilityChanged() { lastTime = 0; if (!document.hidden) resize(); }
  function motionChanged() { lastTime = 0; if (reduced()) center(); schedule(); }
  function scrolled() {
    if (clientPoint && !reduced()) { pointFromClient(clientPoint.x, clientPoint.y); schedule(); }
  }
  const eventTarget = follow === 'page' ? window : canvas;
  if (follow !== 'none') eventTarget.addEventListener('pointermove', onPointer, { passive: true });
  if (follow === 'canvas') canvas.addEventListener('pointerleave', center);
  window.addEventListener('blur', center);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', scrolled, { passive: true, capture: true });
  document.addEventListener('visibilitychange', visibilityChanged);
  motion.addEventListener('change', motionChanged);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(wrapper);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true; lastTime = 0; if (visible) schedule();
  });
  intersectionObserver.observe(wrapper);

  function release() {
    if (runtime && frameId) runtime.cancelAnimationFrame(frameId);
    frameId = 0;
    machine?.delete(); machine = undefined;
    artboard?.delete(); artboard = undefined;
    file?.unref(); file = undefined;
    renderer?.delete(); renderer = undefined;
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; abort.abort(); release();
    resizeObserver.disconnect(); intersectionObserver.disconnect();
    eventTarget.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('pointerleave', center);
    window.removeEventListener('blur', center);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', scrolled, true);
    document.removeEventListener('visibilitychange', visibilityChanged);
    motion.removeEventListener('change', motionChanged);
    wrapper.remove();
  }
  const api = {
    canvas, character,
    play() { if (!destroyed) { playing = true; lastTime = 0; schedule(); } },
    pause() { playing = false; lastTime = 0; },
    /** Normalized coordinates: -1 = left/up, +1 = right/down. */
    lookAt(x, y) {
      if (destroyed) return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('lookAt requires finite numbers.');
      clientPoint = null;
      pointer = { x: 500 + clamp(x, -1, 1) * 500, y: 500 + clamp(y, -1, 1) * 500 };
      pointerDirty = true; schedule();
    },
    resize, destroy,
    get status() { return destroyed ? 'destroyed' : machine ? 'ready' : 'loading'; },
    get diagnostics() {
      return { character: character.id, artboard: artboard?.name, artboardCount: file?.artboardCount(),
        stateMachine: machine ? character.stateMachine : undefined, pointer: { ...pointer }, playing, reducedMotion: reduced(),
        canvasWidth: canvas.width, canvasHeight: canvas.height };
    },
  };
  api.ready = (async () => {
    try {
      const [rt, bytes] = await Promise.all([
        loadRiveRuntime(options.wasmUrl),
        loadRiveBytes(options.src ?? new URL('./character.riv', import.meta.url), abort.signal),
      ]);
      if (destroyed) throw new DOMException('Character unmounted', 'AbortError');
      runtime = rt;
      const loaded = await runtime.load(bytes, undefined, false);
      if (destroyed) { loaded?.unref(); throw new DOMException('Character unmounted', 'AbortError'); }
      file = loaded;
      if (!file) throw new Error('Unable to decode character.riv.');
      if (file.artboardCount() !== 1) throw new Error('Expected a single-character Rive file.');
      artboard = file.artboardByName(character.artboard);
      if (!artboard) throw new Error(`Missing artboard: ${character.artboard}`);
      const definition = artboard.stateMachineByName(character.stateMachine);
      if (!definition) throw new Error(`Missing state machine: ${character.stateMachine}`);
      machine = new runtime.StateMachineInstance(definition, artboard);
      renderer = runtime.makeRenderer(canvas);
      if (!renderer) throw new Error('Character renderer unavailable.');
      artboard.advance(0); resize();
      if (frameId) { runtime.cancelAnimationFrame(frameId); frameId = 0; }
      draw(0);
      if (destroyed) throw new Error('Character first frame failed.');
      options.onReady?.(api);
      return api;
    } catch (error) {
      if (!destroyed) { destroy(); options.onError?.(error); }
      throw error;
    }
  })();
  // Ready remains awaitable, without an unhandled rejection after a rapid UI unmount.
  api.ready.catch(() => {});
  return api;
}

/** Optional native Custom Element adapter, suitable for HTML, Vue and other frameworks. */
export function defineCharacterElement(tagName = character.tagName) {
  if (customElements.get(tagName)) return;
  customElements.define(tagName, class extends HTMLElement {
    connectedCallback() {
      if (this.player) return;
      if (!this.style.display) this.style.display = 'block';
      this.player = mountCharacter(this, {
        follow: this.getAttribute('follow') ?? 'page',
        onReady: player => this.dispatchEvent(new CustomEvent('character-ready', { detail: player })),
        onError: error => this.dispatchEvent(new CustomEvent('character-error', { detail: error })),
      });
    }
    disconnectedCallback() { this.player?.destroy(); this.player = undefined; }
  });
}
