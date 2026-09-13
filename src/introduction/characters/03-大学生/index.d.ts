export interface CharacterOptions { follow?: 'page' | 'canvas' | 'none'; fit?: 'contain' | 'cover'; autoplay?: boolean; respectReducedMotion?: boolean; src?: string | URL; wasmUrl?: string; label?: string; onReady?: (player: CharacterPlayer) => void; onError?: (error: Error) => void; }
export interface CharacterPlayer { canvas: HTMLCanvasElement; ready: Promise<CharacterPlayer>; readonly status: 'loading' | 'ready' | 'destroyed'; readonly diagnostics: Record<string, unknown>; play(): void; pause(): void; lookAt(x: number, y: number): void; resize(): void; destroy(): void; }
export const character: Readonly<{ id: string; label: string; artboard: string; stateMachine: string; tagName: string; status: string; sourceProject: string }>;
export function mountCharacter(target: HTMLElement | string, options?: CharacterOptions): CharacterPlayer;
export function defineCharacterElement(tagName?: string): void;
