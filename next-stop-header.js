(()=>{
  const body=document.getElementById('scheduleBody');
  if(!body)return;
  const style=document.createElement('style');
  style.textContent=`
    #routeNextStop{font-size:14px!important;font-weight:800!important;line-height:1.25!important;max-width:62%;}
    #routeNextStop .nextStopLabel{display:block;color:#aaa;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    #routeNextStop .nextStopMain{display:block;color:#fff;font-size:14px;font-weight:900}
    #routeNextStop .nextStopStatus{display:block;margin-top:2px;font-size:13px;font-weight:1000}
    #routeNextStop .nextStopStatus.early{color:#ffd60a}
    #routeNextStop .nextStopStatus.onTime{color:#34c759}
    #routeNextStop .nextStopStatus.late{color:#ff453a}
    .activeStopEtaBubble{display:none!important}
    #routeNavRoot .maplibregl-popup{display:none!important}
    #routeNavRoot button[style*="top: 190px"],#routeNavRoot button[style*="top:190px"]{display:none!important}
  `;
  document.head.appendChild(style);
  function rows(){return [...body.querySelectorAll('tr')].filter(r=>r.dataset.coordinate)}
  function activeRow(){const rs=rows();let idx=Number(body.dataset.gpsNextStop);if(Number.isInteger(idx)&&idx>=0&&idx<rs.length)return rs[idx];return rs.find(r=>r.classList.contains('gpsNextStop'))||rs[0]||null}
  function dataFromRow(row){if(!row)return null;const name=(row.querySelector('td:first-child')?.childNodes[0]?.textContent||row.querySelector('td:first-child')?.innerText||'').trim();const plan=(row.children[1]?.firstChild?.textContent||row.children[1]?.textContent||'').trim().match(/\b\d{1,2}:\d{2}\b/)?.[0]||'';return{name,plan}}
  function statusText(detail){const diff=Number(detail?.diffSeconds);if(!Number.isFinite(diff))return{kind:'',text:''};if(Math.abs(diff)<=30)return{kind:'onTime',text:'👍 NA CZAS'};const min=Math.max(1,Math.floor(Math.abs(diff)/60));return diff<0?{kind:'early',text:`${min} min za wcześnie`}:{kind:'late',text:`${min} min opóźnienia`}}
  function render(detail){const el=document.getElementById('routeNextStop');if(!el)return;const d=dataFromRow(activeRow());if(!d){el.textContent='';return}const s=statusText(detail);el.innerHTML=`<span class="nextStopLabel">Następny przystanek</span><span class="nextStopMain">${escapeHtml(d.name)}${d.plan?` · ${escapeHtml(d.plan)}`:''}</span>${s.text?`<span class="nextStopStatus ${s.kind}">${s.text}</span>`:''}`}
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  body.addEventListener('nav-eta-update',e=>render(e.detail));
  const observer=new MutationObserver(()=>render());observer.observe(body,{subtree:true,attributes:true,attributeFilter:['class','data-gps-next-stop']});
  setInterval(()=>{document.querySelectorAll('#routeNavRoot .maplibregl-popup,.activeStopEtaBubble').forEach(el=>el.style.display='none')},500);
  render();
})();