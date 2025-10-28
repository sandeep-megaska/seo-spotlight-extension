// --- Simple DOM helpers ------------------------------------------------------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function safeText(n) { return (n && n.textContent || "").trim(); }
function attr(el, name) { return el ? el.getAttribute(name) : null; }
function len(s) { return (s || "").length; }

// --- Collect metrics ---------------------------------------------------------
function collectSEO() {
  const title = safeText($("title"));
  const metaDesc = attr($('meta[name="description"]'), "content") || "";
  const robots = attr($('meta[name="robots"]'), "content") || "";
  const canonical = attr($('link[rel="canonical"]'), "href") || "";
  const og = Object.fromEntries($$('meta[property^="og:"]').map(m => [attr(m,"property"), attr(m,"content")]));
  const twitter = Object.fromEntries($$('meta[name^="twitter:"]').map(m => [attr(m,"name"), attr(m,"content")]));
  const h1s = $$("h1");
  const h2s = $$("h2");
  const h3s = $$("h3");
  const imgs = $$("img");
  const links = $$("a[href]");
  const noAlt = imgs.filter(i => !i.hasAttribute("alt") || i.getAttribute("alt").trim()==="");
  const schemaScripts = $$('script[type="application/ld+json"]').map(s => {
    try { return JSON.parse(s.textContent); } catch { return null; }
  }).filter(Boolean);

  // Basic indexability hints
  const hasNoindex = /noindex/i.test(robots);
  const hasNofollow = /nofollow/i.test(robots);
  const hasCanonical = !!canonical;

  // Headings outline
  const headings = [...$$("h1,h2,h3,h4,h5,h6")].map(el => ({
    tag: el.tagName,
    text: safeText(el).slice(0,120)
  }));

  return {
    url: location.href,
    title,
    titleLength: len(title),
    metaDesc,
    metaDescLength: len(metaDesc),
    robots, hasNoindex, hasNofollow,
    canonical, hasCanonical,
    og, twitter,
    counts: {
      h1: h1s.length, h2: h2s.length, h3: h3s.length,
      images: imgs.length, imagesMissingAlt: noAlt.length,
      links: links.length
    },
    headings,
    schemaTypes: schemaScripts.flatMap(s => {
      const types = [];
      const walk = (node) => {
        if (!node || typeof node !== "object") return;
        if (node['@type']) types.push(node['@type']);
        if (Array.isArray(node)) node.forEach(walk);
        else Object.values(node).forEach(walk);
      };
      walk(s);
      return types;
    })
  };
}

// --- Highlights --------------------------------------------------------------
function clearHighlights() {
  $$(".seo-spotlight-outline").forEach(el => el.classList.remove("seo-spotlight-outline"));
}
function highlightSelector(sel) {
  $$(sel).forEach(el => el.classList.add("seo-spotlight-outline"));
}

