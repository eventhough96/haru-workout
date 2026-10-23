(function (root) {
  'use strict';
  const DAY = 86400000;
  function dateKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function validDate(s) { if(typeof s !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(s+'T12:00:00Z'); return Number.isFinite(+d) && d.toISOString().slice(0,10)===s; }
  function addDays(s, n) { const d = new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
  function daysBetween(a,b) { return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/DAY); }
  function emptyState() { return {version:1,plans:[],records:{},settings:{skipMode:'ask'},updatedAt:null}; }
  function activePlan(s, date) { return s.plans.find(p=>p.start<=date && (!p.end || p.end>=date)) || null; }
  function scheduled(s,date) {
    const plan=activePlan(s,date); if(!plan) return null;
    let index=daysBetween(plan.start,date);
    for(const [day,r] of Object.entries(s.records)) if(day>=plan.start && day<date && r.planId===plan.id && r.advance===false && ['done','rest','pass'].includes(r.status)) index--;
    const step=plan.steps[((index%plan.steps.length)+plan.steps.length)%plan.steps.length];
    return {...step,planId:plan.id,index};
  }
  function dayInfo(s,date) {
    const predicted=scheduled(s,date),record=s.records[date]||null;
    const planned=(record && (record.status!=='none' || record.actual) ? record.planned : null) || predicted;
    const label=record?.actual || planned?.label || '';
    return {date,planned,predicted,record,label,isRest:record?.status==='rest'||(!record?.actual && !!planned?.isRest),status:record?.status||'none'};
  }
  function applyPlan(s,plan) {
    s.plans=s.plans.filter(p=>p.start<plan.start).map(p=>({...p,end:(!p.end||p.end>=plan.start)?addDays(plan.start,-1):p.end}));
    s.plans.push(plan); s.plans.sort((a,b)=>a.start.localeCompare(b.start));
  }
  function validateState(s) {
    const fail=()=>{throw new Error('이 앱의 올바른 백업 파일이 아니에요.');};
    if(!s || s.version!==1 || !Array.isArray(s.plans) || s.plans.length>500 || !s.records || typeof s.records!=='object' || Array.isArray(s.records) || !s.settings || !['ask','hold','advance'].includes(s.settings.skipMode)) fail();
    const textOK=(v,n)=>typeof v==='string'&&v.length<=n;
    const stepOK=x=>x&&textOK(x.label,24)&&x.label.trim()&&typeof x.isRest==='boolean';
    const ids=new Set(); let lastEnd=null;
    for(const p of s.plans) {
      if(!p || !textOK(p.id,100) || ids.has(p.id) || !validDate(p.start) || (p.end!==null && (!validDate(p.end)||p.end<p.start)) || !Array.isArray(p.steps)||!p.steps.length||p.steps.length>50||!p.steps.every(stepOK))fail();
      if(ids.size && (!lastEnd || p.start<=lastEnd)) fail();
      ids.add(p.id); lastEnd=p.end;
    }
    if(Object.keys(s.records).length>37000)fail();
    for(const [date,r] of Object.entries(s.records)) {
      if(!validDate(date)||!r||!['none','done','rest','pass'].includes(r.status)||!textOK(r.actual,24)||!textOK(r.note,2000)||typeof r.advance!=='boolean'||(r.planId!==null&&!textOK(r.planId,100))||(r.planned!==null&&!stepOK(r.planned)))fail();
    }
    // Rebuild plain objects so imported extra properties never enter the application.
    return {version:1,plans:s.plans.map(p=>({id:p.id,start:p.start,end:p.end,steps:p.steps.map(x=>({label:x.label.trim(),isRest:x.isRest}))})),records:Object.fromEntries(Object.entries(s.records).map(([d,r])=>[d,{status:r.status,actual:r.actual,note:r.note,advance:r.advance,planId:r.planId,planned:r.planned?{label:r.planned.label,isRest:r.planned.isRest}:null}])),settings:{skipMode:s.settings.skipMode},updatedAt:typeof s.updatedAt==='string'?s.updatedAt:null};
  }
  const api={dateKey,validDate,addDays,daysBetween,emptyState,activePlan,scheduled,dayInfo,applyPlan,validateState};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WorkoutEngine=api;
})(typeof window==='undefined'?globalThis:window);
