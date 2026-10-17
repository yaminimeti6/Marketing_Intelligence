import { test,expect, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';

let authenticatedCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
test.beforeAll(async ({browser,baseURL}) => {
  test.setTimeout(60000);
  const context = await browser.newContext();
  try {
    const health = await context.request.get(`${baseURL}/api/health`);
    if (health.status() === 503) return;
    if (health.status() !== 200) throw new Error('Unexpected health response');
    const file = process.env.PLAYWRIGHT_OWNER_LOGIN_FILE;
    if (!file) throw new Error('Set PLAYWRIGHT_OWNER_LOGIN_FILE for configured-database browser tests.');
    const local = await readFile(file,'utf8');
    const email = local.match(/^Email: (.+)$/m)?.[1]?.trim();
    const password = local.match(/^Password: (.+)$/m)?.[1];
    if (!email || !password) throw new Error('Private test login file format is invalid.');
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}/login`);
      await page.getByLabel('Email address',{exact:true}).fill(email);
      await page.getByLabel('Password',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Sign in securely'}).click();
      await page.waitForURL('**/meta',{timeout:30000});
      authenticatedCookies = await context.cookies();
    } catch { throw new Error('Configured Owner login failed; credentials withheld.'); }
  } finally { await context.close(); }
});
test.beforeEach(async ({context},info) => {
  if (!info.title.startsWith('sign-in reflects')) await context.addCookies(authenticatedCookies);
});

test('Rules page exposes condition editing and review history without hydration errors or unintended alerts',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/alerts');
 await expect(page.getByRole('heading',{name:'Rules & Alerts',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Recent alerts',exact:true})).toBeVisible();
 await expect(page.getByText('No email, Slack message or advertising action is sent.',{exact:false})).toBeVisible();
 const form=page.locator('.rule-editor');if(await form.count()){
  await page.getByRole('button',{name:'Add condition',exact:true}).click();await expect(form.locator('select[name=metric]')).toHaveCount(2);await page.getByLabel('Condition logic',{exact:true}).selectOption('any');await expect(page.getByLabel('Condition logic',{exact:true})).toHaveValue('any');await page.getByRole('button',{name:'Remove condition 2',exact:true}).click();await expect(form.locator('select[name=metric]')).toHaveCount(1);
 }
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 expect(errors).toEqual([]);
});

test('Analytics has shared filters, selectable columns, safe exports and no placeholder or hydration failure',async({page,browser,baseURL})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/analytics');
 await expect(page.getByRole('heading',{name:'Analytics',exact:true})).toBeVisible();await expect(page.getByText('Planned for a later milestone',{exact:true})).toHaveCount(0);
 await page.locator('input[name=metric][value=clicks]').uncheck();await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page).toHaveURL(/columns=/);expect(new URL(page.url()).searchParams.get('columns')?.split(',')).not.toContain('clicks');
 await page.goto('/analytics?provider=meta');await expect(page.getByLabel('Channel',{exact:true})).toHaveValue('meta');
 await page.goto('/settings');await expect(page.getByRole('heading',{name:'Privacy & browser event retention',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Integration audit history',exact:true})).toBeVisible();
 await page.goto('/onboarding');await expect(page.getByRole('heading',{name:'Setup checklist',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
 const anonymous=await browser.newContext();try{for(const route of ['analytics','shopify','combined']){const response=await anonymous.request.post(`${baseURL}/api/reports/${route}/export`,{form:{}});expect(response.status()).toBe(401);}}finally{await anonymous.close();}
});
test('foundation shows empty states without provider calls or demo metrics',async({page})=>{
  const errors:string[]=[];
  const providers:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/graph\.facebook|myshopify\.com/.test(r.url()))providers.push(r.url());});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Meta Ads',exact:true})).toBeVisible();
  await expect(page.locator('.meta-source-pill')).toBeVisible();
  await expect(page.locator('.meta-kpis .kpi-value')).toHaveCount(11);
  await page.screenshot({path:'test-results/meta-dashboard-desktop.png',fullPage:true});
  await page.getByRole('link',{name:'Integrations',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Meta Ads',exact:true})).toBeVisible();
  const shopifyButton=page.getByRole('button',{name:/^(Configure Shopify app first|Apply Shopify migration first|Administrator access required|Connect Shopify|Reconnect Shopify)$/});
  await expect(shopifyButton).toBeVisible();
  if(['Connect Shopify','Reconnect Shopify'].includes((await shopifyButton.textContent())??''))await expect(shopifyButton).toBeEnabled();else await expect(shopifyButton).toBeDisabled();
  const metaButton=page.getByRole('button',{name:/^(Configure Meta app first|Apply Meta migration first|Administrator access required|Connect Meta Ads|Reconnect Meta Ads)$/});
  await expect(metaButton).toBeVisible();
  const metaLabel=await metaButton.textContent();
  if(metaLabel==='Connect Meta Ads'||metaLabel==='Reconnect Meta Ads')await expect(metaButton).toBeEnabled();
  else await expect(metaButton).toBeDisabled();
  
  expect(providers).toEqual([]); expect(errors).toEqual([]);
});
test('responsive shell fits mobile and exposes navigation',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/meta-dashboard-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Open navigation'}).click();
  await expect(page.getByRole('link',{name:'Shopify Sales',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Shopify Sales',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Shopify Sales',exact:true})).toBeVisible();
});
test('sign-in reflects database readiness and starts unauthenticated',async({page})=>{
  await page.goto('/login');
  expect((await page.context().cookies()).some(c=>c.name.includes('session'))).toBe(false);
  const health=await page.request.get('/api/health');
  if (authenticatedCookies.length) {
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({status:'ready',scope:'application',schema:'016_alert_rules',integrations:'not_checked'});
    await expect(page.getByRole('button',{name:'Sign in securely'})).toBeEnabled();
    await page.goto('/meta');
    await expect(page).toHaveURL(/\/login$/);
  } else {
    expect(health.status()).toBe(503);
    expect(await health.json()).toEqual({status:'setup_required'});
    await expect(page.getByRole('button',{name:'Sign in securely'})).toBeDisabled();
  }
});
test('foundation pages fit phone, tablet and desktop widths',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',()=>errors.push('runtime error'));
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    for(const route of ['meta','campaigns','analytics','reports','alerts','shopify','overview','integrations','settings','onboarding']) {
      await page.goto('/'+route);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} at ${width}`).toBe(true);expect(errors,`${route} runtime errors`).toEqual([]);
    }
  }
});

