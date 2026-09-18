import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import * as THREE from 'three';
import katex from 'katex';
import * as Remotion from 'remotion';
import * as RemotionPlayer from '@remotion/player';

const global = window as unknown as Window & Record<string, unknown>;
const assign = (name: string, value: object) => {
  try {
    Object.assign(value, { default: value });
  } catch {
    /* Some library namespaces are frozen; the IIFE global still resolves. */
  }
  global[name] = value;
};

assign('React', React);
assign('ReactDOM', ReactDOM);
assign('jsxRuntime', jsxRuntime);
assign('THREE', THREE);
assign('katex', Object.assign(Object(katex), { default: katex }));
assign('Remotion', Remotion);
assign('RemotionPlayer', RemotionPlayer);
