// netlify/functions/briefing.js
//
// The daily briefing agent for Venture Legacy.
// Reads live business state, calls Claude with the advisor panel's voice,
// returns a short, direct briefing plus the questions Jordan should be asked today.
//
// Requires env var: ANTHROPIC_API_KEY  (set in Netlify dashboard, never in the repo)

import { getStore } from "@netlify/blobs";
import seed from "../../state.json" with { type: "json" };

const MODEL = "claude-sonnet-4-6";

// ---------- the agents ----------
// Each agent is a lens, not a separate system. Same data, different job.

const AGENTS = {
  chief: {
    name: "Chief of Staff",
    brief: `You run point. Your job is to tell Jordan where the business actually stands today, what moved, what did not, and the single most valuable thing he can do in the next 24 hours. You are direct and you do not pad. If something has been sitting untouched for days, you say so plainly.`
  },
  content: {
    name: "Content",
    brief: `You own audience growth. You think like Gary Vee on volume and Godin on remarkability. The email list is the number that matters, not followers. You push for shipped content over polished content, and you flag when a week has gone by without filming. You know the six content pillars and the signature intro hook.`
  },
  money: {
    name: "Finance",
    brief: `You own the numbers. Landed cost, breakeven, cash flow, and margin. You think like Hormozi on capital efficiency. You are the one who reminds Jordan that pre-order money is owed as product, not available to spend. You flag the cash flow gap between November payment and February delivery whenever it becomes relevant.`
  },
  ops: {
    name: "Operations",
    brief: `You own manufacturing, fulfillment, and timelines. You track the design bottleneck, the Bangwee relationship, the 75-day production and shipping clock, and the 3PL decision. You work backward from delivery dates and tell Jordan when a date is about to become impossible.`
  },
  launch: {
    name: "Launch",
    brief: `You own the November 8 launch. You think like Brunson on sequencing and Kennedy on deadlines. You count down, you check whether each phase is on track, and you are the one who says out loud when the launch date is at risk.`
  }
};

const HOUSE_RULES = `
You are part of Jordan Thomas's operating team for Venture Legacy, a financial education company. Jordan is a licensed financial planner. The flagship product is Legacy Wealth, a premium financial and business education board game.

How you talk to Jordan:
- Plain language. Short sentences. He often listens rather than reads.
- No em dashes, ever.
- No hype, no bro talk. Warm but direct.
- Give your honest recommendation, not a list of options. He makes the final call himself.
- Never flatter. If a number is bad or a task is slipping, lead with that.
- He is one person doing four jobs. Do not hand him twenty tasks. Give him the one or two that matter today.

Hard business facts you must never get wrong:
- Retail price is $79.99. Landed cost is $11.83 per unit. A 1,000 unit run costs $11,830 all in.
- Breakeven is 148 pre-orders. That is when the full run is funded and the order gets placed.
- Production is 35 days, sea shipping is 40 days. That is a 75 day clock from order to delivery.
- Pre-order opens November 8, 2026. Realistic delivery is late January to mid February 2027.
- The brand is premium. Never suggest discounting, Kickstarter, or scarcity theatrics.
- Money collected during pre-order is owed as product. It is not spendable revenue.
`;

const OUTPUT_SHAPE = `
Return your briefing in this shape, using plain text with no markdown headers:

WHERE THINGS STAND
Two or three sentences. The real state of play today, including days remaining until launch and progress against the email list goal.

WHAT MOVED
What changed since the last briefing. If nothing changed, say that plainly and say what it costs him.

TODAY
One or two specific actions. Not a checklist. The thing that matters most, and why it matters most.

WHAT I NEED TO ASK YOU
Two or three direct questions. These should be things you genuinely cannot know from the data and that would change your advice. Ask about things that have been sitting still. Challenge assumptions where the numbers do not support them.
`;

export default async (req, context) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return json({ error: "ANTHROPIC_API_KEY is not set on this site." }, 500);
  }

  const url = new URL(req.url);
  const which = url.searchParams.get("agent") || "chief";
  const agent = AGENTS[which] || AGENTS.chief;

  // ---- load live state, falling back to the repo seed on first run ----
  let state;
  try {
    const store = getStore("venture-legacy");
    const saved = await store.get("state", { type: "json" });
    state = saved || seed;
  } catch (e) {
    state = seed;
  }

  const today = new Date();
  const launch = new Date(state.launchDate);
  const daysOut = Math.ceil((launch - today) / 86400000);

  const facts = {
    today: today.toISOString().slice(0, 10),
    daysUntilLaunch: daysOut,
    metrics: state.metrics,
    money: state.money,
    tracks: state.tracks,
    openQuestions: state.openQuestions,
    recentLog: (state.log || []).slice(-8)
  };

  const system = `${HOUSE_RULES}

You are the ${agent.name} agent.
${agent.brief}
${OUTPUT_SHAPE}`;

  const body = {
    model: MODEL,
    max_tokens: 1400,
    system,
    messages: [{
      role: "user",
      content: `Here is the current state of the business as JSON. Write today's briefing.\n\n${JSON.stringify(facts, null, 2)}`
    }]
  };

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const detail = await r.text();
      return json({ error: "The briefing could not be generated.", detail }, 502);
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim();

    return json({
      agent: agent.name,
      generatedAt: today.toISOString(),
      daysUntilLaunch: daysOut,
      briefing: text
    });

  } catch (err) {
    return json({ error: "Could not reach the briefing service. Try again shortly." }, 502);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}