test('real Meta reports save personal filters, generate CSV and enforce export authentication/origin',async({page,browser,baseURL})=>{
  await page.goto('/reports');
  await expect(page.getByRole('heading',{name:'Reports',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Report library',exact:true})).toBeVisible();
  const name='Browser report '+Date.now();
  await page.getByLabel('Report name',{exact:true}).fill(name);
  await page.getByRole('button',{name:'Save applied filters',exact:true}).click();
  await expect(page.getByRole('link',{name,exact:true})).toBeVisible();
  await page.getByRole('link',{name,exact:true}).click();
  await expect(page).toHaveURL(/\/reports\?.*start=/);
  const exportButton=page.getByRole('button',{name:'Download filtered CSV',exact:true});
  if(await exportButton.isEnabled()){
    const downloadPromise=page.waitForEvent('download');await exportButton.click();const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^northstar-meta-campaigns-.*\.csv$/);
    const file=await download.path();expect(file).toBeTruthy();const csv=await readFile(file!,'utf8');expect(csv).toContain('Meta Marketing API');expect(csv).toContain('"Coverage"');expect(csv).not.toContain('DEMO DATA');
    await page.reload();await expect(page.getByText('No exports generated yet.',{exact:true})).toHaveCount(0);
  }
  const badOrigin=await page.request.post('/api/reports/meta/export',{headers:{Origin:'https://evil.invalid'},form:{}});expect(badOrigin.status()).toBe(403);
  const anonymous=await browser.newContext();try{const denied=await anonymous.request.post(`${baseURL}/api/reports/meta/export`,{headers:{Origin:baseURL!},form:{}});expect(denied.status()).toBe(401);}finally{await anonymous.close();}
  await page.getByRole('button',{name:`Delete saved report ${name}`,exact:true}).click();await expect(page.getByRole('link',{name,exact:true})).toHaveCount(0);
});

test('workspace settings expose protected Owner controls and invitation links without claiming email delivery',async({page})=>{
 await page.goto('/settings');await expect(page.getByRole('heading',{name:'Your profile & security',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Members & roles',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Create invitation link',exact:true})).toBeEnabled();await expect(page.getByText('Otherwise, share the link manually.',{exact:false})).toBeVisible();
 const last=page.locator('.settings-member').filter({has:page.getByText('Last Owner protected',{exact:true})});if(await last.count()){await expect(last.getByRole('button',{name:'Remove member',exact:true})).toBeDisabled();await expect(last.getByRole('button',{name:'Update role',exact:true})).toBeDisabled();}
 const email='browser-invite-'+Date.now()+'@example.invalid';await page.getByLabel('Invite email',{exact:true}).fill(email);await page.getByRole('button',{name:'Create invitation link',exact:true}).click();
 const link=page.getByRole('textbox',{name:'Private invitation link',exact:true});await expect(link).toBeVisible();const value=await link.inputValue();expect(new URL(value).pathname).toBe('/invite');expect(new URL(value).hash.length).toBe(44);await expect(page.getByText('Invitation created, not emailed.',{exact:false})).toBeVisible();
 const row=page.locator('.settings-invitation').filter({has:page.getByText(email,{exact:true})});await row.getByRole('button',{name:'Revoke invitation',exact:true}).click();await expect(page.getByText('Invitation revoked. The old link can no longer be accepted.',{exact:true})).toBeVisible();
 await page.goto('/invite#'+new URL(value).hash.slice(1));await expect(page.getByRole('heading',{name:'Join a workspace'})).toBeVisible();await expect(page).toHaveURL(/\/invite$/);await page.getByRole('button',{name:'Accept invitation',exact:true}).click();await expect(page.locator('.auth-card [role=alert]')).toContainText('invalid, expired, revoked or already accepted');
});

 test('Audit history filters loaded records without changing workspace data',async({page})=>{
 await page.goto('/settings');const section=page.getByRole('heading',{name:'Integration audit history',exact:true}).locator('..');
 await expect(section.getByRole('combobox',{name:'Audit source',exact:true})).toBeVisible();await section.getByLabel('Search audit actions',{exact:true}).fill('no-such-audit-action-fixture');await expect(section.getByText('No actions match these filters.',{exact:true})).toBeVisible();await expect(section.getByRole('button',{name:'Next audit page',exact:true})).toBeDisabled();await section.getByRole('button',{name:'Reset audit filters',exact:true}).click();await expect(section.getByLabel('Search audit actions',{exact:true})).toHaveValue('');
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 });

test('Invitation errors survive a full form navigation without JavaScript',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false});try{await context.addCookies(authenticatedCookies);const page=await context.newPage();await page.goto(baseURL+'/settings');const email=await page.getByLabel('Email',{exact:true}).inputValue();await page.getByLabel('Invite email',{exact:true}).fill(email);await page.getByRole('button',{name:'Create invitation link',exact:true}).click();await expect(page.getByText('This email is already a workspace member. Use member roles instead.',{exact:true})).toBeVisible();}finally{await context.close();}
});

