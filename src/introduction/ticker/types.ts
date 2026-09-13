export type ArticleCardData={
 id:string;topic:string;title:string;sourceTitle:string;author:string;avatar:string;
 badge?:string;badgeText?:string;votes:number;comments:number;url:string;
 toc:string[];sections:{heading:string;text:string}[];sourceFile:string;sourceIndex:number;
};
