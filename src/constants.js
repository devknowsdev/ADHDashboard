/*
MODULE: constants.js
LAYER: constants
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: constants.js responsibilities
USES: local modules
STATE_READS: tasks
STATE_WRITES: COLOR_OPTS, DARK, DAYS, HABIT_ANCHORS, INTENTION_QUESTIONS, LIGHT, MONTHS, defaultCats
PUBLIC_API: none
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Shared app constants. Keeping these in one file makes the rest of the code
// easier to scan and reduces accidental drift between subsystems.

const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLOR_OPTS=[
  {bg:'#dbeafe',text:'#1e3a8a',dot:'#2563eb',name:'blue'},
  {bg:'#dcfce7',text:'#14532d',dot:'#16a34a',name:'green'},
  {bg:'#e0f2fe',text:'#0c4a6e',dot:'#0284c7',name:'sky'},
  {bg:'#d1fae5',text:'#064e3b',dot:'#059669',name:'emerald'},
  {bg:'#fce7f3',text:'#831843',dot:'#db2777',name:'pink'},
  {bg:'#fef9c3',text:'#713f12',dot:'#ca8a04',name:'yellow'},
  {bg:'#ffedd5',text:'#7c2d12',dot:'#ea580c',name:'orange'},
  {bg:'#ede9fe',text:'#4c1d95',dot:'#7c3aed',name:'purple'},
  {bg:'#ccfbf1',text:'#134e4a',dot:'#0d9488',name:'teal'},
  {bg:'#fee2e2',text:'#7f1d1d',dot:'#dc2626',name:'red'},
];

const LIGHT={
  bg:'#eef6f2',surface:'#ffffff',surface2:'#f2faf6',
  surface3:'#e6f2ec',       // green-family tint (was blue — audit fix #7)
  border:'#d0e8de',border2:'#a0c8b8',  // lighter graded weight (audit fix #1)
  borderBlue:'#b6ccf0',     // blue-tinted border (focus board only)
  text:'#1a3028',muted:'#3d6050',muted2:'#7a9e92',
  accent:'#1e7a56',
  accent2:'#1d5fa8',
  blue:'#dbeafe',           // soft blue fill
  pomo:'#c0442a',green:'#1a8040',
  inputBg:'#ffffff',inputText:'#1a3028',
  btnBg:'#ffffff',btnText:'#1a3028',
  // Urgency: 3 levels only — amber / orange / red (audit fix #6)
  urg1:'#f59e0b',urg2:'#f97316',urg3:'#dc2626',
};

const DARK={
  bg:'#0f1e17',surface:'#172518',surface2:'#1e3024',
  surface3:'#1a2e20',       // green-dark tint (was blue — audit fix #7)
  border:'#243d30',border2:'#3a6a52',  // graded (audit fix #1)
  borderBlue:'#1e3a5f',     // blue-tinted border (focus board only)
  text:'#e0f0e8',muted:'#90baa4',muted2:'#5a8a6e',
  accent:'#34c980',
  accent2:'#60a5fa',
  blue:'#1e3a5f',           // muted blue fill
  pomo:'#f87171',green:'#4ade80',
  inputBg:'#1e3024',inputText:'#e0f0e8',
  btnBg:'#1e3024',btnText:'#e0f0e8',
  // Urgency: 3 levels only — amber / orange / red (audit fix #6)
  urg1:'#f59e0b',urg2:'#f97316',urg3:'#ef4444',
};

const INTENTION_QUESTIONS=[
  {
    key:'arriving',
    label:'Capacity check',
    hint:'Rate your working memory / focus right now. Be honest — this sets what kind of day is realistic, not what you wish for.',
    icon:'ti-gauge',
    placeholder:'e.g. 3/5 — slept badly, can do routine tasks but not deep work. High-output day not on the cards.',
  },
  {
    key:'oneWin',
    label:'Priority lock',
    hint:'One specific task. If this is done, the day is a success regardless of everything else. Name the actual task, not a feeling.',
    icon:'ti-target',
    placeholder:'e.g. Send the revised proposal to client by 15:00',
  },
  {
    key:'derail',
    label:'If–then plan',
    hint:'Identify your most likely obstacle, then write a concrete if-then response. "If [trigger], then I will [specific action]."',
    icon:'ti-shield-check',
    placeholder:'e.g. If I get pulled into Slack, then I close it and set a 25-min timer before checking again',
  },
  {
    key:'goodEnough',
    label:'Done criteria',
    hint:'2–3 concrete, observable things that mean today was good enough. Behaviours, not feelings. Checkboxes, not aspirations.',
    icon:'ti-list-check',
    placeholder:'e.g. 1. Priority task sent. 2. Inbox at zero. 3. 30-min walk done.',
  },
];

const HABIT_ANCHORS=[
  {id:'day_start',label:'Day start',icon:'ti-sunrise',hint:'First thing'},
  {id:'morning',label:'Morning',icon:'ti-sun',hint:'Before midday'},
  {id:'after_break',label:'After break',icon:'ti-coffee',hint:'Post-break reset'},
  {id:'afternoon',label:'Afternoon',icon:'ti-sun-low',hint:'After 13:00'},
  {id:'wind_down',label:'Wind down',icon:'ti-sunset',hint:'Wrapping up'},
  {id:'day_end',label:'Day end',icon:'ti-moon',hint:'Last thing'},
];

const defaultCats=[
  {id:'work',name:'Work',color:COLOR_OPTS[0]},
  {id:'home',name:'Home',color:COLOR_OPTS[1]},
  {id:'health',name:'Health',color:COLOR_OPTS[4]},
  {id:'errand',name:'Errand',color:COLOR_OPTS[5]},
];
