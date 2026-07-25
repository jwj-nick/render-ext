// render-ext standalone diagram renderers — Graphviz (.dot), mermaid (.mmd),
// WaveDrom (.wd/.wavejson), draw.io (.drawio) and PlantUML (.puml, opt-in).
'use strict';

// ---- Graphviz ------------------------------------------------------------
// The WASM engine runs in the SERVICE WORKER, not here: an extension page can
// declare 'wasm-unsafe-eval', a content script's WASM story is murkier. The SW
// returns finished SVG text, so this side stays plain DOM.

function rxSwGraphviz(dot) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: 'rx-graphviz', dot }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (res && res.ok) return resolve(res.svg);
        reject(new Error((res && res.error) || 'no response from service worker'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function rxRenderDot(text, spec) {
  let svg;
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    svg = await rxSwGraphviz(text);
  } else if (typeof Viz !== 'undefined') {
    const viz = await Viz.instance();          // harness/demo path
    svg = viz.renderString(text, { format: 'svg' });
  } else {
    throw new Error('Graphviz engine unavailable');
  }

  const root = document.createElement('div');
  root.className = 'rx-media';
  const holder = document.createElement('div');
  holder.className = 'rx-media-svg';
  holder.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
  root.appendChild(holder);
  return { node: root, title: spec.file || '', note: 'Graphviz' };
}

// ---- standalone mermaid --------------------------------------------------

function rxRenderMermaidFile(text, spec) {
  const root = document.createElement('div');
  root.className = 'rx-media';
  const holder = document.createElement('div');
  holder.className = 'mermaid rx-diagram rx-mermaid-pending';
  holder.textContent = text;
  root.appendChild(holder);
  // rxRenderDiagrams(root) runs after attach — mermaid needs a live node
  return { node: root, title: spec.file || '', note: 'Mermaid' };
}

// ---- standalone wavedrom -------------------------------------------------

function rxRenderWaveFile(text, spec) {
  const root = document.createElement('div');
  root.className = 'rx-media';
  const holder = document.createElement('div');
  holder.className = 'rx-diagram rx-wavedrom rx-wavedrom-pending';
  holder.dataset.rxSource = text;
  root.appendChild(holder);
  return { node: root, title: spec.file || '', note: 'WaveDrom' };
}

// ---- draw.io -------------------------------------------------------------

// A .drawio diagram body is usually base64 + raw-deflate + URL-encoding.
// Returns the mxGraphModel XML.
function rxDrawioDecode(text) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const diagram = doc.querySelector('diagram');
  if (!diagram) return text; // already a bare mxGraphModel
  if (diagram.querySelector('mxGraphModel')) {
    return new XMLSerializer().serializeToString(diagram.querySelector('mxGraphModel'));
  }
  const payload = (diagram.textContent || '').trim();
  if (!payload) return text;
  if (payload.startsWith('<')) return payload;
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const inflated = pako.inflateRaw(bytes, { to: 'string' });
  try {
    return decodeURIComponent(inflated);
  } catch (e) {
    return inflated;
  }
}

