function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTime(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').replace(/\..+/, '') + ' UTC';
}

function renderKillPage({ killID, killmail, resolved }) {
    const {
        victimName, victimCorp, victimShip,
        systemName, regionName, security,
        finalBlowName, finalBlowCorp, finalBlowShip,
        attackers
    } = resolved;

    const time = formatTime(killmail.killmail_time);
    const attackerCount = attackers.length;

    // Open Graph metadata for Discord/Bluesky/Slack/Twitter previews
    const ogTitle = `${victimName} loses ${victimShip} in ${systemName}`;
    const ogDesc = `${attackerCount} attacker${attackerCount === 1 ? '' : 's'} | Final blow: ${finalBlowName} (${finalBlowShip}) | ${time}`;
    const ogImage = `https://images.evetech.net/types/${killmail.victim.ship_type_id}/render?size=512`;

    const attackerRows = attackers.map(a => `
        <tr>
            <td>${escapeHtml(a.name)}</td>
            <td>${escapeHtml(a.corp)}</td>
            <td>${escapeHtml(a.ship)}</td>
            <td style="text-align:right">${(a.damage || 0).toLocaleString()}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(ogTitle)} | Socket.Kill</title>
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDesc)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:url" content="https://socketkill.com/kill/${killmail.killmail_time.slice(0,10)}/${killID}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDesc)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
<style>
body { font-family: -apple-system, system-ui, sans-serif; max-width: 900px; margin: 2em auto; padding: 0 1em; background: #0d1117; color: #c9d1d9; }
h1 { font-size: 1.4em; margin-bottom: 0.2em; }
h2 { font-size: 1.1em; margin-top: 1.5em; border-bottom: 1px solid #30363d; padding-bottom: 0.3em; }
.meta { color: #8b949e; font-size: 0.9em; margin-bottom: 1em; }
.victim-block { display: flex; gap: 1em; align-items: center; padding: 1em; background: #161b22; border-radius: 6px; }
.victim-block img { width: 96px; height: 96px; border-radius: 4px; }
table { width: 100%; border-collapse: collapse; margin-top: 0.5em; }
th, td { padding: 0.4em 0.6em; text-align: left; border-bottom: 1px solid #21262d; font-size: 0.9em; }
th { color: #8b949e; font-weight: normal; }
a { color: #58a6ff; }
.footer { margin-top: 2em; padding-top: 1em; border-top: 1px solid #30363d; font-size: 0.85em; color: #8b949e; }
</style>
</head>
<body>
<h1>${escapeHtml(victimName)} &mdash; ${escapeHtml(victimShip)}</h1>
<div class="meta">Killmail #${killID} &middot; ${escapeHtml(time)}</div>

<div class="victim-block">
    <img src="${escapeHtml(ogImage)}" alt="${escapeHtml(victimShip)}">
    <div>
        <div><strong>${escapeHtml(victimName)}</strong></div>
        <div>${escapeHtml(victimCorp)}</div>
        <div>Lost a <strong>${escapeHtml(victimShip)}</strong></div>
    </div>
</div>

<h2>Location</h2>
<div>${escapeHtml(systemName)} (${security?.toFixed?.(1) ?? '?'}) &middot; ${escapeHtml(regionName)}</div>

<h2>Final Blow</h2>
<div>${escapeHtml(finalBlowName)} &middot; ${escapeHtml(finalBlowCorp)} &middot; ${escapeHtml(finalBlowShip)}</div>

<h2>Attackers (${attackerCount})</h2>
<table>
    <thead><tr><th>Pilot</th><th>Corporation</th><th>Ship</th><th style="text-align:right">Damage</th></tr></thead>
    <tbody>${attackerRows}</tbody>
</table>

<div class="footer">
    <a href="https://zkillboard.com/kill/${killID}/" rel="noopener">View on zKillboard</a> &middot;
    <a href="https://socketkill.com/">Socket.Kill</a>
</div>
</body>
</html>`;
}

module.exports = { renderKillPage };