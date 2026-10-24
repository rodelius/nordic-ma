import { test, expect } from '@playwright/test';
test('radar, filtering, evidence, watchlist and brief work',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'See the deal. Find the opportunity.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Project Alpha',exact:true})).toBeVisible();
 await page.getByLabel('Country filter').selectOption('Norway');await expect(page.getByRole('button',{name:'Project Alpha',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Project Fjord',exact:true})).toBeVisible();
 await page.getByLabel('Country filter').selectOption('All Nordics');await page.getByRole('button',{name:'Project Alpha',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('heading',{name:'Evidence & assumptions'})).toBeVisible();
 await page.getByRole('button',{name:'Follow transaction',exact:true}).click();await expect(page.getByRole('button',{name:'Following',exact:true})).toBeVisible();
 await page.getByLabel('Close deal').click();
 if(info.project.name==='mobile')await page.getByLabel('Open navigation').click();
 await page.getByRole('button',{name:'Morning brief',exact:true}).click();await expect(page.getByRole('heading',{name:'Daily action table'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Watchlist with no material update'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 if(info.project.name==='mobile')await page.getByLabel('Open navigation').click();
 await page.getByRole('button',{name:'Opportunity radar',exact:true}).click();
 await page.screenshot({path:`docs/${info.project.name}.png`,fullPage:true});expect(errors).toEqual([]);
});
test('API returns real brief sections and rejects unauthenticated writes',async({request})=>{
 const r=await request.get('/api/brief?hours=24');expect(r.ok()).toBeTruthy();const j=await r.json();expect(j.sections.A.length).toBeGreaterThan(0);expect(j.sections.E.some((d:{id:string})=>d.id==='delta')).toBeTruthy();
 expect((await request.post('/api/events',{data:{}})).status()).toBe(401);
 expect((await request.get('/api/brief?hours=NaN')).status()).toBe(400);
 expect((await request.get('/manifest.webmanifest')).ok()).toBeTruthy();
});
