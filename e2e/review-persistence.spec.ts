import {test,expect,type Page} from '@playwright/test';
import {previewAssessment} from '../lib/review-analysis';
const sourceId='persistent-source';
async function setup(page:Page,request:import('@playwright/test').APIRequestContext){
 const baseline=await request.get('/api/deals').then(r=>r.json());
 let source={id:sourceId,headline:'Persistent review fixture',url:'https://news.cision.com/issuer/r/persistent',published_at:new Date().toISOString(),excerpt:'Source evidence.',source:'Cision',state:'pending',review_version:0,analysis:null as Record<string,unknown>|null,deal_id:null as string|null};
 let draft:null|{draft_text:string;note:string;assessment:unknown;base_version:number;revision:number}=null,fail=false;
 const messages:Record<string,unknown>[]=[];
 const learning=()=>({enabled:true,mode:'shadow',algorithm:'ficc-cases-v2',feedbackCount:source.analysis?1:0,trainingCases:source.analysis?1:0,workingVersion:'a'.repeat(64),activeVersion:null,evaluation:{eligible:false,reason:'More labels needed',trainingCount:0,holdoutCount:0,scoredHoldouts:0,precisionAt3:null,baselinePrecisionAt3:null},versions:[],recent:source.analysis?[{id:'f',sourceId,headline:source.headline,decision:'useful',reason:'approved',score:source.analysis.score,note:'Reviewed',at:new Date().toISOString(),hasAnalysis:true}]:[]});
 await page.route('**/api/deals',r=>r.fulfill({json:{...baseline,mode:'pilot',stage:2}}));
 await page.route('**/api/pilot',r=>r.fulfill({json:{enabled:true,canReview:true,items:source.state==='pending'?[source]:[],runs:[],deliveries:[],monitoring:false,notifications:false,learning:learning()}}));
 await page.route('**/api/reviews**',async r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{source,draft,assessment:draft?.assessment||null,revisions:[]}});
  const b=r.request().postDataJSON();messages.push(b);
  if(fail)return r.fulfill({status:400,json:{error:'Invalid country: confirm the Nordic connection'}});
  if(b.action==='draft'){draft={draft_text:b.text,note:b.note,assessment:previewAssessment(b.text),base_version:source.review_version,revision:(draft?.revision||0)+1};return r.fulfill({json:{saved:true,draftRevision:draft.revision,assessment:draft.assessment,message:'Draft and assessment saved.'}});}
  source={...source,state:'approved',review_version:source.review_version+1,analysis:JSON.parse(b.text),deal_id:'alpha'};draft=null;return r.fulfill({json:{saved:true,message:'Assessment correction saved. No alert sent.'}});
 });
 return {baseline,messages,setFail:(v:boolean)=>{fail=v;},approve:()=>{source={...source,state:'approved',review_version:1,analysis:{...baseline.deals[0],target:'Saved original assessment',score:4},deal_id:'alpha'};}};
}
async function alerts(page:Page,mobile:boolean){await page.goto('/');await expect(page.getByText('PILOT / STAGE 2',{exact:true})).toBeVisible();if(mobile)await page.getByLabel('Open navigation').click();await page.getByRole('button',{name:/^Alerts & catalysts/}).click();}
test('review pane saves and restores JSON drafts and visibly reports missing confirmation and server errors',async({page,request},info)=>{
 const state=await setup(page,request);await alerts(page,info.project.name==='mobile');
 const button=page.getByRole('button',{name:'Review',exact:true});await button.scrollIntoViewIfNeeded();await page.evaluate(()=>document.addEventListener('click',e=>{if((e.target as HTMLElement).textContent==='Review')(window as unknown as {reviewClickY:number}).reviewClickY=scrollY;},true));await button.click();const scroll=await page.evaluate(()=>(window as unknown as {reviewClickY:number}).reviewClickY);
 const dialog=page.getByRole('dialog',{name:'Review announcement'});await expect(dialog).toBeVisible();expect(Math.abs((await page.evaluate(()=>scrollY))-scroll)).toBeLessThan(2);
 const draftText=JSON.stringify({...state.baseline.deals[0],evidence:[{label:'Consideration type',value:'CASH',kind:'Fact'},{label:'Consideration currency',value:'SEK',kind:'Fact'},{label:'Buyer funding currency',value:'EUR',kind:'Fact'}]});
 await page.getByRole('button',{name:'Advanced JSON',exact:true}).click();await page.getByLabel('Reviewed analysis (JSON)').fill(draftText);await page.getByRole('button',{name:'Approve reviewed update'}).click();await expect(dialog.getByRole('alert')).toContainText('Confirm that you checked');expect(state.messages.length).toBe(0);
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Draft and assessment saved');await page.getByLabel('Close review pane').click();
 await page.getByRole('button',{name:'Review',exact:true}).click();await page.getByRole('button',{name:'Advanced JSON',exact:true}).click();await expect(page.getByLabel('Reviewed analysis (JSON)')).toHaveValue(draftText);await expect(dialog.getByRole('status')).toContainText('restored');await expect(dialog.getByRole('heading',{name:'Saved draft FICC assessment'})).toBeVisible();await page.getByLabel('Reviewed analysis (JSON)').fill('{"incomplete":true}');
 await page.getByLabel(/I checked the source/).check();state.setFail(true);await page.getByRole('button',{name:'Approve reviewed update'}).click();await expect(dialog.getByRole('alert')).toContainText('Invalid country');await expect(dialog.getByRole('alert')).toBeInViewport();await expect(page.getByLabel('Reviewed analysis (JSON)')).toHaveValue('{"incomplete":true}');if(info.project.name==='desktop')await page.screenshot({path:'/tmp/review-fix-desktop.png'});
});
test('history opens the saved JSON in the right pane and persists assessment corrections across reopening',async({page,request},info)=>{
 const state=await setup(page,request);state.approve();await alerts(page,info.project.name==='mobile');await page.getByText('Latest 15 feedback decisions',{exact:true}).click();await page.getByRole('button',{name:'Edit saved assessment'}).click();
 const dialog=page.getByRole('dialog',{name:'Edit saved assessment'});await expect(dialog).toBeVisible();await page.getByRole('button',{name:'Advanced JSON',exact:true}).click();await expect(page.getByLabel('Reviewed analysis (JSON)')).toHaveValue(/Saved original assessment/);
 const changed={...state.baseline.deals[0],target:'Corrected saved assessment',score:2};await page.getByLabel('Reviewed analysis (JSON)').fill(JSON.stringify(changed));await page.getByLabel('Why are you correcting this assessment?').fill('Corrected the payment and financing assessment.');await page.getByLabel(/I checked the source/).check();await page.getByRole('button',{name:'Save assessment correction'}).click();await expect(dialog).toHaveCount(0);
 expect(state.messages.at(-1)).toMatchObject({action:'submit',version:1,sourceId});expect(JSON.parse(state.messages.at(-1)!.text as string).score).toBe(2);
 await page.getByRole('button',{name:'Edit saved assessment'}).click();await page.getByRole('button',{name:'Advanced JSON',exact:true}).click();await expect(page.getByLabel('Reviewed analysis (JSON)')).toHaveValue(/Corrected saved assessment/);
});

