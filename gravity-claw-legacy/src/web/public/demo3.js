// ═══════════════════════════════════════════════
// AIRBNB AGENT CATALOGUE
// ═══════════════════════════════════════════════
const AIRBNB_AGENTS = [
  { id:'data-analyst', name:'Zara Obi', role:'Web Researcher · Data Analyst',
    avatar:'avatars/data-analyst.png', color:'#06b6d4',
    tags:['Apify','Firecrawl','Scraping'],
    greeting:'On it — connecting Apify residential proxy to extract all listing photos, price, and metadata.',
    rounds:[
      { work:['Routing via Apify residential proxy…','Bypassing Airbnb WAF…','Extracting listing metadata ✓','Found 12 photos · £142/night · 4.8★','Downloading high-res photo URLs… ✓'],
        out:'12 photos extracted. £142/night, 4.8★, 96 reviews. Handing to Retoucher + IEO Scorer.' },
    ],
    amends:['Re-scrape: client updated listing URL.'],
    thinking:['Airbnb uses Cloudflare WAF — residential proxy essential…','Apify Actor dtrungtin/airbnb-scraper is maintained for this…','Extract all CDN photo URLs in full resolution…'],
    trad:'$120/hr', ai:'$0.02Sc',
    outputs:[
      {type:'code', label:'listing-data.json', preview:'{\n  "title": "Bright Studio near Hyde Park",\n  "pricePerNight": 142,\n  "rating": 4.8,\n  "photos": 12\n}'},
      {type:'doc', label:'scrape-report.md', preview:'## Scrape Summary\n- Tool: Apify residential\n- Cost: $0.22\n- Photos: 12\n- Baseline IEO: 61/100'}
    ]
  },
  { id:'retoucher', name:'Jin Sato', role:'Photo Retoucher',
    avatar:'avatars/retoucher.png', color:'#f97316',
    tags:['Topaz','Autoenhance','Imagen'],
    trad:'$140/hr', ai:'$0.05Sc',
    greeting:'Received 12 photos. Autoenhance for colour + perspective first, then Topaz 4× on hero shots.',
    rounds:[
      { work:['Autoenhance: HDR merge + sky pull…','Colour correction + white balance ✓','Perspective / vertical alignment ✓','Window pull (interior ↔ exterior) ✓','Topaz 4× upscale on hero shots…','Topaz denoise + sharpen ✓','Imagen: warm golden-hour tones…','12/12 photos enhanced ✓'],
        out:'All 12 photos enhanced. Topaz 4× on hero, Autoenhance colour/perspective, Imagen warmth.' },
      { work:['IEO flagged: bedroom 58pts','Topaz object removal (clutter)…','Imagen re-stage: softer lighting ✓','Bedroom: 58 → 87pts ✓'],
        out:'Bedroom revised per IEO feedback. All photos now 80+ pts.' },
    ],
    amends:['Bedroom below 80pts — Topaz object removal + Imagen restage.'],
    thinking:['Autoenhance cheapest for colour + perspective…','Hero shot: Topaz 4× worth the $0.08…','Topaz object removal only for IEO-flagged shots…'],
    outputs:[
      {type:'image', label:'hero-enhanced.jpg', preview:'[Topaz 4× · Autoenhance · Imagen warm]\nResolution: 3840×2160\nSharpness: +42% · Noise: -78%\nCost: $0.11'},
      {type:'doc', label:'retouch-log.json', preview:'{\n  "photosProcessed": 12,\n  "totalCost": "$0.87",\n  "avgScoreBefore": 61,\n  "avgScoreAfter": 84\n}'}
    ]
  },
  { id:'ieo-scorer', name:'Priya Mehta', role:'IEO · AEO Specialist',
    avatar:'avatars/ieo-scorer.png', color:'#8b5cf6',
    tags:['Scoring','AEO','Airbnb Algo'],
    trad:'$160/hr', ai:'$0.01Sc',
    greeting:'Scoring all 12 photos across 7 dimensions. Flagging anything below 80pts for Retoucher revision.',
    rounds:[
      { work:['Gemini Vision scoring…','Lighting:   14/20','Staging:    13/20','Cleanliness:10/15','Alignment:   9/15','Sharpness:   8/15','Colour:      6/10','AEO:         3/5 ','━━━━━━━━━━━━━━━','Overall: 63/100','Flagged: bedroom (58) · kitchen (61)'],
        out:'Pre-retouch: 63/100. 2 photos flagged for revision.' },
      { work:['Re-scoring post-retouch…','Bedroom: 58 → 87 ✓','Kitchen: 61 → 83 ✓','Overall: 63 → 84/100','Tier: PRO ✓','Projected rate: £142 → £173/night','AEO score: 84 · Algo boost: HIGH ✓'],
        out:'POST-retouch: 84/100 PRO tier. £173/night projected (+22%). AEO: 84.' },
    ],
    amends:['Re-score after Retoucher revises bedroom + kitchen.'],
    thinking:['Cover photo weighted 3× by Airbnb algo…','90+ score = Guest Favourite badge eligibility…','Revenue tiers: Base$14.99 · Pro$24.99 · Elite$44.99…'],
    outputs:[
      {type:'doc', label:'ieo-report.json', preview:'{\n  "overallScore": 84,\n  "tier": "PRO",\n  "servicePrice": "$24.99",\n  "projectedRate": "£173/night",\n  "aeoScore": 84\n}'},
      {type:'doc', label:'photo-scores.md', preview:'| Photo | Before | After |\n|---|---|---|\n| Hero | 71 | 91 ✓ |\n| Bedroom | 58 | 87 ✓ |\n| Kitchen | 61 | 83 ✓ |\n| Bathroom | 68 | 82 ✓ |'}
    ]
  },
];

// Brief-type routing
const BRIEF_PROFILES = {
  airbnb: {
    test: /airbnb|listing|property|short.?let|bnb|rental photo/i,
    agents: ()=>AIRBNB_AGENTS,
    smGreeting: 'Welcome! I see you want to enhance your Airbnb listing. I\'ll recruit our Data Analyst, Retoucher, and IEO Scorer to boost your ranking and nightly rate.',
    deliverables: ['🖼 12-enhanced-photos.zip','📊 ieo-pro-report.pdf','📈 revenue-uplift-calc.xlsx'],
    billingEstimate:[
      'Analysing brief…','',
      'Scraping (Apify):       $0.22',
      'Vertex AI Retouch:      $0.02–$0.08/pic',
      'SIO Scoring (Gemini):   $0.004/pic',
      'Max 3 QA rounds:        ~$0.07/pic',
      '─────────────────────────────',
      'TOTAL AIA cost:         ~$0.30/pilot',
      'vs Pro Photographer:   $600',
      'vs Freelance Retoucher: $140',
      '',
      '↓ Select tier below to proceed ↓',
    ],
  },
  website:{
    test:/website|saas|landing|marketing|frontend|backend/i,
    agents:()=>AGENTS,
    smGreeting: 'Welcome! This looks like a full-stack marketing website project. I\'ll assemble a team of 5 specialists to handle the UI, UX, Backend, and Copy.',
    deliverables: ['💻 landing-page.zip','🎨 brand-identity-v2.fig','🗂 ux-flows-18-screens.zip','⚙️ api-schema.json','✍️ copywriting-suite.md'],
    billingEstimate:[
      'Frontend:    $0.09','UX:          $0.07','Design:      $0.08',
      'Backend:     $0.10','Copywriting: $0.05','──────────────────',
      'TOTAL:       $0.39','vs Agency:   $420','vs Freelance:$175',
    ],
  },
};

