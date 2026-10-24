// Conservative display grouping only. No source is deleted, labelled or automatically linked.
export function sourceGroups<T extends {id:string;headline:string;url:string}>(items:T[]):T[][]{
 const groups=new Map<string,T[]>();
 for(const item of items){let canonical=item.url;try{const u=new URL(item.url);canonical=u.hostname+u.pathname.replace(/^\/[a-z]{2}\//,'/').replace(/\/$/,'');}catch{}
 const headline=item.headline.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const key=headline.length>=20?'headline:'+headline:'url:'+canonical;
 const group=groups.get(key)||[];group.push(item);groups.set(key,group);
 }return [...groups.values()];
}
