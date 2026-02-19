const getOrdinalLabel = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value ?? '');
  }
  const abs = Math.abs(number);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${number}th`;
  }
  switch (abs % 10) {
    case 1:
      return `${number}st`;
    case 2:
      return `${number}nd`;
    case 3:
      return `${number}rd`;
    default:
      return `${number}th`;
  }
};

const PERIOD_UNIT_ABBREVIATIONS = {
  half: 'H',
  quarter: 'Q',
  period: 'P',
  section: 'S',
  inning: 'IN',
};

const formatUnitLabel = (unit) => {
  if (!unit) {
    return 'Period';
  }
  return unit.charAt(0).toUpperCase() + unit.slice(1);
};

const buildPeriodLabel = (label, pattern) => {
  if (!pattern || typeof pattern !== 'string') {
    return label;
  }
  return pattern.replace('{label}', label);
};

export const buildPeriodSequenceFromRules = (rules, matchHasExtraTime, match) => {
  const variants = rules?.variants;
  if (!variants || typeof variants !== 'object') {
    return null;
  }
  const variantKey = rules.default_variant ?? Object.keys(variants)[0];
  const variant = variants?.[variantKey];
  if (!variant?.regulation) {
    return null;
  }

  const periodLabelPattern = rules?.uiHints?.periodLabelPattern ?? '{label}';
  const sequence = [];

  const appendPeriods = (config, kind, lengthMinutes, codeBuilder) => {
    const count = Math.max(0, Number(config?.count ?? 0));
    if (!count) {
      return;
    }
    const unit = config?.unit ?? 'period';
    const labels = Array.isArray(config?.labels) ? config.labels : [];
    const unitLabel = formatUnitLabel(unit);
    const unitAbbrev = PERIOD_UNIT_ABBREVIATIONS[unit] ?? unit.charAt(0).toUpperCase();
    for (let index = 0; index < count; index += 1) {
      const baseLabel = labels[index] ?? `${getOrdinalLabel(index + 1)} ${unitLabel}`;
      sequence.push({
        code: codeBuilder(index, unitAbbrev),
        label: buildPeriodLabel(baseLabel, periodLabelPattern),
        kind,
        unit,
        lengthMinutes,
        isClockRunning: config?.is_clock_running ?? true,
        hasStoppageTime: config?.has_stoppage_time ?? false,
      });
    }
  };

  appendPeriods(
    variant.regulation,
    'regulation',
    match?.half_length_minutes ?? null,
    (index, unitAbbrev) => `${index + 1}${unitAbbrev}`,
  );

  if (matchHasExtraTime && variant.overtime?.type && variant.overtime.type !== 'none') {
    appendPeriods(
      variant.overtime,
      'overtime',
      match?.extra_time_length_minutes ?? null,
      (index, unitAbbrev) => {
        if (variant.overtime.unit === 'half') {
          return `${index + 1}ET`;
        }
        return `ET${index + 1}${unitAbbrev}`;
      },
    );
  }

  if (matchHasExtraTime && variant.tiebreak?.type && variant.tiebreak.type !== 'none') {
    const label = variant.tiebreak.label ?? 'Tiebreak';
    sequence.push({
      code: variant.tiebreak.type === 'penalties' ? 'PK' : 'TB',
      label: buildPeriodLabel(label, periodLabelPattern),
      kind: 'tiebreak',
      unit: 'tiebreak',
      lengthMinutes: null,
      isClockRunning: false,
      hasStoppageTime: false,
    });
  }

  return sequence.length ? sequence : null;
};

export const buildDefaultPeriodSequence = (match) => [
  {
    code: '1H',
    label: '1st Half',
    kind: 'regulation',
    unit: 'half',
    lengthMinutes: match?.half_length_minutes ?? null,
    isClockRunning: true,
    hasStoppageTime: true,
  },
  {
    code: '2H',
    label: '2nd Half',
    kind: 'regulation',
    unit: 'half',
    lengthMinutes: match?.half_length_minutes ?? null,
    isClockRunning: true,
    hasStoppageTime: true,
  },
];