// ═══════════════════════════════════════════════
// CORE DATA
// ═══════════════════════════════════════════════
const CLIENT = {
  id:'client', name:'The Dough House', role:'Client · B2B SaaS Website', avatar:'avatars/client.png',
  brief:`Build us a marketing website.\n\nTarget: Founders + CTOs at early-stage startups.\nDeliverables: Landing page, brand identity, backend API, UX flows, copywriting. Dark-mode first.`
};
const SM = { id:'sm', name:'Alex Okafor', role:'Studio Manager', avatar:'avatars/sm.png' };
const BILLING = { id:'billing', name:'Elena Thorne', role:'Accounts & Billing', avatar:'avatars/billing.png' };


const AGENTS = [
  { id:'frontend', name:'Sam Kim', role:'Frontend Dev', avatar:'avatars/frontend.png', color:'#06b6d4',
    tags:['Next.js','React','CSS'], trad:'$130/hr', ai:'$0.01/tok',
    greeting:'Got the brief! Should we use App Router or Pages Router for Next.js 14?',
    rounds:[
      { work:['Scaffolding Next.js 14 + TS…','Installing Tailwind + Shadcn…','Hero section built →','Mobile nav complete ✓'], out:'Landing page scaffold + hero section complete.' },
      { work:['Adding skeleton loaders…','Fixing CLS issues…','Lighthouse 94 ✓'], out:'Performance pass complete. Skeletons + Lighthouse green.' },
    ],
    amends:['Add skeleton loaders + fix Lighthouse CLS score.'],
    thinking:['Checking SSR vs SSG for landing…','Hero needs animated gradient via framer-motion…','Mobile breakpoint 768px standard should work…'],
    outputs:[ {type:'code', label:'landing-page.tsx', preview:'export default function Home() {\n  return <main className="dark">\n    <HeroSection />\n    <Features />\n    <Pricing />\n  </main>;\n}'},
              {type:'code', label:'tailwind.config.js', preview:"module.exports = {\n  darkMode: 'class',\n  content: ['./src/**/*.tsx'],\n  theme: { extend: { colors: { brand: '#6466f1' } } }\n}"}]
  },
  { id:'ux', name:'Leo Bouchard', role:'UX Lead', avatar:'avatars/ux.png', color:'#f59e0b',
    tags:['Flows','Figma','Research'], trad:'$120/hr', ai:'$0.01/tok',
    greeting:'Starting with discovery → conversion flow. Any specific pain-point to focus on?',
    rounds:[
      { work:['Mapping discovery journey…','Core 3-step sign-up flow ✓','Wireframes: Homepage, Pricing ✓'], out:'Core flow + wireframes (3 screens) done.' },
      { work:['Empty-state screens (6) added…','Onboarding extended to 5 steps ✓'], out:'Extended onboarding + empty-state library.' },
    ],
    amends:['Add empty-state wireframes + extend onboarding to 5 steps.'],
    thinking:['Discovery to conversion: 3 clicks max…','Notion does onboarding really well — study it…','Empty states always forgotten, document them now…'],
    outputs:[ {type:'figma', label:'ux-flows-v1.fig', preview:'Homepage → Pricing → Sign-up (3 screens)\nOnboarding wizard (5 steps)\nEmpty states x6'},
              {type:'doc', label:'ux-research.md', preview:'# UX Research Notes\n\n**Primary persona**: Technical founder, time-poor, scans not reads.\n**Drop-off**: 70% at pricing page — needs social proof above fold.'}]
  },
  { id:'designer', name:'Mira Osei', role:'Visual Designer', avatar:'avatars/designer.png', color:'#ec4899',
    tags:['Brand','Figma','Motion'], trad:'$150/hr', ai:'$0.01/tok',
    greeting:'Love this brief. Going dark-mode-first, Indigo + Slate — good pairing for SaaS?',
    rounds:[
      { work:['Brand direction: dark-first ✓','Logo v1: geometric wordmark ✓','Colour + token system ✓'], out:'Brand v1 — geometric logo + colour tokens.' },
      { work:['Logo v2: clean monochrome ✓','Favicon + OG image done ✓'], out:'Brand v2 — minimal monochrome, all assets.' },
    ],
    amends:['Simplify logo — remove gradient, clean monochrome wordmark only.'],
    thinking:['Geometric wordmark too complex for favicon…','Monochrome first, colour as accent…','Token naming: semantic names not colour values…'],
    outputs:[ {type:'image', label:'logo-v2.svg', preview:'[SVG Wordmark — Monochrome]\nFont: Inter 700 | Colour: #EEEEF8\nFavicon: 32×32 geometric mark'},
              {type:'doc', label:'brand-tokens.json', preview:'{\n  "color-brand": "#6466f1",\n  "color-surface": "#111119",\n  "font-heading": "Inter 700",\n  "radius-card": "13px"\n}'}]
  },
  { id:'backend', name:'Priya Sharma', role:'Backend Dev', avatar:'avatars/backend.png', color:'#8b5cf6',
    tags:['Node','Postgres','API'], trad:'$140/hr', ai:'$0.01/tok',
    greeting:'On it. Prisma or Drizzle for the ORM? I lean Prisma for type safety.',
    rounds:[
      { work:['Express + Prisma scaffolded ✓','Auth: JWT + refresh rotation ✓','Stripe checkout wired ✓','18 endpoints passing ✓'], out:'Full API: auth, payments, 18 endpoints.' },
    ],
    amends:[],
    thinking:['JWT refresh rotation safer than single token…','Rate limiting per-IP + per-user separately…','Stripe webhook needs idempotency key…'],
    outputs:[ {type:'code', label:'api-schema.json', preview:'{\n  "version": "1.0",\n  "endpoints": 18,\n  "auth": "JWT+Refresh",\n  "payments": "Stripe Checkout",\n  "db": "Postgres/Prisma"\n}'},
              {type:'doc', label:'api-docs.md', preview:'# API Reference\n\n## Auth\n`POST /auth/login` — Returns JWT + refresh token\n`POST /auth/refresh` — Rotates refresh token\n\n## Payments\n`POST /payments/checkout` — Creates Stripe session'}]
  },
  { id:'copy', name:'Tom Rivera', role:'Copywriter', avatar:'avatars/copy.png', color:'#10b981',
    tags:['SEO','Brand Voice','UX'], trad:'$95/hr', ai:'$0.01/tok',
    greeting:'Brand voice: confident, direct, founder-friendly. Utility hook as the opener?',
    rounds:[
      { work:['Hero: "Where great software starts" ✓','6 feature headlines ✓','Pricing copy ✓'], out:'Full copy suite — hero, features, pricing.' },
      { work:['New hero: "Built for founders who ship fast." ✓','Microcopy revised ✓'], out:'v2 copy — founder-focused hero + revised CTAs.' },
    ],
    amends:['Hero too generic — rewrite targeting B2B SaaS founders specifically.'],
    thinking:['Generic hero kills conversion — specificity wins…','Target persona: technical, time-poor founder…','Utility over cleverness — they scan, not read…'],
    outputs:[ {type:'doc', label:'copywriting-suite.md', preview:'# Hero\n"Built for founders who ship fast."\n\n# Sub-headline\n"Your entire marketing stack, AI-powered, live in 48 hours."\n\n# CTA\n"Start free — no card needed"'},
              {type:'doc', label:'seo-metadata.json', preview:'{\n  "title": "YourBrand — AI-Powered SaaS Marketing",\n  "description": "Full-stack marketing websites for B2B SaaS. From landing page to brand system in 48h.",\n  "keywords": ["SaaS", "marketing website", "B2B"]\n}'}]
  },
];

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let elements={}, noodles={}, noodleConvos={};
let costTimers={}, nodeCosts={}, billingLedger={};
let totalCost=0;
let billingApproveCallback=null;
let dragging=null;
let activeChatId=null; // Which agent the chat panel is showing
let selectedTier='pro'; // Default tier
const CARD_W=212;

