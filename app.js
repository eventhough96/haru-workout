(() => {
  'use strict';
  const E=window.WorkoutEngine,$=id=>document.getElementById(id),KEY='haru-workout-v1',BACKUP_KEY='haru-workout-last-backup';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortDate=d=>`${Number(d.slice(5,7))}.${Number(d.slice(8,10))}`;
  const weekday=d=>['일','월','화','수','목','금','토'][new Date(d+'T12:00:00').getDay()];
  const statusName={done:'완료',rest:'휴식',pass:'패스',none:'미기록'};
  let state=E.emptyState(),today=E.dateKey(),month=today.slice(0,7),selectedDate=today,draft=[],dayContext=null,toastTimer,storageBroken=false;
  try {const raw=localStorage.getItem(KEY);if(raw)state=E.validateState(JSON.parse(raw));}catch(error){storageBroken=true;$('storageWarning').hidden=false;$('storageWarning').textContent='저장된 기록을 읽지 못했어요. 기존 데이터를 덮어쓰지 않도록 저장을 막았어요. 백업 파일이 있다면 설정에서 복원해주세요. 브라우저 저장 권한 문제일 수도 있어요.';}
  function toast(message){const t=$('toast');t.textContent=message;if(t.showPopover){try{t.showPopover();}catch{}}t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.classList.remove('visible');if(t.hidePopover){try{t.hidePopover();}catch{}}},3800);}
  function commit(mutator,restore=false){
    if(storageBroken&&!restore){toast('저장이 차단돼 있어요. 설정에서 백업을 복원해주세요.');return false;}
    const next=JSON.parse(JSON.stringify(state));mutator(next);next.updatedAt=new Date().toISOString();
    try{const clean=E.validateState(next);localStorage.setItem(KEY,JSON.stringify(clean));state=clean;storageBroken=false;$('storageWarning').hidden=true;render();return true;}catch(error){toast('저장하지 못했어요. 저장공간과 브라우저 권한을 확인해주세요.');return false;}
  }
  async function confirmAction(title,message,button='확인'){
    $('confirmTitle').textContent=title;$('confirmText').textContent=message;$('confirmOK').textContent=button;
    const dialog=$('confirmDialog');dialog.showModal();
    return new Promise(resolve=>{
      const finish=value=>{dialog.removeEventListener('cancel',cancel);$('confirmCancel').onclick=null;$('confirmOK').onclick=null;dialog.close();resolve(value);};
      const cancel=e=>{e.preventDefault();finish(false);};dialog.addEventListener('cancel',cancel);$('confirmCancel').onclick=()=>finish(false);$('confirmOK').onclick=()=>finish(true);
    });
  }
  function render(){
    today=E.dateKey();const info=E.dayInfo(state,today),next=E.dayInfo(state,E.addDays(today,1));
    const title=info.label || '나의 루틴을 시작해요';
    $('todayCard').innerHTML=`<div class="today-top"><span class="today-date">TODAY · ${shortDate(today)} ${weekday(today)}요일</span><span class="today-status">${info.record?.status&&info.record.status!=='none'?statusName[info.status]:info.planned?'기록 전':'루틴 미설정'}</span></div><h2>${escape(title)}</h2><div class="today-bottom"><span>${next.label?'내일은 '+escape(next.label):'나만의 순서를 만들어보세요'}</span><button class="today-link" id="todayCardAction">${info.planned||info.record?'기록하기 ↗':'루틴 만들기 ↗'}</button></div>`;
    $('todayCardAction').onclick=()=>info.planned||info.record?openDay(today):openRoutine();
    const [year,mon]=month.split('-').map(Number);$('monthTitle').textContent=`${year}년 ${mon}월`;
    $('prevMonth').disabled=month==='2000-01';$('nextMonth').disabled=month==='2099-12';
    const first=month+'-01',leading=new Date(first+'T12:00:00').getDay(),last=new Date(year,mon,0).getDate(),cells=Math.ceil((leading+last)/7)*7;
    let html='';for(let i=0;i<cells;i++){
      const d=E.addDays(first,i-leading),x=E.dayInfo(state,d),out=d.slice(0,7)!==month;
      let label=x.label||'—',marker='';
      if(x.status!=='none')marker=`<i class="dot ${x.status}" aria-hidden="true"></i>`;
      else if(d<today&&x.planned)marker='<i class="dot missing" aria-hidden="true"></i>';
      if(x.record?.note)marker+='<i class="note-dot" aria-hidden="true"></i>';
      const desc=`${d} ${label} ${x.status==='none'?(d<today&&x.planned?'미기록':'예정'):statusName[x.status]}${x.record?.note?', 메모 있음':''}`;
      html+=`<button class="calendar-day ${out?'is-out':''} ${d===today?'is-today':''}" data-date="${d}" aria-label="${escape(desc)}" ${E.validDate(d)?'':'disabled'} ${d===today?'aria-current="date"':''}><span class="day-number">${Number(d.slice(8))}</span><span class="day-label ${x.label?'':'unplanned'}" data-status="${x.status==='none'&&x.isRest?'rest':x.status}">${escape(label)}</span><span class="day-marker">${marker}</span></button>`;
    }
    $('calendar').innerHTML=html;
    const p=E.activePlan(state,today),future=state.plans.find(p=>p.start>today),displayPlan=p||future;
    if(displayPlan){$('routineSummary').innerHTML=`<div class="routine-track">${displayPlan.steps.map((s,i)=>`${i?'<span class="routine-arrow" aria-hidden="true">›</span>':''}<span class="routine-chip ${s.isRest?'rest-chip':''}">${escape(s.label)}</span>`).join('')}<span class="routine-arrow" aria-label="반복">↺</span></div><p class="routine-caption">${displayPlan.start.replaceAll('-','.')}부터 · ${displayPlan.end?displayPlan.end.replaceAll('-','.')+'까지':'계속 반복'}${p?'':' · 시작 예정'}</p>`;}
    else $('routineSummary').innerHTML='<div class="empty-routine"><p>상체, 하체, 휴식… 순서만 정해두면<br>달력이 앞으로의 운동을 챙겨줘요.</p><button class="secondary-button" id="firstRoutine">첫 루틴 만들기 ↗</button></div>';
    if($('firstRoutine'))$('firstRoutine').onclick=openRoutine;
    $('upcoming').innerHTML=Array.from({length:7},(_,i)=>{const d=E.addDays(today,i+1),x=E.dayInfo(state,d);return `<div class="upcoming-row"><span class="upcoming-date">${shortDate(d)} ${weekday(d)}</span><span class="upcoming-label">${escape(x.label||'루틴 없음')}</span><span class="upcoming-chip">${x.status==='none'?'예정':statusName[x.status]}</span><button class="upcoming-open" data-date="${d}" aria-label="${d} 기록 열기">›</button></div>`;}).join('');
    $('workoutNames').innerHTML=[...new Set(['상체','하체','팔','어깨','가슴','등','유산소','전신',...state.plans.flatMap(p=>p.steps.filter(s=>!s.isRest).map(s=>s.label))])].map(n=>`<option value="${escape(n)}"></option>`).join('');
  }
  function openDay(date){
    if(!E.validDate(date))return;selectedDate=date;const info=E.dayInfo(state,date);
    const nextPlan=E.activePlan(state,E.addDays(date,1));
    dayContext={info,originalActual:info.record?.actual||info.planned?.label||'',canShift:!!info.predicted&&nextPlan?.id===info.predicted.planId&&(!info.record?.planId||info.record.planId===info.predicted.planId)};
    $('dayForm').reset();$('dayDate').textContent=`${date.replaceAll('-','.')} ${weekday(date)}요일`;
    $('dayPlanned').textContent=info.predicted?`예정: ${info.predicted.label}${info.record?.planned&&info.record.planned.label!==info.predicted.label?' · 기록 당시 예정: '+info.record.planned.label:''}`:'정해진 루틴이 없는 날이에요. 기록은 남길 수 있어요.';
    $('actual').value=dayContext.originalActual;$('note').value=info.record?.note||'';
    document.querySelector(`#dayForm input[name=status][value=${info.status}]`).checked=true;
    let advance='advance';if(info.record)advance=info.record.advance?'advance':'hold';else if(state.settings.skipMode==='hold'&&!info.predicted?.isRest)advance='hold';
    document.querySelector(`#dayForm input[name=advance][value=${advance}]`).checked=true;
    $('clearDay').hidden=!info.record;
    $('dayEditNote').textContent=Object.keys(state.records).some(d=>d>date)?'미루기 선택을 바꾸면 이후 예정 일정이 바뀌어요. 이미 저장한 운동·상태·메모는 유지돼요.':'메모만 남겨도 저장할 수 있어요.';
    updateDayControls();$('dayDialog').showModal();
  }
  function updateDayControls(event){
    const status=document.querySelector('#dayForm input[name=status]:checked').value;
    if(event?.target.name==='status'&&status==='done'&&dayContext.info.status!=='done')document.querySelector('#dayForm input[name=advance][value=advance]').checked=true;
    $('actual').disabled=['rest','pass'].includes(status);
    const changed=$('actual').value.trim()!==(dayContext.info.planned?.label||'');
    const show=dayContext.canShift&&(status==='rest'||status==='pass'||(status==='done'&&changed));
    $('advanceField').hidden=!show;
    if(dayContext.canShift){
      const base=JSON.parse(JSON.stringify(state));delete base.records[selectedDate];
      const prediction=E.scheduled(base,selectedDate),next=E.scheduled(base,E.addDays(selectedDate,1));
      $('advanceHint').textContent=`다음 날: ${next?.label||'루틴 없음'}`;
      $('holdHint').textContent=`다음 날: ${prediction?.label||'루틴 없음'} · 이후 일정도 하루씩 밀려요`;
    }
  }
  $('dayForm').addEventListener('change',updateDayControls);$('actual').addEventListener('input',updateDayControls);
  $('dayForm').onsubmit=e=>{
    e.preventDefault();const status=document.querySelector('#dayForm input[name=status]:checked').value,info=dayContext.info,input=$('actual').value.trim();
    if(status==='done'&&!input){$('actual').focus();toast('완료한 운동 이름을 적어주세요.');return;}
    const actual=status==='rest'?'휴식':status==='pass'?'':status==='none'&&input===dayContext.originalActual?(info.record?.actual||''):input;
    const advance=$('advanceField').hidden?true:document.querySelector('#dayForm input[name=advance]:checked').value==='advance';
    const r={status,actual,note:$('note').value.trim(),advance,planId:info.record?.status!=='none'&&info.record?.planId?info.record.planId:info.predicted?.planId||null,planned:info.record?.status!=='none'&&info.record?.planned?info.record.planned:(info.predicted?{label:info.predicted.label,isRest:info.predicted.isRest}:null)};
    if(commit(s=>{if(status==='none'&&!r.note&&!r.actual)delete s.records[selectedDate];else s.records[selectedDate]=r;})){$('dayDialog').close();toast(advance?'기록을 저장했어요.':'저장했어요. 원래 운동은 다음 날로 미뤘어요.');}
  };
  $('clearDay').onclick=async()=>{
    if(!await confirmAction('이날 기록을 지울까요?','운동·상태·메모를 지워요. 이날 미뤘던 일정도 되돌아갑니다. 이후 예정 일정이 다시 계산돼요.','기록 지우기'))return;
    if(commit(s=>delete s.records[selectedDate])){$('dayDialog').close();toast('기록을 지웠어요.');}
  };
  function openRoutine(){
    const p=E.activePlan(state,today)||state.plans.find(p=>p.start>today);
    draft=p?p.steps.map(s=>({...s})):[{label:'상체',isRest:false},{label:'하체',isRest:false},{label:'휴식',isRest:true}];
    $('routineStart').value=today;$('routineEnd').value='';$('routineEnd').min=today;$('routineSkipMode').value=state.settings.skipMode;renderSteps();$('routineDialog').showModal();
  }
  function renderSteps(){
    $('stepCount').textContent=`${draft.length}일 주기`;
    $('steps').innerHTML=draft.map((s,i)=>`<div class="step-row" data-index="${i}"><span class="step-number">${i+1}</span><input type="text" maxlength="24" required value="${escape(s.label)}" aria-label="${i+1}번째 운동 이름" placeholder="운동 이름"><label class="step-rest"><input type="checkbox" ${s.isRest?'checked':''} aria-label="${i+1}번째 순서를 휴식으로 지정">휴식</label><div class="step-controls"><button type="button" data-move="-1" aria-label="${i+1}번째 순서 위로" ${i===0?'disabled':''}>↑</button><button type="button" data-move="1" aria-label="${i+1}번째 순서 아래로" ${i===draft.length-1?'disabled':''}>↓</button><button type="button" data-remove aria-label="${i+1}번째 순서 삭제" ${draft.length===1?'disabled':''}>×</button></div></div>`).join('');
    $('addStep').disabled=draft.length>=50;
  }
  $('steps').addEventListener('input',e=>{const row=e.target.closest('[data-index]');if(!row)return;const s=draft[Number(row.dataset.index)];if(e.target.type==='text'){s.label=e.target.value;if(s.label==='휴식'){s.isRest=true;row.querySelector('[type=checkbox]').checked=true;}}else if(e.target.type==='checkbox')s.isRest=e.target.checked;});
  $('steps').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const index=Number(b.closest('[data-index]').dataset.index);if(b.hasAttribute('data-remove'))draft.splice(index,1);else if(b.dataset.move){const next=index+Number(b.dataset.move);[draft[index],draft[next]]=[draft[next],draft[index]];}renderSteps();});
  $('addStep').onclick=()=>{if(draft.length<50){draft.push({label:'',isRest:false});renderSteps();$('steps').lastElementChild.querySelector('input').focus();}};
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{draft=b.dataset.preset.split(',').map(label=>({label,isRest:label==='휴식'}));renderSteps();});
  $('routineStart').onchange=()=>{$('routineEnd').min=$('routineStart').value;};
  $('routineForm').onsubmit=async e=>{
    e.preventDefault();const start=$('routineStart').value,end=$('routineEnd').value||null;
    if(!E.validDate(start)||(end&&(!E.validDate(end)||end<start))){toast('시작일과 종료일을 확인해주세요.');return;}
    if(draft.some(s=>!s.label.trim())){toast('각 순서의 운동 이름을 입력해주세요.');return;}
    const steps=draft.map(s=>({label:s.label.trim(),isRest:s.isRest})),mode=$('routineSkipMode').value;
    const any=state.plans.some(p=>!p.end||p.end>=start);
    if(any&&!await confirmAction('새 루틴을 적용할까요?',`${start}부터 이후 예정 루틴을 교체해요.${end?' '+end+' 이후는 루틴이 비워집니다.':''}\n이미 저장한 기록과 메모는 유지돼요.`, '루틴 적용'))return;
    const plan={id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,start,end,steps};
    if(commit(s=>{E.applyPlan(s,plan);s.settings.skipMode=mode;})){month=start.slice(0,7);render();$('routineDialog').close();toast('달력에 루틴을 채웠어요.');}
  };
  function openSettings(){
    $('settingsSkipMode').value=state.settings.skipMode;
    try{const t=localStorage.getItem(BACKUP_KEY);$('backupInfo').textContent=t?'마지막 백업 다운로드: '+new Date(t).toLocaleString('ko-KR'):'아직 백업을 다운로드하지 않았어요.';}catch{$('backupInfo').textContent='백업 파일을 휴대폰에 보관해주세요.';}
    $('persistBtn').hidden=!navigator.storage?.persist;$('settingsDialog').showModal();
  }
  $('settingsSkipMode').onchange=()=>{const value=$('settingsSkipMode').value;if(commit(s=>s.settings.skipMode=value))toast('기본 처리 방식을 저장했어요.');else $('settingsSkipMode').value=state.settings.skipMode;};
  $('exportBtn').onclick=()=>{
    if(storageBroken){toast('기록을 읽을 수 없어 백업을 만들지 않았어요.');return;}
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`haru-workout-backup-${E.dateKey()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    try{localStorage.setItem(BACKUP_KEY,new Date().toISOString());}catch{}$('backupInfo').textContent='백업 다운로드를 요청했어요. 파일 앱에서 저장 여부를 확인해주세요.';toast('백업 파일을 안전하게 보관해주세요.');
  };
  $('importBtn').onclick=()=>{$('importFile').value='';$('importFile').click();};
  $('importFile').onchange=async()=>{
    const file=$('importFile').files[0];if(!file)return;if(file.size>15*1024*1024){toast('백업 파일이 너무 커요. 15MB 이하 파일을 선택해주세요.');return;}
    let imported;try{imported=E.validateState(JSON.parse(await file.text()));}catch{toast('이 앱에서 만든 올바른 백업 파일인지 확인해주세요.');return;}
    const count=Object.keys(imported.records).length;
    if(!await confirmAction('백업으로 복원할까요?',`루틴 ${imported.plans.length}개, 날짜 기록 ${count}개를 가져옵니다.\n현재 이 기기의 전체 기록을 백업 내용으로 교체해요. 필요하면 먼저 현재 기록을 백업해주세요.`,'백업 복원'))return;
    if(commit(s=>{Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,imported);},true)){$('settingsDialog').close();toast('백업의 기록을 복원했어요.');}
  };
  $('persistBtn').onclick=async()=>{try{const granted=await navigator.storage.persist();$('persistInfo').textContent=granted?'저장공간 보호가 허용됐어요. 기기 변경 등에 대비한 백업은 계속 필요해요.':'브라우저가 지금은 허용하지 않았어요. 앱은 사용할 수 있어요. 백업 파일을 보관해주세요.';}catch{$('persistInfo').textContent='이 환경에서는 권한을 요청할 수 없어요. 백업 파일을 보관해주세요.';}};
  $('settingsBtn').onclick=openSettings;$('routineBtn').onclick=openRoutine;$('floatingToday').onclick=()=>openDay(E.dateKey());
  $('todayBtn').onclick=()=>{month=E.dateKey().slice(0,7);render();};
  function moveMonth(delta){const d=new Date(month+'-15T12:00:00');d.setMonth(d.getMonth()+delta);const value=E.dateKey(d).slice(0,7);if(value>='2000-01'&&value<='2099-12'){month=value;render();}}
  $('prevMonth').onclick=()=>moveMonth(-1);$('nextMonth').onclick=()=>moveMonth(1);
  $('calendar').onclick=$('upcoming').onclick=e=>{const el=e.target.closest('[data-date]');if(el)openDay(el.dataset.date);};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('dialog.sheet').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render();});
  window.addEventListener('storage',event=>{if(event.key===KEY){try{state=event.newValue?E.validateState(JSON.parse(event.newValue)):E.emptyState();storageBroken=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();toast('다른 창에서 변경한 기록을 불러왔어요.');}catch{toast('변경된 기록을 불러오지 못했어요. 새로고침해주세요.');}}});
  setInterval(()=>{if(E.dateKey()!==today)render();},30000);
  if('serviceWorker' in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  render();
})();
