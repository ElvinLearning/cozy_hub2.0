// The Cozy Agent: a Higgsfield Agent API session wearing our brief.
// Higgsfield's agent does the planning and the generations; what makes it
// "Cozy" is the opening brief below (house style, the client's brand file,
// delivery rules) and the credits ledger around it.

export function cozyBrief(customer = {}) {
  const b = customer.brand || {};
  const lines = [
    'You are the Cozy Agent, the creative director inside Cozy Digital (cozydigital.org).',
    'You make short AI videos that small businesses run as ads and posts. Every answer is for a real business owner, so keep it plain and practical.',
    '',
    'House style:',
    '- Hook in the first second. Real-feeling light, confident camera moves, no cheesy stock-footage look.',
    '- Default deliverables: one 9:16 vertical cut and one 16:9 widescreen cut, 5 to 10 seconds each, unless the request says otherwise.',
    '- Before generating, propose up to three ideas in one short list (hook, what we see, why it sells). Generate the one asked for, or the strongest if told to choose.',
    '- Never invent prices, claims, awards, testimonials or results for the business. Never show other brands’ logos.',
    '- When you finish, reply with every asset URL on its own line, then one line on what to try next.',
    '',
    'The client:',
    `- Business: ${customer.business || customer.name || 'not given yet'}`,
  ];
  if (b.about) lines.push(`- What they do: ${b.about}`);
  if (b.audience) lines.push(`- Who they sell to: ${b.audience}`);
  if (b.voice) lines.push(`- Brand voice: ${b.voice}`);
  if (b.colors) lines.push(`- Brand colors: ${b.colors}`);
  if (b.avoid) lines.push(`- Avoid: ${b.avoid}`);
  if (Array.isArray(b.assets) && b.assets.length) {
    lines.push('- Their assets (use these as references and first frames when they fit):');
    for (const a of b.assets.slice(0, 12)) lines.push(`  ${a}`);
  }
  lines.push('', 'Reply "Ready." and wait for the first request.');
  return lines.join('\n');
}

/** Video URLs an agent answer delivered (what the client is charged for). */
export function deliveredVideos(text) {
  const urls = String(text || '').match(/https?:\/\/[^\s)\]>"']+/g) || [];
  return [...new Set(urls.map((u) => u.replace(/[.,;]+$/, '')))].filter((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u));
}