// Tier configuration matching backend
const TIERS = {
  basic: { price: '$14.99', sio: '70+', label: 'Basic', color: '#94a3b8',
    features: ['Auto-enhance', 'Lens correction', 'Basic declutter'] },
  pro:   { price: '$24.99', sio: '80+', label: 'Pro', color: '#6466f1',
    features: ['+ Colour grading', 'Staging cleanup', 'Vertical alignment', 'Reframing'] },
  elite: { price: '$44.99', sio: '90+', label: 'Elite', color: '#f59e0b',
    features: ['+ Editorial reframing', 'Multi-round QA', 'Premium grade'] },
  ultra: { price: '$79.99', sio: '95+', label: 'Ultra', color: '#ec4899',
    features: ['+ Reference grading', 'AD/Cereal standard', 'Manual review'] },
};

// ═══════════════════════════════════════════════
// SVG HELPERS
// ═══════════════════════════════════════════════
function svgEl(tag, attrs={}) {
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
  return el;
}

function getAnchorXY(id) {
  const el=elements[id]; if(!el) return {x:0,y:0};
  const x=parseFloat(el.style.left)||0, y=parseFloat(el.style.top)||0;
  // Anchor is at the top-centre of each card, slightly below the avatar dot
  return {x: x + el.offsetWidth/2, y: y + 60};
}

