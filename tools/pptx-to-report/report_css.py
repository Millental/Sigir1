"""Вынесенный <style> утверждённой ledger-дизайн-системы SIGIR (как в живом
еженедельном своде) — используется как есть, без изменений, чтобы вывод
конвертера визуально совпадал с утверждённым форматом."""

REPORT_CSS = """
  :root{
    color-scheme: light;
    --plane:      #faf8f3;
    --surface:    #faf8f3;
    --surface-2:  #f1ecdf;
    --line:       #ddd4c0;
    --line-soft:  #e9e2d2;
    --ink:        #20161b;
    --ink-soft:   #594a52;
    --muted:      #8c7f85;
    --brand-900:  #1c1129;
    --brand-700:  #3a2260;
    --brand-600:  #4d2c82;
    --brand-500:  #6c3fb0;
    --brand-300:  #b79ce3;
    --brand-100:  #ece2f8;
    --amber-600:  #b9720e;
    --amber-500:  #d9a441;
    --amber-100:  #faedd3;
    --orange-500: #c2581a;
    --orange-700: #8a3d0f;
    --orange-100: #fce7d6;
    --good:       #2f7d3c;
    --good-bg:    #e5f7e5;
    --warning:    #a86a00;
    --warning-bg: #fdf0d8;
    --serious:    #b23a1c;
    --serious-bg: #fbe6dc;
    --critical:   #a62f2f;
    --critical-bg:#fbe3e3;
    --shadow: none;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      color-scheme: dark;
      --plane:      #171019; --surface:#171019; --surface-2:#221a24;
      --line:#3a2f3a; --line-soft:#2c2430; --ink:#f2ecef; --ink-soft:#cbbdc5; --muted:#948a90;
      --brand-500:#a788dd; --brand-300:#6c4aa6; --brand-100:#291f3a;
      --amber-600:#e6ab4d; --orange-500:#e38a52; --orange-700:#f0a56c;
      --good:#4fc466; --good-bg:#15301d; --warning:#e3b24c; --warning-bg:#332710;
      --serious:#e07e52; --serious-bg:#35241a; --critical:#e2706b; --critical-bg:#361d1c;
    }
  }
  :root[data-theme="dark"]{
    color-scheme: dark;
    --plane:#171019; --surface:#171019; --surface-2:#221a24;
    --line:#3a2f3a; --line-soft:#2c2430; --ink:#f2ecef; --ink-soft:#cbbdc5; --muted:#948a90;
    --brand-500:#a788dd; --brand-300:#6c4aa6; --brand-100:#291f3a;
    --amber-600:#e6ab4d; --orange-500:#e38a52; --orange-700:#f0a56c;
    --good:#4fc466; --good-bg:#15301d; --warning:#e3b24c; --warning-bg:#332710;
    --serious:#e07e52; --serious-bg:#35241a; --critical:#e2706b; --critical-bg:#361d1c;
  }

  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{
    margin:0; background:var(--plane); color:var(--ink);
    font-family:"Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size:15.5px; line-height:1.5; -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
  }
  h1,h2,h3,.eyebrow,.nav-link{font-family:"Montserrat","Golos Text",system-ui,sans-serif}
  h1,h2,h3{margin:0; text-wrap:balance; font-weight:700; letter-spacing:-.01em}
  p{margin:0}
  ul{margin:0; padding:0; list-style:none}
  a{color:inherit}
  :focus-visible{outline:2px solid var(--brand-500); outline-offset:3px; border-radius:2px}
  .num{font-variant-numeric:tabular-nums}

  .wrap{max-width:1180px; margin:0 auto; padding:0 32px}
  @media (max-width:640px){.wrap{padding:0 18px}}

  header.masthead{ background:var(--brand-900); color:#f4effc; padding:48px 0 34px; }
  .masthead .eyebrow{color:#c9adf2}
  .masthead .eyebrow .brand-mark{color:var(--orange-500); font-weight:800}
  header.masthead h1{ font-size:clamp(2.1rem, 4.4vw, 3.1rem); font-weight:800; color:#fff; margin-top:10px; }
  .masthead-meta{ display:flex; flex-wrap:wrap; gap:8px 28px; margin-top:18px; font-size:.9rem; color:#cdbbe6; font-variant-numeric:tabular-nums; }
  .masthead-meta b{color:#fff; font-weight:600}
  .masthead-rule{ width:100%; height:1px; margin-top:24px; background:linear-gradient(90deg, var(--orange-500), transparent 70%); }

  .eyebrow{ text-transform:uppercase; font-size:.72rem; font-weight:700; letter-spacing:.11em; color:var(--brand-500); }

  nav.subnav{ position:sticky; top:0; z-index:30; background:color-mix(in oklab, var(--surface) 92%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
  nav.subnav .wrap{ display:flex; align-items:center; gap:0; overflow-x:auto; padding-top:12px; padding-bottom:12px; scrollbar-width:thin; scrollbar-color:var(--brand-300) transparent; -webkit-mask-image:linear-gradient(to right, #000 calc(100% - 46px), transparent 100%); mask-image:linear-gradient(to right, #000 calc(100% - 46px), transparent 100%); }
  nav.subnav .wrap::-webkit-scrollbar{height:6px}
  nav.subnav .wrap::-webkit-scrollbar-track{background:transparent}
  nav.subnav .wrap::-webkit-scrollbar-thumb{background:var(--brand-300); border-radius:99px}
  nav.subnav .wrap::-webkit-scrollbar-thumb:hover{background:var(--brand-500)}
  .nav-link{ flex:0 0 auto; white-space:nowrap; font-size:.8rem; font-weight:600; color:var(--ink-soft); padding:5px 0; margin-right:18px; text-decoration:none; border-bottom:2px solid transparent; transition:color .12s, border-color .12s; }
  .nav-link:hover{color:var(--orange-700); border-color:var(--orange-500)}

  section.dept{padding:46px 0; border-top:1px solid var(--line)}
  section.dept:first-of-type{border-top:none}
  .dept-head{scroll-margin-top:76px; margin-bottom:24px; display:flex; align-items:baseline; gap:14px; flex-wrap:wrap}
  .dept-head h2{font-size:1.38rem; color:var(--ink)}
  .dept-head .role{font-size:.88rem; color:var(--muted)}
  .group-title{ padding:36px 0 6px; font-size:.72rem; text-transform:uppercase; letter-spacing:.16em; font-weight:700; color:var(--orange-700); border-top:1px solid var(--ink); margin-top:8px; }
  .wrap > .group-title:first-child{border-top:none; margin-top:0}

  .row2{display:grid; grid-template-columns:1fr 1fr; gap:30px; min-width:0}
  .row2 > *{min-width:0}
  @media (max-width:760px){.row2{grid-template-columns:1fr}}

  .block{margin-bottom:22px}
  .block:last-child{margin-bottom:0}
  .block-title{font-size:.82rem; font-weight:700; color:var(--ink-soft); margin-bottom:10px; text-transform:uppercase; letter-spacing:.04em}

  .bullets li{position:relative; padding-left:14px; margin-bottom:5px; color:var(--ink-soft); font-size:.88rem}
  .bullets li::before{content:"–"; position:absolute; left:0; color:var(--muted)}
  .bullets.tight li{margin-bottom:3px}
  .plain-p{font-size:.88rem; color:var(--ink-soft); margin-bottom:8px; white-space:pre-line}

  .risk{border-left:3px solid var(--serious); padding:4px 0 4px 16px; font-size:.9rem; color:var(--serious); font-weight:500}

  .dept-footer{margin-top:32px; padding-top:18px; border-top:1px solid var(--line-soft)}
  .dept-footer-label{ font-size:.74rem; text-transform:uppercase; letter-spacing:.09em; color:var(--muted); font-weight:700; margin-bottom:12px; }
  .dept-footer-row{display:flex; flex-wrap:wrap; column-gap:36px; row-gap:12px}
  .dept-footer-stat .dt{font-size:.72rem; color:var(--muted); margin-bottom:3px}
  .dept-footer-stat .dd{font-size:.98rem; font-weight:700; color:var(--ink)}
  .dept-footer-note{font-size:.86rem; color:var(--ink-soft); max-width:360px}
  .dept-footer-note b{color:var(--ink); font-weight:600}
  .dept-footer-empty{font-size:.86rem; color:var(--muted); font-style:italic}

  .tbl-wrap{overflow-x:auto; -webkit-overflow-scrolling:touch; max-width:100%}
  table.tbl{width:100%; border-collapse:collapse; font-size:.82rem; min-width:0}
  table.tbl th, table.tbl td{padding:6px 10px 6px 0; text-align:right; border-bottom:1px solid var(--line-soft); white-space:nowrap}
  table.tbl th:first-child, table.tbl td:first-child{text-align:left; white-space:normal; padding-left:0}
  table.tbl th.wrap, table.tbl td.wrap{white-space:normal; text-align:left}
  table.tbl thead th{color:var(--muted); font-weight:600; font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid var(--ink)}
  table.tbl tbody tr:last-child td{border-bottom:1px solid var(--line-soft)}
  .tbl-caption{font-size:.8rem; color:var(--muted); margin:9px 0 5px; font-weight:600}
  .tbl-caption:first-child{margin-top:0}

  .chart-card{padding:0; border-top:1px solid var(--line-soft)}
  .chart-head{display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin:14px 0 10px; flex-wrap:wrap}
  .chart-head h4{font-size:.86rem; font-weight:700; color:var(--ink-soft)}
  .linechart{width:100%; height:auto}
  .linechart .grid-line{stroke:var(--line-soft); stroke-width:1}
  .linechart .area{fill:var(--brand-500); opacity:.08}
  .linechart .line{fill:none; stroke:var(--brand-500); stroke-width:2; stroke-linecap:round; stroke-linejoin:round}
  .linechart .dot{fill:var(--surface); stroke:var(--brand-500); stroke-width:2}
  .linechart .dot.end{fill:var(--brand-700); stroke:var(--surface); stroke-width:2}
  .linechart text{font-family:"Golos Text",sans-serif; fill:var(--muted); font-size:11px}
  .linechart text.end-label{fill:var(--brand-700); font-weight:700; font-size:12px}
  :root[data-theme="dark"] .linechart text.end-label{fill:var(--brand-300)}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .linechart text.end-label{fill:var(--brand-300)}}

  .cols3{display:grid; grid-template-columns:repeat(var(--cols,3),1fr); gap:28px; min-width:0}
  .cols3 > *{min-width:0; border-left:1px solid var(--line-soft); padding-left:18px}
  .cols3 > *:first-child{border-left:none; padding-left:0}
  @media (max-width:900px){.cols3{grid-template-columns:1fr} .cols3 > *{border-left:none; padding-left:0; border-top:1px solid var(--line-soft); padding-top:14px} .cols3 > *:first-child{border-top:none; padding-top:0}}

  .subcard{padding:0}
  .subcard h5{font-size:.84rem; font-weight:700; margin-bottom:8px; color:var(--ink)}

  .divider-dept{ margin:18px 0; padding:28px 0; border-top:1px dashed var(--line); border-bottom:1px dashed var(--line); display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:8px; min-height:0; }
  .divider-dept h3{font-size:1.5rem; color:var(--ink-soft); font-weight:700}
  .divider-dept .tag-empty{ font-size:.84rem; color:var(--muted); font-style:italic; }

  footer{padding:44px 0 56px; color:var(--muted); font-size:.85rem; border-top:1px solid var(--line)}
  footer .wordmark{font-family:"Montserrat"; font-weight:800; letter-spacing:.06em; color:var(--orange-700); font-size:1rem; margin-bottom:6px}

  @media print{ nav.subnav{position:static} section.dept{break-inside:avoid} }
"""
