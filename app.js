/* ============================================================================
   OMARCHY 64 — omarchy.org, rebooted as a Commodore 64
   ========================================================================= */

const RES = window.__OM_RES__;

async function loadThree() {
  const src = document.getElementById('three-src').textContent;
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  return await import(url);
}
const THREE = await loadThree();
THREE.ColorManagement.enabled = false;

/* ------------------------------------------------------------- content ---*/
const LINKS = [
  ['MANUAL',       'https://omarchy.org/manual/',                       41],
  ['ISO',          'https://iso.omarchy.org/omarchy-4.0.1.iso',        255],
  ['PLUGINS',      'https://omarchyplugins.com/',                       63],
  ['GITHUB',       'https://github.com/omacom/omarchy',                128],
  ['SECURITY',     'https://omarchy.org/security/',                      9],
  ['NEWS',         'https://omarchy.org/news/',                         22],
  ['TEAMS',        'https://omarchy.org/teams/',                        14],
  ['PATRONS',      'https://omarchy.org/patrons/',                      18],
  ['SPONSORS',     'https://omarchy.org/sponsorships/',                 11],
  ['AIR',          'https://omarchy.org/air/',                          27],
  ['DISCORD',      'https://discord.gg/tXFUdasqhY',                     64],
  ['MEETUPS',      'https://omarchy.org/meetups/',                      12],
  ['WORKSTATIONS', 'https://omarchy.org/workstations/',                 33],
  ['MERCH',        'https://supply.37signals.com/collections/omarchy',  17],
];
const EXTRA = {
  DHH: 'https://dhh.dk/', OMARCH: 'https://omarchs.fyi/', OMARCHS: 'https://omarchs.fyi/',
  BRAND: 'https://omarchy.org/brand/', SIGNALS: 'https://37signals.com/',
  BASECAMP: 'https://basecamp.com/', HEY: 'https://hey.com/', HOME: 'https://omarchy.org/',
  MAIL: 'mailto:david@omarchy.org', CLOUDFLARE: 'https://cloudflare.com/',
};
const TICKER =
  '\u00b7\u00b7\u00b7 OMACOM FOUNDATION LAUNCHES WITH $10 MILLION \u00b7\u00b7\u00b7 ' +
  'BEAUTIFUL, FUN & OPINIONATED LINUX BY DHH \u00b7\u00b7\u00b7 ' +
  'INCUBATED AT 37SIGNALS \u00b7\u00b7\u00b7 SPONSORED HOSTING BY CLOUDFLARE \u00b7\u00b7\u00b7 ' +
  'TYPE HELP FOR THE COMMAND LIST \u00b7\u00b7\u00b7 ';

/* --------------------------------------------------------------- screen ---*/
const PAL = [
  [0, 0, 0], [255, 255, 255], [129, 51, 56], [117, 206, 200],
  [142, 60, 151], [86, 172, 77], [46, 44, 155], [237, 241, 113],
  [142, 80, 41], [85, 56, 0], [196, 108, 113], [74, 74, 74],
  [123, 123, 123], [169, 255, 159], [112, 109, 235], [178, 178, 178],
];
const CSS = PAL.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
const WHITE = 1, CYAN = 3, BLUE = 6, YELLOW = 7, GREEN = 5, LTRED = 10,
      GREY = 12, LTGREEN = 13, LTBLUE = 14, LTGREY = 15;

let SW = 352, SH = 242, COLS = 40, ROWS = 25;
const BX = 16, BY = 21;
/* Pick a character grid that matches the shape of the tube, so the picture
   fills the glass instead of floating in a sea of border. A phone held
   upright gets a genuinely portrait terminal, not a squashed landscape one. */
function gridFor(a) {
  const cols = a >= 1.25 ? 40 : a >= 0.98 ? 36 : a >= 0.72 ? 34 : 30;
  return { cols, rows: Math.max(25, Math.min(60, Math.round(cols / a))) };
}
function wrap(text, w) {
  const out = []; let line = '';
  const flush = () => { if (line.length) { out.push(line); line = ''; } };
  for (let word of String(text).split(' ')) {
    while (word.length > w) { flush(); out.push(word.slice(0, w)); word = word.slice(w); }
    if (!line.length) line = word;
    else if (line.length + 1 + word.length <= w) line += ' ' + word;
    else { flush(); line = word; }
  }
  flush();
  return out.length ? out : [''];
}

function scode(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 0xE000) return c - 0xE000;
  if (c === 64) return 0;
  if (c >= 65 && c <= 90) return c - 64;
  if (c >= 97 && c <= 122) return c - 96;
  if (c === 91) return 27;
  if (c === 93) return 29;
  if (c === 94) return 30;
  if (c === 163) return 28;
  if (c === 183) return 122;
  if (c >= 32 && c <= 63) return c;
  if (c === 95) return 100;
  return 32;
}
function codes(str) { const a = []; for (const ch of str) a.push(scode(ch)); return a; }
const G = (n) => String.fromCharCode(0xE000 + n);
const HLINE = G(64), VLINE = G(93), TL = G(112), TR = G(110), BL = G(109), BR = G(125), BLOCK = G(160);

class Screen {
  constructor(rom) {
    this.cv = document.createElement('canvas');
    this.cv.width = SW; this.cv.height = SH;
    this.ctx = this.cv.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.chars = new Uint8Array(COLS * ROWS).fill(32);
    this.cols = new Uint8Array(COLS * ROWS).fill(LTBLUE);
    this.resize = () => {
      this.cv.width = SW; this.cv.height = SH;
      this.ctx.imageSmoothingEnabled = false;
      this.chars = new Uint8Array(COLS * ROWS).fill(32);
      this.cols = new Uint8Array(COLS * ROWS).fill(this.pen);
      this.cx = 0; this.cy = 0;
    };
    this.border = LTBLUE; this.bg = BLUE; this.pen = LTBLUE;
    this.cx = 0; this.cy = 0;
    this.rasterBands = null; this.overlay = null; this.cursor = null;
    this.buildAtlas(rom);
  }
  buildAtlas(rom) {
    const mask = document.createElement('canvas'); mask.width = 128; mask.height = 128;
    const mc = mask.getContext('2d');
    const id = mc.createImageData(128, 128);
    for (let c = 0; c < 256; c++) {
      const gx = (c & 15) * 8, gy = (c >> 4) * 8;
      for (let r = 0; r < 8; r++) {
        const b = rom[c * 8 + r];
        for (let x = 0; x < 8; x++) {
          const i = ((gy + r) * 128 + gx + x) * 4;
          id.data[i] = id.data[i + 1] = id.data[i + 2] = 255;
          id.data[i + 3] = ((b >> (7 - x)) & 1) ? 255 : 0;
        }
      }
    }
    mc.putImageData(id, 0, 0);
    this.mask = mask;
    this.atlas = PAL.map((_, i) => {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      const cc = cv.getContext('2d');
      cc.drawImage(mask, 0, 0);
      cc.globalCompositeOperation = 'source-in';
      cc.fillStyle = CSS[i]; cc.fillRect(0, 0, 128, 128);
      return cv;
    });
  }
  clear() { this.chars.fill(32); this.cols.fill(this.pen); this.cx = 0; this.cy = 0; }
  clearRows(r0, r1) {
    for (let r = r0; r <= r1; r++)
      for (let c = 0; c < COLS; c++) { this.chars[r * COLS + c] = 32; this.cols[r * COLS + c] = this.pen; }
  }
  put(c, r, code, col) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    this.chars[r * COLS + c] = code & 255;
    this.cols[r * COLS + c] = (col === undefined ? this.pen : col) & 15;
  }
  at(c, r, str, col, rev) {
    const cs = codes(str);
    for (let i = 0; i < cs.length; i++) this.put(c + i, r, rev ? (cs[i] + 128) & 255 : cs[i], col);
  }
  centre(r, str, col, rev) { this.at(Math.max(0, (COLS - [...str].length) >> 1), r, str, col, rev); }
  scrollUp(r0, r1) {
    for (let r = r0; r < r1; r++)
      for (let c = 0; c < COLS; c++) {
        this.chars[r * COLS + c] = this.chars[(r + 1) * COLS + c];
        this.cols[r * COLS + c] = this.cols[(r + 1) * COLS + c];
      }
    for (let c = 0; c < COLS; c++) { this.chars[r1 * COLS + c] = 32; this.cols[r1 * COLS + c] = this.pen; }
  }
  nl() { this.cx = 0; this.cy++; if (this.cy >= ROWS) { this.cy = ROWS - 1; this.scrollUp(0, ROWS - 1); } }
  type(str) {
    for (const ch of str) {
      if (ch === '\n') { this.nl(); continue; }
      this.put(this.cx, this.cy, codes(ch)[0], this.pen);
      this.cx++; if (this.cx >= COLS) this.nl();
    }
  }
  render(t, cursorOn) {
    const x = this.ctx;
    x.fillStyle = CSS[this.border]; x.fillRect(0, 0, SW, SH);
    if (this.rasterBands) {
      for (let y = 0; y < SH; y += 2) { x.fillStyle = CSS[this.rasterBands(y, t)]; x.fillRect(0, y, SW, 2); }
    }
    x.fillStyle = CSS[this.bg]; x.fillRect(BX, BY, COLS * 8, ROWS * 8);
    for (let r = 0; r < ROWS; r++) {
      const rb = BY + r * 8;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, code = this.chars[i];
        if (code === 32) continue;
        x.drawImage(this.atlas[this.cols[i]], (code & 15) * 8, (code >> 4) * 8, 8, 8, BX + c * 8, rb, 8, 8);
      }
    }
    if (this.overlay) this.overlay(x, t);
    if (cursorOn && this.cursor) {
      const { c, r, col } = this.cursor;
      const code = (this.chars[r * COLS + c] + 128) & 255;
      x.drawImage(this.atlas[col === undefined ? this.pen : col], (code & 15) * 8, (code >> 4) * 8, 8, 8, BX + c * 8, BY + r * 8, 8, 8);
    }
  }
}

const LOGO_GRAD = ['#e2f8ff', '#9aeafc', '#52cdf6', '#2ba8f0', '#2f7de6', '#4d5cd7', '#7440c4', '#a52f9c'];
/* the omarchy.org wordmark, verbatim: the site draws it as block art in a <pre>.
   F = full block, U = upper half, L = lower half, . = blank. 81 cells x 10 rows. */
const LOGO_ART = [
  '.................LLL.............................................................',
  '.LFFFFFL....LFFFFFFFFFFFL....LFFFFFFF...LFFFFFFF...LFFFFFFF...LF...FL....LF...FL.',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF..FFF...FFF..FFF...FU...FFF...FFF..FFF...FFF',
  'FFF...FFF..FFF...FFF...FFF.LFFFLLLFFF.LFFFLLLFFU..FFF.......LFFFLLLFFFL.FFFLLLFFF',
  'FFF...FFF..FFF...FFF...FFF.UFFFUUUFFF.UFFFUUUU....FFF......UUFFFUUUFFF..UUUUUUFFF',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF.FFFFFFFFFF..FFF...FL...FFF...FFF..LFF...FFF',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF',
  '.UFFFFFU....UF...FFF...FU...FFF...FU...FFF...FFF..FFFFFFFU...FFF...FU....UFFFFFU.',
  '.......................................FFF...FU..................................',
];
function makeLogo(px) {
  const S = px || 2;                                  /* px per source half-cell */
  const W = LOGO_ART[0].length * S, H = LOGO_ART.length * 2 * S;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#fff';
  for (let r = 0; r < LOGO_ART.length; r++) {
    const row = LOGO_ART[r], y = r * 2 * S;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === 'F') c.fillRect(i * S, y, S, S * 2);
      else if (ch === 'U') c.fillRect(i * S, y, S, S);
      else if (ch === 'L') c.fillRect(i * S, y + S, S, S);
    }
  }
  c.globalCompositeOperation = 'source-atop';        /* brand gradient, as raster bars */
  const g = c.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i < LOGO_GRAD.length; i++) g.addColorStop(i / (LOGO_GRAD.length - 1), LOGO_GRAD[i]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}

