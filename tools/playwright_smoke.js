const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    try{
      if(msg.type && msg.type() === 'error') consoleErrors.push(msg.text());
    }catch(e){}
  });

  try{
    const resp = await page.goto('http://localhost:8000', { waitUntil: 'load', timeout: 15000 });
    if(!resp || resp.status() !== 200){ console.error('HTTP failed', resp && resp.status()); await browser.close(); process.exit(2); }
    // check for root element
    const root = await page.$('#root');
    if(!root){ console.error('missing #root'); await browser.close(); process.exit(3); }
    // wait a little for scripts to run
    await page.waitForTimeout(500);
    if(consoleErrors.length){ console.error('console errors:', consoleErrors); await browser.close(); process.exit(4); }
    console.log('Playwright smoke: OK');
    await browser.close(); process.exit(0);
  }catch(e){ console.error('playwright error', e && e.message); try{ await browser.close(); }catch(_){} process.exit(10); }

})();
