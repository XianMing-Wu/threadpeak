import type { CSSProperties, HTMLAttributes, ReactElement } from 'react';
import type { CharacterOptions, CharacterPlayer } from './index.js';
export interface CharacterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError' | 'onReady'> { size?: number | string; follow?: CharacterOptions['follow']; autoplay?: boolean; respectReducedMotion?: boolean; src?: string; wasmUrl?: string; style?: CSSProperties; onReady?: (player: CharacterPlayer) => void; onError?: (error: Error) => void; }
export default function Character(props: CharacterProps): ReactElement;
