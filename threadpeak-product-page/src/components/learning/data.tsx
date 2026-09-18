import { createContext,useContext } from 'react';
import type { Article } from "./model.ts";
export const LearningData = createContext<{
    articles: Article[];
    concept: string;
    example?: boolean;
}>({ articles: [], concept: '' });
export const useLearningData = () => useContext(LearningData);
