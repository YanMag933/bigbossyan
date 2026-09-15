#!/usr/bin/env python3
"""Generate theme packs under themes/packs/. Port of build-themes.js."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "themes" / "packs"


def ensure(dir_path: Path) -> None:
    dir_path.mkdir(parents=True, exist_ok=True)


def preview_svg(
    bg1: str,
    bg2: str,
    panel: str,
    btn1: str,
    btn2: str,
    accent: str,
    label: str,
    ink: str = "#f3efe6",
) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="{bg1}"/><stop offset="100%" stop-color="{bg2}"/></linearGradient>
    <linearGradient id="btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="{btn1}"/><stop offset="100%" stop-color="{btn2}"/></linearGradient>
    <filter id="sh"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.45"/></filter>
  </defs>
  <rect width="320" height="200" rx="18" fill="url(#bg)"/>
  <rect x="18" y="18" width="284" height="110" rx="14" fill="{panel}" stroke="{accent}" stroke-opacity="0.45" filter="url(#sh)"/>
  <rect x="34" y="36" width="120" height="14" rx="4" fill="{accent}" fill-opacity="0.85"/>
  <rect x="34" y="60" width="200" height="8" rx="3" fill="{ink}" fill-opacity="0.35"/>
  <rect x="34" y="76" width="160" height="8" rx="3" fill="{ink}" fill-opacity="0.22"/>
  <rect x="34" y="100" width="90" height="16" rx="8" fill="{accent}" fill-opacity="0.2" stroke="{accent}" stroke-opacity="0.5"/>
  <rect x="34" y="146" width="140" height="36" rx="12" fill="url(#btn)" filter="url(#sh)"/>
  <text x="104" y="169" text-anchor="middle" font-family="Segoe UI, Arial" font-size="13" font-weight="700" fill="#14110a">кнопка</text>
  <text x="302" y="188" text-anchor="end" font-family="Segoe UI, Arial" font-size="11" font-weight="700" fill="{accent}">{label}</text>
</svg>
"""


def theme_css(
    id: str,
    vars: str,
    body_extra: str,
    panel_extra: str,
    btn_extra: str,
    extras: str = "",
) -> str:
    return f"""html[data-theme="{id}"] {{
{vars}
}}
html[data-theme="{id}"] body {{
{body_extra}
}}
html[data-theme="{id}"] .panel {{
{panel_extra}
}}
html[data-theme="{id}"] .btn:not(.ghost):not(.secondary) {{
{btn_extra}
}}
html[data-theme="{id}"] .btn.secondary {{
  background: var(--graphite);
  border: 1px solid var(--line-strong);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.35);
}}
html[data-theme="{id}"] .metric,
html[data-theme="{id}"] .metric-btn {{
  background: var(--metric-bg, rgba(0,0,0,0.28));
  border: 1px solid var(--line);
  box-shadow: var(--metric-shadow, none);
}}
html[data-theme="{id}"] .bottom-nav {{
  background: var(--nav-bg, rgba(8,8,8,0.94));
  border-top-color: var(--line);
}}
html[data-theme="{id}"] .topbar {{
  background: var(--topbar-bg, linear-gradient(180deg, rgba(7,7,7,0.98) 0%, rgba(7,7,7,0.88) 72%, transparent));
}}
html[data-theme="{id}"] .hero-block h2 {{
  background: var(--hero-title, linear-gradient(180deg, #fff 8%, var(--gold) 100%));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}}
html[data-theme="{id}"] .nav-btn.active {{
  background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 22%, transparent), color-mix(in srgb, var(--gold) 6%, transparent));
}}
html[data-theme="{id}"] .nav-btn.active .nav-ico {{
  color: var(--gold-bright);
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--gold) 50%, transparent));
}}
html[data-theme="{id}"] .brand-mark {{
  border-color: color-mix(in srgb, var(--gold) 55%, transparent);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px color-mix(in srgb, var(--gold) 22%, transparent);
}}
html[data-theme="{id}"] .funnel-bar {{
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 40%, transparent), rgba(42,42,42,0.9));
}}
html[data-theme="{id}"] .bar i {{
  background: linear-gradient(90deg, var(--gold-dim), var(--gold-bright));
}}
html[data-theme="{id}"] .eyebrow,
html[data-theme="{id}"] .section-title,
html[data-theme="{id}"] .gloss-term,
html[data-theme="{id}"] .metric .value,
html[data-theme="{id}"] .price-row strong {{
  color: var(--gold-bright);
}}
{extras}"""


