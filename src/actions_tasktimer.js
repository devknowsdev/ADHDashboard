
// -----------------------------
// UI LAYER: TIMELINE + HEATMAP + DRAG BRIDGE
// -----------------------------

function computeDayTimeline(list, dayFilter){
  const dayTasks = dayFilter
    ? list.filter(t => (t.ts||'').startsWith(dayFilter))
    : list;

  return dayTasks
    .map(t => {
      const start = toMinutes(t.ts);
      const duration = t.estimatedMins || 30;
      if(start==null) return null;

      return {
        id: t.id,
        label: t.text,
        start,
        end: start + duration,
        urgency: t.urgency || 0,
        energy: t.energyRequired || 0
      };
    })
    .filter(Boolean)
    .sort((a,b)=>a.start-b.start);
}

function renderTimeline(containerId, dayFilter){
  const el = document.getElementById(containerId);
  if(!el) return;

  const items = computeDayTimeline(tasks, dayFilter);

  let html = '<div class="timeline">';

  items.forEach(it => {
    const top = (it.start/1440)*100;
    const height = ((it.end-it.start)/1440)*100;

    html += `
      <div class="tl-block" data-task-id="${it.id}" style="top:${top}%;height:${height}%">
        <div class="tl-label">${it.label}</div>
      </div>
    `;
  });

  html += '</div>';
  el.innerHTML = html;

  enableTimelineDrag(el);
}

function computeWeeklyHeatmap(list){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const heat = {};

  days.forEach(d => heat[d] = 0);

  list.forEach(t => {
    const d = (t.ts||'').split(' ')[0];
    if(!heat.hasOwnProperty(d)) return;
    heat[d] += t.estimatedMins || 30;
  });

  return heat;
}

function renderWeeklyHeatmap(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;

  const heat = computeWeeklyHeatmap(tasks);

  let html = '<div class="heatmap">';

  Object.entries(heat).forEach(([day,val]) => {
    const intensity = Math.min(val/360,1);

    html += `
      <div class="heat-cell" data-day="${day}" style="opacity:${0.2 + intensity}">
        <span>${day}</span>
        <small>${val}m</small>
      </div>
    `;
  });

  html += '</div>';

  el.innerHTML = html;
}

// -----------------------------
// DRAG & DROP BRIDGE (MINIMAL)
// -----------------------------

function enableTimelineDrag(root){
  const blocks = root.querySelectorAll('[data-task-id]');

  blocks.forEach(b => {
    b.draggable = true;

    b.ondragstart = (e) => {
      e.dataTransfer.setData('taskId', b.getAttribute('data-task-id'));
    };
  });

  root.ondragover = (e) => e.preventDefault();

  root.ondrop = (e) => {
    e.preventDefault();

    const id = e.dataTransfer.getData('taskId');
    const t = tasks.find(x => x.id == id);
    if(!t) return;

    // naive drop: reposition based on Y coordinate
    const rect = root.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const mins = Math.floor(y * 1440);

    t.ts = toHHMM(mins);

    save?.();
    renderNow?.();
  };
}

// -----------------------------
// UI EXPORT
// -----------------------------

window.__calendarUI = {
  computeDayTimeline,
  renderTimeline,
  computeWeeklyHeatmap,
  renderWeeklyHeatmap,
  enableTimelineDrag
};
