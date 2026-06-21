/*
MODULE: init.js
LAYER: dispatcher/runtime
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: init.js responsibilities
USES: local modules
STATE_READS: habits, tasks
STATE_WRITES: habits, protocol, tasks
PUBLIC_API: none
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

load();
if(!tasks.length){tasks=[
  {id:1,text:'Check emails',catId:'work',done:false,status:'todo',ts:'09:00',order:0,createdAt:1,repeat:null,templateId:null,generatedForDate:null,pinned:false,subtasks:[]},
  {id:2,text:'Drink a glass of water',catId:'health',done:false,status:'todo',ts:'09:30',order:1,createdAt:2,repeat:null,templateId:null,generatedForDate:null,pinned:false,subtasks:[]},
  {id:3,text:'10 min walk outside',catId:'health',done:false,status:'todo',ts:'10:00',order:2,createdAt:3,repeat:null,templateId:null,generatedForDate:null,pinned:false,subtasks:[]},
];}
if(!habits.length){habits=[{id:1,name:'Drink water',hits:[]},{id:2,name:'Move body',hits:[]}];}
// migrateTasks() runs here (once) so it covers both the normal load path
// and seed data inserted above — previously ran 3× at startup.
migrateTasks();
// migrateJournal() folds old adhd4_notes + audioRecordings into journalEntries once.
migrateJournal();
// ensureRepeatTasksForToday depends on migrated repeat/templateId fields, so runs after migrate.
ensureRepeatTasksForToday();
resetTimer(true);
render();

// Browser file:// hint (Electron desktop app is unaffected)
if(location.protocol==='file:'&&!/Electron/i.test(navigator.userAgent)&&!localStorage.getItem('adhd4_web_file_warn')){
  setTimeout(()=>{
    showToast('Browser mode: tasks & timer work offline. Voice notes may need opening via a local server (see web/README).','warn');
    localStorage.setItem('adhd4_web_file_warn','1');
  },1200);
}
