
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
  grid.innerHTML=items.map(p=>{
   const url=p.github||(p.repo?`https://github.com/${p.repo}`:"");
   const repo=p.repo||(url?url.replace(/^https?:\/\/github\.com\//,""):"");
   if(!url){
    return `<article class="card card-static">
   <div class="eyebrow">${escapeHtml(p.type)} · ${escapeHtml(p.isa)}</div><h3>${escapeHtml(p.name)}</h3>
   <div class="metrics"><span class="metric">★ <b>${fmt(p.stars)}</b></span><span class="metric">⑂ <b>${fmt(p.forks)}</b></span><span class="metric">${escapeHtml(p.language||p.rtl||"—")}</span></div>
   <p>${escapeHtml(p.desc)}</p><div class="tags">${(p.tags||[]).map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>
   <span class="status dim">NO GITHUB LINK</span></article>`;
   }
   return `<a class="card card-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(p.name)} on GitHub">
   <div class="eyebrow">${escapeHtml(p.type)} · ${escapeHtml(p.isa)}</div><h3>${escapeHtml(p.name)}</h3>
   <div class="metrics"><span class="metric">★ <b>${fmt(p.stars)}</b></span><span class="metric">⑂ <b>${fmt(p.forks)}</b></span><span class="metric">${escapeHtml(p.language||p.rtl||"—")}</span></div>
   <p>${escapeHtml(p.desc)}</p><div class="tags">${(p.tags||[]).map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>
   ${p.updated_at?`<span class="status">ACTIVE · ${new Date(p.updated_at).toLocaleDateString()}</span>`:`<span class="status dim">CURATED</span>`}
   <span class="card-cta"><span class="card-repo">${escapeHtml(repo)}</span><span class="card-action">Open on GitHub →</span></span></a>`;
  }).join("");
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
function categoryLabel(id, cats){
 const hit=(cats||[]).find(c=>c.id===id);
 return hit?hit.label:id;
}
async function loadNewsData(){
 let data=(typeof window!=="undefined"&&window.CHIPWIRE_NEWS)||null;
 if(!data||!Array.isArray(data.items)||!data.items.length){
  data=await getJSON("data/industry-news.json");
 }
 return data||{items:[],categories:[],home_limit:12};
}
function renderNewsCard(n, cats){
 const cat=categoryLabel(n.category, cats);
 return `<a class="news-card" href="${escapeHtml(n.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(n.source)} · ${escapeHtml(cat)}</div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.summary||"")}</p><div class="story-foot">${fmtNewsDate(n.published)||"Recent"} · ${escapeHtml((n.source||"").toUpperCase())}</div></a>`;
}
async function initIndustryNews(){
 const el=document.querySelector("#industry-news"),stamp=document.querySelector("#news-updated");
 if(!el)return;
 const data=await loadNewsData();
 const items=data.items||[];
 const limit=data.home_limit||12;
 if(stamp&&data.updated_at)stamp.textContent="Updated "+fmtNewsDate(data.updated_at);
 if(!items.length){
  el.innerHTML=`<p class="news-empty">No headlines loaded yet. Run <code>python3 scripts/update_news.py</code>, then hard-refresh.</p>`;
  return;
 }
 el.innerHTML=items.slice(0,limit).map(n=>renderNewsCard(n,data.categories)).join("");
}
async function initNewsPage(){
 const grid=document.querySelector("#news-all");
 const filters=document.querySelector("#news-filters");
 const stamp=document.querySelector("#news-updated");
 const countEl=document.querySelector("#news-count");
 if(!grid||!filters)return;
 const data=await loadNewsData();
 const items=data.items||[];
 const cats=data.categories||[];
 if(stamp&&data.updated_at)stamp.textContent="Updated "+fmtNewsDate(data.updated_at);
 if(!items.length){
  filters.innerHTML="";
  grid.innerHTML=`<p class="news-empty">No headlines loaded yet. Run <code>python3 scripts/update_news.py</code>.</p>`;
  return;
 }
 const present=new Set(items.map(i=>i.category).filter(Boolean));
 const tabs=[{id:"all",label:"All"},...cats.filter(c=>present.has(c.id))];
 let active="all";
 const hash=location.hash.replace("#","");
 if(hash&&(hash==="all"||present.has(hash)))active=hash;
 function render(){
  filters.querySelectorAll("[data-cat]").forEach(btn=>{
   btn.classList.toggle("is-active",btn.dataset.cat===active);
  });
  const shown=active==="all"?items:items.filter(i=>i.category===active);
  if(countEl)countEl.textContent=shown.length+" articles";
  grid.innerHTML=shown.map(n=>renderNewsCard(n,cats)).join("");
 }
 filters.innerHTML=tabs.map(t=>`<button type="button" class="news-filter" data-cat="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`).join("");
 filters.addEventListener("click",e=>{
  const btn=e.target.closest("[data-cat]");
  if(!btn)return;
  active=btn.dataset.cat;
  history.replaceState(null,"","#"+active);
  render();
 });
 render();
}
function initChrome(){
 const header=document.querySelector("header");
 const toggle=document.querySelector(".nav-toggle");
 const page=location.pathname.split("/").pop()||"index.html";
 document.querySelectorAll("nav a").forEach(a=>{
  const href=a.getAttribute("href");
  if(href===page||(page==="index.html"&&href==="index.html"))a.classList.add("is-active");
 });
 if(toggle&&header){
  toggle.addEventListener("click",()=>{
   const open=header.classList.toggle("nav-open");
   toggle.setAttribute("aria-label",open?"Close menu":"Open menu");
  });
 }
}
if(document.querySelector("#projectGrid"))initProjects();
initTrending();
initStackCounts();
initIndustryNews();
initNewsPage();
initChrome();
