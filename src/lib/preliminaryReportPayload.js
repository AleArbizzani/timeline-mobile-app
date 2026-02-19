/**
 * Builds the runsheet text and payload for the Claude preliminary report Edge Function.
 * Reuses logic similar to RunsheetView for resolving path labels and formatting incidents.
 */

const FORMAT_CLOCK = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) return '00:00';
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const buildCodeToLabelMap = (tree) => {
  const map = new Map();
  const dicts = tree?.dictionaries ?? {};
  Object.values(dicts).forEach((options) => {
    if (!Array.isArray(options)) return;
    options.forEach((opt) => {
      if (opt?.code != null) {
        map.set(String(opt.code), opt.label ?? opt.code);
      }
    });
  });
  return map;
};

const resolvePathLabels = (pathCodes, codeToLabel) => {
  if (!pathCodes?.length) return '';
  return pathCodes
    .filter((code) => String(code) !== 'KMI')
    .map((code) => codeToLabel.get(String(code)) ?? code)
    .filter(Boolean)
    .join(' ');
};

const getRefereeFromJson = (incidentJson, codeToLabel) => {
  if (!incidentJson || typeof incidentJson !== 'object') return null;
  const raw =
    incidentJson.referee ??
    incidentJson.official ??
    incidentJson.ref ??
    null;
  if (raw) return raw;
  const roleCode = incidentJson.official_role;
  if (roleCode && codeToLabel) {
    return codeToLabel.get(String(roleCode)) ?? roleCode;
  }
  return null;
};

const formatSanctionOffence = (incident) => {
  const parts = [];
  if (incident.sanction_code) parts.push(incident.sanction_code);
  if (incident.offence_code) parts.push(`(${incident.offence_code})`);
  if (incident.reason_code) parts.push(`reason: ${incident.reason_code}`);
  return parts.length ? parts.join(' ') : null;
};

const formatIncidentLine = (incident, codeToLabel, periodLabel) => {
  const time = FORMAT_CLOCK(incident.clock_second_in_period);
  const referee = getRefereeFromJson(incident.incident_json, codeToLabel);
  const pathLabels = resolvePathLabels(incident.path_codes, codeToLabel);
  const sanctionOffence = formatSanctionOffence(incident);

  const parts = [`[${periodLabel}]`, time];
  if (referee) parts.push(referee);
  if (pathLabels) parts.push(pathLabels);
  if (sanctionOffence) parts.push(sanctionOffence);
  if (incident.note_text?.trim()) {
    parts.push(`- comment: ${incident.note_text.trim()}`);
  }

  return parts.join(' ');
};

const groupIncidentsByPeriod = (incidents, periodSequence) => {
  if (!incidents?.length) return [];
  const orderMap = new Map();
  if (periodSequence?.length) {
    periodSequence.forEach((p, i) => orderMap.set(p.code, i));
  }
  const sorted = [...incidents].sort((a, b) => {
    const orderA = orderMap.has(a.period) ? orderMap.get(a.period) : 999;
    const orderB = orderMap.has(b.period) ? orderMap.get(b.period) : 999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.clock_second_in_period ?? 0) - (b.clock_second_in_period ?? 0);
  });
  const groups = [];
  let currentPeriod = null;
  for (const inc of sorted) {
    const periodCode = inc.period ?? '?';
    if (periodCode !== currentPeriod) {
      currentPeriod = periodCode;
      const periodMeta = periodSequence?.find((p) => p.code === periodCode);
      groups.push({
        periodCode,
        periodLabel: periodMeta?.label ?? periodCode,
        items: [],
      });
    }
    groups[groups.length - 1].items.push(inc);
  }
  return groups;
};

/**
 * Builds the runsheet text for the Claude prompt.
 * @param {Array} incidents - Raw incidents from DB
 * @param {Object} tree - Sport tree for label resolution
 * @param {Array} periodSequence - Period metadata (code, label)
 * @returns {string}
 */
export function buildRunsheetText(incidents, tree, periodSequence) {
  if (!incidents?.length) return '(No incidents recorded)';
  const codeToLabel = buildCodeToLabelMap(tree);
  const groups = groupIncidentsByPeriod(incidents, periodSequence);
  const lines = [];
  for (const group of groups) {
    const label = group.periodLabel ?? group.periodCode;
    for (const inc of group.items) {
      lines.push(formatIncidentLine(inc, codeToLabel, label));
    }
  }
  return lines.join('\n');
}

/**
 * Builds the full payload to send to the Edge Function.
 * @param {Object} match - Game record with home_team, away_team, competition, ground
 * @param {Array} officials - game_officials with role and officials.full_name
 * @param {Array} incidents - Incidents for the game
 * @param {Object} tree - Sport tree
 * @param {Array} periodSequence - Period sequence
 * @returns {{ match: Object, officials: Array, runsheetText: string }}
 */
export function buildPayloadForClaude(match, officials, incidents, tree, periodSequence) {
  const runsheetText = buildRunsheetText(incidents, tree, periodSequence);
  const officialsList = (officials ?? []).map((entry) => ({
    role: entry?.role ?? '',
    full_name: entry?.officials?.full_name ?? entry?.full_name ?? '',
  }));
  return {
    match: {
      home_team: match?.home_team ?? '',
      away_team: match?.away_team ?? '',
      competition: match?.competition ?? '',
      ground: match?.ground ?? '',
    },
    officials: officialsList,
    runsheetText,
  };
}