/* ---------------------------------------------------------------- audio ---*/
const Snd = {
  ctx: null, master: null, vol: 0.5,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol * 0.4;
    this.master.connect(this.ctx.destination);
  },
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v * 0.4; },
  beep(freq, dur, type = 'square', gain = 0.14, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.03);
  },
  key() { this.beep(1500 + Math.random() * 500, 0.02, 'square', 0.045, -700); },
  noise(dur, gain = 0.05, f = 900, q = 3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = gain;
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t);
  },
  drive(on) {
    if (!this.ctx) return;
    if (on) {
      if (this._dr) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      const g = this.ctx.createGain(); g.gain.value = 0.0001;
      g.gain.linearRampToValueAtTime(0.06, t + 0.1);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start();
      this._dr = { o, g };
    } else if (this._dr) {
      const t = this.ctx.currentTime, d = this._dr; this._dr = null;
      d.g.gain.linearRampToValueAtTime(0.0001, t + 0.15);
      try { d.o.stop(t + 0.25); } catch (e) {}
    }
  },
  power(up) { this.beep(up ? 95 : 700, up ? 0.45 : 0.32, 'sine', 0.15, up ? 850 : -640); this.noise(0.16, 0.045, 2600, 1); },
};

/* -------------------------------------------------------------- machine ---*/
const rom = Uint8Array.from(atob(RES.rom), (c) => c.charCodeAt(0));
const scr = new Screen(rom);
const LOGO = makeLogo(2);

const M = {
  mode: 'boot', page: 'menu', sel: 0, input: '', status: '', statusCol: LTBLUE,
  statusT: 0, tick: 0, tickerOff: 0, driveLed: 0, powered: true, maze: null,
  hits: [], hover: null, doc: null,
};

const HINTS = [
  'CRSR KEYS TO MOVE \u00b7 RETURN TO LAUNCH',
  'OR JUST TYPE A NAME AND HIT RETURN',
  'TYPE  HELP  FOR THE COMMAND LIST',
  'TYPE  ISO  TO GRAB THE IMAGE',
  'TRY TYPING  10 PRINT',
  'THE 10 PRINT MAZE STILL RUNS FOREVER',
  'THE POWER SWITCH WORKS. OF COURSE IT DOES.',
  'DRAG THE KNOBS. IT IS A REAL MONITOR.',
];

function say(msg, col = LTGREEN) { M.status = msg; M.statusCol = col; M.statusT = 7; }

/* ----------------------------------------------------------------- pages --*/
function drawFrame() {
  scr.at(0, 0, BLOCK.repeat(COLS), LTGREY);
  scr.at(0, 0, ' OMARCHY/64 ', LTGREY, true);
  const right = COLS >= 38 ? ' V4.0.1 \u00b7 38911 BYTES FREE ' : ' V4.0.1 ';
  scr.at(COLS - right.length, 0, right, LTGREY, true);
}

function drawTicker() {
  let out = '';
  for (let i = 0; i < COLS; i++) out += TICKER[(M.tickerOff + i) % TICKER.length];
  scr.at(0, ROWS - 1, out, CYAN, true);
}

function pageMenu() {
  scr.clearRows(1, ROWS - 3);
  M.hits = [];
  const stack = COLS < 38;
  scr.overlay = (x) => {
    const w = LOGO.width, h = LOGO.height;
    const px = Math.round(BX + (COLS * 8 - w) / 2), py = BY + 8;
    x.imageSmoothingEnabled = false;
    x.drawImage(LOGO, px, py, w, h);
  };
  let r = 1 + Math.ceil(LOGO.height / 8);
  for (const t of (COLS >= 36 ? ['BEAUTIFUL, FUN & OPINIONATED LINUX']
                              : wrap('BEAUTIFUL, FUN & OPINIONATED LINUX', COLS - 2)))
    scr.centre(r++, t, LTGREY);
  scr.centre(r++, 'BY DHH', WHITE);
  r++;
  const blurb = COLS >= 40
    ? ['THE MALLEABLE OS FOR THE AGE OF AGENTS.',
       'VIBE YOUR WAY THROUGH EVERY ALTERATION,',
       'TWEAK, AND DESIRE. BE THE OMARCH.']
    : wrap('THE MALLEABLE OS FOR THE AGE OF AGENTS. VIBE YOUR WAY THROUGH ' +
           'EVERY ALTERATION, TWEAK, AND DESIRE. BE THE OMARCH.', COLS - 2);
  for (const t of blurb) scr.centre(r++, t, CYAN);

  const listRows = stack ? LINKS.length : 7;
  const top = Math.min(ROWS - 5 - listRows, r + Math.max(1, Math.floor(((ROWS - 4 - r) - (listRows + 2)) / 2)));
  const bar = COLS - 4, cap = ' MAIN MENU ';
  const lead = Math.floor((bar - cap.length) / 2);
  scr.at(1, top, TL + HLINE.repeat(lead) + cap + HLINE.repeat(bar - lead - cap.length) + TR, LTBLUE);
  const colW = Math.floor((COLS - 4) / 2);
  const labW = stack ? COLS - 7 : colW - 4;
  for (let i = 0; i < LINKS.length; i++) {
    const row = top + 1 + (stack ? i : i % 7);
    const x = stack ? 2 : 2 + (i < 7 ? 0 : colW);
    scr.put(1, row, 93, LTBLUE); scr.put(COLS - 2, row, 93, LTBLUE);
    const label = String(i + 1).padStart(2, ' ') + ' ' + LINKS[i][0].padEnd(labW, ' ').slice(0, labW);
    if (i === M.sel) scr.at(x, row, label, CYAN, true);
    else { scr.at(x, row, label, WHITE); scr.at(x, row, String(i + 1).padStart(2, ' '), CYAN); }
    M.hits.push({ r: row, x0: x, x1: x + label.length - 1, menu: i });
  }
  scr.at(1, top + listRows + 1, BL + HLINE.repeat(bar) + BR, LTBLUE);
  const footR = ROWS - 5;
  if (footR > top + listRows + 3)
    scr.centre(footR, COLS >= 36 ? 'CRSR KEYS AND RETURN, OR TYPE A NUMBER'
                                 : 'CRSR + RETURN, OR A NUMBER', LTGREY);
}

/* Lay a scraped omarchy.org page out for a 40-column tube: headings in the
   frame colours, paragraphs word-wrapped, links printed the way a terminal
   would print them. Everything the site says, nothing it doesn't. */
/* Split a paragraph into sentences so body copy lands in short blocks with
   air between them. Very short sentences ride along with the previous one so
   the page doesn't turn into confetti. */
