import { clamp01 } from "./motion.ts";

export const LEARNING_START = 7.4;
export const LEARNING_SPAN = 10;
export const LEARNING_END = 27.8;
export const NETWORK_START = 27.8;
export const NETWORK_END = 40.4;
export const NETWORK_EXIT = 42.25;
export const CONSULTATION_START = 40.4;
export const CONSULTATION_END = 59.5;

export const spanProgress = (raw: number, start: number, end: number) => clamp01((raw - start) / (end - start));
export const learningProgress = (raw: number) => Math.min(2.04, Math.max(0, (raw - LEARNING_START) / LEARNING_SPAN));
export const rawAtLearning = (p: number) => LEARNING_START + p * LEARNING_SPAN;
export const networkProgress = (raw: number) => spanProgress(raw, NETWORK_START, NETWORK_END);
