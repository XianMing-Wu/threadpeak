import sourceUrl from "../../../assets/rive/06-researcher.riv?url";
import { createCharacterMount } from "../mount-character.js";
import { character } from "./config.js";
export { character };
export const mountCharacter = createCharacterMount(character, sourceUrl);
