import React from 'react';
import {Img,staticFile} from 'remotion';
import type {ArticleCardData} from './types';

export const ARTICLE_WIDTH=1080;
export const ARTICLE_HEIGHT=2285;
const ink='#262728',blue='#0084e9',muted='#999da3';
function Icon({name,size=64,color=ink}:{name:string;size?:number;color?:string}){
 const paths:Record<string,React.ReactNode>={
  back:<path d="M39 10 17 32l22 22"/>,search:<><circle cx="28" cy="28" r="21"/><path d="m44 44 13 13"/></>,
  plus:<path d="M32 14v36M14 32h36"/>,share:<path d="M7 49c3-22 17-26 30-26V10l22 22-22 21V39C23 37 14 40 7 49Z"/>,
  headphones:<><path d="M11 42V30a21 21 0 0 1 42 0v12"/><rect x="8" y="33" width="10" height="20" rx="4" fill="currentColor"/><rect x="46" y="33" width="10" height="20" rx="4" fill="currentColor"/></>,
  book:<><path d="M16 9h30v47L31 48 16 56Z" fill="currentColor" stroke="none"/><path d="M23 22h16M23 30h16" stroke="white" strokeWidth="3"/></>,
  chevron:<path d="m25 18 14 14-14 14"/>,down:<path d="m16 25 16 14 16-14"/>,
  up:<path d="m31 10 25 44H7Z"/>,voteDown:<path d="m31 55 25-44H7Z"/>,
  star:<path d="m32 5 8 18 20 2-15 14 4 20-17-10-18 10 4-20L3 25l21-2Z"/>,
  comment:<path d="M52 47C44 60 16 57 9 43 0 23 16 7 33 9c20 1 30 19 22 35l3 12-12-4"/>,
  more:<>{[14,32,50].map(y=><circle key={y} cx="32" cy={y} r="4.8" fill="currentColor" stroke="none"/>)}</>,
 };
 return <svg viewBox="0 0 64 64" width={size} height={size} style={{display:'block',flexShrink:0,color}} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
const count=(n:number)=>n>=10000?`${(n/10000).toFixed(1)}万`:n.toLocaleString('en-US');
export function ArticleCard({data,width=1080,assetSource=staticFile,nativeImages=false}:{data:ArticleCardData;width?:number;assetSource?:(path:string)=>string;nativeImages?:boolean}){
 const scale=width/ARTICLE_WIDTH;
 const Image=nativeImages?'img':Img;
 return <article data-article-id={data.id} style={{position:'relative',width,height:ARTICLE_HEIGHT*scale,flexShrink:0,background:'white',borderRadius:16*scale,overflow:'hidden',boxShadow:'0 5px 22px #10213b0d',fontFamily:'CardSans,"PingFang SC",sans-serif',color:ink}}>
  <div style={{position:'absolute',width:ARTICLE_WIDTH,height:ARTICLE_HEIGHT,transform:`scale(${scale})`,transformOrigin:'top left',background:'#fff'}}>
   <div style={{position:'absolute',left:46,top:35}}><Icon name="back" size={76}/></div>
   <div style={{position:'absolute',right:45,top:35}}><Icon name="search" size={68}/></div>
   <h1 data-title style={{position:'absolute',left:48,right:48,top:171,margin:0,fontSize:52,fontWeight:650,lineHeight:1.22,letterSpacing:-1.1}}>{data.title}</h1>
   <Image alt={data.author} src={assetSource(data.avatar)} style={{position:'absolute',left:48,top:294,width:108,height:108,borderRadius:'50%',objectFit:'cover'}}/>
   <div style={{position:'absolute',left:185,top:290,maxWidth:503,display:'flex',alignItems:'center',gap:14,height:65}}>
    <span style={{fontSize:data.author.length>10?39:46,fontWeight:520,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{data.author}</span>
    {data.badge&&<Image alt="" src={assetSource(data.badge)} style={{width:52,height:52,objectFit:'contain',flexShrink:0}}/>}
   </div>
   <div style={{position:'absolute',left:185,top:360,width:500,fontSize:37,lineHeight:1.3,color:muted,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{data.badgeText||'知乎回答 · 学习经验分享'}</div>
   <div style={{position:'absolute',left:713,top:303,width:219,height:88,borderRadius:48,background:'#eaf4ff',display:'flex',alignItems:'center',justifyContent:'center',gap:11,color:blue,fontSize:42,fontWeight:550}}><Icon name="plus" size={45} color={blue}/>关注</div>
   <div style={{position:'absolute',right:46,top:318}}><Icon name="share" size={70}/></div>
   <div style={{position:'absolute',left:48,top:440,fontSize:36,color:muted,display:'flex',alignItems:'center',gap:5}}>{count(data.votes)} 人赞同 · 要点整理<Icon name="chevron" size={35} color={muted}/></div>
   <div style={{position:'absolute',right:48,top:440,display:'flex',gap:10,alignItems:'center',color:blue,fontSize:39}}><Icon name="headphones" size={42} color={blue}/>听内容</div>
   <div style={{position:'absolute',left:48,top:515,width:824,height:88,borderRadius:50,background:'#edf5ff',display:'flex',gap:14,alignItems:'center',padding:'0 28px',color:blue,fontSize:40}}><Icon name="book" size={44} color={blue}/>学习话题 · {data.topic}<span style={{marginLeft:'auto'}}><Icon name="chevron" size={35} color={blue}/></span></div>
   <h2 style={{position:'absolute',left:49,top:635,margin:0,fontSize:54,fontWeight:550}}>目录</h2>
   <div style={{position:'absolute',left:96,top:747,fontSize:37,lineHeight:'67px'}}>{data.toc.map((item,i)=><div key={item} style={{display:'flex',alignItems:'center',gap:13,opacity:i===2?.38:1}}>{item}<span style={{width:0,height:0,borderTop:'8px solid transparent',borderBottom:'8px solid transparent',borderLeft:'13px solid #bec2c7'}}/></div>)}</div>
   <div style={{position:'absolute',top:960,left:0,right:0,display:'flex',justifyContent:'center',alignItems:'center',gap:10,fontSize:43,color:'#919ba7'}}>展开目录<Icon name="down" size={35} color="#919ba7"/></div>
   <div data-body style={{position:'absolute',left:48,right:48,top:1105,bottom:166,overflow:'hidden'}}>
    {data.sections.map((section,i)=><section key={section.heading} style={{marginBottom:98}}>
     <h2 style={{fontSize:56,lineHeight:1.35,fontWeight:650,margin:`${i===0?0:10}px 0 50px`}}>{section.heading}</h2>
     <p style={{fontSize:48,lineHeight:1.52,letterSpacing:.8,textAlign:'justify',margin:0,overflowWrap:'anywhere'}}>{section.text}</p>
    </section>)}
   </div>
   <div style={{position:'absolute',left:0,right:0,bottom:0,height:146,background:'white',borderTop:'2px solid #eeeeef',display:'flex',alignItems:'flex-start',padding:'21px 48px',gap:60}}>
    <div style={{height:106,width:330,borderRadius:60,display:'flex',alignItems:'center',justifyContent:'center',color:'#9c9fa6',fontSize:36,background:'#f8f8fa',flexShrink:0}}>欢迎参与讨论</div>
    <div style={{position:'relative',marginTop:18}}><Icon name="up" size={67}/><span style={{position:'absolute',left:44,top:-23,fontSize:29,color:'#333',whiteSpace:'nowrap'}}>{count(data.votes)}</span></div>
    <div style={{marginTop:18}}><Icon name="voteDown" size={67}/></div>
    <div style={{marginTop:17}}><Icon name="star" size={68}/></div>
    <div style={{position:'relative',marginTop:17}}><Icon name="comment" size={70}/><span style={{position:'absolute',right:1,top:-23,fontSize:29,color:'#333'}}>{data.comments}</span></div>
    <div style={{marginTop:13,marginLeft:-20}}><Icon name="more" size={66}/></div>
    <div style={{position:'absolute',width:428,height:7,background:'#c4c4c4',left:'50%',transform:'translateX(-50%)',bottom:5,borderRadius:6}}/>
   </div>
  </div>
 </article>;
}
