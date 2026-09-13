import type {ReactElement} from 'react';
import type {mountCharacter} from './01-工程师-安全帽/index.js';
import type {CharacterProps} from './01-工程师-安全帽/Character.jsx';
export function createCharacterView(mount: typeof mountCharacter, character: {id: string; label: string}, poster: string): (props: CharacterProps) => ReactElement;
