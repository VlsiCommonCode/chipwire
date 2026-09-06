
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
async function initTrending(){
 const projects=await getJSON("data/projects.json")||[],live=await getJSON("data/github-data.json")||{},el=document.querySelector("#trending");
 if(!el)return;
 const items=projects.map(p=>({...p,...(live[p.repo]||{})})).filter(p=>p.stars!=null).sort((a,b)=>(b.stars||0)-(a.stars||0)).slice(0,5);
 el.innerHTML=items.map((p,i)=>`<div class="story"><div class="meta">0${i+1} · ${p.type}</div><h3>${p.name}</h3><p>★ ${p.stars.toLocaleString()} stars · ${p.language||p.rtl||"RTL/HDL"} · <a href="${p.github}" target="_blank">GitHub →</a></p></div>`).join("");
}
if(document.querySelector("#projectGrid"))initProjects();initTrending();
