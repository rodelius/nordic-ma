import {test,expect,type Page} from '@playwright/test';
async function alerts(page:Page,mobile:boolean){await page.goto('/');await expect(page.getByText('PILOT / STAGE 2',{exact:true})).toBeVisible();if(mobile)await page.getByLabel('Open navigation').click();await page.getByRole('button',{name:/^Alerts & catalysts/}).click();}
const evaluation={eligible:false,reason:'Need at least 12 distinct labelled groups.',trainingCount:0,holdoutCount:0,scoredHoldouts:0,precisionAt3:null,baselinePrecisionAt3:null};
test('dismissal reasons and feedback corrections are explicit; shadow promotion stays blocked',async({page,request},info)=>{
 const baseline=await request.get('/api/deals').then(r=>r.json());let dismissed=false,excluded=false,saved=false;const bodies:Record<string,unknown>[]=[];
 const item={id:'learning-fixture',headline:'Routine shareholding fixture',url:'https://news.cision.com/issuer/r/learning-fixture',published_at:new Date().toISOString(),excerpt:'A routine disclosure with no new transaction.',source:'Cision',state:'pending'};
 await page.route('**/api/deals',r=>r.fulfill({json:{...baseline,mode:'pilot',stage:2}}));
 await page.route('**/api/pilot',async r=>{
  if(r.request().method()==='POST'){bodies.push(r.request().postDataJSON());dismissed=true;return r.fulfill({json:{dismissed:true,feedbackRecorded:true}});}
  return r.fulfill({json:{enabled:true,canReview:true,monitoring:false,notifications:false,items:dismissed?[]:[item],runs:[],deliveries:[],subscriptions:[],learning:{enabled:true,mode:'shadow',algorithm:'ficc-cases-v1',feedbackCount:dismissed?1:0,trainingCases:dismissed&&!excluded?1:0,workingVersion:'a'.repeat(64),activeVersion:null,evaluation,versions:saved?[{id:'a'.repeat(64),createdAt:new Date().toISOString(),evaluation}]:[],recent:dismissed?[{id:'f',sourceId:item.id,headline:item.headline,decision:excluded?'exclude':'not_useful',reason:excluded?'retracted':'routine',score:null,note:'Reviewed fixture',at:new Date().toISOString()}]:[]}}});
 });
 await page.route('**/api/learning',async r=>{const body=r.request().postDataJSON();bodies.push(body);if(body.action==='save')saved=true;if(body.action==='exclude')excluded=true;return r.fulfill({json:{ok:true,message:'Feedback saved in shadow mode.'}});});
 await alerts(page,info.project.name==='mobile');await expect(page.getByRole('heading',{name:'Nordic FICC learning engine'})).toBeVisible();
 await expect(page.getByText(/Shadow mode · queue order unchanged/)).toBeVisible();
 await page.getByRole('button',{name:'Dismiss',exact:true}).click();
 await expect(page.getByLabel('Dismissal reason')).toBeVisible();await page.getByRole('button',{name:'Dismiss and record feedback'}).click();expect(dismissed).toBe(false);
 await page.getByLabel('Dismissal reason').selectOption('routine');await page.getByLabel('Feedback note (optional)').fill('Only a routine shareholding disclosure.');await page.getByRole('button',{name:'Dismiss and record feedback'}).click();
 await expect(page.getByText('No pending candidates. Scan the source to check for recent announcements.')).toBeVisible();expect(bodies[0]).toMatchObject({action:'dismiss',reason:'routine',note:'Only a routine shareholding disclosure.'});
 await page.getByText('Latest 15 feedback decisions',{exact:true}).click();await page.getByRole('button',{name:'Correct or exclude feedback'}).click();
 await page.getByLabel('Correct label').selectOption('exclude');await page.getByLabel('Why are you correcting this feedback?').fill('Exclude this example from the training dataset.');await page.getByRole('button',{name:'Save feedback correction'}).click();
 await expect(page.getByText('exclude · retracted',{exact:false})).toBeVisible();expect(bodies.some(b=>b.action==='exclude'&&b.sourceId===item.id)).toBe(true);
 await page.getByRole('button',{name:'Evaluate & save version'}).click();await page.getByLabel('Saved learning model').selectOption('a'.repeat(64));await expect(page.getByRole('button',{name:'Activate selected ranking'})).toBeDisabled();
});
test('readers can inspect learning but cannot publish models or change feedback',async({page,request},info)=>{
 const baseline=await request.get('/api/deals').then(r=>r.json());
 await page.route('**/api/deals',r=>r.fulfill({json:{...baseline,mode:'pilot',stage:2}}));
 await page.route('**/api/pilot',r=>r.fulfill({json:{enabled:true,canReview:false,items:[],runs:[],deliveries:[],monitoring:false,notifications:false,learning:{enabled:true,mode:'shadow',algorithm:'ficc-cases-v1',feedbackCount:0,trainingCases:0,workingVersion:'a'.repeat(64),evaluation,versions:[],recent:[]}}}));
 await alerts(page,info.project.name==='mobile');await expect(page.getByRole('heading',{name:'Nordic FICC learning engine'})).toBeVisible();await expect(page.getByRole('button',{name:'Evaluate & save version'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Activate selected ranking'})).toHaveCount(0);
});
