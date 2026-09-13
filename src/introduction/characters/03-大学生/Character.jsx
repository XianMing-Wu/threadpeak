"use client";
import { createElement, useEffect, useRef, useState } from 'react';
import { mountCharacter, character } from './index.js';

export default function Character({ size = 320, follow = 'page', autoplay = true,
  respectReducedMotion = true, src, wasmUrl, className, style, onReady, onError, ...props }) {
  const host = useRef(null);
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const [error, setError] = useState(null);
  useEffect(() => {
    setError(null);
    const player = mountCharacter(host.current, { follow, autoplay, respectReducedMotion, src, wasmUrl,
      onReady: value => callbacks.current.onReady?.(value),
      onError: value => { setError(value.message); callbacks.current.onError?.(value); },
    });
    return () => player.destroy();
  }, [follow, autoplay, respectReducedMotion, src, wasmUrl]);
  return createElement('div', { ...props, className, style: { width: size, height: size, ...style } },
    createElement('div', { ref: host, style: { width: '100%', height: '100%' } }),
    error && createElement('span', { role: 'alert' }, `${character.label}加载失败：${error}`));
}
