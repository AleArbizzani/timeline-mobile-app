import { StyleSheet, Text, View } from 'react-native';
import { getCustomIcon, getIconNamesFromPathCodes } from './CustomIcons';
import { colors, spacing, typography } from '../theme';

const ICON_SIZE = 14;

const FORMAT_CLOCK = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) {
    return '00:00';
  }
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

const formatRowText = (incident, codeToLabel) => {
  const time = FORMAT_CLOCK(incident.clock_second_in_period);
  const referee = getRefereeFromJson(incident.incident_json, codeToLabel);
  const pathLabels = resolvePathLabels(incident.path_codes, codeToLabel);
  const parts = [time];
  if (referee) parts.push(referee);
  if (pathLabels) parts.push(pathLabels);
  return parts.join(' ');
};

const isKmi = (pathCodes) =>
  Array.isArray(pathCodes) && pathCodes.some((c) => String(c) === 'KMI');

const groupIncidentsByPeriod = (incidents, periodSequence) => {
  if (!incidents.length) return [];
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

export default function RunsheetView({
  incidents = [],
  periodSequence = null,
  tree = null,
  isLoading = false,
  emptyText = 'No incidents recorded yet.',
}) {
  const codeToLabel = buildCodeToLabelMap(tree);
  const groups = groupIncidentsByPeriod(incidents, periodSequence);

  if (!incidents.length && !isLoading) {
    return (
      <Text style={styles.emptyText}>{emptyText}</Text>
    );
  }

  return (
    <View style={styles.container}>
      {groups.map((group) => (
        <View key={group.periodCode} style={styles.group}>
          {group.periodLabel != null && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{group.periodLabel}</Text>
            </View>
          )}
          {group.items.map((incident) => {
            const rowText = formatRowText(incident, codeToLabel);
            const iconSource = incident.incident_json?.icon;
            const iconNames = Array.isArray(iconSource)
              ? iconSource.filter((n) => typeof n === 'string' && n.trim())
              : typeof iconSource === 'string' && iconSource.trim()
                ? [iconSource.trim()]
                : getIconNamesFromPathCodes(incident.path_codes);
            const kmi = isKmi(incident.path_codes);

            return (
              <View
                key={incident.id}
                style={[
                  styles.row,
                  kmi && styles.rowKmi,
                ]}
              >
                <Text style={styles.rowText}>
                  {rowText}
                </Text>
                {iconNames.length > 0 ? (
                  <View style={styles.rowIcons} collapsable={false}>
                    {iconNames.map((name) => {
                      const IconComponent = getCustomIcon(name);
                      return IconComponent ? (
                        <View key={name} style={styles.rowIcon}>
                          <IconComponent
                            width={ICON_SIZE}
                            height={ICON_SIZE}
                          />
                        </View>
                      ) : null;
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  group: {
    gap: spacing[8],
  },
  chip: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    backgroundColor: colors.iceGrey,
    alignSelf: 'flex-start',
    borderRadius: 44,
  },
  chipText: {
    ...typography.ui.chip,
    color: colors.softBlack,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.softGrey,
  },
  rowText: {
    flex: 1,
    ...typography.label.medium,
    color: colors.black,
  },
  rowKmi: {
    backgroundColor: colors.iceGrey,
    paddingHorizontal: spacing[4],
  },
  rowIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginLeft: spacing[4],
    flexShrink: 0,
  },
  rowIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  emptyText: {
    color: colors.darkGrey,
    marginTop: spacing[12],
    ...typography.paragraph.small,
  },
});
