"use client";
import poster from "../../../assets/images/characters/teacher.webp?url";
import { createCharacterView } from "../CharacterView.jsx";
import { character,mountCharacter } from "./index.js";
export default createCharacterView(mountCharacter, character, poster);
