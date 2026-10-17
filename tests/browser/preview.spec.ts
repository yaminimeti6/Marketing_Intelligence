import { test, expect } from '@playwright/test';
test('all seven layouts load without browser errors', async ({ page }) => {
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['overview','analytics','campaigns','attribution','reports','integrations','settings']){
    await page.goto('/design-preview/'+route);
    await expect(page.locator('h1')).toHaveText(new RegExp(route,'i'));
    await expect(page.getByText('DEMO DATA',{exact:true}).first()).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('filters, campaign details, report generation and local settings work',async({page})=>{
  await page.goto('/design-preview/analytics');
  await page.getByRole('button',{name:'Meta Ads',exact:true}).click();
  await page.getByRole('textbox',{name:'Search campaigns'}).fill('creative');
  await page.getByLabel('Campaign status').selectOption('Paused');
  await expect(page.locator('.table-footer')).toContainText('1 of 1 campaigns');
  await page.locator('.campaign-name').filter({hasText:'Creative testing'}).click();
  await expect(page.getByRole('dialog')).toContainText('Edit budget · P1');
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.goto('/design-preview/reports');
  await page.getByRole('button',{name:/Generate preview/}).click();
  await expect(page.getByRole('heading',{name:'Report preview'})).toBeVisible();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download CSV',exact:true}).click();
  expect((await download).suggestedFilename()).toContain('DEMO');
  await page.goto('/design-preview/settings');
  await page.getByLabel('Workspace name').fill('Review workspace');
  await page.getByRole('button',{name:'Save preferences'}).click();
  await page.reload();
  await expect(page.getByLabel('Workspace name')).toHaveValue('Review workspace');
});
test('responsive layouts have no document overflow',async({page})=>{
  for(const width of [375,768,1024,1280,1440]){
    await page.setViewportSize({width,height:1000});
    for(const route of ['overview','analytics','campaigns','attribution','reports','integrations','settings']){
      await page.goto('/design-preview/'+route);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${route} at ${width}px`).toBe(true);
    }
  }
});
test('mobile navigation and date range work',async({page})=>{
  await page.setViewportSize({width:375,height:900});
  await page.goto('/design-preview/overview');
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('link',{name:'Analytics',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('Analytics');
  await page.getByRole('button',{name:'Last 30 days'}).click();
  await page.getByRole('button',{name:'Last 7 days',exact:true}).click();
  await expect(page).toHaveURL(/start=2026-10-09/);
});