function bezierD(x1,y1,x2,y2){
  const cy=(y1+y2)/2;
  return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
}
function horizD(x1,y1,x2,y2){
  const cx=(x1+x2)/2;
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

function addNoodle(from, to, horiz=false) {
  const key=`${from}-${to}`;
  const svg=document.getElementById('svgLayer'); if(!svg) return;
  const base=svgEl('path',{class:'noodle-base'});
  const hl=svgEl('path',{class:'noodle-hl'});
  const hit=svgEl('path',{stroke:'transparent','stroke-width':'24',fill:'none',cursor:'pointer'});
  hit.style.pointerEvents='stroke';
  hit.addEventListener('click', ()=>openNoodleConvo(from,to));
  svg.insertBefore(base,svg.firstChild);
  svg.appendChild(hl);
  svg.appendChild(hit);
  noodles[key]={base,hl,hit,horiz};
  updateNoodle(from,to);
}

function updateNoodle(from,to) {
  const key=`${from}-${to}`, n=noodles[key]; if(!n) return;
  const a=getAnchorXY(from), b=getAnchorXY(to);
  const d=n.horiz ? horizD(a.x,a.y,b.x,b.y) : bezierD(a.x,a.y,b.x,b.y);
  [n.base,n.hl,n.hit].forEach(p=>p.setAttribute('d',d));
}

function updateAllNoodles() {
  updateNoodle('client','sm');
  updateNoodle('sm','billing');
  currentAgents.forEach(a=>updateNoodle('sm',a.id));
}

function flashNoodle(from, to, color, dur=600) {
  const key=`${from}-${to}`, kR=`${to}-${from}`;
  const n=noodles[key]||noodles[kR]; if(!n) return;
  n.hl.setAttribute('stroke',color);
  n.hl.style.opacity='0.6';
  setTimeout(()=>n.hl.style.opacity='0', dur);
}

// ═══════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════
let currentAgents = AGENTS; // Defaults to website team
let activeProfile = BRIEF_PROFILES.website;

function calcLayout() {
  const canvas=document.getElementById('canvas');
  const W=canvas.offsetWidth || window.innerWidth;
  const cx=W/2;
  const t0y=40;
  const t1y=t0y+260+80; // More gap between tiers
  const t2y=t1y+180+110;
  const clX=cx-134, smX=cx-210, bmX=cx+50; // Widen SM/Billing gap
  const totalAW=currentAgents.length*(CARD_W+32)-32;
  const agX=cx-totalAW/2;
  return {clX,smX,bmX,agX,t0y,t1y,t2y};
}

function fitToScreen(animated=true) {
  const nodeLayer=document.getElementById('nodeLayer');
  const svgLayer=document.getElementById('svgLayer');
  const nodes=Array.from(nodeLayer.querySelectorAll('.node.visible'));
  if(!nodes.length) return;
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  nodes.forEach(el=>{
    const x=parseFloat(el.style.left)||0, y=parseFloat(el.style.top)||0;
    const w=el.offsetWidth||220, h=el.offsetHeight||180;
    minX=Math.min(minX,x); minY=Math.min(minY,y);
    maxX=Math.max(maxX,x+w); maxY=Math.max(maxY,y+h);
  });
  const pad=60;
  const bannerH=120; // Reserve space for approval banner
  const canvas=document.getElementById('canvas');
  const cw=canvas.offsetWidth||window.innerWidth, ch=(canvas.offsetHeight||window.innerHeight) - bannerH;
  
  let scale=Math.min(1.0, Math.min(cw/((maxX-minX)+pad*2), ch/((maxY-minY)+pad*2)));
  if(scale < 0.4) scale = 0.4; // Don't shrink too much
  
  const tx=(cw-((maxX-minX)+pad*2)*scale)/2-(minX-pad)*scale;
  const ty=(ch-((maxY-minY)+pad*2)*scale)/2-(minY-pad)*scale;
  const tr=`translate(${tx}px,${ty}px) scale(${scale})`;
  const dur=animated?'transform 0.6s cubic-bezier(.4,0,.2,1)':'none';
  nodeLayer.style.transition=dur; svgLayer.style.transition=dur;
  nodeLayer.style.transform=tr; svgLayer.style.transform=tr;
}
function fitRetry(count=5, delay=80) {
  // Retry fitToScreen several times so late-spawning cards are always captured
  for(let i=0;i<count;i++) setTimeout(()=>fitToScreen(i>0), delay*(i+1));
}

// ═══════════════════════════════════════════════
// DRAG
// ═══════════════════════════════════════════════
function makeDraggable(el, id) {
  el.addEventListener('mousedown', e=>{
    const tag=e.target.tagName;
    if(['BUTTON','INPUT','TEXTAREA'].includes(tag)) return;
    if(e.target.closest('.agent-chat-area,.chat-area')) return;
    dragging={
      el, id,
      sx: parseFloat(el.style.left)||0,
      sy: parseFloat(el.style.top)||0,
      mx: e.clientX, my: e.clientY
    };
    el.style.zIndex='200';
    el.style.transition='none';
    e.preventDefault();
  });
}
document.addEventListener('mousemove', e=>{
  if(!dragging) return;
  const nl=document.getElementById('nodeLayer');
  const m=new DOMMatrix(window.getComputedStyle(nl).transform);
  const scale=m.a||1;
  dragging.el.style.left=(dragging.sx+(e.clientX-dragging.mx)/scale)+'px';
  dragging.el.style.top=(dragging.sy+(e.clientY-dragging.my)/scale)+'px';
  updateAllNoodles();
});
document.addEventListener('mouseup', ()=>{
  if(dragging){ dragging.el.style.zIndex=''; dragging.el.style.transition=''; dragging=null; }
});

// ═══════════════════════════════════════════════
// SPAWN NODES
// ═══════════════════════════════════════════════
function spawnNode(id, el, x, y) {
  el.style.cssText+=`;position:absolute;left:${x}px;top:${y}px;opacity:0;`;
  document.getElementById('nodeLayer').appendChild(el);
  elements[id]=el;
  makeDraggable(el,id);
  requestAnimationFrame(()=>{
    el.classList.add('visible');
    updateAllNoodles();
    fitRetry();
  });
}

function avatarHtml(src, fb) {
  return `<div class="avatar-wrap"><div class="anchor"></div>
    <div class="avatar">
      <img src="${src}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="avatar-fallback" style="display:none">${fb}</div>
    </div>
  </div>`;
}

function spawnClient(x,y) {
  const el=document.createElement('div');
  el.className='node client-card s-new';
  el.innerHTML=`${avatarHtml(CLIENT.avatar,'👤')}
    <div class="cc-name">${CLIENT.name}</div>
    <div class="cc-role">${CLIENT.role}</div>
    <div class="cc-brief" id="brief-client">Submitting brief…</div>
    <div class="cc-status"><div class="sd" id="dot-client"></div>&nbsp;<span id="status-client">Waiting…</span></div>
    <div id="files-client"></div>
    <div class="chat-area" id="chat-area-client">
      <textarea class="card-input" id="input-client" placeholder="Message client…" rows="1"></textarea>
      <button class="card-send" onclick="sendCardMsg('client')">↑</button>
    </div>`;
  spawnNode('client',el,x,y);
}

function spawnSM(x,y) {
  const el=document.createElement('div');
  el.className='node sm-card s-new';
  el.innerHTML=`${avatarHtml(SM.avatar,'⬡')}
    <div class="sm-name">${SM.name}</div>
    <div class="sm-role">${SM.role}</div>
    <div class="sm-log" id="log-sm">Standby…</div>
    <div class="sm-status"><div class="sd" id="dot-sm"></div>&nbsp;<span id="status-sm">Idle</span></div>
    <div class="cost-bubble" id="cost-sm">£0.0000</div>
    <div class="chat-area" id="chat-area-sm">
      <textarea class="card-input" id="input-sm" placeholder="Message Alex…" rows="1"></textarea>
      <button class="card-send" onclick="sendCardMsg('sm')">↑</button>
    </div>`;
  spawnNode('sm',el,x,y);
}

function spawnBilling(x,y) {
  const el=document.createElement('div');
  el.className='node billing-card s-new';
  el.innerHTML=`${avatarHtml(BILLING.avatar,'💰')}
    <div class="billing-name">${BILLING.name}</div>
    <div class="billing-role">${BILLING.role}</div>
    <div class="billing-log" id="log-billing">Analysing scope…</div>
    <div class="approve-wrap" id="approve-wrap">
      <button class="approve-btn" onclick="doApprove()">✓ Approve Budget</button>
      <button class="reject-btn" onclick="doReject()">✕ Revise</button>
    </div>
    <div class="cost-bubble" id="cost-billing">£0.0000</div>
    <div class="sd" id="dot-billing" style="margin-top:6px"></div>`;
  el.addEventListener('click', e=>{ if(!e.target.closest('button')) openLedger(); });
  spawnNode('billing',el,x,y);
}

function spawnAgent(a, x, y) {
  const el=document.createElement('div');
  el.className='node agent-card s-new';
  el.innerHTML=`${avatarHtml(a.avatar, a.name[0])}
    <div class="ag-name" style="color:${a.color}">${a.name}</div>
    <div class="ag-role">${a.role}</div>
    <div class="ag-rates">
      <span class="ag-rate-trad">${a.trad}</span>&nbsp;
      <span class="ag-rate-ai">${a.ai}</span>
    </div>
    <div class="ag-status-row">
      <div class="ag-dot" id="dot-${a.id}"></div>
      <div class="ag-status-txt" id="status-${a.id}">Standby</div>
    </div>
    <div class="ag-log" id="log-${a.id}">Waiting for brief…</div>
    <div class="ag-tags">${a.tags.map(t=>`<span class="ag-tag">${t}</span>`).join('')}</div>
    <div class="cost-bubble" id="cost-${a.id}">£0.0000</div>
    <div class="agent-chat-area">
      <textarea class="card-input" id="input-${a.id}" placeholder="Ask ${a.name}…" rows="1"></textarea>
      <button class="card-send" onclick="sendCardMsg('${a.id}')">↑</button>
    </div>
    <div class="desk-hint" onclick="openDesk('${a.id}')">🗂 View desk & outputs</div>
    <div id="attachment-${a.id}" class="card-attachment" style="display:none"></div>`;
  spawnNode(a.id,el,x,y);
  // After spawning, show greeting message after a brief delay
  setTimeout(()=>{
    recordMsg(a.id,'sm','agent', a.greeting);
  }, 500);
}

// ═══════════════════════════════════════════════
// STATE HELPERS
// ═══════════════════════════════════════════════
function setState(id, state) {
  const el=elements[id]; if(!el) return;
  const s=state.startsWith('s-')?state:`s-${state}`;
  el.classList.remove('s-new','s-reviewed','s-working','s-amend','s-waiting','s-done','s-approve');
  el.classList.add(s);
}
const setLog=(id,t)=>{const e=document.getElementById(`log-${id}`); if(e)e.textContent=t;};
const setStatus=(id,t)=>{const e=document.getElementById(`status-${id}`); if(e)e.textContent=t;};
const setGlobal=(t,c)=>{
  const gs=document.getElementById('globalStatus'), gd=document.getElementById('globDot');
  const pl=document.getElementById('phaseLabel');
  if(gs)gs.textContent=t; if(gd)gd.style.background=c; if(pl)pl.textContent=t;
};

function typeLog(id, lines, speed=20, onDone) {
  const el=document.getElementById(`log-${id}`);
  if(!el){onDone?.();return;}
  const txt=lines.join('\n');
  let i=0;
  const t=setInterval(()=>{
    el.textContent=txt.substring(0,i)+'▋';
    if(++i>txt.length){clearInterval(t);el.textContent=txt;onDone?.();}
  },speed);
}

// ═══════════════════════════════════════════════
// MESSAGE RECORDING
// ═══════════════════════════════════════════════
function recordMsg(from, to, role, text) {
  const key=`${from}-${to}`, rKey=`${to}-${from}`;
  const cKey=noodleConvos[key]!==undefined ? key : (noodleConvos[rKey]!==undefined ? rKey : key);
  if(!noodleConvos[cKey]) noodleConvos[cKey]=[];
  const msg={from,to,role,text,time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})};
  noodleConvos[cKey].push(msg);
  // If chat panel is open for this connection, refresh it
  if(document.getElementById('chatPanel').classList.contains('open')){ refreshChatPanel(); }
}