/* mailto query strings and scheme noise are not worth a line of a C64 screen */
function pretty(url) {
  return url.replace(/^https?:\/\//, '').replace(/^mailto:/i, '').replace(/\?.*$/, '')
            .replace(/\/+$/, '').toUpperCase();
}

function sentences(text) {
  const out = [];
  let buf = '';
  for (const part of String(text).split(/(?<=[.!?])\s+/)) {
    if (!part) continue;
    if (buf && buf.length + 1 + part.length <= 30) { buf += ' ' + part; continue; }
    if (buf) out.push(buf);
    buf = part;
  }
  if (buf) out.push(buf);
  return out;
}

function docLines(key, width) {
  const p = PAGES[key];
  const out = [];
  let lastH3 = '';
  const push = (t, c, u) => out.push([t, c, u]);
  for (const n of p.n) {
    const kind = n[0];
    if (kind === 'H2') {
      if (out.length) push('', GREY);
      const h = wrap(n[1], width);
      for (const l of h) push(l, YELLOW);
      push(HLINE.repeat(Math.max(...h.map((l) => l.length))), CYAN);
    } else if (kind === 'H3') {
      if (out.length) push('', GREY);
      lastH3 = n[1];
      for (const l of wrap(n[1], width)) push(l, YELLOW);
    } else if (kind === 'P') {
      /* one sentence per block, continuation lines hang two columns in */
      for (const s of sentences(n[1])) {
        wrap(s, width - 2).forEach((l, i) => push((i ? '  ' : '') + l, WHITE));
        push('', GREY);
      }
    } else if (kind === 'LI') {
      wrap(n[1], width - 2).forEach((l, i) => push((i ? '  ' : '- ') + l, CYAN));
      push('', GREY);
    } else if (kind === 'KV') {
      wrap(n[1] + ': ' + n[2], width - 2).forEach((l, i) => push((i ? '  ' : '') + l, LTGREY));
    } else if (kind === 'A') {
      if (n[1] !== lastH3) for (const l of wrap(n[1], width)) push(l, LTGREEN, n[2]);
      /* don't echo the destination when the label already is it */
      const shown = pretty(n[2]);
      if (shown !== n[1]) for (const l of wrap(shown, width - 2)) push('  ' + l, CYAN, n[2]);
    }
  }
  /* never stack two blank rows, and never open the page on one */
  const tidy = [];
  for (const ln of out)
    if (ln[0] || (tidy.length && tidy[tidy.length - 1][0])) tidy.push(ln);
  while (tidy.length && !tidy[tidy.length - 1][0]) tidy.pop();
  return tidy;
}

function pageDoc() {
  const d = M.doc;
  scr.overlay = null;
  scr.clearRows(1, ROWS - 3);
  M.hits = [];
  const bar = COLS - 4, top = 1, bot = ROWS - 4, inner = bot - top - 1;
  const cap = ' ' + d.title.slice(0, bar - 4) + ' ';
  scr.at(1, top, TL + HLINE.repeat(bar) + TR, LTBLUE);
  scr.at(3, top, cap, WHITE);
  scr.at(1, bot, BL + HLINE.repeat(bar) + BR, LTBLUE);
  const max = Math.max(0, d.lines.length - inner);
  d.off = Math.max(0, Math.min(max, d.off));
  for (let i = 0; i < inner; i++) {
    const r = top + 1 + i;
    scr.put(1, r, 93, LTBLUE); scr.put(COLS - 2, r, 93, LTBLUE);
    const ln = d.lines[d.off + i];
    if (!ln) continue;
    const txt = ln[0].slice(0, COLS - 6);
    const on = ln[2] && M.hover && M.hover.r === r;
    scr.at(3, r, txt, on ? WHITE : ln[1], !!on);
    if (ln[2]) M.hits.push({ r, x0: 3, x1: 2 + txt.length, url: ln[2] });
  }
  if (max > 0) {                                   /* a little lift bar */
    const h = Math.max(1, Math.round(inner * inner / d.lines.length));
    const y = Math.round((inner - h) * (d.off / max));
    for (let i = 0; i < h; i++) scr.put(COLS - 2, top + 1 + y + i, 160, CYAN);
  }
  const foot = max > 0 ? 'CRSR/SPACE SCROLLS \u00b7 RUN GOES BACK'
                       : 'RUN GOES BACK TO THE MENU';
  scr.at(0, ROWS - 3, foot.slice(0, COLS), LTGREY);
}

function openDoc(key) {
  const p = PAGES[key];
  M.doc = { key, title: p.t, off: 0, lines: docLines(key, COLS - 6) };
  M.page = 'doc';
  say('LOADING ' + key + ' \u00b7\u00b7\u00b7', LTGREEN);
  Snd.beep(300, 0.06, 'square', 0.09, 520);
  repaint();
}

function pageText(lines, title) {
  scr.overlay = null;
  scr.clearRows(1, ROWS - 3);
  M.hits = [];
  const bar = COLS - 4, top = 2, bot = ROWS - 4, W = COLS - 6;
  scr.at(1, top, TL + HLINE.repeat(bar) + TR, LTBLUE);
  scr.at(3, top, ' ' + title.slice(0, bar - 4) + ' ', WHITE);
  scr.at(1, bot, BL + HLINE.repeat(bar) + BR, LTBLUE);
  for (let q = top + 1; q < bot; q++) { scr.put(1, q, 93, LTBLUE); scr.put(COLS - 2, q, 93, LTBLUE); }
  let r = top + 2;
  for (const raw of lines) {
    if (r >= bot) break;
    const l = typeof raw === 'string' ? [raw, LTBLUE, 0] : raw;
    /* nothing may run under the right rail: re-wrap anything wider than the tube */
    const parts = l[0].length <= W ? [l[0]] : wrap(l[0], W);
    for (let i = 0; i < parts.length && r < bot; i++, r++) {
      scr.at(3, r, parts[i], l[1]);
      if (l[2] && !i) scr.at(3, r, parts[i].slice(0, l[2]), CYAN);
    }
  }
}

function drawPrompt() {
  const hintR = ROWS - 3, readyR = ROWS - 2, room = COLS - 9;
  scr.clearRows(hintR, readyR);
  if (M.status) scr.at(0, hintR, M.status.slice(0, COLS), M.statusCol);
  else {
    const pool = HINTS.filter((h) => h.length <= COLS);
    const list = pool.length ? pool : HINTS;
    scr.at(0, hintR, list[Math.floor(M.tick / 400) % list.length].slice(0, COLS), GREY);
  }
  scr.at(0, readyR, 'READY.', LTGREY);
  scr.at(7, readyR, M.input.slice(-room), WHITE);
  scr.cursor = { c: Math.min(COLS - 1, 7 + Math.min(room, M.input.length)), r: readyR, col: WHITE };
}

function repaint() {
  drawFrame();
  if (M.page === 'menu') pageMenu();
  else if (M.page === 'doc') pageDoc();
  drawPrompt();
  drawTicker();
}

/* -------------------------------------------------------------- commands --*/
/* window.open with a features string gets a stripped popup window; a synthetic
   anchor click is what actually produces a normal background tab. */
function newTab(url) {
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
}

function openLink(url, label) {
  say('LAUNCHING ' + label + ' \u00b7\u00b7\u00b7', LTGREEN);
  Snd.beep(320, 0.08, 'square', 0.11, 640);
  setTimeout(() => Snd.beep(780, 0.11, 'square', 0.11, 380), 85);
  newTab(url);
}

/* a URL that omarchy.org owns opens on the tube, anything else gets a tab */
function follow(url) {
  const row = LINKS.find((l) => l[1].replace(/\/+$/, '') === url.replace(/\/+$/, ''));
  if (row && PAGES[row[0]]) { openDoc(row[0]); return; }
  if (/^mailto:/i.test(url)) {                     /* a tab for mail is silly */
    say('OPENING MAIL \u00b7\u00b7\u00b7', LTGREEN); Snd.beep(320, 0.08, 'square', 0.11, 640);
    window.location.href = url; return;
  }
  openLink(url, (row ? row[0] : pretty(url)).slice(0, 22));
}
function launch(i) {
  M.driveLed = 0.6; setTimeout(() => { M.driveLed = 0; }, 380);
  const key = LINKS[i][0];
  if (PAGES[key]) openDoc(key);            /* first-party pages stay on the tube */
  else openLink(LINKS[i][1], LINKS[i][0]); /* github, discord, merch, the iso ... */
}

const HELP_CMDS = [
  ['RUN', 'BACK TO THE MENU'],
  ['DIR', 'CATALOG THE DISK'],
  ['LIST', 'LIST THE PROGRAM'],
  ['ABOUT', 'WHAT IS THIS THING'],
  ['<NAME>', 'LAUNCH A MENU ENTRY'],
  ['<1 - 14>', 'LAUNCH BY NUMBER'],
  null,
  ['POKE 53280,N', 'BORDER COLOUR 0-15'],
  ['POKE 53281,N', 'SCREEN COLOUR 0-15'],
  ['SYS 64738', 'COLD START'],
  ['10 PRINT', '... YOU KNOW THE ONE'],
];

/* Two columns while the descriptions still fit beside the commands, stacked
   once the tube gets narrow. Either way nothing runs under the right rail. */
function helpLines(w) {
  const cw = Math.max(...HELP_CMDS.filter(Boolean).map((c) => c[0].length));
  const wide = cw + 2 + 16 <= w;
  const out = [['THE OMARCHY/64 COMMAND SET', YELLOW], ''];
  for (const row of HELP_CMDS) {
    if (!row) { out.push(''); continue; }
    if (wide)
      wrap(row[1], w - cw - 2).forEach((s, i) => out.push([
        (i ? ' '.repeat(cw + 2) : row[0].padEnd(cw + 2)) + s, LTGREY, i ? 0 : row[0].length]));
    else {
      out.push([row[0], CYAN]);
      wrap(row[1], w - 2).forEach((s) => out.push(['  ' + s, LTGREY]));
    }
  }
  out.push('', ['CRSR KEYS AND RETURN WORK TOO.', LTGREY]);
  return out;
}
const ABOUT_LINES = [
  ['OMARCHY IS BEAUTIFUL, FUN AND OPINIONATED LINUX BY DHH.', WHITE],
  ['ARCH PLUS HYPRLAND, READY THE SECOND IT BOOTS.', WHITE], '',
  ['THE MALLEABLE OS FOR THE AGE OF AGENTS, WHERE YOU CAN VIBE ' +
   'YOUR WAY THROUGH EVERY ALTERATION, TWEAK, AND DESIRE.', CYAN],
  ['BE THE OMARCH AND COMMAND YOUR AGENT.', CYAN], '',
  ['INCUBATED AT 37SIGNALS, MAKERS OF BASECAMP AND HEY.', LTGREY],
  ['HOSTING BY CLOUDFLARE. PENDING TRADEMARK.', LTGREY], '',
  ['PARTNER OR PATRON? DAVID@OMARCHY.ORG', LTGREEN],
];
const LIST_LINES = [
  ['10 PRINT "OMARCHY"', LTGREEN],
  ['20 REM BEAUTIFUL, FUN, OPINIONATED', GREY],
  ['30 LET OS$ = "ARCH LINUX"', LTGREEN],
  ['40 LET WM$ = "HYPRLAND"', LTGREEN],
  ['50 GOSUB 900 : REM VIBE THE CONFIG', LTGREEN],
  ['60 FOR A = 1 TO AGENTS', LTGREEN],
  ['70   COMMAND A : REM BE THE OMARCH', LTGREEN],
  ['80 NEXT A', LTGREEN],
  ['90 IF NOT BEAUTIFUL THEN GOTO 10', LTGREEN],
  ['100 SYS 40001 : REM SHIP IT', LTGREEN], '',
  ['READY.', LTGREY],
];
function dirLines() {
  const out = [['0 "OMARCHY 4.0.1  " 64 2A', WHITE], ''];
  for (const [n, , b] of LINKS) out.push([String(b).padStart(4, ' ') + '  "' + n + '"', LTGREY]);
  out.push('', ['135 BLOCKS FREE.', WHITE]);
  return out;
}

function exec(raw) {
  const cmd = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  M.status = '';
  if (!cmd) { M.page = 'menu'; return; }
  const poke = cmd.match(/^POKE ?(53280|53281) ?, ?(\d+)$/);
  if (poke) {
    const v = parseInt(poke[2], 10) & 15;
    if (poke[1] === '53280') scr.border = v; else scr.bg = v;
    say('OK.', LTGREEN); Snd.beep(950, 0.04); return;
  }
  if (/^SYS ?64738$/.test(cmd)) { coldStart(); return; }
  if (/^(10 ?PRINT|MAZE)/.test(cmd)) { startMaze(); return; }
  if (cmd === 'HELP' || cmd === '?') { M.page = 'help'; pageText(helpLines(COLS - 6), 'HELP'); return; }
  if (cmd === 'ABOUT' || cmd === 'INFO' || cmd === 'NEOFETCH' || cmd === 'FASTFETCH') {
    M.page = 'about'; pageText(ABOUT_LINES, 'OMARCHY 4.0.1 / X86_64'); return;
  }
  if (cmd === 'LIST') { M.page = 'list'; pageText(LIST_LINES, 'LIST'); return; }
  if (cmd === 'DIR' || cmd === 'CATALOG' || cmd === 'LS' || /^LOAD ?"\$"/.test(cmd)) {
    M.page = 'dir'; pageText(dirLines(), 'DEVICE 8 \u00b7 OMARCHY'); Snd.noise(0.35, 0.05, 480, 2); return;
  }
  if (cmd === 'RUN' || cmd === 'MENU' || cmd === 'HOME' || cmd === 'CLR' || cmd === 'CLS') { M.page = 'menu'; return; }
  if (cmd === 'SUDO' || cmd === 'SUDO SU' || cmd === 'ROOT') { say('?PERMISSION DENIED  ERROR', LTRED); Snd.beep(170, 0.18, 'square', 0.11, -60); return; }
  if (cmd === 'VIM' || cmd === ':Q' || cmd === ':Q!' || cmd === 'EXIT') { say('?CANNOT EXIT  ERROR. TRY THE POWER SWITCH.', LTRED); return; }
  if (cmd === 'SYSTEMD') { say('?NOT FOUND  ERROR', LTRED); return; }
  const num = parseInt(cmd, 10);
  if (String(num) === cmd && num >= 1 && num <= 14) { M.sel = num - 1; launch(num - 1); return; }
  const hit = LINKS.findIndex(([n]) => n === cmd || (cmd.length >= 3 && n.startsWith(cmd)));
  if (hit >= 0) { M.sel = hit; M.page = 'menu'; launch(hit); return; }
  if (EXTRA[cmd]) { openLink(EXTRA[cmd], cmd); return; }
  say('?SYNTAX  ERROR', LTRED);
  Snd.beep(180, 0.15, 'square', 0.1, -60);
}

/* ----------------------------------------------------------------- maze ---*/
function startMaze() {
  M.page = 'maze'; M.maze = { r: 1, c: 0, acc: 0 };
  scr.overlay = null; scr.clearRows(1, ROWS - 2); scr.cursor = null;
  scr.at(0, ROWS - 2, ' 10 PRINT CHR$(205.5+RND(1)); : 20 GOTO 10'.slice(0, COLS), LTGREY);
  Snd.noise(0.1, 0.04, 1400, 2);
}
function stepMaze(dt) {
  const m = M.maze; if (!m) return;
  m.acc += dt * 1100;
  while (m.acc > 1) {
    m.acc -= 1;
    scr.put(m.c, m.r, Math.random() < 0.5 ? 77 : 78, [LTBLUE, CYAN, WHITE, LTGREEN][(m.r * 7 + m.c) & 3]);
    m.c++;
    if (m.c >= COLS) { m.c = 0; m.r++; if (m.r > ROWS - 4) { m.r = ROWS - 4; scr.scrollUp(1, ROWS - 4); } }
  }
}

/* -------------------------------------------------------------- boot seq --*/
let bootSeq = [], bootAcc = 0;
function makeBoot() {
  const q = [];
  const wait = (s) => q.push({ t: s });
  const run = (f) => q.push({ t: 0, f });
  wait(0.95);
  run(() => {
    scr.clear(); scr.cy = 1;
    scr.type('    **** OMARCHY 64 BASIC V4.0.1 ****\n\n');
    scr.type(' 64K RAM SYSTEM  38911 BASIC BYTES FREE\n\n');
    scr.type('READY.\n');
    scr.cursor = { c: 0, r: 6 };
    Snd.beep(720, 0.045, 'square', 0.08);
  });
  wait(0.85);
  for (const ch of 'LOAD"OMARCHY*",8,1') {
    run(() => { scr.type(ch); scr.cursor = { c: scr.cx, r: scr.cy }; Snd.key(); });
    wait(0.052);
  }
  wait(0.42);
  run(() => {
    scr.nl(); scr.type('\nSEARCHING FOR OMARCHY*\n');
    scr.cursor = { c: scr.cx, r: scr.cy };
    Snd.drive(true); M.driveLed = 1;
  });
  wait(0.7);
  run(() => { scr.type('LOADING\n'); scr.cursor = { c: 0, r: scr.cy }; });
  wait(0.3);
  run(() => {
    scr.rasterBands = (y, t) => {
      const v = Math.sin(y * 0.29 + t * 8.7) + Math.sin(y * 0.09 - t * 5.1) * 1.4 + Math.sin(y * 0.71 + t * 2.3);
      const idx = [LTBLUE, CYAN, WHITE, 4, BLUE, LTGREEN, YELLOW, LTRED];
      return idx[Math.abs(Math.floor(v * 3 + y * 0.6)) % idx.length];
    };
  });
  wait(2.25);
  run(() => {
    scr.rasterBands = null; scr.border = LTBLUE;
    Snd.drive(false); M.driveLed = 0;
    scr.type('READY.\n'); scr.cursor = { c: 0, r: scr.cy };
  });
  wait(0.45);
  for (const ch of 'RUN') { run(() => { scr.type(ch); scr.cursor = { c: scr.cx, r: scr.cy }; Snd.key(); }); wait(0.1); }
  wait(0.4);
  run(() => {
    M.mode = 'app'; M.page = 'menu'; scr.clear(); repaint();
    Snd.beep(233, 0.07, 'triangle', 0.09, 400);
    setTimeout(() => Snd.beep(466, 0.07, 'triangle', 0.09, 350), 75);
    setTimeout(() => Snd.beep(699, 0.18, 'triangle', 0.09, 250), 150);
  });
  return q;
}
function coldStart() {
  M.mode = 'boot'; M.page = 'menu'; M.sel = 0; M.input = ''; M.status = ''; M.maze = null;
  scr.overlay = null; scr.rasterBands = null; scr.cursor = null;
  scr.border = LTBLUE; scr.bg = BLUE; scr.pen = LTBLUE;
  scr.clear();
  crt.on = 0; crt.target = 1;
  Snd.power(true);
  bootSeq = makeBoot(); bootAcc = 0;
}
function skipBoot() {
  if (M.mode !== 'boot') return;
  bootSeq = []; Snd.drive(false); M.driveLed = 0;
  scr.rasterBands = null; scr.border = LTBLUE; scr.bg = BLUE; scr.pen = LTBLUE;
  crt.on = 1;
  M.mode = 'app'; M.page = 'menu'; scr.clear(); repaint();
}
function stepBoot(dt) {
  if (!bootSeq.length) return;
  bootAcc += dt;
  let guard = 0;
  while (bootSeq.length && bootAcc >= bootSeq[0].t && guard++ < 400) {
    bootAcc -= bootSeq[0].t;
    const s = bootSeq.shift();
    if (s.f) s.f();
  }
}

/* ------------------------------------------------------------- 3d scene ---*/
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const rig = new THREE.Group();
rig.position.set(0, -0.02, 0);
scene.add(rig);

function tex(dataUrl) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.generateMipmaps = true; t.needsUpdate = true;
      res(t);
    };
    img.src = dataUrl;
  });
}
const [texMon, texKbd, texDrv, texFlp, texArt, texDesk, texSpk] = await Promise.all([
  tex(RES.monitor), tex(RES.keyboard), tex(RES.drive), tex(RES.floppy),
  tex(RES.art), tex(RES.desk), tex(RES.speaker),
]);
texDesk.wrapS = texDesk.wrapT = THREE.RepeatWrapping; texDesk.repeat.set(6.2, 2.7);

