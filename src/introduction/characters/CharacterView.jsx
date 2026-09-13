import { createElement, useEffect, useRef, useState } from 'react';

/** A real neutral frame stays visible while the optional live renderer starts. */
export function createCharacterView(mountCharacter, character, poster) {
  return function Character({ size = 320, follow = 'page', autoplay = true,
    respectReducedMotion = true, src, wasmUrl, className, style, onReady, onError, ...props }) {
    const host = useRef(null);
    const callbacks = useRef({ onReady, onError });
    callbacks.current = { onReady, onError };
    const [status, setStatus] = useState('loading');
    useEffect(() => {
      let disposed = false, player, timer, attempts = 0, phase = 'loading';
      const start = () => {
        if (disposed) return;
        clearTimeout(timer);
        player?.destroy();
        attempts += 1; phase = 'loading'; setStatus(phase);
        player = mountCharacter(host.current, { follow, autoplay, respectReducedMotion, src, wasmUrl,
          onReady: value => {
            if (disposed) return;
            phase = 'ready'; setStatus(phase); callbacks.current.onReady?.(value);
          },
          onError: error => {
            if (disposed) return;
            phase = 'fallback'; setStatus(phase); callbacks.current.onError?.(error);
            // One bounded automatic recovery, never a per-frame retry loop.
            if (attempts < 2 && navigator.onLine !== false) timer = setTimeout(start, 1000);
          },
        });
      };
      const online = () => { if (phase === 'fallback' && attempts < 2) start(); };
      window.addEventListener('online', online);
      start();
      return () => { disposed = true; clearTimeout(timer); window.removeEventListener('online', online); player?.destroy(); };
    }, [follow, autoplay, respectReducedMotion, src, wasmUrl]);
    return createElement('div', { ...props, className, 'data-character-state': status,
      style: { width: size, height: size, position: 'relative', ...style } },
      createElement('img', { src: poster, alt: `${character.label}（静态展示）`, draggable: false,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: status === 'ready' ? 'none' : 'block' } }),
      createElement('div', { ref: host, 'aria-hidden': status !== 'ready',
        style: { width: '100%', height: '100%', opacity: status === 'ready' ? 1 : 0 } }));
  };
}