// ═══════════════════════════════════════════════
// COST
// ═══════════════════════════════════════════════
function startNodeCost(id, rate=0.0004) {
  if(costTimers[id]) return;
  if(!nodeCosts[id]) nodeCosts[id]=0;
  costTimers[id]=setInterval(()=>{
    const d=rate+Math.random()*rate*0.3;
    nodeCosts[id]+=d; totalCost+=d;
    if(!billingLedger[id]) billingLedger[id]={total:0};
    billingLedger[id].total+=d;
    const el=document.getElementById(`cost-${id}`); if(el)el.textContent=`£${nodeCosts[id].toFixed(4)}`;
    const aEl=document.getElementById('aiaV'); if(aEl)aEl.textContent=`£${totalCost.toFixed(4)}`;
    const tEl=document.getElementById('taV'); if(tEl)tEl.textContent=`£${Math.round(totalCost*220)}`;
    const fEl=document.getElementById('fvV'); if(fEl)fEl.textContent=`£${Math.round(totalCost*90)}`;
  },450);
}
function stopNodeCost(id){ clearInterval(costTimers[id]); delete costTimers[id]; }
function stopAllCosts(){ Object.keys(costTimers).forEach(stopNodeCost); }

// ═══════════════════════════════════════════════
// PULSES
// ═══════════════════════════════════════════════
function pulseDot(fromId, toId, color, onDone, dur=750) {
  const A=getAnchorXY(fromId), B=getAnchorXY(toId);
  if(!A||!B){onDone?.();return;}
  flashNoodle(fromId,toId,color,dur-100);
  const svg=document.getElementById('svgLayer');
  const dot=svgEl('circle',{r:'8',fill:color,filter:'url(#gf)',opacity:'0'});
  svg.appendChild(dot);
  let s=0; const steps=50;
  const tick=setInterval(()=>{
    const t=++s/steps, eased=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    dot.setAttribute('cx', A.x+(B.x-A.x)*eased);
    dot.setAttribute('cy', A.y+(B.y-A.y)*eased);
    dot.setAttribute('opacity', s<5?s/5 : s>45?(50-s)/5 : 1);
    if(s>=steps){ clearInterval(tick); if(svg.contains(dot))svg.removeChild(dot); onDone?.(); }
  }, dur/steps);
}

function sendBillingPulse(id) {
  const A=getAnchorXY(id), B=getAnchorXY('billing');
  if(!A||!B||!elements['billing']) return;
  const svg=document.getElementById('svgLayer');
  const dot=svgEl('circle',{r:'4',fill:'#f59e0b',filter:'url(#gf)',opacity:'.7'});
  svg.appendChild(dot);
  let s=0;
  const tick=setInterval(()=>{
    const t=++s/40;
    dot.setAttribute('cx',A.x+(B.x-A.x)*t);
    dot.setAttribute('cy',A.y+(B.y-A.y)*t);
    if(s>=40){ clearInterval(tick); if(svg.contains(dot))svg.removeChild(dot); }
  },15);
}

// ═══════════════════════════════════════════════
// MAIN SHOW
// ═══════════════════════════════════════════════
function runAgentExchange(a, onDone) {
  let ri=0;
  function round() {
    const r=a.rounds[ri], isF=(ri===0);
    const briefMsg=isF?`Sending initial brief to ${a.role}…`:`Sending amendment ${ri}: ${a.amends[ri-1]||'Refine output'}`;
    recordMsg('sm',a.id,'agent',briefMsg);
    pulseDot('sm',a.id, isF?'#6466f1':'#f59e0b',()=>{
      setState(a.id,'working'); setStatus(a.id,isF?'Working on brief…':'Iterating…');
      startNodeCost(a.id, 0.00045);
      typeLog(a.id, r.work, 22, ()=>{
        stopNodeCost(a.id);
        sendBillingPulse(a.id);
        const outMsg=`Round ${ri+1} complete: ${r.out}`;
        recordMsg(a.id,'sm','user',outMsg);
        pulseDot(a.id,'sm','#10b981',()=>{
          setLog(a.id, r.out);
          if(++ri < a.rounds.length) {
            setState(a.id,'waiting'); setStatus(a.id,'Awaiting feedback…');
            setTimeout(round, 2500+Math.random()*1000);
          } else {
            setState(a.id,'done'); setStatus(a.id,'Complete ✓'); onDone();
          }
        }, 700);
      });
    }, 700);
  }
  round();
}

function doApprove() {
  setState('billing','done'); setLog('billing',`${TIERS[selectedTier].label} tier approved ✓ (${TIERS[selectedTier].price})`);
  document.getElementById('approve-wrap').style.display='none';
  recordMsg('client','billing','user',`Approved ${TIERS[selectedTier].label} tier — proceed.`);
  
  // Forward approval to backend with tier selection
  const url = CLIENT.brief.match(/https?:\/\/[^\s]+/)?.[0] || CLIENT.brief;
  sendToBackend({
    type: 'command',
    command: 'START_AIRBNB_WORKFLOW',
    url: url,
    tier: selectedTier,
    text: `Approved ${selectedTier} tier. Execute 'ag_run_airbnb_workflow' for: ${url}`,
    chatId: 'demo3-session'
  });

  if(billingApproveCallback) billingApproveCallback();
}
function doReject() {
  setLog('billing','Revising estimate per client request…');
  setState('billing','working');
  recordMsg('client','billing','user','Can you sharpen the estimate?');
  setTimeout(()=>{
    setState('billing','approve');
    typeLog('billing',['Reviewing scope…','Revised: Frontend £0.07, UX £0.06, Design £0.07, Backend £0.09, Copy £0.04','TOTAL REVISED: ~£0.33 (saved £0.06)'],12,()=>{
      document.getElementById('approve-wrap').style.display='block';
    });
  },2000);
}