def write_pack(
    id: str,
    preview_args: list,
    css_args: list | None = None,
) -> None:
    dir_path = ROOT / id
    ensure(dir_path)
    (dir_path / "preview.svg").write_text(
        preview_svg(*preview_args), encoding="utf-8"
    )
    if css_args is not None:
        (dir_path / "theme.css").write_text(
            theme_css(id, *css_args), encoding="utf-8"
        )


def main() -> None:
    ensure(ROOT)

    write_pack(
        "classic",
        ["#121212", "#070707", "#1a1a1a", "#f0d78c", "#d4af37", "#d4af37", "CLASSIC"],
    )

    write_pack(
        "royal-gold",
        ["#0a0a0a", "#050505", "#141210", "#f4e2a0", "#c9a227", "#e8c547", "ROYAL"],
        [
            """  --bg: #050505;
  --bg-2: #12100c;
  --bg-3: #1c1812;
  --graphite: #2a2418;
  --graphite-2: #3d3424;
  --line: rgba(232, 197, 71, 0.18);
  --line-strong: rgba(232, 197, 71, 0.4);
  --text: #f7f0df;
  --muted: #a89b7a;
  --gold: #d4af37;
  --gold-bright: #f4e2a0;
  --gold-dim: #8a6910;
  --gold-soft: rgba(212, 175, 55, 0.18);
  --shadow-lux: 0 18px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(212,175,55,0.08);
  --metric-bg: linear-gradient(160deg, rgba(212,175,55,0.12), rgba(0,0,0,0.45));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.4);
  --nav-bg: rgba(5,5,5,0.96);
  --topbar-bg: linear-gradient(180deg, rgba(5,5,5,0.98) 0%, rgba(5,5,5,0.85) 70%, transparent);
  --hero-title: linear-gradient(180deg, #fff8e7 10%, #d4af37 85%);""",
            """  background:
    radial-gradient(ellipse 80% 45% at 50% -8%, rgba(212,175,55,0.28), transparent 55%),
    radial-gradient(circle at 85% 20%, rgba(255,220,120,0.08), transparent 35%),
    linear-gradient(180deg, #16120a 0%, #050505 50%, #000 100%);""",
            """  background:
    linear-gradient(145deg, rgba(244,226,160,0.14), transparent 40%),
    linear-gradient(180deg, #1a1610, #0e0c09);
  border: 1px solid rgba(212,175,55,0.35);
  box-shadow:
    inset 0 1px 0 rgba(255,240,180,0.18),
    inset 0 -1px 0 rgba(0,0,0,0.5),
    0 16px 40px rgba(0,0,0,0.55),
    0 0 24px rgba(212,175,55,0.08);""",
            """  background: linear-gradient(180deg, #ffe9a8 0%, #d4af37 48%, #9a7418 100%);
  color: #1a1408;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.55),
    inset 0 -2px 0 rgba(90,60,0,0.35),
    0 12px 28px rgba(212,175,55,0.35),
    0 0 20px rgba(212,175,55,0.2);
  text-shadow: 0 1px 0 rgba(255,255,255,0.25);""",
        ],
    )

    write_pack(
        "obsidian-script",
        ["#0c0c0c", "#050505", "#151515", "#f0d78c", "#b8942a", "#f0d78c", "OBSIDIAN"],
        [
            """  --bg: #040404;
  --bg-2: #101010;
  --bg-3: #1a1a1a;
  --graphite: #262626;
  --graphite-2: #3a3a3a;
  --line: rgba(240, 215, 140, 0.16);
  --line-strong: rgba(240, 215, 140, 0.38);
  --text: #f5f2ea;
  --muted: #9a9588;
  --gold: #c9a84a;
  --gold-bright: #f0d78c;
  --gold-dim: #7a6220;
  --gold-soft: rgba(201, 168, 74, 0.16);
  --shadow-lux: 0 22px 50px rgba(0,0,0,0.7);
  --metric-bg: linear-gradient(165deg, rgba(255,255,255,0.05), rgba(0,0,0,0.55));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 28px rgba(0,0,0,0.5);
  --hero-title: linear-gradient(180deg, #ffffff 0%, #f0d78c 70%, #a8842a 100%);""",
            """  background:
    radial-gradient(ellipse 70% 40% at 20% 0%, rgba(255,255,255,0.06), transparent 50%),
    radial-gradient(ellipse 50% 30% at 100% 80%, rgba(201,168,74,0.1), transparent 45%),
    linear-gradient(180deg, #141414, #040404 60%, #000);""",
            """  background:
    linear-gradient(160deg, rgba(255,255,255,0.07), transparent 35%),
    linear-gradient(180deg, #1c1c1c, #0a0a0a);
  border: 1px solid rgba(240,215,140,0.28);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.2),
    inset 0 -2px 6px rgba(0,0,0,0.55),
    0 18px 36px rgba(0,0,0,0.6);""",
            """  background: linear-gradient(180deg, #fff1c2, #c9a84a 55%, #7a5c18);
  color: #120e06;
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.65),
    0 10px 26px rgba(201,168,74,0.35),
    0 0 1px #f0d78c;""",
        ],
    )

    write_pack(
        "ember-lava",
        ["#1a0c06", "#080402", "#22140c", "#ffb347", "#ff5a1f", "#ff8c00", "EMBER"],
        [
            """  --bg: #080402;
  --bg-2: #160e08;
  --bg-3: #24160e;
  --graphite: #2e1c12;
  --graphite-2: #4a2e1a;
  --line: rgba(255, 120, 40, 0.22);
  --line-strong: rgba(255, 140, 50, 0.45);
  --text: #ffe8d6;
  --muted: #b89278;
  --gold: #ff8c00;
  --gold-bright: #ffb347;
  --gold-dim: #b34510;
  --gold-soft: rgba(255, 140, 0, 0.16);
  --shadow-lux: 0 18px 48px rgba(0,0,0,0.65), 0 0 30px rgba(255,80,0,0.08);
  --metric-bg: linear-gradient(160deg, rgba(255,100,20,0.14), rgba(20,8,4,0.85));
  --metric-shadow: inset 0 0 20px rgba(255,80,0,0.08), 0 10px 28px rgba(0,0,0,0.45);
  --nav-bg: rgba(8,4,2,0.96);
  --hero-title: linear-gradient(180deg, #fff2e0 5%, #ff8c00 55%, #cc3300 100%);""",
            """  background:
    radial-gradient(ellipse 60% 35% at 50% 110%, rgba(255,60,0,0.22), transparent 55%),
    radial-gradient(circle at 15% 20%, rgba(255,120,0,0.12), transparent 30%),
    linear-gradient(180deg, #1a0e08, #080402 55%, #050201);""",
            """  background:
    linear-gradient(145deg, rgba(255,120,40,0.12), transparent 42%),
    linear-gradient(180deg, #22140c, #100804);
  border: 1px solid rgba(255,120,40,0.35);
  box-shadow:
    inset 0 1px 0 rgba(255,180,100,0.15),
    0 0 0 1px rgba(80,20,0,0.4),
    0 16px 40px rgba(0,0,0,0.55),
    0 0 28px rgba(255,80,0,0.12);""",
            """  background: linear-gradient(180deg, #ffd08a, #ff8c00 40%, #cc3300 100%);
  color: #1a0a02;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.45),
    0 0 24px rgba(255,100,0,0.45),
    0 12px 28px rgba(255,60,0,0.3);""",
        ],
    )

    write_pack(
        "stone-dark",
        ["#1a1c1e", "#0c0e10", "#24282c", "#d8dde2", "#8a929a", "#c5ccd3", "SLATE"],
        [
            """  --bg: #0c0e10;
  --bg-2: #171a1d;
  --bg-3: #22272b;
  --graphite: #2c3238;
  --graphite-2: #3e4650;
  --line: rgba(200, 210, 220, 0.16);
  --line-strong: rgba(200, 210, 220, 0.32);
  --text: #e8eef2;
  --muted: #9aa3ad;
  --gold: #c5ccd3;
  --gold-bright: #eef2f5;
  --gold-dim: #6e7884;
  --gold-soft: rgba(197, 204, 211, 0.12);
  --shadow-lux: 0 16px 40px rgba(0,0,0,0.55);
  --metric-bg: linear-gradient(155deg, rgba(255,255,255,0.07), rgba(0,0,0,0.35));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4), 0 10px 22px rgba(0,0,0,0.4);
  --nav-bg: rgba(10,12,14,0.96);
  --hero-title: linear-gradient(180deg, #ffffff 0%, #c5ccd3 80%);""",
            """  background:
    radial-gradient(ellipse 90% 50% at 10% 0%, rgba(220,230,240,0.08), transparent 45%),
    radial-gradient(ellipse 60% 40% at 90% 100%, rgba(180,190,200,0.06), transparent 40%),
    linear-gradient(180deg, #1a1d20, #0c0e10 55%, #08090a);""",
            """  background-color: #1a1d20;
  background-image:
    linear-gradient(145deg, rgba(230,235,240,0.1), transparent 38%),
    linear-gradient(180deg, #24282c, #14171a),
    repeating-linear-gradient(115deg, transparent 0 18px, rgba(255,255,255,0.03) 18px 19px),
    repeating-linear-gradient(20deg, transparent 0 28px, rgba(0,0,0,0.08) 28px 29px);
  border: 1px solid rgba(200,210,220,0.22);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.14),
    inset 0 -2px 0 rgba(0,0,0,0.45),
    0 14px 32px rgba(0,0,0,0.5);""",
            """  background: linear-gradient(180deg, #eef2f5, #a8b0b8 55%, #6e7884);
  color: #121416;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),
    inset 0 -2px 0 rgba(40,45,50,0.35),
    0 12px 26px rgba(0,0,0,0.4);""",
        ],
    )

    write_pack(
        "stone-light",
        ["#f2efe8", "#e4dfd4", "#faf8f3", "#6b7280", "#4b5563", "#6b7280", "MARBLE", "#2a261f"],
        [
            """  --bg: #e8e4dc;
  --bg-2: #f4f1ea;
  --bg-3: #ffffff;
  --graphite: #d9d4cb;
  --graphite-2: #c4bfb4;
  --line: rgba(70, 74, 82, 0.16);
  --line-strong: rgba(70, 74, 82, 0.32);
  --text: #1f1c18;
  --muted: #6b6560;
  --gold: #6b7280;
  --gold-bright: #4b5563;
  --gold-dim: #9ca3af;
  --gold-soft: rgba(107, 114, 128, 0.12);
  --ok: #1f8a5a;
  --danger: #b33a3a;
  --shadow-lux: 0 14px 36px rgba(40,35,25,0.12);
  --metric-bg: linear-gradient(160deg, rgba(255,255,255,0.95), rgba(220,215,205,0.85));
  --metric-shadow: inset 0 1px 0 #fff, 0 8px 20px rgba(40,35,25,0.1);
  --nav-bg: rgba(244,241,234,0.96);
  --topbar-bg: linear-gradient(180deg, rgba(244,241,234,0.98) 0%, rgba(244,241,234,0.88) 70%, transparent);
  --hero-title: linear-gradient(180deg, #1f1c18 10%, #4b5563 100%);""",
            """  background:
    radial-gradient(ellipse 80% 50% at 80% 0%, rgba(120,120,130,0.12), transparent 50%),
    radial-gradient(ellipse 50% 40% at 10% 90%, rgba(90,90,100,0.1), transparent 45%),
    linear-gradient(180deg, #f7f4ee, #e8e4dc 55%, #ddd8ce);
  color: var(--text);""",
            """  background-color: #f4f1ea;
  background-image:
    linear-gradient(145deg, rgba(255,255,255,0.9), transparent 40%),
    linear-gradient(180deg, #faf8f3, #ebe6dc),
    repeating-linear-gradient(125deg, transparent 0 22px, rgba(90,90,100,0.06) 22px 23px),
    repeating-linear-gradient(35deg, transparent 0 40px, rgba(60,60,70,0.04) 40px 41px);
  border: 1px solid rgba(90,90,100,0.18);
  color: var(--text);
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 0 rgba(80,70,50,0.08),
    0 12px 28px rgba(40,35,25,0.1);""",
            """  background: linear-gradient(180deg, #9ca3af, #6b7280 50%, #4b5563);
  color: #f8fafc;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    0 10px 22px rgba(40,35,25,0.18);""",
            """html[data-theme="stone-light"] .btn.ghost {
  color: var(--text);
  border-color: rgba(70,74,82,0.35);
}
html[data-theme="stone-light"] .bubble.bot {
  background: #fff;
  color: #1f1c18;
  border: 1px solid rgba(70,74,82,0.15);
}
html[data-theme="stone-light"] .chat-box {
  background: rgba(255,255,255,0.55);
}
html[data-theme="stone-light"] .doc-viewer-paper {
  background: #fff;
  color: #1f1c18;
}
""",
        ],
    )

    write_pack(
        "burnished-crest",
        ["#1a160f", "#0e0c08", "#221c12", "#e0b85a", "#8a6a28", "#c9a227", "CREST"],
        [
            """  --bg: #0e0c08;
  --bg-2: #17140e;
  --bg-3: #241e14;
  --graphite: #2e2618;
  --graphite-2: #453820;
  --line: rgba(184, 140, 60, 0.22);
  --line-strong: rgba(184, 140, 60, 0.4);
  --text: #f0e6d0;
  --muted: #a09070;
  --gold: #b8923a;
  --gold-bright: #e0b85a;
  --gold-dim: #6e5218;
  --gold-soft: rgba(184, 146, 58, 0.16);
  --shadow-lux: 0 18px 44px rgba(0,0,0,0.6);
  --metric-bg: linear-gradient(155deg, rgba(224,184,90,0.1), rgba(20,16,8,0.8));
  --metric-shadow: inset 0 1px 0 rgba(224,184,90,0.15), 0 10px 24px rgba(0,0,0,0.45);
  --hero-title: linear-gradient(180deg, #f5e6c0 0%, #b8923a 90%);""",
            """  background:
    radial-gradient(ellipse 70% 40% at 50% -5%, rgba(184,146,58,0.18), transparent 50%),
    linear-gradient(180deg, #1c1810, #0e0c08 60%, #080604);""",
            """  background:
    linear-gradient(150deg, rgba(224,184,90,0.12), transparent 40%),
    linear-gradient(180deg, #241e14, #120e08);
  border: 1px solid rgba(184,140,60,0.35);
  box-shadow:
    inset 0 1px 0 rgba(224,184,90,0.2),
    inset 0 -2px 4px rgba(0,0,0,0.45),
    0 14px 34px rgba(0,0,0,0.55);""",
            """  background: linear-gradient(180deg, #e8c878, #b8923a 45%, #6e5218);
  color: #1a1408;
  box-shadow:
    inset 0 1px 0 rgba(255,240,200,0.5),
    inset 0 -2px 0 rgba(60,40,10,0.4),
    0 12px 26px rgba(184,146,58,0.28);""",
        ],
    )

    write_pack(
        "glass-prism",
        ["#0a0e14", "#05070c", "rgba(30,40,55,0.85)", "#a5f3fc", "#67e8f9", "#22d3ee", "GLASS"],
        [
            """  --bg: #05070c;
  --bg-2: rgba(18, 24, 36, 0.82);
  --bg-3: rgba(28, 36, 52, 0.9);
  --graphite: rgba(40, 50, 70, 0.85);
  --graphite-2: rgba(55, 70, 95, 0.9);
  --line: rgba(165, 243, 252, 0.18);
  --line-strong: rgba(165, 243, 252, 0.4);
  --text: #e8f4ff;
  --muted: #8aa0b8;
  --gold: #22d3ee;
  --gold-bright: #a5f3fc;
  --gold-dim: #0e7490;
  --gold-soft: rgba(34, 211, 238, 0.14);
  --shadow-lux: 0 18px 48px rgba(0,0,0,0.55), 0 0 40px rgba(34,211,238,0.06);
  --metric-bg: linear-gradient(145deg, rgba(165,243,252,0.1), rgba(10,14,24,0.65));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 28px rgba(0,0,0,0.4);
  --nav-bg: rgba(5,7,12,0.92);
  --hero-title: linear-gradient(90deg, #fff 0%, #a5f3fc 40%, #c084fc 70%, #f9a8d4 100%);""",
            """  background:
    radial-gradient(ellipse 50% 40% at 50% 30%, rgba(34,211,238,0.16), transparent 55%),
    radial-gradient(circle at 80% 70%, rgba(192,132,252,0.12), transparent 35%),
    radial-gradient(circle at 15% 80%, rgba(249,168,212,0.08), transparent 30%),
    linear-gradient(180deg, #0c121c, #05070c 60%, #03040a);""",
            """  background:
    linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 40%, rgba(34,211,238,0.06)),
    rgba(16, 22, 34, 0.72);
  border: 1px solid rgba(165,243,252,0.28);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -1px 0 rgba(34,211,238,0.12),
    0 16px 40px rgba(0,0,0,0.45),
    0 0 30px rgba(34,211,238,0.08);""",
            """  background: linear-gradient(135deg, #ecfeff, #a5f3fc 35%, #c084fc 70%, #f9a8d4);
  color: #0c1220;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),
    0 0 28px rgba(34,211,238,0.35),
    0 12px 28px rgba(0,0,0,0.35);""",
        ],
    )

    write_pack(
        "metal-silver",
        ["#16181c", "#0c0e12", "#22262c", "#e5e7eb", "#9ca3af", "#d1d5db", "SILVER"],
        [
            """  --bg: #0c0e12;
  --bg-2: #16191e;
  --bg-3: #22262c;
  --graphite: #2c3138;
  --graphite-2: #3f4650;
  --line: rgba(209, 213, 219, 0.16);
  --line-strong: rgba(209, 213, 219, 0.34);
  --text: #f3f4f6;
  --muted: #9ca3af;
  --gold: #c0c5cc;
  --gold-bright: #e5e7eb;
  --gold-dim: #6b7280;
  --gold-soft: rgba(192, 197, 204, 0.12);
  --shadow-lux: 0 18px 44px rgba(0,0,0,0.55);
  --metric-bg: linear-gradient(160deg, rgba(255,255,255,0.1), rgba(20,22,26,0.85));
  --metric-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px rgba(0,0,0,0.4);
  --nav-bg: rgba(10,12,16,0.96);
  --hero-title: linear-gradient(180deg, #ffffff 0%, #c0c5cc 80%);""",
            """  background:
    radial-gradient(ellipse 70% 40% at 50% -10%, rgba(255,255,255,0.08), transparent 50%),
    linear-gradient(180deg, #1a1d22, #0c0e12 55%, #08090c);""",
            """  background:
    linear-gradient(155deg, rgba(255,255,255,0.12), transparent 38%),
    linear-gradient(180deg, #2a2f36, #14171c);
  border: 1px solid rgba(209,213,219,0.28);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -2px 0 rgba(0,0,0,0.4),
    0 14px 32px rgba(0,0,0,0.5);""",
            """  background: linear-gradient(180deg, #f9fafb, #c0c5cc 48%, #6b7280);
  color: #111827;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.75),
    inset 0 -2px 0 rgba(30,35,40,0.3),
    0 12px 26px rgba(0,0,0,0.4);""",
        ],
    )

    dirs = sorted(p.name for p in ROOT.iterdir() if p.is_dir())
    print("OK", ", ".join(dirs))


if __name__ == "__main__":
    main()