const screenTex = new THREE.CanvasTexture(scr.cv);
screenTex.minFilter = THREE.LinearFilter; screenTex.magFilter = THREE.NearestFilter;
screenTex.colorSpace = THREE.NoColorSpace; screenTex.generateMipmaps = false;

const rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: false };
let persist = [new THREE.WebGLRenderTarget(SW, SH, rtOpt), new THREE.WebGLRenderTarget(SW, SH, rtOpt)];

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const fullQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
fullQuad.frustumCulled = false;
const fsScene = new THREE.Scene(); fsScene.add(fullQuad);
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function blit(mat, target) { fullQuad.material = mat; renderer.setRenderTarget(target || null); renderer.render(fsScene, fsCam); }

const matPersist = new THREE.ShaderMaterial({
  uniforms: { uNew: { value: screenTex }, uPrev: { value: null }, uDecay: { value: 0.48 } },
  vertexShader: VS,
  fragmentShader: `uniform sampler2D uNew, uPrev; uniform float uDecay; varying vec2 vUv;
    void main(){ vec3 n = texture2D(uNew,vUv).rgb; vec3 p = texture2D(uPrev,vUv).rgb * uDecay;
      gl_FragColor = vec4(max(n,p),1.0); }`,
});

const MON = { w: 1.162, h: 1.0 };
/* the aperture is the whole tube face now: the picture fills the glass */
const SCR3 = { x: 0.0005, y: 0.0305, w: 0.977, h: 0.707, u0: 0.0800, u1: 0.9208, v0: 0.116, v1: 0.823 };
const OVER = 1.030;

/* ---------------------------------------------------------------------------
   The case is a stretchable nine-slice, not one flat quad, so it can fill any
   viewport without smearing the bezel curve, the Commodore badge or the knobs.
   Bands marked 'f' are pinned to their pixel size, 's' bands are plain plastic
   that soaks up the slack, and 'S' is the tube aperture itself.               */
const TEXW = 1162, TEXH = 1000;
const AP = { x0: 93, x1: 1070, y0: 116, y1: 823 };
const COLB = [[0,45,'f'],[45,80,'s'],[80,150,'f'],[150,1010,'S'],[1010,1085,'f'],[1085,1120,'s'],[1120,1162,'f']];
const ROWB = [[0,45,'f'],[45,85,'s'],[85,175,'f'],[175,765,'S'],[765,845,'f'],[845,872,'s'],[872,1000,'f']];
const STRB = [[0,500,'f'],[500,650,'s'],[650,1162,'f']];   /* badge | gap | knobs */
const GLASS_MIN = 0.40, GLASS_MAX = 1.70;                  /* plausible tube shapes */
const CASE = { w: 1.162, h: 1, u: 0.001, oy: 0, cols: [], rows: [], strip: [], ap: { x: 0, y: 0, w: 1, h: 1 } };

function solveBands(defs, total, u, mid) {
  let fixed = 0, sNat = 0;
  for (const d of defs) {
    const n = (d[1] - d[0]) * u;
    if (d[2] === 'f') fixed += n; else if (d[2] === 's') sNat += n;
  }
  const slack = Math.max(0, total - fixed - mid);
  const out = []; let p = 0;
  for (const d of defs) {
    const n = (d[1] - d[0]) * u;
    const size = d[2] === 'S' ? mid : d[2] === 's' ? (sNat > 0 ? slack * n / sNat : 0) : n;
    out.push({ t0: d[0], t1: d[1], a: p, b: p + size });
    p += size;
  }
  return out;
}
function bandAt(bands, t) {
  for (const b of bands) if (t <= b.t1) return b.a + (b.b - b.a) * ((t - b.t0) / (b.t1 - b.t0));
  return bands[bands.length - 1].b;
}
const mapX = (t) => -CASE.w / 2 + bandAt(CASE.cols, t);
const mapY = (t) =>  CASE.h / 2 - bandAt(CASE.rows, t);

function solveCase(cw, ch) {
  const stripFix = 500 + (TEXW - 650);                 /* badge + knob cluster  */
  const colFix   = 45 + 70 + 75 + 42;                  /* pinned side bands     */
  let u = Math.min(0.001, (cw - 0.03) / stripFix, (cw - 0.06) / colFix, ch / 900);
  u = Math.max(u, 0.00016);
  const edgeW = colFix * u, edgeH = (45 + 90 + 80 + 128) * u;
  const sNatW = 70 * u, sNatH = 67 * u;
  let midW = Math.max(0.04, cw - edgeW - sNatW);
  let midH = Math.max(0.04, ch - edgeH - sNatH);
  const lipW = (150 - AP.x0 + AP.x1 - 1010) * u;       /* aperture inside the pins */
  const lipH = (175 - AP.y0 + AP.y1 - 765) * u;
  let apW = midW + lipW, apH = midH + lipH;
  const a = apW / apH;
  if (a > GLASS_MAX) { apW = apH * GLASS_MAX; midW = Math.max(0.04, apW - lipW); }
  else if (a < GLASS_MIN) { apH = apW / GLASS_MIN; midH = Math.max(0.04, apH - lipH); }
  CASE.w = cw; CASE.h = ch; CASE.u = u;
  CASE.cols  = solveBands(COLB, cw, u, midW);
  CASE.rows  = solveBands(ROWB, ch, u, midH);
  CASE.strip = solveBands(STRB, cw, u, 0);
  CASE.oy = ch / 2 - 0.508;                            /* crop the top, keep the knobs */
  const x0 = mapX(AP.x0), x1 = mapX(AP.x1), y0 = mapY(AP.y0), y1 = mapY(AP.y1);
  CASE.ap = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y0 - y1 };
}