function runShow(briefText) {
  const l=calcLayout();

  // Phase 0: Client
  spawnClient(l.clX, l.t0y);
  setTimeout(()=>{
    document.getElementById('brief-client').textContent=briefText;
    CLIENT.brief = briefText;
    setStatus('client','Waiting for Studio Manager…');
    setState('client','waiting');
    recordMsg('client','sm','user', briefText);
  }, 300);

  // Phase 1: SM joins
  setTimeout(()=>{
    spawnSM(l.smX, l.t1y);
    addNoodle('client','sm');
    setState('sm','working'); startNodeCost('sm',0.00015);
    setGlobal('Free consultation — scoping…','#f97316');
    pulseDot('client','sm','#6466f1',()=>{
      setLog('sm',`Reading brief...`);
      recordMsg('sm','client','agent', activeProfile.smGreeting || 'Welcome! I\'m reading your brief.');
      setTimeout(()=>{
        setLog('sm','Scoping complete. Preparing estimate…');
        stopNodeCost('sm');
        setState('sm','reviewed');
        spawnBilling(l.bmX, l.t1y);
        addNoodle('sm','billing',true);
        recordMsg('sm','billing','agent','New project scoped. Prepare budget estimate.');
        pulseDot('sm','billing','#f59e0b',()=>{
          setState('billing','working'); startNodeCost('billing',0.00008);
          typeLog('billing', activeProfile.billingEstimate || [
            'Analysing scope…',
            'TOTAL:      ~£0.39'
          ], 14, ()=>{
            stopNodeCost('billing');
            setState('billing','approve');
            document.getElementById('approve-wrap').style.display='block';
            recordMsg('billing','client','agent','Budget estimate ready. Please approve to proceed.');
            setGlobal('Awaiting budget approval…','#f59e0b');
            billingApproveCallback=afterApproval;
            showApprovalPrompt();
          });
        },700);
      },2500);
    },800);
  },900);

  function afterApproval() {
    hideApprovalPrompt();
    setState('sm','working'); startNodeCost('sm',0.0002);
    setLog('sm','Budget approved! Recruiting team…');
    setGlobal('Deploying team…','#6466f1');
    recordMsg('sm','client','agent','Budget approved. Assembling specialist team...');

    currentAgents.forEach((a,i)=>setTimeout(()=>{
      // Visual instantiation happens immediately for ALL profiles
      spawnAgent(a, l.agX+i*(CARD_W+24), l.t2y);
      addNoodle('sm',a.id);
      recordMsg('sm',a.id,'agent',`Welcome to the project: "${CLIENT.name}"`);
      
      if (activeProfile === BRIEF_PROFILES.airbnb) {
         console.log(`[UI] Airbnb specialist spawned on canvas: ${a.id}`);
         // No simulated runAgentExchange — we wait for WebSocket updates
      }
    }, i*380));

    const allSpawned=currentAgents.length*380+900;
    setTimeout(()=>{
        if (activeProfile === BRIEF_PROFILES.airbnb) {
          stopNodeCost('sm');
          
          setTimeout(()=>{
            typeLog('sm', ['Refining listing targets...', 'Strategy brief generated ✓'], 15, ()=>{
                // Orchestration Pulse to Zara
                pulseDot('sm', 'data-analyst', '#6466f1', ()=>{
                    setLog('data-analyst', 'Instructions received. ✓');
                });
            });
          }, 500);

          setLog('sm', 'Orchestrating Airbnb specialist loop…');
          setGlobal('Agents Active…', '#ffffff');
          return; // STOP simulation — backend updates will follow via WebSocket
        }

        setGlobal('Team working…','#ffffff');
        let done=0;
        currentAgents.forEach((a,i)=>setTimeout(()=>{
          runAgentExchange(a, ()=>{
            if(++done===currentAgents.length) allDone();
          });
        }, i*300));
      }, allSpawned);
    }

  function allDone() {
    setGlobal('Collating deliverables…','#6466f1');
    setState('sm','working'); startNodeCost('sm',0.0003);
    setLog('sm','Collating department outputs…');
    recordMsg('sm','client','agent','All deliverables received! Packaging final bundle...');
    setTimeout(()=>{
      stopNodeCost('sm'); stopAllCosts();
      setState('sm','done'); setLog('sm','Package complete ✓');
      pulseDot('sm','client','#10b981',()=>{
        setState('client','done'); setStatus('client','Package received ✓');
        document.getElementById('brief-client').textContent='✅ Deliverables ready!';
        const files=activeProfile.deliverables || ['assets.zip'];
        const fc=document.getElementById('files-client');
        fc.innerHTML=files.map(f=>`<div class="file-item">${f}</div>`).join('')
          +`<button class="dl-btn" style="margin-top:6px;width:100%;background:#10b981;color:#111;border:none;border-radius:7px;padding:7px;font-size:11px;font-weight:700;cursor:pointer">⬇ Download All</button>`;
        recordMsg('sm','client','agent','Full project package delivered.');
        document.getElementById('deliveryBanner')?.classList.add('show');
      },900);
    },2800);
  }
}

function startProject() {
  const name = document.getElementById('clientNameInput').value || 'The Dough House';
  const brief = document.getElementById('clientBriefInput').value || 'Build us a marketing website.';
  
  CLIENT.name = name;
  CLIENT.brief = brief;

  // Route to profile
  if (BRIEF_PROFILES.airbnb.test.test(brief)) {
    activeProfile = BRIEF_PROFILES.airbnb;
    currentAgents = AIRBNB_AGENTS;
    CLIENT.role = 'Client · Airbnb Host';
    
    // START BACKEND WORKFLOW
    sendToBackend({
        type: 'message',
        text: `Please enhance this Airbnb listing: ${brief}`,
        chatId: 'demo3-session'
    });
  } else {
    activeProfile = BRIEF_PROFILES.website;
    currentAgents = AGENTS;
  }

  document.getElementById('briefModal').classList.remove('open');
  runShow(brief);
}

function showStartModal() {
  document.getElementById('briefModal').classList.add('open');
}

// ═══════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════
function sendCardMsg(id) {
  const input=document.getElementById(`input-${id}`);
  if(!input||!input.value.trim()) return;
  const text=input.value.trim();
  input.value='';

  // Record user's message to this agent
  recordMsg('client',id,'user',text);
  flashNoodle('client',id,'#f97316');

  // Simulate agent replying after a brief delay
  const a=[...currentAgents, SM].find(x=>x.id===id);
  const replies=[
    `Got it — "${text.substring(0,40)}…" noted. I'll factor this into the next round.`,
    `Understood. I'll prioritise that in my current iteration.`,
    `Thanks for the input! I'll adjust the output accordingly.`,
  ];
  const reply=replies[Math.floor(Math.random()*replies.length)];
  setTimeout(()=>{
    recordMsg(id,'client','agent',reply);
    flashNoodle(id,'client',a.color||'#6466f1');
  },1000+Math.random()*1500);
}

function openNoodleConvo(from, to) {
  const key=`${from}-${to}`, rKey=`${to}-${from}`;
  const msgs=noodleConvos[key]||noodleConvos[rKey]||[];
  const aFrom=[...AGENTS,SM,BILLING,CLIENT].find(x=>x.id===from)||{name:from};
  const aTo=[...AGENTS,SM,BILLING,CLIENT].find(x=>x.id===to)||{name:to};

  const panel=document.getElementById('chatPanel');
  const hName=panel.querySelector('.chat-header-name');
  const hRole=panel.querySelector('.chat-header-role');
  const hImg=document.getElementById('chatHeaderImg');

  hName.textContent=`${aFrom.name} ↔ ${aTo.name}`;
  hRole.textContent='Connection thread — click card inputs to message directly';
  if(hImg) { hImg.src=aFrom.avatar||''; hImg.style.display=aFrom.avatar?'block':'none'; }

  // Store current connection for refresh
  panel.dataset.fromNode=from;
  panel.dataset.toNode=to;

  renderConvoMessages(msgs);
  panel.classList.add('open');
  document.getElementById('ledgerPanel').classList.remove('open');
}

function refreshChatPanel() {
  const panel=document.getElementById('chatPanel');
  if(!panel.classList.contains('open')) return;
  const from=panel.dataset.fromNode, to=panel.dataset.toNode;
  if(!from||!to) return;
  const key=`${from}-${to}`, rKey=`${to}-${from}`;
  renderConvoMessages(noodleConvos[key]||noodleConvos[rKey]||[]);
}

function renderConvoMessages(msgs) {
  const mc=document.getElementById('chatMessages');
  if(!mc) return;
  if(!msgs.length){
    mc.innerHTML='<div class="msg-empty">No messages yet on this connection.<br>Messages appear here when agents communicate.</div>';
    return;
  }
  mc.innerHTML=msgs.map(m=>`
    <div class="msg-bundle">
      <div class="msg-from">${m.from} → ${m.to}</div>
      <div class="msg ${m.role}">${m.text}<div class="msg-time">${m.time}</div></div>
    </div>`).join('');
  mc.scrollTop=mc.scrollHeight;
}

