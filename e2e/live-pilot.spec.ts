import {test,expect} from '@playwright/test';
async function openAlerts(page:import('@playwright/test').Page,mobile:boolean){await page.goto('/');await expect(page.getByText('PILOT / STAGE 2',{exact:true})).toBeVisible();if(mobile)await page.getByLabel('Open navigation').click();await page.getByRole('button',{name:/^Alerts & catalysts/}).click();}
test('Stage 2 source review requires confirmation and sends the chosen transaction',async({page,request},info)=>{
 const baseline=await request.get('/api/deals').then(r=>r.json());let approved=false;let received:Record<string,unknown>|null=null;
 const source={id:'fixture-source',headline:'Addtech acquisition — UI fixture',url:'https://news.cision.com/addtech/r/fixture',published_at:new Date().toISOString(),excerpt:'Illustrative official-source excerpt for the UI test.',source:'Addtech / Cision',state:'pending'};
 await page.route('**/api/deals',r=>r.fulfill({json:{...baseline,mode:'pilot',stage:2,readOnly:false}}));
 await page.route('**/api/pilot',async r=>{
 if(r.request().method()==='POST'){received=r.request().postDataJSON();approved=true;return r.fulfill({json:{material:true,queued:false,dealId:'test-deal'}});}
 return r.fulfill({json:{enabled:true,canReview:true,monitoring:false,notifications:false,items:approved?[]:[source],runs:[],deliveries:[],subscriptions:[]}});
 });
 await openAlerts(page,info.project.name==='mobile');await expect(page.getByRole('heading',{name:'Addtech announcement review'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Deliver queued alerts'})).toBeDisabled();
 await page.getByRole('button',{name:'Review',exact:true}).click();
 const analysis={...baseline.deals[0],synthetic:false,target:'Reviewed UI fixture',source:{headline:source.headline,url:source.url,timestamp:source.published_at}};
 await page.getByLabel('Reviewed analysis (JSON)').fill(JSON.stringify(analysis));
 await page.getByRole('button',{name:'Approve reviewed update'}).click();expect(approved).toBe(false);
 await page.getByLabel(/I checked the source/).check();await page.getByRole('button',{name:'Approve reviewed update'}).click();
 await expect(page.getByText('No pending candidates. Scan the source to check for recent announcements.')).toBeVisible();
 expect(received).toMatchObject({action:'approve',sourceId:'fixture-source',existingId:null,deal:{target:'Reviewed UI fixture'}});
});
test('Stage 2 readers see source status but cannot approve or run source scans',async({page,request},info)=>{
 const baseline=await request.get('/api/deals').then(r=>r.json());
 await page.route('**/api/deals',r=>r.fulfill({json:{...baseline,mode:'pilot',stage:2,readOnly:false}}));
 await page.route('**/api/pilot',r=>r.fulfill({json:{enabled:true,canReview:false,monitoring:false,notifications:false,items:[],runs:[],deliveries:[],subscriptions:[]}}));
 await openAlerts(page,info.project.name==='mobile');await expect(page.getByRole('heading',{name:'Addtech announcement review'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Scan official feed'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Queue one test alert'})).toHaveCount(0);
});
