"use client";
import { mountCharacter, character } from './index.js';
import { createCharacterView } from '../CharacterView.jsx';
import poster from '../posters/developer.webp?url';
export default createCharacterView(mountCharacter, character, poster);