function buildCaseGeo() {
  const pos = [], uvs = [], idx = [];
  const quad = (tx0, tx1, ty0, ty1, X0, X1, Y0, Y1) => {
    const n = pos.length / 3;
    pos.push(X0, Y1, 0, X1, Y1, 0, X1, Y0, 0, X0, Y0, 0);
    const u0 = tx0 / TEXW, u1 = tx1 / TEXW, v0 = 1 - ty0 / TEXH, v1 = 1 - ty1 / TEXH;
    uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  CASE.rows.forEach((r, ri) => {
    const cols = ri >= 5 ? CASE.strip : CASE.cols;     /* the strip keeps its own split */
    const Y0 = CASE.h / 2 - r.a, Y1 = CASE.h / 2 - r.b;
    if (Y0 - Y1 < 1e-6) return;
    for (const c of cols) {
      if (c.b - c.a < 1e-6) continue;
      if (ri === 3 && c.t0 === 150) continue;          /* the hole in the middle */
      quad(c.t0, c.t1, r.t0, r.t1, -CASE.w / 2 + c.a, -CASE.w / 2 + c.b, Y0, Y1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}
function makeScreenGeo(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 64, 44);
  const p = g.attributes.position;
  const bulge = 0.050 * Math.min(w, h);
  for (let i = 0; i < p.count; i++) {
    const u = Math.min(1, Math.abs(p.getX(i) / (w * 0.5)));
    const v = Math.min(1, Math.abs(p.getY(i) / (h * 0.5)));
    p.setZ(i, bulge * Math.cos(u * 1.15) * Math.cos(v * 1.15));
  }
  p.needsUpdate = true; return g;
}
const screenGeo = makeScreenGeo(SCR3.w * OVER, SCR3.h * OVER);

const crt = {
  on: 0, target: 1, bright: 1, contrast: 1,
  uniforms: {
    uTex: { value: persist[0].texture },
    uRes: { value: new THREE.Vector2(SW, SH) },
    uTime: { value: 0 }, uOn: { value: 0 }, uBright: { value: 1 },
    uContrast: { value: 1 }, uDpr: { value: 1 }, uFlash: { value: 0 }, uGlow: { value: 0.19 },
    uFit: { value: new THREE.Vector2(1, 1) },
  },
};

const matScreen = new THREE.ShaderMaterial({
  uniforms: crt.uniforms,
  vertexShader: VS,
  fragmentShader: `
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uRes;
  uniform float uTime, uOn, uBright, uContrast, uDpr, uFlash, uGlow;
  uniform vec2 uFit;
  varying vec2 vUv;
  vec3 samp(vec2 uv){
    vec2 p = uv * uRes; vec2 i = floor(p) + 0.5;
    vec2 f = clamp((p - i) * 3.2, -0.5, 0.5);
    return texture2D(uTex, (i + f) / uRes).rgb;
  }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    vec2 c = uv * 2.0 - 1.0;
    vec2 o = abs(c.yx) / vec2(17.0, 14.0);
    c += c * o * o;
    float openY = smoothstep(0.0, 0.62, uOn);
    float openX = smoothstep(0.0, 0.20, uOn);
    c.y /= max(openY, 0.0008);
    c.x /= max(openX, 0.0008);
    vec2 s = c * 0.5 + 0.5;
    float inside = step(0.0, s.x) * step(s.x, 1.0) * step(0.0, s.y) * step(s.y, 1.0);
    /* the 40x25 block keeps its shape; the C64 border spills out to the glass
       edge on its own because the canvas clamps to its border-coloured rim. */
    s = 0.5 + (s - 0.5) * uFit;
    vec2 sc = clamp(s, 0.0, 1.0);
    float ca = 0.0006 + 0.0019 * dot(c, c);
    vec3 col;
    col.r = samp(clamp(s + vec2(ca, 0.0), 0.0, 1.0)).r;
    col.g = samp(sc).g;
    col.b = samp(clamp(s - vec2(ca, 0.0), 0.0, 1.0)).b;
    col *= inside;
    vec3 gl = vec3(0.0);
    gl += samp(clamp(s + vec2( 0.0060, 0.0), 0.0, 1.0));
    gl += samp(clamp(s + vec2(-0.0060, 0.0), 0.0, 1.0));
    gl += samp(clamp(s + vec2(0.0,  0.0090), 0.0, 1.0));
    gl += samp(clamp(s + vec2(0.0, -0.0090), 0.0, 1.0));
    gl += samp(clamp(s + vec2( 0.0140, 0.0190), 0.0, 1.0));
    gl += samp(clamp(s + vec2(-0.0140,-0.0190), 0.0, 1.0));
    gl += samp(clamp(s + vec2( 0.0260,-0.0330), 0.0, 1.0));
    gl += samp(clamp(s + vec2(-0.0260, 0.0330), 0.0, 1.0));
    gl *= 0.125 * inside;
    float sl = sin(s.y * uRes.y * 3.14159265);
    float scan = 1.0 - 0.17 * sl * sl;
    float m = mod(gl_FragCoord.x / max(uDpr * 0.62, 1.0), 3.0);
    vec3 mask = (m < 1.0) ? vec3(1.12, 0.80, 0.88)
              : (m < 2.0) ? vec3(0.80, 1.12, 0.88)
                          : vec3(0.88, 0.80, 1.12);
    col = col * scan * mask * 0.94;
    col += gl * uGlow;
    col += col * col * 0.11;
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 4.0) * uBright;
    col *= 1.0 + 0.030 * smoothstep(0.86, 1.0, sin(s.y * 3.2 - uTime * 0.55));
    col *= 1.0 + 0.013 * sin(uTime * 96.0);
    col *= clamp(1.0 - 0.30 * dot(c * 0.80, c * 0.80), 0.0, 1.0);
    float sheen = smoothstep(0.55, -0.35, uv.x + uv.y * 0.75) * 0.022;
    sheen += pow(max(0.0, 1.0 - length((uv - vec2(0.20, 0.84)) * vec2(1.45, 2.7))), 3.0) * 0.040;
    col += vec3(0.62, 0.72, 1.0) * sheen * (0.30 + 0.70 * uOn);
    col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.020;
    col += vec3(0.78, 0.86, 1.0) * uFlash;
    col += vec3(0.013, 0.014, 0.021) * (1.0 - uOn);
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`,
});
const screenMesh = new THREE.Mesh(screenGeo, matScreen);
screenMesh.position.set(SCR3.x, SCR3.y + 0.02, -0.042);
screenMesh.renderOrder = 1;
rig.add(screenMesh);

/* the black tube surround behind the glass, so the bezel cut-out never shows the room */
const matTube = new THREE.ShaderMaterial({
  uniforms: { uGlow: { value: new THREE.Color(0.3, 0.3, 0.7) }, uAmount: { value: 0 } },
  vertexShader: VS,
  fragmentShader: `uniform vec3 uGlow; uniform float uAmount; varying vec2 vUv;
    void main(){
      vec2 c = vUv * 2.0 - 1.0;
      float e = max(abs(c.x), abs(c.y));
      vec3 col = vec3(0.017, 0.018, 0.024);
      col += uGlow * uAmount * 0.085 * (1.0 - smoothstep(0.70, 1.0, e));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const tubeBack = new THREE.Mesh(new THREE.PlaneGeometry(SCR3.w * 1.04, SCR3.h * 1.06), matTube);
tubeBack.position.set(SCR3.x, SCR3.y + 0.02, -0.078);
tubeBack.renderOrder = 0;
rig.add(tubeBack);

function hardwareMat(map, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uAmbient: { value: o.ambient !== undefined ? o.ambient : 0.26 },
      uGlow: { value: new THREE.Color(0.3, 0.3, 0.7) },
      uAmount: { value: 0 },
      uCenter: { value: new THREE.Vector3(0, 0.06, 0) },
      uFall: { value: o.fall !== undefined ? o.fall : 1.15 },
      uTop: { value: o.top !== undefined ? o.top : 0.10 },
    },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D map; uniform float uAmbient, uAmount, uFall, uTop;
      uniform vec3 uGlow, uCenter; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.004) discard;
        float d = length(vW - uCenter);
        float g = uAmount / (1.0 + uFall * d * d * 2.2);
        vec3 warm = vec3(1.0, 0.94, 0.83) * (uAmbient + uTop * vUv.y);
        gl_FragColor = vec4(t.rgb * (warm + uGlow * g * 1.42), t.a);
      }`,
  });
}
function plane(map, w, aspect, o) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), hardwareMat(map, o));
  rig.add(m); return m;
}
const DESK_Y = -0.37;                    /* the timber the whole scene stands on */
solveCase(MON.w, MON.h);
const monitor = new THREE.Mesh(buildCaseGeo(), hardwareMat(texMon, { ambient: 0.235, fall: 0.85, top: 0.06 }));
rig.add(monitor);
monitor.position.set(0, 0, 0); monitor.renderOrder = 2;

const keyboard = plane(texKbd, 1.36, 1400 / 621, { ambient: 0.215, fall: 1.45, top: 0.18 });
keyboard.position.set(0, -0.635, 0.42); keyboard.rotation.x = -1.15; keyboard.renderOrder = 3;

const drive = plane(texDrv, 0.78, 1200 / 597, { ambient: 0.195, fall: 1.5, top: 0.13 });
drive.position.set(0.985, -0.445, 0.08); drive.rotation.set(-0.30, -0.16, 0); drive.renderOrder = 3;

const floppy = plane(texFlp, 0.325, 900 / 931, { ambient: 0.225, fall: 1.6, top: 0.14 });
floppy.position.set(-0.945, -0.655, 0.50); floppy.rotation.set(-1.24, 0.16, 0.16); floppy.renderOrder = 3;

/* -- seat the cut-outs on the desk ----------------------------------------
   Each of these was authored as a flat sticker sitting at roughly z = 0, so
   nothing actually touched the timber. Slide each one down its own view ray
   until its base meets the desk plane, then scale it by the same factor: the
   silhouette on screen is untouched, but the kit now genuinely stands on the
   desk, which is what makes the contact shadows and the parallax read. */
const SOLO = true;                                     /* only the 1702 is on screen */
const SEAT_EYE = new THREE.Vector3(0, -0.02, 3.566);   /* the resting camera */
const CONTACTS = [];
function seat(obj, w, h, depth, shade) {
  rig.updateMatrixWorld(true);
  const base = obj.localToWorld(new THREE.Vector3(0, -h / 2, 0));
  const k = (DESK_Y - SEAT_EYE.y) / (base.y - SEAT_EYE.y);
  const p = obj.getWorldPosition(new THREE.Vector3());
  obj.position.copy(rig.worldToLocal(SEAT_EYE.clone().addScaledVector(p.clone().sub(SEAT_EYE), k)));
  obj.scale.setScalar(k);
  rig.updateMatrixWorld(true);
  const c = obj.localToWorld(new THREE.Vector3(0, -h / 2, 0));
  /* the base point is the FRONT of the footprint, so the box runs backwards */
  const hz = depth * k * 0.5;
  CONTACTS.push([c.x, c.z - hz, w * k * 0.5, hz, -obj.rotation.y, shade]);
}
/* solo framing: nothing stands on a desk any more, so leave the tube at 1:1.
   Seating dollies and scales its plane, which would break the alignment
   between the case, the punched aperture, the picture and the power LED. */
