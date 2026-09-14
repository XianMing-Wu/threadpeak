import {expect,test} from 'vitest';
import content,{projectScenario} from '../../src/introduction/learning-story-content';
import captured from '../../src/introduction/learning-content.json';
import {consultationAuthors,consultationDraftFor} from '../../src/introduction/consultation-content';
import route from '../../src/introduction/interview-route.json';

test('presentation guides preserve original article and author evidence identities and text',()=>{
 content.articles.forEach((a,i)=>expect({id:a.id,title:a.title,text:a.text,url:a.url}).toEqual({id:captured.articles[i].id,title:captured.articles[i].title,text:captured.articles[i].text,url:captured.articles[i].url}));
 content.authorFollowup.paragraphs.forEach((a,i)=>{
  expect(a.author).toEqual(captured.authorFollowup.paragraphs[i].author);
  expect(a.text).toBe(captured.authorFollowup.paragraphs[i].text);
 });
});

test('every showcased quotation occurs in the associated saved evidence',()=>{
 for(const author of consultationAuthors){
  expect(author.text.replace(/\s/g,''),author.name).toContain(author.quote.replace(/\s/g,''));
  expect(new URL(author.url).hostname).toMatch(/(^|\.)zhihu\.com$/);
 }
});

test('learning cards have one existing parent and consultation uses distinct author evidence',()=>{
 const cards=[...content.answers,...content.followup.paragraphs,...content.authorFollowup.paragraphs];
 const ids=new Set([content.provenance.conceptId,...content.articles.map(a=>a.id),...cards.map(a=>a.id)]);
 for(const card of cards){expect(card.parents).toHaveLength(1);expect(ids.has(card.parents[0]),card.title).toBe(true)}
 expect(new Set(consultationAuthors.map(a=>a.id)).size).toBe(consultationAuthors.length);
 for(let i=0;i<consultationAuthors.length;i++)for(const purpose of ['consult','invite']){
  const draft=consultationDraftFor(i,purpose);
  expect(draft).toContain(consultationAuthors[i].title);
  expect(draft).not.toContain('undefined');
  expect(draft).not.toContain('AI 建议修改');
 }
 expect(content.authorFollowup.question).not.toBe(projectScenario.question);
});

test('each concept has a scope and completion check, and the route retains parallel and merge semantics',()=>{
 for(const concept of route.structure.concepts){
  const card=route.data.cards.find(c=>c.id===concept.cardRef)!;
  expect(card.summary).toContain('学到这里');expect(card.summary).toContain('完成检验');
 }
 expect(route.structure.flowGroups.some(g=>g.type==='split'&&g.policy==='parallel')).toBe(true);
 expect(route.structure.flowGroups.some(g=>g.type==='join'&&g.policy==='all-required')).toBe(true);
});
