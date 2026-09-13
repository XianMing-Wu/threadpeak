import {part} from './learning-motion';
export const FINALE_START=58.75,FINALE_END=63.30;
export function finaleAt(raw:number){return{enter:part(raw,58.75,59.95),search:part(raw,58.95,60.10),paper:part(raw,58.85,59.95),favorites:part(raw,59.15,60.25),goal:part(raw,59.35,60.45),heading:part(raw,59.80,60.70),action:part(raw,60.40,61.20)};}
