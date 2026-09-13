
async function getJSON(path){try{let r=await fetch(path);return await r.json()}catch(e){return null}}
async function initProjects(){
 const projects=await getJSON("data/projects.json")||[];
 const live=await getJSON("data/github-data.json")||{};
 const grid=document.querySelector("#projectGrid"), search=document.querySelector("#search"), type=document.querySelector("#type"), sort=document.querySelector("#sort");
 const merged=projects.map(p=>({...p,...(live[p.repo]||{})}));
 function fmt(n){if(n==null)return "—";return n>=1000?(n/1000).toFixed(1).replace(".0","")+"k":String(n)}
 function render(){
  const q=search.value.toLowerCase(),t=type.value,s=sort.value;
  let items=merged.filter(p=>(!q||JSON.stringify(p).toLowerCase().includes(q))&&(!t||p.type===t));
  if(s==="stars")items.sort((a,b)=>(b.stars||0)-(a.stars||0));
  if(s==="recent")items.sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0));
  grid.innerHTML=items.map(p=>`<article class="card">
   <div class="eyebrow">${p.type} · ${p.isa}</div><h3>${p.name}</h3>
   <div class="metrics"><span class="metric">★ <b>${fmt(p.stars)}</b></span><span class="metric">⑂ <b>${fmt(p.forks)}</b></span><span class="metric">${p.language||p.rtl||"—"}</span></div>
   <p>${p.desc}</p><div class="tags">${(p.tags||[]).map(x=>`<span class="tag">${x}</span>`).join("")}</div>
   ${p.updated_at?`<span class="status">ACTIVE DATA · ${new Date(p.updated_at).toLocaleDateString()}</span>`:`<span class="status dim">CURATED</span>`}
   <a href="${p.github}" target="_blank" rel="noopener">VIEW ON GITHUB →</a></article>`).join("");
 }
 [search,type,sort].forEach(x=>x&&x.addEventListener("input",render));render();
}
const STACK_MAP={cpu:["CPU Core"],soc:["SoC Framework","Complete SoC"],ip:["SoC Framework"],verification:["Verification","Simulation"],fpga:["FPGA SoC"],asic:["ASIC","ASIC / Security"],security:["ASIC / Security"],silicon:["ASIC","FPGA SoC","Complete SoC"]};
async function initTrending(){
 const projects=await getJSON("data/projects.json")||[],live=await getJSON("data/github-data.json")||{},el=document.querySelector("#trending");
 if(!el)return;
 const items=projects.map(p=>({...p,...(live[p.repo]||{})})).filter(p=>p.stars!=null).sort((a,b)=>(b.stars||0)-(a.stars||0)).slice(0,3);
 el.innerHTML=items.map(p=>`<a class="story" href="${p.github}" target="_blank" rel="noopener"><div class="meta">${p.type} · ${p.isa}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="story-foot">★ ${p.stars.toLocaleString()} · ${p.language||p.rtl||"RTL/HDL"} · GITHUB</div></a>`).join("");
}
async function initStackCounts(){
 const projects=await getJSON("data/projects.json")||[],el=document.querySelector("#stack");
 if(!el)return;
 el.querySelectorAll("[data-stack]").forEach(a=>{
  const types=STACK_MAP[a.dataset.stack]||[];
  const n=projects.filter(p=>types.includes(p.type)).length;
  a.querySelector(".stack-count").textContent=n||"—";
 });
}
function fmtNewsDate(iso){
 if(!iso)return "";
 const d=new Date(iso);
 if(Number.isNaN(d.getTime()))return "";
 return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
async function initIndustryNews(){
 const el=document.querySelector("#industry-news"),stamp=document.querySelector("#news-updated");
 if(!el)return;
 // Prefer bundled JS (works with file://); fall back to JSON fetch on a real server.
 let data=(typeof window!=="undefined"&&window.CHIPWIRE_NEWS)||null;
 if(!data||!Array.isArray(data.items)||!data.items.length){
  data=await getJSON("data/industry-news.json");
 }
 const items=(data&&Array.isArray(data.items))?data.items:[];
 if(stamp&&data&&data.updated_at)stamp.textContent="Updated "+fmtNewsDate(data.updated_at);
 if(!items.length){
  el.innerHTML=`<p class="news-empty">No headlines loaded yet. Run <code>python3 scripts/update_news.py</code>, then hard-refresh. On the live site, push <code>data/industry-news.js</code> (or wait for Actions).</p>`;
  return;
 }
 el.innerHTML=items.slice(0,9).map(n=>`<a class="news-card" href="${escapeHtml(n.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(n.source)}</div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.summary||"")}</p><div class="story-foot">${fmtNewsDate(n.published)||"Recent"} · ${escapeHtml((n.source||"").toUpperCase())}</div></a>`).join("");
}
if(document.querySelector("#projectGrid"))initProjects();initTrending();initStackCounts();initIndustryNews();