function closeChat(){ document.getElementById('chatPanel').classList.remove('open'); }

// ═══════════════════════════════════════════════
// DESK VIEW
// ═══════════════════════════════════════════════
function openDesk(id) {
  const a=[...currentAgents, SM].find(x=>x.id===id);
  if(!a) return;
  const m=document.getElementById('deskModal');
  document.getElementById('deskAgentName').textContent=a.name;
  document.getElementById('deskAgentRole').textContent=a.role;
  const img=document.getElementById('deskAgentImg'); if(img)img.src=a.avatar;

  // Current output
  const logText=document.getElementById(`log-${a.id}`)?.textContent||'Work in progress.';
  document.getElementById('deskOutput').textContent=logText;

  // Incoming Messages / Brief
  const msgEl = document.getElementById('deskMessages');
  if (msgEl) {
      // Find messages TO this agent
      const msgs = Object.keys(noodleConvos)
          .filter(k => k.includes(`-${a.id}`))
          .flatMap(k => noodleConvos[k])
          .filter(m => m.to === a.id);
      
      msgEl.innerHTML = msgs.map(m => `
          <div class="msg-bubble" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);padding:8px;border-radius:8px;margin-bottom:8px">
              <div style="font-size:9px;color:var(--muted);margin-bottom:4px">From: ${m.from} (${m.time})</div>
              <div style="font-size:12px;color:#eee;white-space:pre-wrap">${m.text}</div>
          </div>
      `).join('') || '<em style="color:var(--muted);font-size:11px">Waiting for instructions…</em>';
  }

  // Thinking
  const thinkEl=document.getElementById('deskThinking');
  if(thinkEl) thinkEl.innerHTML=(a.thinking||[]).map(t=>`<div class="think-line">💭 ${t}</div>`).join('');

  // Iteration history
  const histEl=document.getElementById('deskHistory');
  if(histEl) histEl.innerHTML=(a.rounds||[]).map((r,i)=>`
    <div class="iter-block">
      <div class="iter-lbl">Round ${i+1}</div>
      <div class="iter-content">${r.out}</div>
    </div>`).join('') || '<em style="color:var(--muted);font-size:11px">No completed rounds yet.</em>';

  // File outputs preview
  const filesEl=document.getElementById('deskFiles');
  if(filesEl) {
    filesEl.innerHTML=(a.outputs||[]).map(f=>{
      const icon={code:'💻',figma:'🎨',doc:'📄',image:'🖼'}[f.type]||'📁';
      return `<div class="output-file">
        <div class="of-header">${icon} <strong>${f.label}</strong><span class="of-type">${f.type}</span></div>
        <pre class="of-preview">${f.preview}</pre>
      </div>`;
    }).join('') || '<em style="color:var(--muted);font-size:11px">No files generated yet.</em>';
  }

  m.classList.add('open');
}
function closeDesk(){ document.getElementById('deskModal').classList.remove('open'); }

// ═══════════════════════════════════════════════
// LEDGER
// ═══════════════════════════════════════════════
function openLedger(){
  const panel=document.getElementById('ledgerPanel');
  panel.classList.add('open');
  document.getElementById('chatPanel').classList.remove('open');
  const b=document.getElementById('ledgerBody');
  if(!b) return;
  const rows=[{id:'sm',name:'Alex Okafor',role:'Studio Manager'},...currentAgents,{id:'billing',name:'Elena Thorne',role:'Billing'}]
    .map(a=>{
      const d=billingLedger[a.id]||{total:0};
      return `<tr><td>${a.name}<div style="font-size:8px;color:var(--muted)">${a.role||''}</div></td>
        <td style="color:var(--green);text-align:right;font-family:'JetBrains Mono',monospace">£${d.total.toFixed(4)}</td>
        <td style="color:var(--muted);text-align:right;font-size:9px">${Math.round(d.total*240000)} tok</td></tr>`;
    }).join('');
  b.innerHTML=rows;
  const lt=document.getElementById('ledgerTotal');
  if(lt) lt.textContent=`TOTAL: £${totalCost.toFixed(4)}`;
}
function closeLedger(){ document.getElementById('ledgerPanel').classList.remove('open'); }

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
window.addEventListener('load', ()=>{
  const svg=document.getElementById('svgLayer');
  const defs=svgEl('defs');
  defs.innerHTML=`<filter id="gf" x="-200%" y="-200%" width="500%" height="500%">
    <feGaussianBlur stdDeviation="3" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
  svg.appendChild(defs);

  window.addEventListener('resize', ()=>fitRetry(3,60));
  
  // Start with the modal open
  showStartModal();
});

// ── TIER SELECTION + APPROVAL PROMPT ──
function showApprovalPrompt() {
  let b=document.getElementById('approvalPrompt');
  if(!b){
    b=document.createElement('div');
    b.id='approvalPrompt';
    b.style.cssText=`position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      z-index:500;background:rgba(17,17,25,.92);border:1.5px solid rgba(100,102,241,.3);
      border-radius:18px;padding:16px 20px;backdrop-filter:blur(16px);
      max-width:720px;width:95%;`;
    b.innerHTML=buildTierUI();
    document.body.appendChild(b);
  }
  b.style.display='block';
}

function buildTierUI() {
  const cards = Object.entries(TIERS).map(([key, t]) => {
    const isSelected = key === selectedTier;
    return `<div class="tier-card ${isSelected ? 'tier-selected' : ''}" 
      onclick="selectTier('${key}')" 
      style="flex:1;min-width:140px;padding:12px;border-radius:12px;cursor:pointer;text-align:center;
        border:1.5px solid ${isSelected ? t.color : 'rgba(255,255,255,.1)'};
        background:${isSelected ? t.color+'18' : 'rgba(255,255,255,.03)'};
        transition:all .2s ease">
      <div style="font-size:10px;font-weight:700;color:${t.color};text-transform:uppercase;margin-bottom:4px;letter-spacing:1px">${t.label}</div>
      <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:2px">${t.price}</div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:8px">SIO Target: ${t.sio}</div>
      <div style="font-size:9px;color:${isSelected ? '#ddd' : 'var(--muted)'};text-align:left;line-height:1.5">
        ${t.features.map(f => '• ' + f).join('<br>')}
      </div>
    </div>`;
  }).join('');

  return `
    <div style="text-align:center;margin-bottom:12px">
      <span style="font-size:11px;font-weight:700;color:#f59e0b">💰 Elena Thorne — Select Enhancement Tier</span>
      <div style="font-size:9px;color:var(--muted);margin-top:3px">Higher tiers = more retouch rounds + stricter quality threshold</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">${cards}</div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button onclick="approveBudget()" style="background:#f59e0b;color:#111;border:none;
        border-radius:8px;padding:8px 24px;font-weight:700;cursor:pointer;font-size:12px;
        font-family:'Inter',sans-serif;animation:pulseAmber 1.6s ease-in-out infinite"
        >✓ Approve ${TIERS[selectedTier].label} — ${TIERS[selectedTier].price}</button>
      <button onclick="rejectBudget()" style="background:rgba(255,255,255,.06);color:var(--muted);
        border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px 16px;
        font-weight:600;cursor:pointer;font-size:11px;font-family:'Inter',sans-serif">↩ Revise</button>
    </div>
    <div style="text-align:center;margin-top:8px;font-size:9px;color:var(--muted)">
      vs Pro Photographer: $600 · vs Freelance Retoucher: $140
    </div>`;
}

function selectTier(tier) {
  selectedTier = tier;
  const el = document.getElementById('approvalPrompt');
  if (el) el.innerHTML = buildTierUI();
}

function hideApprovalPrompt(){
  const b=document.getElementById('approvalPrompt');
  if(b) b.style.display='none';
}

// Panel-level chat send (used in the noodle/chat panel sidebar)
function sendChatPanel() {
  const input = document.getElementById('chatInput');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';
  const panel = document.getElementById('chatPanel');
  const from = panel.dataset.fromNode || 'client';
  const to = panel.dataset.toNode || 'sm';
  recordMsg(from, to, 'user', text);
  refreshChatPanel();
  // Simulate a reply
  const agent = [...currentAgents, SM, BILLING].find(x => x.id === to);
  if (agent) {
    setTimeout(() => {
      const replies = [
        `Noted — "${text.substring(0,50)}…". I'll factor that in.`,
        `Thanks for flagging. I'll adjust my next output accordingly.`,
        `Good point. Let me revisit that before sending the next deliverable.`,
      ];
      recordMsg(to, from, 'agent', replies[Math.floor(Math.random()*replies.length)]);
      refreshChatPanel();
    }, 800 + Math.random() * 1200);
  }
}
// Legacy alias
const sendChat = sendChatPanel;