if (!SOLO) {
  seat(monitor,  MON.w, MON.h,             0.46, 0.94);
  seat(keyboard, 1.36,  1.36 * 621 / 1400, 0.44, 0.90);
  seat(drive,    0.78,  0.78 * 597 / 1200, 0.42, 0.88);
  seat(floppy,   0.325, 0.325 * 931 / 900, 0.30, 0.62);
}

function ledMat(hex) {
  return new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uCol: { value: new THREE.Color(hex) } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: VS,
    fragmentShader: `uniform float uOn; uniform vec3 uCol; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0;
        float core = smoothstep(0.30, 0.0, d), halo = smoothstep(1.0, 0.05, d);
        gl_FragColor = vec4(uCol * (core * 1.7 + halo * 0.5) * uOn, 1.0); }`,
  });
}
function ledMesh(mat, size) { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); m.renderOrder = 8; return m; }

const mLedPower = ledMat(0x6dff9a), mLedDrvR = ledMat(0xff4a35),
      mLedDrvG = ledMat(0x5cff7a), mLedKbd = ledMat(0xff5c46);
const ledPower = ledMesh(mLedPower, 0.05);
ledPower.position.set((0.8885 - 0.5) * MON.w, (0.5 - 0.893) * MON.h + 0.02, 0.01);
rig.add(ledPower);

/* -- solo framing ---------------------------------------------------------
   The page is a single object now: the 1702 and its bezel, filling the view.
   The rest of the desk still exists in the graph (the boot sequence drives its
   LEDs and the shaders share uniforms) but nothing else is drawn. */
for (const o of [keyboard, drive, floppy]) o.visible = false;
const ledDrvR = ledMesh(mLedDrvR, 0.05); ledDrvR.position.set(-0.242, -0.112, 0.004); drive.add(ledDrvR);
const ledDrvG = ledMesh(mLedDrvG, 0.045); ledDrvG.position.set(-0.242, -0.146, 0.004); drive.add(ledDrvG);
const ledKbd = ledMesh(mLedKbd, 0.055); ledKbd.position.set(0.497, 0.252, 0.004); keyboard.add(ledKbd);

/* ------------------------------------------------------- the room ------ */
/* A dark study at night: pale plaster wall, pale-oak desk, a big canvas print
   of the Omarchy landscape on the wall, a studio monitor off to the right.
   Everything is lit almost entirely by the CRT, so each surface takes the
   live screen colour (uGlow / uAmount) as a coloured bounce light.          */

const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }`;
const WVS = `varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w; }`;

const WALL_Z = -2.20;
const roomU = () => ({ uGlow: { value: new THREE.Color(0.2, 0.2, 0.6) }, uAmount: { value: 0 }, uTime: { value: 0 } });

/* -- wall ---------------------------------------------------------------- */
const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.ShaderMaterial({
  uniforms: roomU(), depthWrite: true,
  vertexShader: WVS,
  fragmentShader: `uniform vec3 uGlow; uniform float uAmount, uTime; varying vec2 vUv; varying vec3 vW;
    ${NOISE}
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 p = vec2(vW.x, vW.y - 0.10);
      float mott = vn(vW.xy * 1.7) * 0.6 + vn(vW.xy * 4.6) * 0.3 + vn(vW.xy * 11.0) * 0.1;
      float r = length(p * vec2(0.62, 0.80));
      /* base plaster, warm-neutral, almost black away from the tube */
      vec3 base = vec3(0.108, 0.100, 0.099);
      float key  = exp(-r * 0.62) * 0.92;                       /* CRT keylight   */
      float amb  = 0.055 + 0.045 * smoothstep(-2.4, 2.6, vW.y);  /* faint sky fill */
      vec3 col = base * (0.80 + mott * 0.42) * (amb + key * 0.50);
      col += vec3(0.030, 0.020, 0.012) * exp(-length(vW.xy - vec2(-3.4, 2.4)) * 0.40);
      col += uGlow * uAmount * 0.215 * exp(-r * 1.10);
      col += uGlow * uAmount * 0.055 * exp(-r * 0.42);
      /* contact shading where the wall meets the desk */
      col *= 1.0 - 0.55 * exp(-max(0.0, vW.y - (${DESK_Y.toFixed(3)})) * 3.4);
      /* soft shadow cast by the canvas print */
      vec2 f = (vW.xy - vec2(-1.30, 0.63)) / vec2(0.95, 0.60);
      col *= 1.0 - 0.30 * exp(-pow(max(0.0, length(max(abs(f) - 0.86, 0.0))), 1.5) * 5.5);
      col += (h(vUv * 1100.0 + fract(uTime)) - 0.5) * 0.0075;   /* paint tooth   */
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
}));
wall.position.set(0, 3.2, WALL_Z); wall.renderOrder = -4;
scene.add(wall);