test('Removed advertising provider has no UI controls or OAuth endpoints',async({page})=>{
 await page.goto('/integrations');await expect(page.getByRole('heading',{name:'Meta Ads',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Shopify',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Google Ads',exact:true})).toHaveCount(0);
 await page.goto('/analytics');await expect(page.getByRole('option',{name:'Google Ads',exact:true})).toHaveCount(0);
 await page.goto('/alerts');await expect(page.getByRole('option',{name:'Google Ads',exact:true})).toHaveCount(0);
 for(const route of ['start','callback']){const r=await page.request.get('/api/integrations/google-ads/'+route);expect([404,405]).toContain(r.status());}
});

test('Workspace navigation works on phone and tablet with keyboard focus and scroll restoration',async({page})=>{
 for(const width of [390,768]){await page.setViewportSize({width,height:900});await page.goto('/overview');const menu=page.getByRole('button',{name:'Open navigation',exact:true});await expect(menu).toBeVisible();await menu.click();const drawer=page.getByRole('dialog',{name:'Workspace navigation'});await expect(drawer).toBeVisible();await expect(menu).toHaveAttribute('aria-expanded','true');expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');await expect(drawer.getByRole('button',{name:'Close navigation',exact:true})).toBeFocused();await page.keyboard.press('Shift+Tab');expect(await drawer.evaluate(el=>el.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(menu).toBeFocused();expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');await menu.click();await page.getByRole('dialog',{name:'Workspace navigation'}).getByRole('link',{name:'Shopify Sales',exact:true}).click();await expect(page).toHaveURL(/\/shopify$/);await expect(page.getByRole('dialog',{name:'Workspace navigation'})).toHaveCount(0);}
});
