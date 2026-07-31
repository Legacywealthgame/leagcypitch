/* ==========================================================
   Legacy Wealth — QR companion pages
   Shared stylesheet (Wealth Wisdom + Business Blueprint)
   ========================================================== */

:root{
  --cream:#FAF7F0;
  --gold:#C9A84C;
  --gold-soft:#E3D4A3;
  --ink:#07080D;
  --ink-soft:#3E4048;
  --rule:rgba(7,8,13,.10);
  --shadow:0 18px 50px -22px rgba(7,8,13,.45);
  --serif:'Playfair Display',Georgia,'Times New Roman',serif;
  --sans:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
}

*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{margin:0;padding:0;}
html{-webkit-text-size-adjust:100%;}

body{
  background:var(--cream);
  color:var(--ink);
  font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
  min-height:100svh;
  display:flex;
  flex-direction:column;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

/* ---------- Masthead ---------- */
.masthead{text-align:center;padding:26px 22px 16px;}
.brand{
  font-size:10px;font-weight:600;letter-spacing:.34em;
  text-transform:uppercase;color:var(--ink-soft);opacity:.65;
}
.masthead h1{
  font-family:var(--serif);font-weight:600;
  font-size:clamp(30px,9vw,40px);line-height:1.02;
  margin:10px 0 0;letter-spacing:-.015em;
}
.flourish{
  width:64px;height:1px;margin:14px auto 0;
  background:linear-gradient(90deg,transparent,var(--gold),transparent);
}

/* ---------- Stage + card ---------- */
.stage{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:8px 18px 26px;}
.card{
  width:100%;max-width:560px;background:#fff;
  border:1px solid var(--rule);border-top:3px solid var(--gold);
  border-radius:3px;box-shadow:var(--shadow);
  padding:30px 24px 28px;position:relative;
  animation:rise .5s cubic-bezier(.2,.7,.3,1) both;
}
@keyframes rise{from{opacity:0;transform:translateY(14px) scale(.99);}to{opacity:1;transform:none;}}

.kicker{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:20px;}
.badge{
  font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink);background:var(--gold-soft);border:1px solid var(--gold);
  padding:5px 9px;border-radius:2px;white-space:nowrap;
}
.cat{
  font-size:10.5px;font-weight:500;letter-spacing:.13em;
  text-transform:uppercase;color:var(--ink-soft);opacity:.7;
}

.statement{
  font-family:var(--serif);font-size:clamp(21px,5.6vw,26px);
  line-height:1.34;font-weight:500;margin:0;letter-spacing:-.01em;
}
.statement.quoted::before{content:'\201C';}
.statement.quoted::after{content:'\201D';}

.lesson-title{
  font-family:var(--serif);font-size:clamp(24px,6.4vw,30px);
  line-height:1.16;font-weight:600;margin:0 0 16px;letter-spacing:-.015em;
}
.lesson-body{font-size:16.5px;line-height:1.66;color:var(--ink-soft);margin:0;}

/* ---------- Flashcard term ---------- */
.term{
  font-family:var(--serif);font-size:clamp(30px,8.4vw,42px);
  line-height:1.08;font-weight:600;margin:0;letter-spacing:-.02em;
}

/* ---------- Reveal fields (flashcards) ---------- */
.field-label{
  font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gold);margin:0 0 7px;
}
.field-label.spaced{margin-top:20px;}
.field-text{font-size:16.5px;line-height:1.6;color:var(--ink-soft);margin:0;}

/* ---------- Choices ---------- */
.choices{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:26px;}
.choices.single{grid-template-columns:1fr;}
.choice{
  font-family:var(--sans);font-size:14px;font-weight:600;
  letter-spacing:.11em;text-transform:uppercase;
  padding:17px 10px;border:1.5px solid var(--ink);
  background:transparent;color:var(--ink);border-radius:2px;
  cursor:pointer;transition:background .16s ease,color .16s ease,transform .12s ease;
}
.choice:active{transform:scale(.975);}
.choice:hover{background:var(--ink);color:var(--cream);}
.choice:focus-visible{outline:2px solid var(--gold);outline-offset:3px;}

/* ---------- Reveal ---------- */
.reveal{
  margin-top:24px;padding-top:22px;border-top:1px solid var(--rule);
  animation:fade .42s ease both;
}
@keyframes fade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}

.verdict{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap;margin-bottom:14px;}
.verdict-word{
  font-family:var(--serif);font-size:34px;font-weight:700;
  line-height:1;letter-spacing:-.02em;
}
.verdict-note{
  font-size:10.5px;font-weight:600;letter-spacing:.17em;
  text-transform:uppercase;padding:4px 8px;border-radius:2px;
}
.right{background:rgba(201,168,76,.16);color:#7C6520;border:1px solid var(--gold);}
.wrong{background:rgba(7,8,13,.05);color:var(--ink-soft);border:1px solid var(--rule);}
.explain{font-size:16px;line-height:1.64;color:var(--ink-soft);margin:0;}

/* ---------- Tray ---------- */
.tray{padding:0 18px 30px;display:flex;justify-content:center;}
.again{
  font-family:var(--sans);font-size:12.5px;font-weight:600;
  letter-spacing:.19em;text-transform:uppercase;
  background:var(--ink);color:var(--cream);border:none;
  padding:17px 34px;border-radius:2px;cursor:pointer;
  width:100%;max-width:560px;
  transition:opacity .16s ease,transform .12s ease;
}
.again:active{transform:scale(.985);}
.again:hover{opacity:.87;}
.again:focus-visible{outline:2px solid var(--gold);outline-offset:3px;}
.again[hidden]{display:none;}

/* ---------- Fallback / empty states ---------- */
.fallback{
  text-align:center;
}
.fallback h2{
  font-family:var(--serif);font-size:24px;font-weight:600;
  margin:0 0 12px;letter-spacing:-.01em;
}
.fallback p{font-size:16px;line-height:1.62;color:var(--ink-soft);margin:0;}

.legal{
  text-align:center;font-size:10.5px;line-height:1.6;
  color:var(--ink-soft);opacity:.5;
  padding:0 26px 26px;max-width:520px;margin:0 auto;
}
.legal strong{font-weight:600;}

@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
@media (min-width:640px){.card{padding:38px 36px 34px;}.masthead{padding-top:44px;}}