// ── GLOBAL APPROVE/REJECT ALIASES ──
// Banner buttons call these; they proxy through to the real handlers.
function approveBudget() { doApprove(); }
function rejectBudget()  { doReject(); }

/* ── ASSET DELIVERABLES ── */
let currentAssets = [];
function openDownload() {
    const modal = document.getElementById('downloadModal');
    const list = document.getElementById('assetList');
    list.innerHTML = '';
    
    // Auto-populate from "Studio Output" (Simulated for now, will be real in next step)
    currentAssets = [
        { name: 'Airbnb_Hero_Enhanced.jpg', dept: 'Photo Retoucher', icon: '🖼️', size: '4.2MB' },
        { name: 'IEO_Scorecard.pdf', dept: 'IEO Specialist', icon: '📊', size: '1.1MB' },
        { name: 'Pricing_Strategy.pdf', dept: 'Market Analyst', icon: '💰', size: '0.8MB' }
    ];

    currentAssets.forEach(asset => {
        const item = document.createElement('div');
        item.className = 'asset-item';
        item.innerHTML = `
            <div class="asset-info">
                <span class="asset-icon">${asset.icon}</span>
                <div>
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-dept">${asset.dept} · ${asset.size}</div>
                </div>
            </div>
            <span class="asset-download" onclick="alert('Downloading ${asset.name}...')">⬇️</span>
        `;
        list.appendChild(item);
    });

    modal.style.display = 'flex';
}

function closeDownload() {
    document.getElementById('downloadModal').style.display = 'none';
}

function confirmDownload() {
    alert('Transferring to Stripe payment gateway... \nTotal: $24.99');
    closeDownload();
    markProjectComplete();
}

function markProjectComplete() {
    const btn = document.getElementById('downloadBtn');
    if(btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
    const pl = document.getElementById('phaseLabel');
    if(pl) {
        pl.innerText = 'Project Delivered ✓';
        pl.style.color = '#10b981';
    }
}

function setAttachment(id, url, label) {
    const el = document.getElementById(`attachment-${id}`);
    if(!el) return;
    el.innerHTML = `
        <img src="${url}" style="width:100%;border-radius:8px;margin-top:10px;cursor:zoom-in;border:1px solid rgba(255,255,255,0.1)" onclick="window.open('${url}','_blank')">
        <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:4px">📎 ${label || 'Asset'}</div>
    `;
    el.style.display = 'block';
}

// Export for window use
window.openDownload = openDownload;
window.closeDownload = closeDownload;
window.confirmDownload = confirmDownload;
window.setAttachment = setAttachment;
window.markProjectComplete = markProjectComplete;

// ═══════════════════════════════════════════════
// REAL-TIME CONNECTION
// ═══════════════════════════════════════════════
let socket = null;
let msgQueue = [];
function sendToBackend(msg) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
    } else {
        console.warn('[UI] Socket not ready, queueing message...');
        msgQueue.push(msg);
    }
}
window.sendToBackend = sendToBackend;

(function initWS() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);
  socket = ws;

  ws.onopen = () => {
    console.log('[UI] Connected to Studio Backend');
    // Process queued messages
    while(msgQueue.length > 0) {
        const m = msgQueue.shift();
        ws.send(JSON.stringify(m));
    }
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'agent_update') {
        const { agentId, targetAgentId, status, log, photoUrl, assetLabel } = msg;

        // Auto-spawn agent if not exists
        if (!elements[agentId]) {
            const agentTemplate = AIRBNB_AGENTS.find(a => a.id === agentId);
            if (agentTemplate) {
                const l = calcLayout();
                const idx = AIRBNB_AGENTS.findIndex(a => a.id === agentId);
                spawnAgent(agentTemplate, l.agX + idx * (CARD_W + 24), l.t2y);
                addNoodle('sm', agentId);
                fitRetry(2, 100); // Fit view to include new agent
            }
        }

        if (status) {
          setState(agentId, status === 'working' ? 'working' : (status === 'done' ? 'done' : 'waiting'));
          setStatus(agentId, status.charAt(0).toUpperCase() + status.slice(1));
        }
        if (log && log.length) {
          const latestLog = log[log.length - 1];
          setLog(agentId, latestLog);
          
          if (targetAgentId) {
             // If agent A is talking to agent B
             recordMsg(agentId, targetAgentId, 'agent', latestLog);
             flashNoodle(agentId, targetAgentId, '#6466f1');
             pulseDot(agentId, targetAgentId, '#6466f1');
          } else {
             // General status/update to SM
             recordMsg(agentId, 'sm', 'agent', latestLog);
             flashNoodle('sm', agentId, '#6466f1');
          }
        }
        if (photoUrl) {
          setAttachment(agentId, photoUrl, assetLabel);
        }
        if (msg.outputs && msg.outputs.length) {
            // Update the in-memory agent state so 'view desk' shows latest files
            const a = elements[agentId]?.agent;
            if (a) {
                a.outputs = msg.outputs;
                // If the desk modal is currently open for this agent, refresh it
                if (document.getElementById('deskModal').style.display === 'flex' && 
                    document.getElementById('deskAgentName').innerText === a.name) {
                    openDesk(agentId); 
                }
            }
        }
      } else if (msg.type === 'project_complete') {
        const smEl = elements['sm'];
        if (smEl) {
            setState('sm', 'done');
            setLog('sm', 'Package complete ✓');
        }
        markProjectComplete();
        setGlobal('Project Delivered ✓', '#10b981');
        document.getElementById('deliveryBanner')?.classList.add('show');
        fitRetry(3, 200);
      }
    } catch (err) {
      console.warn('[UI] WebSocket parse error:', err);
    }
  };
  ws.onclose = () => setTimeout(initWS, 3000);
})();
