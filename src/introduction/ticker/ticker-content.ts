import cardsJson from './cards.json';
import type {ArticleCardData} from './types';

const cards=cardsJson as ArticleCardData[];

// Shared content and pacing; the website and video use separate animation clocks.
export const tickerColumns=[[0,2,4],[1,3,5,9],[6,7,8]].map((ids,i)=>({
 cards:ids.map(id=>cards[id]),
 durationInSeconds:30,
 direction:(i===1?1:-1) as -1|1,
 phase:[.02,.04,.32][i],
}));
