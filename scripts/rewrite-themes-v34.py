# -*- coding: utf-8 -*-
"""Rewrite theme packs with high contrast + texture hooks."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "themes" / "packs"

SHARED = '''
html[data-theme="{id}"] .btn:not(.ghost):not(.secondary) {{
  background: var(--btn-bg);
  color: var(--btn-color);
  box-shadow: var(--btn-shadow);
  text-shadow: none;
}}
html[data-theme="{id}"] .btn.secondary {{
  background: var(--btn-secondary-bg);
  color: var(--text);
  border: 1px solid var(--line-strong);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}}
html[data-theme="{id}"] .btn.ghost {{
  color: var(--text);
  border: 1px solid var(--line-strong);
  background: transparent;
}}
html[data-theme="{id}"] .panel {{
  background: var(--panel-bg);
  border: 1px solid var(--line);
  box-shadow: var(--panel-shadow);
  color: var(--text);
}}
html[data-theme="{id}"] .metric,
html[data-theme="{id}"] .metric-btn {{
  background: var(--metric-bg);
  border: 1px solid var(--line);
  box-shadow: var(--metric-shadow);
  color: var(--text);
}}
html[data-theme="{id}"] .bottom-nav {{
  background: var(--nav-bg);
  border-top-color: var(--line);
}}
html[data-theme="{id}"] .topbar {{
  background: var(--topbar-scrim);
}}
html[data-theme="{id}"] .hero-block h2 {{
  background: var(--hero-title);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}}
html[data-theme="{id}"] .nav-btn {{
  color: var(--muted);
}}
html[data-theme="{id}"] .nav-btn.active {{
  color: var(--text);
  background: var(--nav-active-bg);
}}
html[data-theme="{id}"] .nav-btn.active .nav-ico {{
  color: var(--gold-bright);
  filter: var(--icon-glow);
}}
html[data-theme="{id}"] .eyebrow,
html[data-theme="{id}"] .section-title,
html[data-theme="{id}"] .gloss-term,
html[data-theme="{id}"] .metric .value,
html[data-theme="{id}"] .price-row strong,
html[data-theme="{id}"] .theme-meta h3 {{
  color: var(--gold-bright);
}}
html[data-theme="{id}"] .muted,
html[data-theme="{id}"] .small.muted,
html[data-theme="{id}"] .tiny.muted {{
  color: var(--muted);
}}
html[data-theme="{id}"] .bubble.bot {{
  background: var(--bg-3);
  color: var(--text);
  border: 1px solid var(--line);
}}
html[data-theme="{id}"] .bubble.me {{
  background: color-mix(in srgb, var(--gold) 28%, var(--bg-2));
  color: var(--text);
}}
html[data-theme="{id}"] .chat-box,
html[data-theme="{id}"] .field input,
html[data-theme="{id}"] .field textarea,
html[data-theme="{id}"] .field select {{
  background: color-mix(in srgb, var(--bg) 70%, #000 30%);
  color: var(--text);
  border-color: var(--line);
}}
html[data-theme="{id}"] .brand-mark {{
  border-color: color-mix(in srgb, var(--gold) 55%, transparent);
}}
html[data-theme="{id}"] .funnel-bar {{
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 45%, transparent), var(--graphite));
  color: var(--text);
}}
html[data-theme="{id}"] .bar i {{
  background: linear-gradient(90deg, var(--gold-dim), var(--gold-bright));
}}
'''

THEMES = {
  "royal-gold": {
    "vars": """
  --bg: #050505;
  --bg-2: #14110c;
  --bg-3: #1f1a12;
  --graphite: #2c2518;
  --graphite-2: #42361f;
  --line: rgba(240, 205, 90, 0.28);
  --line-strong: rgba(240, 205, 90, 0.55);
  --text: #fff8e8;
  --muted: #cbb892;
  --gold: #e0b93a;
  --gold-bright: #ffe6a0;
  --gold-dim: #9a7314;
  --gold-soft: rgba(224, 185, 58, 0.2);
  --btn-bg: linear-gradient(180deg, #ffe9a8 0%, #e0b93a 45%, #a07a18 100%);
  --btn-color: #1a1206;
  --btn-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 12px 28px rgba(224,185,58,0.35);
  --btn-secondary-bg: linear-gradient(180deg, #3a3224, #221c12);
  --panel-bg: linear-gradient(145deg, rgba(255,230,150,0.12), transparent 42%), linear-gradient(180deg, #1c1710, #100e09);
  --panel-shadow: inset 0 1px 0 rgba(255,240,180,0.2), 0 16px 40px rgba(0,0,0,0.6);
  --metric-bg: linear-gradient(160deg, rgba(224,185,58,0.16), rgba(0,0,0,0.5));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 24px rgba(0,0,0,0.45);
  --nav-bg: rgba(5,5,5,0.94);
  --nav-active-bg: linear-gradient(180deg, rgba(224,185,58,0.24), rgba(224,185,58,0.06));
  --topbar-scrim: linear-gradient(180deg, rgba(5,5,5,0.96) 0%, rgba(5,5,5,0.82) 70%, transparent);
  --hero-title: linear-gradient(180deg, #fffaf0 8%, #e0b93a 90%);
  --icon-glow: drop-shadow(0 0 8px rgba(224,185,58,0.5));
  --body-bg: linear-gradient(180deg, rgba(5,5,5,0.55), rgba(5,5,5,0.82)), #050505;
  --surface-opacity: 0.42;
  --surface-blend: soft-light;
  --noise-opacity: 0.03;
""",
  },
  "obsidian-script": {
    "vars": """
  --bg: #030303;
  --bg-2: #121212;
  --bg-3: #1c1c1c;
  --graphite: #2a2a2a;
  --graphite-2: #404040;
  --line: rgba(245, 220, 140, 0.28);
  --line-strong: rgba(245, 220, 140, 0.5);
  --text: #faf7f0;
  --muted: #bdb49f;
  --gold: #d4b24a;
  --gold-bright: #ffe7a8;
  --gold-dim: #856820;
  --gold-soft: rgba(212, 178, 74, 0.18);
  --btn-bg: linear-gradient(180deg, #fff1c0, #d4b24a 52%, #7a5c16);
  --btn-color: #141008;
  --btn-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 12px 28px rgba(212,178,74,0.35);
  --btn-secondary-bg: linear-gradient(180deg, #333, #1a1a1a);
  --panel-bg: linear-gradient(160deg, rgba(255,255,255,0.08), transparent 36%), linear-gradient(180deg, #1e1e1e, #0c0c0c);
  --panel-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 18px 36px rgba(0,0,0,0.65);
  --metric-bg: linear-gradient(165deg, rgba(255,255,255,0.08), rgba(0,0,0,0.55));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 24px rgba(0,0,0,0.5);
  --nav-bg: rgba(3,3,3,0.95);
  --nav-active-bg: linear-gradient(180deg, rgba(212,178,74,0.22), rgba(212,178,74,0.05));
  --topbar-scrim: linear-gradient(180deg, rgba(3,3,3,0.97) 0%, rgba(3,3,3,0.85) 70%, transparent);
  --hero-title: linear-gradient(180deg, #fff 0%, #ffe7a8 65%, #d4b24a 100%);
  --icon-glow: drop-shadow(0 0 8px rgba(255,231,168,0.45));
  --body-bg: linear-gradient(180deg, rgba(3,3,3,0.5), rgba(3,3,3,0.78)), #030303;
  --surface-opacity: 0.38;
  --surface-blend: soft-light;
  --noise-opacity: 0.025;
""",
  },
  "ember-lava": {
    "vars": """
  --bg: #0a0502;
  --bg-2: #1a0e08;
  --bg-3: #2a160c;
  --graphite: #3a2214;
  --graphite-2: #5a3420;
  --line: rgba(255, 150, 60, 0.35);
  --line-strong: rgba(255, 170, 80, 0.6);
  --text: #fff3e8;
  --muted: #d4a888;
  --gold: #ff9a2e;
  --gold-bright: #ffc56a;
  --gold-dim: #c44a10;
  --gold-soft: rgba(255, 154, 46, 0.2);
  --btn-bg: linear-gradient(180deg, #ffd89a, #ff9a2e 40%, #e03a00 100%);
  --btn-color: #1c0a02;
  --btn-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 0 24px rgba(255,100,0,0.4), 0 12px 28px rgba(200,40,0,0.35);
  --btn-secondary-bg: linear-gradient(180deg, #3a2418, #1a0e08);
  --panel-bg: linear-gradient(145deg, rgba(255,120,40,0.14), transparent 40%), linear-gradient(180deg, #26140c, #120804);
  --panel-shadow: inset 0 1px 0 rgba(255,180,100,0.18), 0 16px 40px rgba(0,0,0,0.6), 0 0 28px rgba(255,80,0,0.1);
  --metric-bg: linear-gradient(160deg, rgba(255,120,30,0.18), rgba(20,8,4,0.85));
  --metric-shadow: inset 0 0 18px rgba(255,80,0,0.1), 0 10px 24px rgba(0,0,0,0.5);
  --nav-bg: rgba(10,5,2,0.95);
  --nav-active-bg: linear-gradient(180deg, rgba(255,154,46,0.25), rgba(255,154,46,0.06));
  --topbar-scrim: linear-gradient(180deg, rgba(10,5,2,0.96) 0%, rgba(10,5,2,0.82) 70%, transparent);
  --hero-title: linear-gradient(180deg, #fff6ec 5%, #ff9a2e 55%, #ff4500 100%);
  --icon-glow: drop-shadow(0 0 10px rgba(255,120,0,0.55));
  --body-bg: linear-gradient(180deg, rgba(10,5,2,0.45), rgba(10,5,2,0.78)), #0a0502;
  --surface-opacity: 0.48;
  --surface-blend: soft-light;
  --noise-opacity: 0.02;
""",
  },
  "stone-dark": {
    "vars": """
  --bg: #0b0d10;
  --bg-2: #161a1e;
  --bg-3: #22282e;
  --graphite: #2e353c;
  --graphite-2: #454e58;
  --line: rgba(220, 230, 240, 0.28);
  --line-strong: rgba(230, 238, 245, 0.5);
  --text: #f4f7fa;
  --muted: #b0b8c2;
  --gold: #d7dee5;
  --gold-bright: #ffffff;
  --gold-dim: #7b8694;
  --gold-soft: rgba(215, 222, 229, 0.14);
  --btn-bg: linear-gradient(180deg, #f5f7fa, #c5ccd4 50%, #8a939e);
  --btn-color: #12161a;
  --btn-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 12px 26px rgba(0,0,0,0.45);
  --btn-secondary-bg: linear-gradient(180deg, #343b44, #1c2126);
  --panel-bg: linear-gradient(145deg, rgba(255,255,255,0.1), transparent 40%), linear-gradient(180deg, #23292f, #13171b);
  --panel-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 14px 32px rgba(0,0,0,0.55);
  --metric-bg: linear-gradient(155deg, rgba(255,255,255,0.1), rgba(0,0,0,0.4));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 22px rgba(0,0,0,0.45);
  --nav-bg: rgba(11,13,16,0.95);
  --nav-active-bg: linear-gradient(180deg, rgba(215,222,229,0.18), rgba(215,222,229,0.04));
  --topbar-scrim: linear-gradient(180deg, rgba(11,13,16,0.96) 0%, rgba(11,13,16,0.84) 70%, transparent);
  --hero-title: linear-gradient(180deg, #ffffff 0%, #d7dee5 85%);
  --icon-glow: drop-shadow(0 0 8px rgba(220,230,240,0.4));
  --body-bg: linear-gradient(180deg, rgba(11,13,16,0.5), rgba(11,13,16,0.8)), #0b0d10;
  --surface-opacity: 0.4;
  --surface-blend: soft-light;
  --noise-opacity: 0.02;
""",
  },
  "stone-light": {
    "vars": """
  --bg: #e6e1d7;
  --bg-2: #f7f4ee;
  --bg-3: #ffffff;
  --graphite: #d5cfc4;
  --graphite-2: #bdb6aa;
  --line: rgba(40, 42, 48, 0.22);
  --line-strong: rgba(40, 42, 48, 0.4);
  --text: #17150f;
  --muted: #5a554c;
  --gold: #3f4654;
  --gold-bright: #1f2430;
  --gold-dim: #7a8190;
  --gold-soft: rgba(31, 36, 48, 0.1);
  --ok: #157a4e;
  --danger: #b12e2e;
  --btn-bg: linear-gradient(180deg, #3a4252, #232a36 55%, #12161e);
  --btn-color: #f8fafc;
  --btn-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 12px 24px rgba(30,25,15,0.22);
  --btn-secondary-bg: linear-gradient(180deg, #efeae1, #ddd6ca);
  --panel-bg: linear-gradient(145deg, rgba(255,255,255,0.95), transparent 40%), linear-gradient(180deg, #fffcf7, #ebe4d8);
  --panel-shadow: inset 0 1px 0 #fff, 0 12px 28px rgba(40,35,25,0.12);
  --metric-bg: linear-gradient(160deg, #ffffff, #e8e2d6);
  --metric-shadow: inset 0 1px 0 #fff, 0 8px 18px rgba(40,35,25,0.1);
  --nav-bg: rgba(247,244,238,0.96);
  --nav-active-bg: linear-gradient(180deg, rgba(35,42,54,0.12), rgba(35,42,54,0.04));
  --topbar-scrim: linear-gradient(180deg, rgba(247,244,238,0.98) 0%, rgba(247,244,238,0.88) 70%, transparent);
  --hero-title: linear-gradient(180deg, #17150f 10%, #2c3340 100%);
  --icon-glow: drop-shadow(0 0 6px rgba(30,35,45,0.25));
  --body-bg: linear-gradient(180deg, rgba(247,244,238,0.72), rgba(230,225,215,0.88)), #e6e1d7;
  --surface-opacity: 0.34;
  --surface-blend: multiply;
  --noise-opacity: 0.02;
""",
    "extra": '''
html[data-theme="stone-light"] .btn.secondary {
  color: #17150f;
  border-color: rgba(40,42,48,0.28);
}
html[data-theme="stone-light"] .bubble.bot {
  background: #ffffff;
  color: #17150f;
  border: 1px solid rgba(40,42,48,0.16);
}
html[data-theme="stone-light"] .bubble.me {
  background: #2c3340;
  color: #f8fafc;
}
html[data-theme="stone-light"] .chat-box,
html[data-theme="stone-light"] .field input,
html[data-theme="stone-light"] .field textarea,
html[data-theme="stone-light"] .field select {
  background: #ffffff;
  color: #17150f;
  border-color: rgba(40,42,48,0.2);
}
html[data-theme="stone-light"] .doc-viewer-paper {
  background: #fff;
  color: #17150f;
}
''',
  },
  "burnished-crest": {
    "vars": """
  --bg: #0c0a06;
  --bg-2: #18140c;
  --bg-3: #261e12;
  --graphite: #342a18;
  --graphite-2: #4c3c20;
  --line: rgba(220, 175, 80, 0.32);
  --line-strong: rgba(220, 175, 80, 0.55);
  --text: #fff4dc;
  --muted: #c4ad80;
  --gold: #d4a43a;
  --gold-bright: #f0c86a;
  --gold-dim: #7a5a18;
  --gold-soft: rgba(212, 164, 58, 0.18);
  --btn-bg: linear-gradient(180deg, #f0d080, #d4a43a 45%, #7a5a18);
  --btn-color: #1a1206;
  --btn-shadow: inset 0 1px 0 rgba(255,240,200,0.55), 0 12px 26px rgba(212,164,58,0.3);
  --btn-secondary-bg: linear-gradient(180deg, #3a2e18, #1a140c);
  --panel-bg: linear-gradient(150deg, rgba(240,200,100,0.12), transparent 40%), linear-gradient(180deg, #261e12, #120e08);
  --panel-shadow: inset 0 1px 0 rgba(240,200,100,0.22), 0 14px 34px rgba(0,0,0,0.58);
  --metric-bg: linear-gradient(155deg, rgba(240,200,100,0.14), rgba(20,16,8,0.85));
  --metric-shadow: inset 0 1px 0 rgba(240,200,100,0.16), 0 10px 24px rgba(0,0,0,0.48);
  --nav-bg: rgba(12,10,6,0.95);
  --nav-active-bg: linear-gradient(180deg, rgba(212,164,58,0.22), rgba(212,164,58,0.05));
  --topbar-scrim: linear-gradient(180deg, rgba(12,10,6,0.96) 0%, rgba(12,10,6,0.84) 70%, transparent);
  --hero-title: linear-gradient(180deg, #fff6e0 0%, #d4a43a 90%);
  --icon-glow: drop-shadow(0 0 8px rgba(240,200,100,0.45));
  --body-bg: linear-gradient(180deg, rgba(12,10,6,0.5), rgba(12,10,6,0.8)), #0c0a06;
  --surface-opacity: 0.4;
  --surface-blend: soft-light;
  --noise-opacity: 0.03;
""",
  },
  "glass-prism": {
    "vars": """
  --bg: #04060c;
  --bg-2: rgba(16, 24, 40, 0.9);
  --bg-3: rgba(28, 40, 60, 0.92);
  --graphite: rgba(40, 55, 80, 0.9);
  --graphite-2: rgba(55, 75, 105, 0.95);
  --line: rgba(120, 240, 255, 0.32);
  --line-strong: rgba(160, 245, 255, 0.55);
  --text: #f2fbff;
  --muted: #9eb6d0;
  --gold: #2ee6ff;
  --gold-bright: #b8f7ff;
  --gold-dim: #0e7490;
  --gold-soft: rgba(46, 230, 255, 0.16);
  --btn-bg: linear-gradient(135deg, #ecfeff, #7dd3fc 40%, #c084fc 75%, #f9a8d4);
  --btn-color: #0a1220;
  --btn-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 0 28px rgba(46,230,255,0.35), 0 12px 28px rgba(0,0,0,0.4);
  --btn-secondary-bg: linear-gradient(180deg, rgba(40,55,80,0.95), rgba(16,24,40,0.95));
  --panel-bg: linear-gradient(145deg, rgba(255,255,255,0.14), rgba(46,230,255,0.05) 45%), rgba(14, 22, 36, 0.78);
  --panel-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 16px 40px rgba(0,0,0,0.5), 0 0 28px rgba(46,230,255,0.1);
  --metric-bg: linear-gradient(145deg, rgba(184,247,255,0.12), rgba(10,14,24,0.7));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 24px rgba(0,0,0,0.45);
  --nav-bg: rgba(4,6,12,0.94);
  --nav-active-bg: linear-gradient(180deg, rgba(46,230,255,0.2), rgba(46,230,255,0.05));
  --topbar-scrim: linear-gradient(180deg, rgba(4,6,12,0.96) 0%, rgba(4,6,12,0.84) 70%, transparent);
  --hero-title: linear-gradient(90deg, #ffffff 0%, #b8f7ff 35%, #c084fc 70%, #f9a8d4 100%);
  --icon-glow: drop-shadow(0 0 10px rgba(46,230,255,0.5));
  --body-bg: linear-gradient(180deg, rgba(4,6,12,0.55), rgba(4,6,12,0.82)), #04060c;
  --surface-opacity: 0.36;
  --surface-blend: soft-light;
  --noise-opacity: 0.02;
""",
  },
  "metal-silver": {
    "vars": """
  --bg: #0a0c10;
  --bg-2: #151920;
  --bg-3: #222830;
  --graphite: #2e343e;
  --graphite-2: #444c58;
  --line: rgba(230, 235, 245, 0.28);
  --line-strong: rgba(240, 244, 250, 0.5);
  --text: #f7f8fa;
  --muted: #aeb6c2;
  --gold: #d0d5dc;
  --gold-bright: #ffffff;
  --gold-dim: #6b7380;
  --gold-soft: rgba(208, 213, 220, 0.14);
  --btn-bg: linear-gradient(180deg, #ffffff, #c8ced6 48%, #6f7784);
  --btn-color: #0e1116;
  --btn-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 12px 26px rgba(0,0,0,0.45);
  --btn-secondary-bg: linear-gradient(180deg, #343b46, #1a1e24);
  --panel-bg: linear-gradient(155deg, rgba(255,255,255,0.12), transparent 38%), linear-gradient(180deg, #2a3038, #12161c);
  --panel-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 14px 32px rgba(0,0,0,0.55);
  --metric-bg: linear-gradient(160deg, rgba(255,255,255,0.12), rgba(15,18,22,0.9));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 24px rgba(0,0,0,0.45);
  --nav-bg: rgba(10,12,16,0.95);
  --nav-active-bg: linear-gradient(180deg, rgba(208,213,220,0.18), rgba(208,213,220,0.04));
  --topbar-scrim: linear-gradient(180deg, rgba(10,12,16,0.96) 0%, rgba(10,12,16,0.84) 70%, transparent);
  --hero-title: linear-gradient(180deg, #ffffff 0%, #d0d5dc 85%);
  --icon-glow: drop-shadow(0 0 8px rgba(230,235,245,0.4));
  --body-bg: linear-gradient(180deg, rgba(10,12,16,0.5), rgba(10,12,16,0.8)), #0a0c10;
  --surface-opacity: 0.38;
  --surface-blend: soft-light;
  --noise-opacity: 0.02;
""",
  },
}

def write_theme(tid, cfg):
    css = f'html[data-theme="{tid}"] {{{cfg["vars"]}}}\n'
    css += f'html[data-theme="{tid}"] body {{\n  background: var(--body-bg);\n  color: var(--text);\n}}\n'
    css += SHARED.format(id=tid)
    css += cfg.get("extra", "")
    path = ROOT / tid / "theme.css"
    path.write_text(css, encoding="utf-8")
    print("wrote", path, path.stat().st_size)

for tid, cfg in THEMES.items():
    write_theme(tid, cfg)
print("done")