/* -- desk ---------------------------------------------------------------- */
const DESK_D = 5.60, DESK_CZ = WALL_Z - 0.10 + DESK_D / 2;
const desk = new THREE.Mesh(new THREE.PlaneGeometry(13, DESK_D), new THREE.ShaderMaterial({
  uniforms: Object.assign(roomU(), { map: { value: texDesk } }), depthWrite: false,
  vertexShader: WVS,
  fragmentShader: `uniform sampler2D map; uniform vec3 uGlow; uniform float uAmount, uTime;
    varying vec2 vUv; varying vec3 vW;
    ${NOISE}
    /* soft rounded-box footprint: solid under the object, exponential penumbra */
    float shad(vec2 p, vec2 c, vec2 hs, float rot, float k){
      vec2 d = p - c;
      float s = sin(rot), o = cos(rot);
      d = vec2(d.x * o + d.y * s, -d.x * s + d.y * o);
      d = abs(d) - hs;
      float q = length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0);
      return 1.0 - k * exp(-max(q, 0.0) * 6.0);
    }
    void main(){
      vec3 oak = texture2D(map, vUv).rgb;
      oak = pow(oak, vec3(1.10));
      float lo = dot(oak, vec3(0.299, 0.587, 0.114));
      oak = mix(vec3(lo), oak, 1.42) * vec3(1.06, 0.99, 0.90);                       /* deepen the timber */
      vec2 p = vec2(vW.x, vW.z - 0.15);
      float r = length(vec2(vW.x * 0.70, vW.z - 0.48));   /* pool of light sits in front of the tube */
      float key = exp(-r * 0.66);
      vec3 col = oak * (0.090 + key * 0.330);
      col += oak * uGlow * uAmount * 0.300 * exp(-r * 1.15);
      /* anisotropic sheen: the tube reflected in the satin lacquer */
      float sheen = exp(-pow(abs(vW.x * 0.55), 2.0)) * exp(-pow(max(0.0, vW.z + 0.35) * 0.75, 2.0));
      col += uGlow * uAmount * 0.135 * sheen;
      /* contact shadows under the kit */
      float sh = 1.0;
${CONTACTS.map((c) => `      sh *= shad(p, vec2(${c[0].toFixed(4)}, ${(c[1] - 0.15).toFixed(4)}), vec2(${c[2].toFixed(4)}, ${c[3].toFixed(4)}), ${c[4].toFixed(4)}, ${c[5].toFixed(2)});`).join('\n')}
      sh *= shad(p, vec2(1.95, -1.30), vec2(0.30, 0.17), 0.16, 0.74);
      col *= sh;
      col *= 1.0 - 0.42 * smoothstep(0.6, -1.9, vW.z);   /* darker toward the wall */
      col += (h(vUv * 1500.0 + fract(uTime)) - 0.5) * 0.006;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
}));
desk.rotation.x = -Math.PI / 2;
desk.position.set(0, DESK_Y, DESK_CZ);
desk.renderOrder = -3;
desk.visible = false;
scene.add(desk);

/* -- framed canvas print ------------------------------------------------- */
const ART_W = 1.60, ART_H = ART_W * 640 / 1024, FRAME = 0.030;
const artMat = new THREE.ShaderMaterial({
  uniforms: Object.assign(roomU(), { map: { value: texArt } }),
  vertexShader: WVS,
  fragmentShader: `uniform sampler2D map; uniform vec3 uGlow; uniform float uAmount;
    varying vec2 vUv; varying vec3 vW;
    void main(){
      vec3 a = texture2D(map, vUv).rgb;
      float r = length((vW.xy - vec2(0.0, 0.10)) * vec2(0.62, 0.80));
      float key = exp(-r * 0.62);
      vec3 col = a * (0.105 + key * 0.38);
      col += a * uGlow * uAmount * 0.30 * exp(-r * 1.05);
      col += uGlow * uAmount * 0.030 * exp(-r * 1.05);   /* sheen on the varnish */
      col *= 1.0 - 0.20 * smoothstep(0.0, 1.0, vUv.x);   /* light falls off right */
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
});
const artMesh = new THREE.Mesh(new THREE.PlaneGeometry(ART_W, ART_H), artMat);
const frameMat = new THREE.ShaderMaterial({
  uniforms: roomU(), vertexShader: WVS,
  fragmentShader: `uniform vec3 uGlow; uniform float uAmount; varying vec2 vUv; varying vec3 vW;
    void main(){
      float r = length((vW.xy - vec2(0.0, 0.10)) * vec2(0.62, 0.80));
      vec3 col = vec3(0.075, 0.070, 0.064) * (0.30 + exp(-r * 0.62) * 0.75);
      col += uGlow * uAmount * 0.10 * exp(-r * 1.05);
      float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      col *= 0.55 + 0.75 * smoothstep(0.0, 0.03, edge);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
});
const artFrame = new THREE.Mesh(new THREE.PlaneGeometry(ART_W + FRAME * 2, ART_H + FRAME * 2), frameMat);
const artGroup = new THREE.Group();
artFrame.position.z = -0.004;
artGroup.add(artFrame, artMesh);
artGroup.position.set(-1.30, 0.63, WALL_Z + 0.05);
artGroup.renderOrder = -2;
artGroup.visible = false;
scene.add(artGroup);

/* -- studio monitor, far right, half out of frame ------------------------ */
const spkMat = new THREE.ShaderMaterial({
  uniforms: Object.assign(roomU(), { map: { value: texSpk } }),
  transparent: true, vertexShader: WVS,
  fragmentShader: `uniform sampler2D map; uniform vec3 uGlow; uniform float uAmount;
    varying vec2 vUv; varying vec3 vW;
    void main(){
      vec4 t = texture2D(map, vUv);
      if (t.a < 0.02) discard;
      float r = length((vW.xy - vec2(0.0, 0.10)) * vec2(0.60, 0.75));
      vec3 col = t.rgb * (0.046 + exp(-r * 0.70) * 0.122);
      col += t.rgb * uGlow * uAmount * 0.30 * exp(-r * 0.95);
      col *= 0.72 + 0.36 * (1.0 - vUv.x);                /* keyed from the left */
      gl_FragColor = vec4(max(col, 0.0), t.a);
    }`,
});
const speaker = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62 * 520 / 429), spkMat);
speaker.position.set(1.95, DESK_Y + 0.3758, -1.15);
speaker.rotation.y = -0.16;
speaker.renderOrder = -1;
speaker.visible = false;
scene.add(speaker);

const roomMats = [wall.material, desk.material, artMat, frameMat, spkMat];

/* --------------------------------------------------------- post process ---*/
let rtScene, rtA1, rtA2, rtB1, rtB2;
const matBright = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: null }, uThresh: { value: 0.70 } },
  vertexShader: VS,
  fragmentShader: `uniform sampler2D uTex; uniform float uThresh; varying vec2 vUv;
    void main(){ vec3 c = texture2D(uTex, vUv).rgb;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      gl_FragColor = vec4(c * (max(0.0, l - uThresh) / max(l, 0.0001)), 1.0); }`,
});
const matBlur = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() } },
  vertexShader: VS,
  fragmentShader: `uniform sampler2D uTex; uniform vec2 uDir, uTexel; varying vec2 vUv;
    void main(){ vec2 d = uDir * uTexel;
      vec3 s = texture2D(uTex, vUv).rgb * 0.227027;
      s += (texture2D(uTex, vUv + d*1.3846).rgb + texture2D(uTex, vUv - d*1.3846).rgb) * 0.316216;
      s += (texture2D(uTex, vUv + d*3.2308).rgb + texture2D(uTex, vUv - d*3.2308).rgb) * 0.070270;
      gl_FragColor = vec4(s, 1.0); }`,
});
const matCopy = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: null } }, vertexShader: VS,
  fragmentShader: 'uniform sampler2D uTex; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(uTex,vUv).rgb,1.0); }',
});
const matFinal = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: null }, uB1: { value: null }, uB2: { value: null },
    uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uFade: { value: 0 } },
  vertexShader: VS,
  fragmentShader: `precision highp float;
    uniform sampler2D uTex, uB1, uB2; uniform float uTime, uFade; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv * 2.0 - 1.0;
      vec2 uv = vUv + c * dot(c, c) * 0.0070;
      float ab = 0.0013 * dot(c, c);
      vec3 col;
      col.r = texture2D(uTex, uv + c * ab).r;
      col.g = texture2D(uTex, uv).g;
      col.b = texture2D(uTex, uv - c * ab).b;
      col += texture2D(uB1, uv).rgb * 0.23;
      col += texture2D(uB2, uv).rgb * 0.47;
      col *= 0.94;
      col = col / (col + 0.76) * 1.46;
      float l = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(vec3(l), col, 1.14);
      col *= 1.0 - 0.44 * dot(c * 0.74, c * 0.74);
      col += (h(vUv * uRes + fract(uTime) * 137.0) - 0.5) * 0.028;
      gl_FragColor = vec4(clamp(col * uFade, 0.0, 1.0), 1.0);
    }`,
});

function sizeTargets(w, h) {
  [rtScene, rtA1, rtA2, rtB1, rtB2].forEach((r) => r && r.dispose());
  const base = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType };
  rtScene = new THREE.WebGLRenderTarget(w, h, Object.assign({ depthBuffer: true }, base));
  const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
  const qw = Math.max(2, w >> 3), qh = Math.max(2, h >> 3);
  const o2 = Object.assign({ depthBuffer: false }, base);
  rtA1 = new THREE.WebGLRenderTarget(hw, hh, o2);
  rtA2 = new THREE.WebGLRenderTarget(hw, hh, o2);
  rtB1 = new THREE.WebGLRenderTarget(qw, qh, o2);
  rtB2 = new THREE.WebGLRenderTarget(qw, qh, o2);
  matFinal.uniforms.uRes.value.set(w, h);
}

/* --------------------------------------------------------------- layout ---*/
const view = { z: 3.5, y: 0, zoom: 0, targetZoom: 0, userZ: 0 };
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, w * h > 2600000 ? 1.6 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  crt.uniforms.uDpr.value = dpr;
  sizeTargets(Math.max(2, Math.floor(w * dpr)), Math.max(2, Math.floor(h * dpr)));
  const vfov = (camera.fov * Math.PI) / 180;
  const BLEED = 1.03;                  /* overscan the plain outer plastic */
  const ch = BLEED, cw = BLEED * camera.aspect;
  solveCase(cw, ch);
  view.z = 1 / (2 * Math.tan(vfov / 2));
  view.y = 0;
  camera.updateProjectionMatrix();
  syncCase();
}
function syncCase() {
  monitor.geometry.dispose();
  monitor.geometry = buildCaseGeo();
  const ap = CASE.ap;
  screenMesh.geometry.dispose();
  screenMesh.geometry = makeScreenGeo(ap.w * OVER, ap.h * OVER);
  screenMesh.position.set(ap.x, ap.y, -0.042 - 0.030 * (ap.h - 0.707));
  tubeBack.geometry.dispose();
  tubeBack.geometry = new THREE.PlaneGeometry(ap.w * 1.03, ap.h * 1.04);
  tubeBack.position.set(ap.x, ap.y, -0.078 - 0.030 * (ap.h - 0.707));
  const g = gridFor(ap.w / ap.h);
  if (setGrid(g.cols, g.rows) && typeof repaint === 'function') { repaint(); scr.render(0, true); screenTex.needsUpdate = true; }
  /* Fit the character block to the tube. A CRT was always a bit off on width and
     height, so allow a capped non-uniform stretch before falling back to a
     plain C64 border: on a normal screen the picture ends up edge to edge. */
  const tw = ap.w * OVER, th = ap.h * OVER;
  const STRETCH = 1.45, SAFE = 0.962;
  const fx = ap.w * SAFE / (COLS * 8), fy = ap.h * SAFE / (ROWS * 8);
  const sc = Math.min(fx, fy);
  const ax = Math.min(fx, sc * STRETCH), ay = Math.min(fy, sc * STRETCH);
  crt.uniforms.uFit.value.set(tw / (ax * SW), th / (ay * SH));
  ledPower.position.set(mapX(1033), mapY(893), 0.012);
  rig.position.set(0, CASE.oy, 0);
}
function setGrid(cols, rows) {
  if (cols === COLS && rows === ROWS) return false;
  COLS = cols; ROWS = rows;
  SW = COLS * 8 + BX * 2; SH = ROWS * 8 + BY * 2;
  scr.resize();
  persist[0].setSize(SW, SH); persist[1].setSize(SW, SH);
  crt.uniforms.uRes.value.set(SW, SH);
  M.sel = Math.min(M.sel, LINKS.length - 1);
  if (M.page === 'doc' && M.doc) { M.doc.lines = docLines(M.doc.key, COLS - 6); M.doc.off = 0; }
  return true;
}
window.addEventListener('resize', layout);

/* ---------------------------------------------------------- interaction ---*/
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
const HOT = {
  bright:   { u: 0.6145, v: 0.923, r: 0.035 },
  contrast: { u: 0.7090, v: 0.923, r: 0.035 },
  volume:   { u: 0.8040, v: 0.923, r: 0.035 },
  power:    { u: 0.8885, v: 0.924, r: 0.028 },
};
const knob = { bright: 0.62, contrast: 0.88, volume: 0.5 };
let drag = null, hover = null, kbdPulse = 0, isoTimer = 0;

function pick(cx, cy) {
  ptr.x = (cx / window.innerWidth) * 2 - 1;
  ptr.y = -(cy / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects([monitor, screenMesh], false);
  for (const h of hits) {
    if (h.object === monitor) {
      const u = h.uv.x, v = 1 - h.uv.y;
      if (u > SCR3.u0 - 0.008 && u < SCR3.u1 + 0.008 && v > SCR3.v0 - 0.008 && v < SCR3.v1 + 0.008) continue;
      for (const k in HOT) {
        const s = HOT[k];
        if (Math.hypot((u - s.u) * MON.w, (v - s.v) * MON.h) < s.r) return k;
      }
      return 'monitor';
    }
    if (h.object === screenMesh) return 'screen';
  }
  return null;
}

/* Mirror of the screen shader: barrel, then the uFit letterbox, then the
   canvas grid. Gives the cell under the pointer so text can be clickable. */
function cellAt(cx, cy) {
  ptr.x = (cx / window.innerWidth) * 2 - 1;
  ptr.y = -(cy / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const h = ray.intersectObject(screenMesh, false)[0];
  if (!h) return null;
  let x = h.uv.x * 2 - 1, y = h.uv.y * 2 - 1;
  const ox = Math.abs(y) / 17, oy = Math.abs(x) / 14;
  x += x * ox * ox; y += y * oy * oy;
  const f = crt.uniforms.uFit.value;
  const col = Math.floor(((0.5 + x * 0.5 * f.x) * SW - BX) / 8);
  const row = Math.floor(((0.5 - y * 0.5 * f.y) * SH - BY) / 8);
  return (col < 0 || col >= COLS || row < 0 || row >= ROWS) ? null : { col, row };
}

function hitAt(cx, cy) {
  if (!M.powered || M.mode !== 'app' || !M.hits.length) return null;
  const c = cellAt(cx, cy);
  if (!c) return null;
  return M.hits.find((t) => t.r === c.row && c.col >= t.x0 && c.col <= t.x1) || null;
}

const hintEl = document.getElementById('hint');
let hintText = '';
function setHint(t) {
  if (t === hintText) return;
  hintText = t;
  hintEl.textContent = t || '';
  hintEl.classList.toggle('on', !!t);
}
const LABELS = {
  power: 'POWER', bright: 'BRIGHTNESS \u00b7 DRAG', contrast: 'CONTRAST \u00b7 DRAG',
  volume: 'VOLUME \u00b7 DRAG', drive: '1541 DISK DRIVE \u00b7 LOAD THE ISO',
  floppy: 'OMARCHY 4.0.1 \u00b7 INSERT DISK', keyboard: 'TYPE SOMETHING', screen: '', monitor: '',
};

canvas.addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  if (drag) {
    knob[drag] = Math.min(1, Math.max(0, knob[drag] + (-(e.movementY || 0) + (e.movementX || 0)) * 0.004));
    applyKnobs(drag);
    return;
  }
  hover = pick(e.clientX, e.clientY);
  const t = hover === 'screen' ? hitAt(e.clientX, e.clientY) : null;
  const was = M.hover;
  if ((t && t.r) !== (was && was.r) || (t && t.x0) !== (was && was.x0)) {
    M.hover = t;
    if (t && t.menu !== undefined) M.sel = t.menu;
    repaint();
  }
  const l = t ? (t.url ? pretty(t.url) : 'OPEN ' + LINKS[t.menu][0])
              : (hover ? LABELS[hover] : '');
  canvas.style.cursor = (t || l) ? 'pointer' : 'default';
  setHint(l);
});
canvas.addEventListener('pointerleave', () => { setHint(''); if (M.hover) { M.hover = null; repaint(); } });

function wake() {
  Snd.init();
  if (Snd.ctx && Snd.ctx.state === 'suspended') Snd.ctx.resume();
  document.body.classList.add('interacted');
}

canvas.addEventListener('pointerdown', (e) => {
  wake();
  const p = pick(e.clientX, e.clientY);
  if (!p) { view.targetZoom = 0; return; }
  if (p === 'bright' || p === 'contrast' || p === 'volume') {
    drag = p; try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    Snd.beep(2400, 0.014, 'square', 0.05); return;
  }
  if (p === 'power') { togglePower(); return; }
  if (p === 'drive' || p === 'floppy') { loadIso(); return; }
  if (p === 'screen') {
    if (!M.powered) return;
    if (M.mode === 'boot') { skipBoot(); return; }
    if (M.page === 'maze') { exec('RUN'); return; }
    const t = hitAt(e.clientX, e.clientY);
    if (t) {
      Snd.key();
      if (t.menu !== undefined) { M.sel = t.menu; launch(t.menu); } else follow(t.url);
      return;
    }
    Snd.beep(560, 0.05, 'triangle', 0.06, 250);
    return;
  }
  if (p === 'keyboard') { Snd.key(); kbdPulse = 1; }
});
window.addEventListener('pointerup', (e) => {
  if (drag) { drag = null; setHint(''); try { canvas.releasePointerCapture(e.pointerId); } catch (err) {} }
});
/* zoom is deliberately not a user control: the framing is fixed */

function applyKnobs(which) {
  crt.bright = 0.42 + knob.bright * 1.12;
  crt.contrast = 0.62 + knob.contrast * 1.15;
  Snd.setVol(knob.volume);
  if (which) setHint(which.toUpperCase() + ' ' + Math.round(knob[which] * 100) + '%');
}
applyKnobs();

function togglePower() {
  M.powered = !M.powered;
  Snd.power(M.powered);
  if (M.powered) { coldStart(); }
  else { crt.target = 0; bootSeq = []; Snd.drive(false); M.driveLed = 0; }
}
function loadIso() {
  if (!M.powered) return;
  M.driveLed = 1; isoTimer = 2.0;
  Snd.drive(true); Snd.noise(0.3, 0.06, 420, 2);
  if (M.mode === 'app') { M.sel = 1; M.page = 'menu'; say('LOADING "OMARCHY 4.0.1" FROM DEVICE 8', LTGREEN); }
  newTab(LINKS[1][1]);
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  wake();
  kbdPulse = 1;
  if (!M.powered) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePower(); } return; }
  if (M.mode === 'boot') { e.preventDefault(); skipBoot(); Snd.key(); return; }
  if (M.page === 'maze') { e.preventDefault(); exec('RUN'); Snd.key(); return; }
  const k = e.key;
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    if (M.page === 'doc') {
      const step = (k === 'ArrowUp' || k === 'ArrowDown') ? 1 : 10;
      M.doc.off += (k === 'ArrowUp' || k === 'ArrowLeft') ? -step : step;
      Snd.beep(1900, 0.014, 'square', 0.03);
      return;
    }
    if (M.page !== 'menu') M.page = 'menu';
    if (k === 'ArrowUp') M.sel = (M.sel + 13) % 14;
    else if (k === 'ArrowDown') M.sel = (M.sel + 1) % 14;
    else M.sel = (M.sel + 7) % 14;
    M.status = ''; Snd.beep(1900, 0.018, 'square', 0.04);
    return;
  }
  if (k === 'Enter') {
    e.preventDefault(); Snd.beep(1100, 0.028, 'square', 0.055);
    if (M.input.trim()) { const v = M.input; M.input = ''; exec(v); }
    else if (M.page === 'menu') launch(M.sel);
    else { M.page = 'menu'; M.status = ''; }
    return;
  }
  if (M.page === 'doc' && !M.input && (k === ' ' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End')) {
    e.preventDefault();
    const jump = ROWS - 8;
    if (k === 'Home') M.doc.off = 0;
    else if (k === 'End') M.doc.off = M.doc.lines.length;
    else M.doc.off += (k === 'PageUp') ? -jump : jump;
    Snd.beep(1500, 0.02, 'square', 0.04);
    return;
  }
  if (k === 'Backspace') { e.preventDefault(); M.input = M.input.slice(0, -1); Snd.key(); return; }
  if (k === 'Escape') { e.preventDefault(); M.input = ''; M.page = 'menu'; M.status = ''; view.targetZoom = 0; return; }
  if (k === 'Tab') { e.preventDefault(); M.page = 'menu'; M.sel = (M.sel + (e.shiftKey ? 13 : 1)) % 14; return; }
  if (k.length === 1 && k >= ' ' && k <= '~') {
    e.preventDefault();
    if (M.input.length < 30) M.input += k.toUpperCase();
    Snd.key();
  }
});

/* --------------------------------------------------------------- runtime --*/
layout();
coldStart();

const clock = new THREE.Clock();
let flash = 0;
const avgCol = new THREE.Color(0.25, 0.25, 0.6);
const glowCol = new THREE.Color(0.3, 0.3, 0.7);
let glowAmt = 0, sampleAcc = 0;
const sCv = document.createElement('canvas'); sCv.width = 12; sCv.height = 8;
const sCtx = sCv.getContext('2d', { willReadFrequently: true });
function sampleScreen() {
  sCtx.drawImage(scr.cv, 0, 0, 12, 8);
  const d = sCtx.getImageData(0, 0, 12, 8).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = (d.length / 4) * 255;
  avgCol.setRGB(r / n, g / n, b / n);
}

const loaderEl = document.getElementById('loader');
if (loaderEl) loaderEl.remove();
document.body.classList.add('ready');

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.getElapsedTime();
  M.tick++;

  if (M.powered) {
    stepBoot(dt);
    if (M.mode === 'app') {
      if (M.page === 'maze') stepMaze(dt);
      else {
        if (M.statusT > 0) { M.statusT -= dt; if (M.statusT <= 0) M.status = ''; }
        repaint();
      }
      if (M.tick % 22 === 0) M.tickerOff = (M.tickerOff + 1) % TICKER.length;
    }
  }
  if (isoTimer > 0) { isoTimer -= dt; if (isoTimer <= 0) { Snd.drive(false); M.driveLed = 0; } }

  const prevOn = crt.on;
  crt.on += (crt.target - crt.on) * Math.min(1, dt * (crt.target > crt.on ? 3.2 : 9));
  if (crt.target > 0.5 && prevOn < 0.22 && crt.on >= 0.22) flash = 1;
  flash *= Math.pow(0.0018, dt);
  crt.uniforms.uOn.value = crt.on;
  crt.uniforms.uFlash.value = flash * 0.5;
  crt.uniforms.uTime.value = t;
  crt.uniforms.uBright.value = crt.bright;
  crt.uniforms.uContrast.value = crt.contrast;
  crt.uniforms.uGlow.value += ((M.page === 'doc' ? 0.085 : 0.19) - crt.uniforms.uGlow.value) * 0.08;

  scr.render(t, (t * 1.9) % 1 < 0.55);
  screenTex.needsUpdate = true;
  matPersist.uniforms.uPrev.value = persist[1].texture;
  blit(matPersist, persist[0]);
  crt.uniforms.uTex.value = persist[0].texture;
  persist.reverse();

  sampleAcc += dt;
  if (sampleAcc > 0.05) { sampleAcc = 0; sampleScreen(); }

  const target = crt.on * (0.5 + 0.5 * Math.min(1, (avgCol.r + avgCol.g + avgCol.b) * 1.5));
  glowAmt += (target - glowAmt) * Math.min(1, dt * 7);
  glowCol.copy(avgCol).lerp(new THREE.Color(0.55, 0.60, 1.0), 0.45);
  for (const m of [monitor, keyboard, drive, floppy]) {
    m.material.uniforms.uAmount.value = glowAmt;
    m.material.uniforms.uGlow.value.copy(glowCol);
  }
  matTube.uniforms.uAmount.value = glowAmt;
  matTube.uniforms.uGlow.value.copy(glowCol);
  for (const m of roomMats) {
    m.uniforms.uAmount.value = glowAmt;
    m.uniforms.uGlow.value.copy(glowCol);
    if (m.uniforms.uTime) m.uniforms.uTime.value = t;
  }

  mLedPower.uniforms.uOn.value = M.powered ? 0.9 + 0.06 * Math.sin(t * 7) : 0;
  mLedKbd.uniforms.uOn.value = M.powered ? 0.85 + kbdPulse * 0.7 : 0;
  mLedDrvR.uniforms.uOn.value = M.driveLed * (0.7 + 0.3 * Math.sin(t * 26));
  mLedDrvG.uniforms.uOn.value = M.powered ? 0.5 : 0;
  kbdPulse *= Math.pow(0.02, dt);
  keyboard.material.uniforms.uAmbient.value = 0.215 + kbdPulse * 0.06;

  mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3.0);
  mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3.0);
  view.zoom += (view.targetZoom - view.zoom) * Math.min(1, dt * 2.8);
  const z = view.zoom * view.zoom * (3 - 2 * view.zoom);
  const par = 1 - z * 0.72;
  const intro = Math.min(1, Math.max(0, (t - 0.1) / 2.4));
  const iE = 1 - Math.pow(1 - intro, 3);
  const dist = view.z * (1 - (1 - iE) * 0.09 + view.userZ) - z * (view.z - 1.52);
  const ty = rig.position.y + CASE.ap.y + 0.015;
  /* no orbit: the framing is fixed. only a faint breath so it is not dead. */
  const dy = mouse.y + Math.sin(t * 0.16 + 1.7) * 0.07;
  camera.position.set(0, view.y - dy * 0.005 + z * ty, dist);
  camera.lookAt(0, view.y * 0.4 + z * ty, 0);
  rig.rotation.y = 0;
  rig.rotation.x = dy * 0.006;
  matFinal.uniforms.uFade.value = Math.min(1, 0.04 + iE * 1.15);

  renderer.setRenderTarget(rtScene);
  renderer.clear();
  renderer.render(scene, camera);

  matBright.uniforms.uTex.value = rtScene.texture;
  blit(matBright, rtA1);
  matBlur.uniforms.uTex.value = rtA1.texture;
  matBlur.uniforms.uTexel.value.set(1 / rtA1.width, 1 / rtA1.height);
  matBlur.uniforms.uDir.value.set(1, 0);
  blit(matBlur, rtA2);
  matBlur.uniforms.uTex.value = rtA2.texture;
  matBlur.uniforms.uDir.value.set(0, 1);
  blit(matBlur, rtA1);

  matCopy.uniforms.uTex.value = rtA1.texture;
  blit(matCopy, rtB1);
  matBlur.uniforms.uTex.value = rtB1.texture;
  matBlur.uniforms.uTexel.value.set(1 / rtB1.width, 1 / rtB1.height);
  matBlur.uniforms.uDir.value.set(1, 0);
  blit(matBlur, rtB2);
  matBlur.uniforms.uTex.value = rtB2.texture;
  matBlur.uniforms.uDir.value.set(0, 1);
  blit(matBlur, rtB1);

  matFinal.uniforms.uTex.value = rtScene.texture;
  matFinal.uniforms.uB1.value = rtA1.texture;
  matFinal.uniforms.uB2.value = rtB1.texture;
  matFinal.uniforms.uTime.value = t;
  blit(matFinal, null);
}
animate();

/* favicon from the logo */
try {
  const fc = document.createElement('canvas'); fc.width = fc.height = 64;
  const fx = fc.getContext('2d');
  fx.fillStyle = CSS[BLUE]; fx.fillRect(0, 0, 64, 64);
  fx.imageSmoothingEnabled = false;
  fx.drawImage(makeLogo(4), 0, 8, 37, 64, 13, 2, 37, 60);   /* the wordmark's O */
  const link = document.querySelector('link[rel="icon"]');
  if (link) link.href = fc.toDataURL('image/png');
} catch (e) {}
