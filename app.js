
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
const STACK_MAP={cpu:["CPU Core"],soc:["SoC Framework","Complete SoC"],ip:["SoC Framework"],verification:["Verification","Simulation"],fpga:["FPGA SoC"],asic:["ASIC","ASIC / Security"],security:["ASIC / Security","Security"],silicon:["ASIC","FPGA SoC","Complete SoC"],chiplet:[]};
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
  const key=a.dataset.stack;
  const types=STACK_MAP[key]||[];
  let n;
  if(key==="chiplet")n=projects.filter(p=>(p.tags||[]).some(t=>/chiplet|ucie|packaging/i.test(t))).length;
  else if(key==="security")n=projects.filter(p=>types.includes(p.type)||(p.tags||[]).some(t=>/security|opentitan|cheri|root of trust/i.test(t))).length;
  else n=projects.filter(p=>types.includes(p.type)).length;
  const countEl=a.querySelector(".stack-count");
  if(countEl)countEl.textContent=n||"—";
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
 let data=(typeof window!=="undefined"&&(window.IMPEDRA_NEWS||window.CHIPWIRE_NEWS))||null;
 if(!data||!Array.isArray(data.items)||!data.items.length){
  data=await getJSON("data/industry-news.json");
 }
 return data||{items:[],categories:[],home_limit:12};
}
function channelLabel(id, channels){
 const hit=(channels||[]).find(c=>c.id===id);
 return hit?hit.label:id;
}
function renderNewsCard(n, cats, channels){
 const cat=categoryLabel(n.category, cats);
 const ch=(n.channels||[]).map(id=>channelLabel(id, channels)).filter(Boolean);
 const meta=[n.source, cat, ...ch.slice(0,2)].filter(Boolean).join(" · ");
 return `<a class="news-card" href="${escapeHtml(n.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(meta)}</div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.summary||"")}</p><div class="story-foot">${fmtNewsDate(n.published)||"Recent"} · ${escapeHtml((n.source||"").toUpperCase())}</div></a>`;
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
 el.innerHTML=items.slice(0,limit).map(n=>renderNewsCard(n,data.categories,data.channels)).join("");
}
async function initNewsPage(){
 const grid=document.querySelector("#news-all");
 const filters=document.querySelector("#news-filters");
 const channelsEl=document.querySelector("#news-channels");
 const stamp=document.querySelector("#news-updated");
 const countEl=document.querySelector("#news-count");
 if(!grid||!filters)return;
 const data=await loadNewsData();
 const items=data.items||[];
 const cats=data.categories||[];
 const channels=data.channels||[];
 if(stamp&&data.updated_at)stamp.textContent="Updated "+fmtNewsDate(data.updated_at);
 if(!items.length){
  filters.innerHTML="";
  if(channelsEl)channelsEl.innerHTML="";
  grid.innerHTML=`<p class="news-empty">No headlines loaded yet. Run <code>python3 scripts/update_news.py</code>.</p>`;
  return;
 }
 const present=new Set(items.map(i=>i.category).filter(Boolean));
 const tabs=[{id:"all",label:"All"},...cats.filter(c=>present.has(c.id))];
 const channelTabs=[{id:"all",label:"All channels"},...channels];
 let active="all";
 let channel="all";
 const hash=location.hash.replace("#","");
 if(hash&&(hash==="all"||present.has(hash)))active=hash;
 if(hash&&channels.some(c=>c.id===hash)){channel=hash;active="all";}
 function apply(){
  filters.querySelectorAll("[data-cat]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.cat===active));
  if(channelsEl)channelsEl.querySelectorAll("[data-channel]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.channel===channel));
  let shown=active==="all"?items:items.filter(i=>i.category===active);
  if(channel!=="all")shown=shown.filter(i=>(i.channels||[]).includes(channel));
  if(countEl)countEl.textContent=shown.length+" articles";
  grid.innerHTML=shown.map(n=>renderNewsCard(n,cats,channels)).join("");
 }
 filters.innerHTML=tabs.map(t=>`<button type="button" class="news-filter" data-cat="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`).join("");
 if(channelsEl){
  channelsEl.innerHTML=channelTabs.map(t=>`<button type="button" class="news-filter" data-channel="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`).join("");
  channelsEl.addEventListener("click",e=>{
   const btn=e.target.closest("[data-channel]");
   if(!btn)return;
   channel=btn.dataset.channel;
   history.replaceState(null,"","#"+(channel==="all"?active:channel));
   apply();
  });
 }
 filters.addEventListener("click",e=>{
  const btn=e.target.closest("[data-cat]");
  if(!btn)return;
  active=btn.dataset.cat;
  history.replaceState(null,"","#"+active);
  apply();
 });
 apply();
}
function fmtEventRange(start,end){
 const a=fmtNewsDate(start);
 const b=end&&end!==start?fmtNewsDate(end):"";
 return b?a+" – "+b:a;
}
async function initEventsPage(){
 const list=document.querySelector("#events-list");
 const webinars=document.querySelector("#webinar-list");
 if(!list&&!webinars)return;
 const data=await getJSON("content/events.json")||{};
 const today=new Date(); today.setHours(0,0,0,0);
 const events=(data.events||[]).slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
 if(list){
  const upcoming=events.filter(e=>new Date(e.end||e.start)>=today);
  const shown=upcoming.length?upcoming:events.slice(-6);
  list.innerHTML=shown.map(e=>`<a class="event-row" href="${escapeHtml(e.url)}" target="_blank" rel="noopener"><div class="event-when">${escapeHtml(fmtEventRange(e.start,e.end))}</div><div><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.place||"")} · ${escapeHtml((e.topics||[]).join(" · "))}</p><p>${escapeHtml(e.blurb||"")}</p></div></a>`).join("");
 }
 if(webinars){
  webinars.innerHTML=(data.webinars||[]).map(w=>`<a class="story" href="${escapeHtml(w.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(w.host||"Webinar")}${w.date?" · "+fmtNewsDate(w.date):""}</div><h3>${escapeHtml(w.name)}</h3><p>${escapeHtml(w.blurb||"")}</p><div class="story-foot">Watch →</div></a>`).join("");
 }
}
async function initHomeEvents(){
 const el=document.querySelector("#home-events");
 if(!el)return;
 const data=await getJSON("content/events.json")||{};
 const today=new Date(); today.setHours(0,0,0,0);
 const upcoming=(data.events||[]).filter(e=>new Date(e.end||e.start)>=today).sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,3);
 el.innerHTML=upcoming.map(e=>`<a class="story" href="${escapeHtml(e.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(fmtEventRange(e.start,e.end))}</div><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.place||"")} · ${escapeHtml(e.blurb||"")}</p></a>`).join("")||`<p class="news-empty">See the <a href="events.html">events calendar</a>.</p>`;
}
async function initOrgsPage(){
 const grid=document.querySelector("#org-grid");
 if(!grid)return;
 const data=await getJSON("content/orgs.json")||{};
 grid.innerHTML=(data.orgs||[]).map(o=>`<a class="card card-link" href="${escapeHtml(o.url)}" target="_blank" rel="noopener"><div class="eyebrow">${escapeHtml(o.focus)}</div><h3>${escapeHtml(o.name)}</h3><p>${escapeHtml(o.blurb)}</p><div class="tags">${(o.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}</div><span class="card-cta"><span class="card-repo">${escapeHtml((o.url||"").replace(/^https?:\/\//,""))}</span><span class="card-action">Visit →</span></span></a>`).join("");
}
async function initInterviews(){
 const el=document.querySelector("#interview-list");
 if(!el)return;
 const data=await getJSON("content/interviews.json")||{};
 el.innerHTML=(data.items||[]).map(n=>`<a class="story" href="${escapeHtml(n.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(n.source)} · ${escapeHtml(n.org||"")}</div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.takeaway)}</p><div class="story-foot">Read original →</div></a>`).join("");
}
async function initReading(){
 const el=document.querySelector("#reading-list");
 if(!el)return;
 const data=await getJSON("content/reading.json")||{};
 el.innerHTML=(data.items||[]).map(n=>`<a class="story" href="${escapeHtml(n.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(n.kind)}</div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.blurb)}</p></a>`).join("");
}
async function initMedia(){
 const el=document.querySelector("#media-list");
 if(!el)return;
 const data=await getJSON("content/media.json")||{};
 el.innerHTML=(data.items||[]).map(n=>`<a class="story" href="${escapeHtml(n.url)}" target="_blank" rel="noopener"><div class="meta">${escapeHtml(n.kind)}</div><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.blurb)}</p><div class="story-foot">Open →</div></a>`).join("");
}
const TOPIC_INDEX=[
 {title:"AXI vs TileLink",url:"topic-bus.html",blurb:"Which interconnect matches the IP you have.",hay:"axi tilelink interconnect bus noc chi"},
 {title:"RISC-V privilege modes",url:"topic-privilege.html",blurb:"M, S, and U — the Linux-capable contract.",hay:"privilege mmode smode linux mmu csr"},
 {title:"OpenLane to GDS",url:"topic-openlane.html",blurb:"The open ASIC implementation sequence.",hay:"openlane openroad asic sky130 gf180 tapeout"},
 {title:"Chiplets",url:"topic-chiplets.html",blurb:"Die-to-die as a packaging contract.",hay:"chiplet ucie 2.5d 3d hbm packaging"},
 {title:"Open silicon security",url:"topic-security.html",blurb:"OpenTitan, Caliptra, CHERI.",hay:"security opentitan cheri caliptra root of trust"},
 {title:"Verification",url:"verification.html",blurb:"ISA, RTL, and SoC validation map.",hay:"verification uvm cocotb formal spike"},
 {title:"India semiconductor",url:"india.html",blurb:"Policy, design, and manufacturing signal.",hay:"india ism meity fab"},
 {title:"Tapeouts",url:"silicon.html",blurb:"OpenMPW, Caravel, SKY130 silicon you can read.",hay:"tapeout silicon openmpw caravel"},
 {title:"Compare cores",url:"compare.html",blurb:"CPU and SoC generator tables.",hay:"compare cpu pipeline license generator"}
];
function issueUrl(title, body){
 return "https://github.com/VlsiCommonCode/chipwire/issues/new?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body);
}
async function initSiteSearch(){
 const input=document.querySelector("#site-search");
 const form=document.querySelector("#site-search-form");
 const out=document.querySelector("#search-results");
 const count=document.querySelector("#search-count");
 if(!out)return;
 const params=new URLSearchParams(location.search);
 const initial=params.get("q")||"";
 if(input&&initial)input.value=initial;
 async function run(q){
  q=(q||"").trim().toLowerCase();
  if(input)input.value=q;
  if(!q){out.innerHTML=""; if(count)count.textContent="Type a term to search projects, news, and topics."; return;}
  const projects=await getJSON("data/projects.json")||[];
  const news=await loadNewsData();
  const hits=[];
  projects.forEach(p=>{
   const hay=JSON.stringify(p).toLowerCase();
   if(hay.includes(q))hits.push({kind:"Project",title:p.name,url:p.github||"projects.html",blurb:p.desc,meta:p.type+" · "+p.isa});
  });
  (news.items||[]).forEach(n=>{
   const hay=(n.title+" "+(n.summary||"")+" "+(n.source||"")).toLowerCase();
   if(hay.includes(q))hits.push({kind:"News",title:n.title,url:n.url,blurb:n.summary||"",meta:n.source});
  });
  TOPIC_INDEX.forEach(t=>{
   const hay=(t.title+" "+t.blurb+" "+t.hay).toLowerCase();
   if(hay.includes(q))hits.push({kind:"Topic",title:t.title,url:t.url,blurb:t.blurb,meta:"Concept"});
  });
  if(count)count.textContent=hits.length+" matches for “"+q+"”";
  out.innerHTML=hits.slice(0,40).map(h=>`<a class="story" href="${escapeHtml(h.url)}" ${h.url.startsWith("http")?'target="_blank" rel="noopener"':""}><div class="meta">${escapeHtml(h.kind)} · ${escapeHtml(h.meta||"")}</div><h3>${escapeHtml(h.title)}</h3><p>${escapeHtml(h.blurb||"")}</p></a>`).join("")||`<p class="news-empty">No matches.</p>`;
 }
 if(form)form.addEventListener("submit",e=>{e.preventDefault(); const q=input?input.value:""; history.replaceState(null,"","search.html?q="+encodeURIComponent(q)); run(q);});
 run(initial);
}
async function initIndiaPage(){
 const newsEl=document.querySelector("#india-news");
 const orgEl=document.querySelector("#india-orgs");
 if(!newsEl&&!orgEl)return;
 if(newsEl){
  const data=await loadNewsData();
  let items=(data.items||[]).filter(n=>n.category==="india");
  if(!items.length)items=(data.items||[]).filter(n=>/india|ism|meity|semicon india/i.test((n.title||"")+" "+(n.summary||"")));
  newsEl.innerHTML=items.slice(0,9).map(n=>renderNewsCard(n,data.categories,data.channels)).join("")||`<p class="news-empty">India headlines appear after the next news refresh.</p>`;
 }
 if(orgEl){
  const data=await getJSON("content/orgs.json")||{};
  const orgs=(data.orgs||[]).filter(o=>/india|ism/i.test(o.focus+" "+(o.tags||[]).join(" ")+" "+o.name));
  orgEl.innerHTML=orgs.map(o=>`<a class="card card-link" href="${escapeHtml(o.url)}" target="_blank" rel="noopener"><div class="eyebrow">${escapeHtml(o.focus)}</div><h3>${escapeHtml(o.name)}</h3><p>${escapeHtml(o.blurb)}</p><span class="card-cta"><span class="card-action">Visit →</span></span></a>`).join("");
 }
}
async function initTapeouts(){
 const el=document.querySelector("#tapeout-grid");
 if(!el)return;
 const data=await getJSON("content/tapeouts.json")||{};
 el.innerHTML=(data.items||[]).map(t=>`<a class="card card-link" href="${escapeHtml(t.url)}" target="_blank" rel="noopener"><div class="eyebrow">${escapeHtml(t.program)} · ${escapeHtml(t.year)}</div><h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.blurb)}</p><div class="tags"><span class="tag">${escapeHtml(t.node)}</span></div><span class="card-cta"><span class="card-action">Open notes →</span></span></a>`).join("");
}
async function initCompare(){
 const cpu=document.querySelector("#cpu-compare");
 const soc=document.querySelector("#soc-compare");
 if(!cpu&&!soc)return;
 const data=await getJSON("content/compare.json")||{};
 if(cpu){
  cpu.innerHTML=`<thead><tr><th>Core</th><th>ISA</th><th>Pipeline</th><th>Bus</th><th>RTL</th><th>Linux</th><th>License</th></tr></thead><tbody>${(data.cpus||[]).map(r=>`<tr><td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></td><td>${escapeHtml(r.isa)}</td><td>${escapeHtml(r.pipeline)}</td><td>${escapeHtml(r.bus)}</td><td>${escapeHtml(r.rtl)}</td><td>${escapeHtml(r.linux)}</td><td>${escapeHtml(r.license)}</td></tr>`).join("")}</tbody>`;
 }
 if(soc){
  soc.innerHTML=`<thead><tr><th>Framework</th><th>Language</th><th>Bus</th><th>Cores</th><th>Target</th></tr></thead><tbody>${(data.socs||[]).map(r=>`<tr><td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></td><td>${escapeHtml(r.lang)}</td><td>${escapeHtml(r.bus)}</td><td>${escapeHtml(r.cores)}</td><td>${escapeHtml(r.target)}</td></tr>`).join("")}</tbody>`;
 }
}
function initAskForm(){
 const form=document.querySelector("#ask-form");
 if(!form)return;
 form.addEventListener("submit",e=>{
  e.preventDefault();
  const name=(form.name.value||"anonymous").trim();
  const question=form.question.value.trim();
  const title="Ask: "+question.slice(0,70);
  const body="From: "+name+"\n\n"+question+"\n";
  window.open(issueUrl(title, body),"_blank","noopener");
 });
}
function initDigestForm(){
 const form=document.querySelector("#digest-form");
 if(!form)return;
 form.addEventListener("submit",e=>{
  e.preventDefault();
  const email=form.email.value.trim();
  if(!email)return;
  window.open(issueUrl("Digest signup","Please add this address to the impedra.ai weekly digest.\n\n"+email+"\n"),"_blank","noopener");
  const status=document.querySelector("#digest-status");
  if(status){status.hidden=false; status.textContent="GitHub issue window opened — submit it while signed in to finish the request.";}
 });
}
if(document.querySelector("#projectGrid"))initProjects();
initTrending();
initStackCounts();
initIndustryNews();
initNewsPage();
initEventsPage();
initHomeEvents();
initOrgsPage();
initInterviews();
initReading();
initMedia();
initSiteSearch();
initIndiaPage();
initTapeouts();
initCompare();
initAskForm();
initDigestForm();
