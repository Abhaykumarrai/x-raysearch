/** Warm, first-person lines — append after dashboard readout; still grounded in live counts. */

function pick(seed, lines) {
  if (!lines?.length) return "";
  const i = Math.abs(Math.floor(Number(seed))) % lines.length;
  return lines[i];
}

export function nayraPipelineSearchLiveLine(seed = 0) {
  return pick(seed, [
    "Okay — I'm out there looking now, across LinkedIn and the other sources you turned on. I'll drop everyone I find into this list as I go.",
    "Here we go — I'm hunting for people on LinkedIn, GitHub, X, portfolios, and Google. Watch the rows fill up while I pull them in.",
  ]);
}

export function nayraPipelineSerpHitsLine(hits, seed = 0) {
  const h = Math.max(0, Number(hits) || 0);
  if (h <= 0) return null;
  return pick(seed, [
    `So far search has turned up ${h} promising leads — mostly LinkedIn-facing links from Google. I'm turning each one into a profile card you can actually read.`,
    `I've got ${h} candidates worth a closer look from that search pass. Next I'm cleaning them up into proper rows so we can compare them fairly.`,
    `${h} hits on the board — I'm unpacking them one by one into real profiles below.`,
  ]);
}

export function nayraPipelineFirstProfileLine(seed = 0) {
  return pick(seed, [
    "There — first person just landed on the page. I'm still pulling more behind them.",
    "Got someone! First profile's in. I'm lining up the rest as fast as the data arrives.",
    "First face is up — give me a moment and you'll see the list grow.",
  ]);
}

export function nayraPipelineParsingProgressLine(parsed, seed = 0) {
  const p = Math.max(0, Number(parsed) || 0);
  return pick(seed, [
    `I'm at ${p} people now — still reading what came back and structuring each profile so nothing gets lost.`,
    `${p} and counting — I'm basically introducing each candidate to you in a tidy row before we judge fit.`,
    `Up to ${p} profiles unpacked. I'm making sure every skill and title is in the right place before we score.`,
  ]);
}

export function nayraPipelinePreScoreLine(total, seed = 0) {
  const t = Math.max(0, Number(total) || 0);
  return pick(seed, [
    `Everyone's here — all ${t} profiles are lined up. Now I'm about to score how well each one matches what you're hiring for.`,
    `${t} candidates ready on my side. Next step: I'm lining each person up against your job description and giving them a real match score.`,
    `Parsing's done for all ${t}. Coming up — I'm judging fit, not just keywords, so you get a ranked list that makes sense.`,
  ]);
}

export function nayraPipelineScoringStartLine(total, seed = 0) {
  const t = Math.max(0, Number(total) || 0);
  if (t <= 0) {
    return pick(seed, [
      "I'm starting match scores now — you'll see a percentage beside each name as soon as I've made up my mind.",
      "Scoring time — I'm walking through every profile and asking how well they fit your brief. Watch the numbers appear.",
    ]);
  }
  return pick(seed, [
    `Now I'm scoring — I'm going one by one through ${t} people and telling you how strongly each one fits your role.`,
    `${t} candidates on my desk. I'm grading each against your JD so you can see who actually belongs in your shortlist.`,
    `This is the part where I get picky — ${t} profiles, each getting a fair match score and a short why-it-matters note.`,
  ]);
}

export function nayraPipelineScoringProgressLine(scored, total, seed = 0) {
  const s = Math.max(0, Number(scored) || 0);
  const t = Math.max(0, Number(total) || 0);
  if (t <= 0 || s <= 0) return null;
  const left = t - s;
  return pick(seed, [
    `I'm ${s} deep out of ${t} — still grading the other ${left}. Almost there.`,
    `${s} of ${t} scored so far; ${left} left in my queue. I'll keep talking as the list settles.`,
    `Through ${s} people already — ${left} more to go before everyone's ranked and ready for you.`,
  ]);
}