function rxParseStyle(style) {
  const out = {};
  for (const part of (style || '').split(';')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) out[part] = true;
    else out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

function rxStripHtml(v) {
  if (!v) return '';
  const d = document.createElement('div');
  d.innerHTML = DOMPurify.sanitize(v);
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

// Simplified renderer: boxes, ellipses, rhombi and straight/waypoint edges with
// labels. Enough for block diagrams; complex drawio styling is not reproduced.
function rxRenderDrawio(text, spec) {
  const xml = rxDrawioDecode(text);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const cells = [...doc.querySelectorAll('mxCell')];

  const nodes = new Map();
  const edges = [];
  for (const c of cells) {
    const geo = c.querySelector('mxGeometry');
    const st = rxParseStyle(c.getAttribute('style'));
    const label = rxStripHtml(c.getAttribute('value'));
    if (c.getAttribute('vertex') === '1' && geo) {
      nodes.set(c.getAttribute('id'), {
        x: parseFloat(geo.getAttribute('x') || 0),
        y: parseFloat(geo.getAttribute('y') || 0),
        w: parseFloat(geo.getAttribute('width') || 0),
        h: parseFloat(geo.getAttribute('height') || 0),
        label, st
      });
    } else if (c.getAttribute('edge') === '1') {
      const pts = geo ? [...geo.querySelectorAll('Array[as="points"] > mxPoint')].map((p) => ({
        x: parseFloat(p.getAttribute('x') || 0), y: parseFloat(p.getAttribute('y') || 0)
      })) : [];
      edges.push({ src: c.getAttribute('source'), dst: c.getAttribute('target'), label, st, pts });
    }
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const PAD = 24;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes.values()) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  // edge waypoints often route outside the node bounds — include them, or the
  // detour gets clipped off the canvas
  for (const e of edges) {
    for (const p of e.pts) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
  }
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 100; }
  const W = maxX - minX + PAD * 2;
  const H = maxY - minY + PAD * 2;
  svg.setAttribute('viewBox', `${minX - PAD} ${minY - PAD} ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';

  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML =
    '<marker id="rx-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">' +
    '<path d="M0,0 L9,3 L0,6 z" fill="#4d4d4d"/></marker>';
  svg.appendChild(defs);

  const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
  // clip a segment at the target box border so the arrowhead sits on the edge
  const clip = (from, n) => {
    const c = center(n);
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    if (!dx && !dy) return c;
    const sx = dx ? (n.w / 2) / Math.abs(dx) : Infinity;
    const sy = dy ? (n.h / 2) / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: c.x - dx * s, y: c.y - dy * s };
  };

  for (const e of edges) {
    const a = nodes.get(e.src);
    const b = nodes.get(e.dst);
    if (!a || !b) continue;
    const start = e.pts.length ? clip(e.pts[0], a) : clip(center(b), a);
    const end = e.pts.length ? clip(e.pts[e.pts.length - 1], b) : clip(center(a), b);
    const path = document.createElementNS(NS, 'polyline');
    const pts = [start, ...e.pts, end].map((p) => `${p.x},${p.y}`).join(' ');
    path.setAttribute('points', pts);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', e.st.strokeColor || '#4d4d4d');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('marker-end', 'url(#rx-arrow)');
    if (e.st.dashed === '1') path.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(path);

    if (e.label) {
      const mid = e.pts.length
        ? e.pts[Math.floor(e.pts.length / 2)]
        : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', mid.x);
      t.setAttribute('y', mid.y - 4);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '11');
      t.setAttribute('fill', '#333');
      t.textContent = e.label;
      svg.appendChild(t);
    }
  }

  for (const n of nodes.values()) {
    const fill = n.st.fillColor && n.st.fillColor !== 'none' ? n.st.fillColor : '#ffffff';
    const stroke = n.st.strokeColor && n.st.strokeColor !== 'none' ? n.st.strokeColor : '#4d4d4d';
    let shape;
    if (n.st.ellipse !== undefined || n.st.shape === 'ellipse') {
      shape = document.createElementNS(NS, 'ellipse');
      shape.setAttribute('cx', n.x + n.w / 2);
      shape.setAttribute('cy', n.y + n.h / 2);
      shape.setAttribute('rx', n.w / 2);
      shape.setAttribute('ry', n.h / 2);
    } else if (n.st.rhombus !== undefined || n.st.shape === 'rhombus') {
      shape = document.createElementNS(NS, 'polygon');
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      shape.setAttribute('points',
        `${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}`);
    } else {
      shape = document.createElementNS(NS, 'rect');
      shape.setAttribute('x', n.x);
      shape.setAttribute('y', n.y);
      shape.setAttribute('width', n.w);
      shape.setAttribute('height', n.h);
      if (n.st.rounded === '1') { shape.setAttribute('rx', 6); shape.setAttribute('ry', 6); }
    }
    shape.setAttribute('fill', fill);
    shape.setAttribute('stroke', stroke);
    shape.setAttribute('stroke-width', '1.5');
    svg.appendChild(shape);

    if (n.label) {
      const lines = n.label.split(/\s*\n\s*/);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', n.x + n.w / 2);
      t.setAttribute('y', n.y + n.h / 2 + 4 - (lines.length - 1) * 7);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '12');
      t.setAttribute('font-family', 'system-ui, sans-serif');
      t.setAttribute('fill', n.st.fontColor || '#111');
      lines.forEach((ln, i) => {
        const ts = document.createElementNS(NS, 'tspan');
        ts.setAttribute('x', n.x + n.w / 2);
        if (i) ts.setAttribute('dy', '14');
        ts.textContent = ln;
        t.appendChild(ts);
      });
      svg.appendChild(t);
    }
  }

  const root = document.createElement('div');
  root.className = 'rx-media';
  const holder = document.createElement('div');
  holder.className = 'rx-media-svg';
  holder.appendChild(svg);
  root.appendChild(holder);
  return {
    node: root,
    title: spec.file || '',
    note: `draw.io · ${nodes.size} shapes / ${edges.length} edges · 단순 렌더`
  };
}

// ---- PlantUML (opt-in, renders on a remote server) ------------------------
// PlantUML has no practical in-browser engine (it needs Java), so rendering
// means sending the diagram source to a server. That is off by default and
// never automatic: the user enables it in options AND clicks per diagram.

const RX_PLANTUML_SERVER = 'https://www.plantuml.com/plantuml/svg/';

// PlantUML's custom base64 alphabet over a raw-deflate of the source.
function rxPlantumlEncode(text) {
  const bytes = pako.deflateRaw(new TextEncoder().encode(text), { level: 9 });
  const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2];
    out += A[b1 >> 2];
    out += A[((b1 & 0x3) << 4) | ((b2 || 0) >> 4)];
    if (b2 === undefined) { out += A[0] + A[0]; break; }
    out += A[((b2 & 0xf) << 2) | ((b3 || 0) >> 6)];
    if (b3 === undefined) { out += A[0]; break; }
    out += A[b3 & 0x3f];
  }
  return out;
}

function rxRenderPlantuml(text, spec, allowRemote) {
  const root = document.createElement('div');
  root.className = 'rx-media rx-puml';

  const bar = document.createElement('div');
  bar.className = 'rx-puml-bar';
  const msg = document.createElement('span');
  const holder = document.createElement('div');
  holder.className = 'rx-media-svg';
  holder.style.display = 'none';

  const pre = document.createElement('pre');
  pre.className = 'rx-code';
  const code = document.createElement('code');
  code.className = 'hljs';
  code.textContent = text;
  pre.appendChild(code);

  if (allowRemote) {
    msg.textContent = '렌더하려면 소스를 PlantUML 서버로 전송합니다: ' + RX_PLANTUML_SERVER;
    const btn = document.createElement('button');
    btn.className = 'rx-toolbar-btn';
    btn.textContent = '서버로 보내 렌더';
    btn.addEventListener('click', () => {
      btn.disabled = true;
      msg.textContent = '렌더 중…';
      const img = document.createElement('img');
      img.className = 'rx-media-img';
      img.src = RX_PLANTUML_SERVER + rxPlantumlEncode(text);
      img.addEventListener('load', () => {
        msg.textContent = 'PlantUML 서버에서 렌더됨';
        holder.style.display = '';
        pre.style.display = 'none';
      });
      img.addEventListener('error', () => {
        msg.textContent = '서버 렌더 실패 — 소스만 표시합니다';
        btn.disabled = false;
      });
      holder.replaceChildren(img);
    });
    bar.append(msg, btn);
  } else {
    msg.textContent =
      'PlantUML은 로컬 렌더 엔진이 없어 서버 전송이 필요합니다. ' +
      '설정에서 "PlantUML 서버 렌더 허용"을 켜면 버튼이 나타납니다 (기본 꺼짐).';
    bar.appendChild(msg);
  }

  root.append(bar, holder, pre);
  return { node: root, title: spec.file || '', note: 'PlantUML 소스' };
}