test('guided review preserves empty facts, shows original and learned score, and advances after approval',async({page,request},info)=>{
 const state=await setup(page,request);const baseline=state.baseline.deals[0];
 let source={id:sourceId,headline:'Guided review fixture',url:'https://news.cision.com/issuer/r/guided',published_at:new Date().toISOString(),excerpt:'Source excerpt for the analyst.',state:'pending',review_version:0,analysis:{...baseline,target:'',sector:''},deal_id:null};
 let draft:Record<string,unknown>|null=null;
 await page.route('**/api/reviews**',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{source,draft,assessment:null,revisions:[],suggestion:{score:4,version:'v2',mode:'shadow',explanation:'Three comparable reviewed groups support a score of 4.'}}});
  const body=route.request().postDataJSON();state.messages.push(body);
  if(body.action==='draft'){draft={draft_text:body.text,note:body.note,assessment:null,base_version:0,revision:1,review_input:body.reviewInput};return route.fulfill({json:{saved:true,draftRevision:1,assessment:null,message:'Draft saved.'}});}
  return route.fulfill({json:{saved:true,message:'Assessment saved.'}});
 });
 await alerts(page,info.project.name==='mobile');await page.getByRole('button',{name:'Review',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review announcement'});await expect(dialog.getByLabel('Target',{exact:true})).toHaveValue('');await expect(dialog.getByText('Pre-review: Empty / unknown',{exact:true}).first()).toBeVisible();
 await expect(dialog.getByText('Three comparable reviewed groups support a score of 4.')).toBeVisible();
 // The suggestion is prefilled; the extracted value remains visible as reference.
 await expect(dialog.getByLabel('FICC relevance score',{exact:true})).toHaveValue('4');
 await dialog.getByLabel('FICC relevance score',{exact:true}).selectOption('2');await dialog.getByLabel('Advisory hypothesis',{exact:true}).fill('Verify actual funding and payment timing.');
 await dialog.getByRole('button',{name:'Save draft',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Draft saved');
 await page.getByLabel('Close review pane').click();await page.getByRole('button',{name:'Review',exact:true}).click();
 await expect(dialog.getByLabel('Target',{exact:true})).toHaveValue('');await expect(dialog.getByLabel('FICC relevance score',{exact:true})).toHaveValue('2');await expect(dialog.getByLabel('Advisory hypothesis',{exact:true})).toHaveValue('Verify actual funding and payment timing.');
 await dialog.getByLabel(/I checked the source/).check();await dialog.getByLabel('Open next item after approval').check();await dialog.getByRole('button',{name:'Approve reviewed update'}).click();await expect(dialog).toHaveCount(0);
 const body=state.messages.at(-1)!;expect(JSON.parse(body.text as string)).toMatchObject({target:'',sector:'',score:2});expect(body.reviewInput).toMatchObject({original:{target:''},suggestion:{score:4}});
});

test('review actions stay inside the dialog and respond after long-form scrolling',async({page,request},info)=>{
 const state=await setup(page,request);await alerts(page,info.project.name==='mobile');await page.getByRole('button',{name:'Review',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review announcement'}),body=dialog.locator('.review-drawer-body'),footer=dialog.locator('.review-drawer-footer');
 await expect(footer).toBeVisible();await page.getByRole('button',{name:'Advanced JSON',exact:true}).click();
 await page.getByLabel('Reviewed analysis (JSON)').fill(JSON.stringify({...state.baseline.deals[0],rationale:'Long source review. '.repeat(150)}));
 for(const edge of ['top','bottom'] as const){
  await body.evaluate((e,edge)=>{e.scrollTop=edge==='top'?0:e.scrollHeight;},edge);
  const geometry=await dialog.evaluate(d=>{
   const body=d.querySelector('.review-drawer-body')!.getBoundingClientRect(),footer=d.querySelector('.review-drawer-footer')!.getBoundingClientRect(),dialog=d.getBoundingClientRect();
   const button=d.querySelector<HTMLButtonElement>('button[type="submit"]')!,b=button.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
   return {contained:footer.top>=dialog.top&&footer.bottom<=dialog.bottom+1,separate:body.bottom<=footer.top+1,hittable:button.contains(document.elementFromPoint(x,y)),x,y};
  });
  expect(geometry.contained).toBe(true);expect(geometry.separate).toBe(true);expect(geometry.hittable).toBe(true);
 }
 const approve=dialog.getByRole('button',{name:'Approve reviewed update'});
 if(info.project.name==='mobile'){const r=await approve.boundingBox();await page.touchscreen.tap(r!.x+r!.width/2,r!.y+r!.height/2);}else await approve.click();
 await expect(dialog.getByRole('alert')).toContainText('Confirm that you checked');await expect(dialog.getByRole('alert')).toBeInViewport();expect(state.messages).toHaveLength(0);
});