// --- Inject panel (Shadow DOM) ----------------------------------------------
(function injectPanel(){
  if (document.getElementById("seo-spotlight-root")) return;

  const host = document.createElement("div");
  host.id = "seo-spotlight-root";
  Object.assign(host.style, {
    position: "fixed", top: "16px", right: "16px", zIndex: 2147483647
  });
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Styles (panel + highlight class)
  const style = document.createElement("style");
  style.textContent = `
    .panel{width:360px; max-height:80vh; overflow:auto; background:#0f172a; color:#e2e8f0; 
      border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.35); font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;}
    .head{display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid #1f2937;}
    .brand{font-weight:700; letter-spacing:.3px}
    .btn{background:#1f2937; border:none; color:#e2e8f0; padding:6px 10px; border-radius:10px; cursor:pointer}
    .btn:hover{background:#374151}
    .grid{display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:12px}
    .card{background:#111827; border:1px solid #1f2937; border-radius:12px; padding:10px}
    .k{opacity:.75}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break:break-all}
    .row{display:flex; gap:8px; align-items:center; margin:8px 0}
    details{padding:10px 12px}
    summary{cursor:pointer; font-weight:600}
    .bar{height:8px; background:#1f2937; border-radius:999px; overflow:hidden}
    .bar>i{display:block; height:100%; background:#22c55e; width:0%}
    .tag{display:inline-block; padding:2px 8px; border-radius:999px; background:#1f2937; margin:4px 4px 0 0}
    .warn{color:#f59e0b}
    .bad{color:#ef4444}
    .ok{color:#22c55e}
    /* highlight class injected into page */
    :host-context(.seo-spotlight-outline), .seo-spotlight-outline{
      outline: 2px dashed #f59e0b !important; outline-offset: 2px !important;
    }
  `;
  shadow.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "panel";

  const hdr = document.createElement("div");
  hdr.className = "head";
  hdr.innerHTML = `
    <div class="brand">SEO Spotlight</div>
    <div>
      <button class="btn" id="btn-refresh">Rescan</button>
      <button class="btn" id="btn-close">Close</button>
    </div>
  `;
  panel.appendChild(hdr);

  const body = document.createElement("div");
  panel.appendChild(body);

  shadow.appendChild(panel);

  function scoreColor(len, min, max){
    if (len === 0) return "bad";
    if (len < min) return "warn";
    if (len > max) return "warn";
    return "ok";
  }

  function render() {
    clearHighlights();
    const data = collectSEO();
    const titleColor = scoreColor(data.titleLength, 30, 60);
    const descColor = scoreColor(data.metaDescLength, 70, 160);

    body.innerHTML = `
      <div class="grid">
        <div class="card">
          <div class="k">Title</div>
          <div class="row ${titleColor}">
            <span>${data.titleLength} chars</span>
          </div>
          <div class="mono">${data.title || "<no title>"}</div>
          <div class="bar"><i style="width:${Math.min(100, data.titleLength)}%"></i></div>
        </div>
        <div class="card">
          <div class="k">Meta Description</div>
          <div class="row ${descColor}"><span>${data.metaDescLength} chars</span></div>
          <div class="mono">${data.metaDesc || "<no description>"}</div>
          <div class="bar"><i style="width:${Math.min(100, data.metaDescLength)}%"></i></div>
        </div>
        <div class="card">
          <div class="k">Headings</div>
          <div>H1: <b>${data.counts.h1}</b> • H2: <b>${data.counts.h2}</b> • H3: <b>${data.counts.h3}</b></div>
          <div class="row">
            <button class="btn" id="hl-h1">Highlight H1</button>
            <button class="btn" id="hl-h2">H2</button>
            <button class="btn" id="hl-h3">H3</button>
          </div>
        </div>
        <div class="card">
          <div class="k">Images</div>
          <div>Total: <b>${data.counts.images}</b></div>
          <div class="${data.counts.imagesMissingAlt>0?"warn":"ok"}">Missing alt: <b>${data.counts.imagesMissingAlt}</b></div>
          <div class="row"><button class="btn" id="hl-miss-alt">Highlight Missing Alt</button></div>
        </div>
        <div class="card">
          <div class="k">Indexability</div>
          <div>Robots: <span class="${data.hasNoindex?"bad":"ok"}">${data.robots || "—"}</span></div>
          <div>Canonical: <b>${data.hasCanonical ? "Yes" : "No"}</b></div>
        </div>
        <div class="card">
          <div class="k">Links</div>
          <div>Total anchors: <b>${data.counts.links}</b></div>
          <div class="row"><button class="btn" id="hl-outbound">Highlight Outbound</button></div>
        </div>
      </div>

      <details>
        <summary>Open Graph / Twitter</summary>
        <div class="card mono">${JSON.stringify({og: data.og, twitter: data.twitter}, null, 2)}</div>
      </details>

      <details>
        <summary>Schema Types</summary>
        <div>
          ${(data.schemaTypes.length ? data.schemaTypes : ["—"]).map(t => `<span class="tag">${Array.isArray(t)?t.join(", "):t}</span>`).join("")}
        </div>
      </details>

      <details>
        <summary>Headings Outline</summary>
        <div class="card mono">${data.headings.map(h => `${h.tag} | ${h.text}`).join("\n") || "—"}</div>
      </details>

      <div class="grid" style="padding:12px">
        <button class="btn" id="btn-export-json">Export JSON</button>
        <button class="btn" id="btn-save-competitor">Save Snapshot</button>
      </div>
    `;

    // Wire buttons
    shadow.getElementById("hl-h1").onclick = () => { clearHighlights(); highlightSelector("h1"); };
    shadow.getElementById("hl-h2").onclick = () => { clearHighlights(); highlightSelector("h2"); };
    shadow.getElementById("hl-h3").onclick = () => { clearHighlights(); highlightSelector("h3"); };
    shadow.getElementById("hl-miss-alt").onclick = () => {
      clearHighlights();
      $$("img").filter(i => !i.hasAttribute("alt") || i.getAttribute("alt").trim()==="").forEach(el => el.classList.add("seo-spotlight-outline"));
    };
    shadow.getElementById("hl-outbound").onclick = () => {
      clearHighlights();
      $$('a[href^="http"]').forEach(el => el.classList.add("seo-spotlight-outline"));
    };
    shadow.getElementById("btn-export-json").onclick = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `seo-spotlight-${location.hostname}.json`;
      a.click(); URL.revokeObjectURL(url);
    };
    shadow.getElementById("btn-save-competitor").onclick = async () => {
      const key = `snapshot::${location.href}`;
      await chrome.storage.sync.set({ [key]: data });
      alert("Saved snapshot for compare.");
    };
  }

  render();

  shadow.getElementById("btn-refresh").onclick = () => render();
  shadow.getElementById("btn-close").onclick = () => {
    clearHighlights();
    host.remove();
  };
})();

