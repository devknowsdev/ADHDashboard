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
    // Create a planner dump for today and promote it to a task
    const result = await page.evaluate(() => {
      try{
        const ymd = dateToYMD(new Date());
        plannerOpenDump(ymd);
        plannerDumpInput = 'Playwright test task';
        plannerAddDump(ymd);
        const dumps = plannerDayDumps[ymd] || [];
        if(dumps.length===0) return {ok:false,reason:'no-dump'};
        const id = dumps[0].id;
        plannerPromoteDump(ymd,id);
        // find created task
        const t = tasks.find(x=>x.text==='Playwright test task');
        if(!t) return {ok:false,reason:'no-task'};
        // focus and start timer for 1s then stop and save
        setFocus(t.id);
        if(typeof startTimerInternal==='function') startTimerInternal();
        return {ok:true,taskId:t.id};
      }catch(e){ return {ok:false,reason:String(e)}; }
    });
    if(!result || !result.ok){ console.error('UI flow failed', result); await browser.close(); process.exit(5); }
    // let timer run briefly
    await page.waitForTimeout(1200);
    // stop and save timer
    await page.evaluate(()=>{ try{ if(typeof stopAndSaveTimer==='function') stopAndSaveTimer(true); }catch(e){} });
    // verify session saved
    const hasSession = await page.evaluate((taskId)=>{ return (timeSessions||[]).some(s=>s.taskId===taskId); }, result.taskId);
    if(!hasSession){ console.error('no session saved for task', result.taskId); await browser.close(); process.exit(6); }
    if(consoleErrors.length){ console.error('console errors:', consoleErrors); await browser.close(); process.exit(4); }
    console.log('Playwright smoke: OK');
    await browser.close(); process.exit(0);
  }catch(e){ console.error('playwright error', e && e.message); try{ await browser.close(); }catch(_){} process.exit(10); }

})();
