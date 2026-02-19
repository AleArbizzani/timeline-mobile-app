import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MatchHeaderContainer } from './headers';
import GameCard from './GameCard';
import PrimaryButton from './PrimaryButton';
import RunsheetView from './RunsheetView';
import { colors, spacing, typography } from '../theme';
import { supabase } from '../lib/supabase';
import {
  buildDefaultPeriodSequence,
  buildPeriodSequenceFromRules,
} from '../lib/periodSequence';

const formatKickoffDate = (value) => {
  if (!value) {
    return '—';
  }
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

const formatKickoffTime = (value) => {
  if (!value) {
    return '—';
  }
  return value.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getDateTimeFromMatch = (match) => {
  if (!match?.game_date) {
    return null;
  }
  const rawTime = match.kickoff_time ?? '00:00:00';
  const normalizedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
  const dateTime = new Date(`${match.game_date}T${normalizedTime}`);
  if (Number.isNaN(dateTime.getTime())) {
    return null;
  }
  return dateTime;
};

const getCountdownColor = (diffMinutes) => {
  if (diffMinutes <= 0) {
    return colors.racing;
  }
  const diffHours = diffMinutes / 60;
  if (diffHours < 2) {
    return colors.racing;
  }
  if (diffHours < 10) {
    return colors.orange;
  }
  return colors.forest;
};

const formatCountdown = (diffMinutes) => {
  if (diffMinutes < 0) {
    return `-${Math.abs(diffMinutes)}m`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
};

const officialRoles = [
  { key: 'REF', label: 'Referee' },
  { key: 'AR1', label: 'Assistant Referee 1' },
  { key: 'AR2', label: 'Assistant Referee 2' },
  { key: 'FOURTH', label: 'Fourth Official' },
];
const officialRoleDisplay = {
  REF: 'REF',
  AR1: 'AR1',
  AR2: 'AR2',
  FOURTH: '4O',
};

export default function MatchDetailsPlaceholder({ gameId, onBack }) {
  const router = useRouter();
  const [match, setMatch] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('match-details');
  const [incidents, setIncidents] = useState([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [tree, setTree] = useState(null);
  const [sportRules, setSportRules] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadMatch = async () => {
      setIsLoading(true);
      if (!gameId) {
        if (isActive) {
          setMatch(null);
          setIsLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from('games')
        .select(
          [
            'id',
            'status',
            'game_date',
            'kickoff_time',
            'home_team',
            'away_team',
            'competition',
            'ground',
            'half_length_minutes',
            'has_extra_time',
            'extra_time_length_minutes',
            'orgs(name, sport_id)',
            'game_officials(id, role, officials(full_name), reports(id, report_section_entries(id)))',
          ].join(','),
        )
        .eq('id', gameId)
        .maybeSingle();

      if (!isActive) {
        return;
      }
      if (error) {
        console.warn('Failed to load match details:', error.message);
        setMatch(null);
        setIsLoading(false);
        return;
      }
      setMatch(data ?? null);
      setIsLoading(false);
    };

    void loadMatch();

    return () => {
      isActive = false;
    };
  }, [gameId]);

  useEffect(() => {
    let isActive = true;
    const sportId = match?.orgs?.sport_id;
    if (!sportId) {
      setSportRules(null);
      return () => {
        isActive = false;
      };
    }
    const loadRules = async () => {
      const { data, error } = await supabase
        .from('sports')
        .select(['id', 'rules'].join(','))
        .eq('id', sportId)
        .maybeSingle();
      if (!isActive) return;
      if (error) {
        console.warn('Failed to load sport rules:', error.message);
        setSportRules(null);
      } else {
        setSportRules(data?.rules ?? null);
      }
    };
    void loadRules();
    return () => {
      isActive = false;
    };
  }, [match?.orgs?.sport_id]);

  useEffect(() => {
    let isActive = true;
    const sportId = match?.orgs?.sport_id;
    if (!sportId) {
      setTree(null);
      return () => {
        isActive = false;
      };
    }
    const loadTree = async () => {
      const { data, error } = await supabase
        .from('sport_trees')
        .select(['id', 'version', 'tree_json', 'published_at', 'sport_id'].join(','))
        .eq('sport_id', sportId)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!isActive) return;
      if (error) {
        console.warn('Failed to load sport tree:', error.message);
        setTree(null);
      } else {
        setTree(data?.tree_json ?? null);
      }
    };
    void loadTree();
    return () => {
      isActive = false;
    };
  }, [match?.orgs?.sport_id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadIncidents = useCallback(async () => {
    setIsLoadingIncidents(true);
    if (!gameId) {
      setIncidents([]);
      setIsLoadingIncidents(false);
      return;
    }
    const { data, error } = await supabase
      .from('incidents')
      .select(
        [
          'id',
          'period',
          'clock_second_in_period',
          'incident_type_code',
          'path_codes',
          'note_text',
          'created_at',
          'incident_json',
        ].join(','),
      )
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Failed to load incidents:', error.message);
      setIncidents([]);
    } else {
      setIncidents(data ?? []);
    }
    setIsLoadingIncidents(false);
  }, [gameId]);

  useEffect(() => {
    if (match?.status === 'complete') {
      void loadIncidents();
    }
  }, [match?.status, loadIncidents]);

  const kickoffTime = useMemo(() => getDateTimeFromMatch(match), [match]);
  const diffMinutes = useMemo(() => {
    if (!kickoffTime) {
      return 0;
    }
    const diffMs = kickoffTime.getTime() - now.getTime();
    return Math.floor(diffMs / 60000);
  }, [kickoffTime, now]);
  const countdownColor = useMemo(
    () => (kickoffTime ? getCountdownColor(diffMinutes) : colors.softGrey),
    [diffMinutes, kickoffTime],
  );
  const isCompleted = match?.status === 'complete';
  const title = isCompleted
    ? 'Match report'
    : kickoffTime && kickoffTime > now
      ? 'Upcoming match'
      : 'Match details';
  const countdownText = kickoffTime ? formatCountdown(diffMinutes) : '—';

  const matchDateTime = kickoffTime;
  const officialsByRole = useMemo(() => {
    const entries = match?.game_officials ?? [];
    return entries.reduce((acc, entry) => {
      if (entry?.role && entry?.officials?.full_name) {
        acc[entry.role] = entry.officials.full_name;
      }
      return acc;
    }, {});
  }, [match]);
  const officialRows = officialRoles
    .map((role) => ({
      key: role.key,
      label: officialRoleDisplay[role.key],
      value: officialsByRole[role.key],
    }))
    .filter((row) => Boolean(row.value));

  const periodSequence = useMemo(() => {
    const fromRules = buildPeriodSequenceFromRules(
      sportRules,
      match?.has_extra_time,
      match,
    );
    if (fromRules?.length) return fromRules;
    return buildDefaultPeriodSequence(match);
  }, [sportRules, match]);

  const matchDetailsRows = [
    { label: 'Fed/Org', value: match?.orgs?.name ?? '—' },
    { label: 'Location', value: match?.ground ?? '—' },
    { label: 'Half length', value: match?.half_length_minutes ?? '—' },
    { label: 'Extra time', value: match?.has_extra_time ? 'Yes' : 'No' },
    ...(match?.has_extra_time
      ? [{ label: 'Extra time length', value: match?.extra_time_length_minutes ?? '—' }]
      : []),
  ];

  const reportOfficials = useMemo(() => {
    const entries = match?.game_officials ?? [];
    return entries
      .filter((e) => e?.role && e?.officials?.full_name)
      .map((entry) => {
        const roleMeta = officialRoles.find((r) => r.key === entry.role);
        const roleLabel = roleMeta?.label ?? entry.role;
        const report = Array.isArray(entry.reports) ? entry.reports[0] : entry.reports;
        const hasContent =
          report?.report_section_entries?.length > 0;
        return {
          id: entry.id,
          roleLabel,
          name: entry.officials.full_name,
          hasContent,
          reportId: report?.id,
        };
      });
  }, [match]);

  const renderSegmentedControl = () => (
    <View style={styles.segmented}>
      {[
        { key: 'match-details', label: 'Match details' },
        { key: 'report', label: 'Report' },
        { key: 'runsheet', label: 'Runsheet' },
      ].map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderMatchDetailsTab = () => (
    <>
      <GameCard
        leagueName={match?.competition ?? 'Competition'}
        leagueIcon={null}
        dateTime={matchDateTime}
        homeTeam={match?.home_team ?? 'Home team'}
        awayTeam={match?.away_team ?? 'Away team'}
      />
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Text style={styles.infoHeaderTitle}>Match officials</Text>
        </View>
        <View style={styles.infoBody}>
          {officialRows.length > 0
            ? officialRows.map((row) => (
                <View key={row.key} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))
            : null}
        </View>
      </View>
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Text style={styles.infoHeaderTitle}>Match details</Text>
        </View>
        <View style={styles.infoBody}>
          {matchDetailsRows.map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  const renderReportTab = () => (
    <>
      <Pressable
        style={styles.preliminaryReportButton}
        onPress={() => router.push({ pathname: '/preliminary-report', params: { gameId } })}
      >
        <Ionicons name="sparkles-outline" size={20} color={colors.forest} />
        <Text style={styles.preliminaryReportButtonText}>Preliminary report</Text>
      </Pressable>
      {reportOfficials.map((official) => (
        <View key={official.id} style={styles.infoCard}>
          <View style={styles.reportCardHeader}>
            <View style={styles.reportCardHeaderLeft}>
              <Text style={styles.reportCardRole}>{official.roleLabel}</Text>
              <View style={styles.reportCardHeaderGap} />
              <Text style={styles.reportCardName}>{official.name}</Text>
            </View>
            <Ionicons name="document-text-outline" size={24} color={colors.black} />
          </View>
          <Pressable
            style={styles.reportCardBody}
            onPress={() => {
              if (!official.hasContent) {
                router.push({
                  pathname: '/report/create',
                  params: { gameId, gameOfficialId: official.id },
                });
              }
            }}
          >
            {official.hasContent ? (
              <Text style={styles.reportCardPlaceholder}>Report content coming soon.</Text>
            ) : (
              <Text style={styles.reportCardEmpty}>Start a report</Text>
            )}
          </Pressable>
        </View>
      ))}
    </>
  );

  const renderRunsheetTab = () => (
    <RunsheetView
      incidents={incidents}
      periodSequence={periodSequence}
      tree={tree}
      isLoading={isLoadingIncidents}
      emptyText="No incidents recorded yet."
    />
  );

  return (
    <View style={styles.screen}>
      <MatchHeaderContainer>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {onBack ? (
              <Pressable style={styles.backButton} onPress={onBack}>
                <Ionicons name="chevron-back" size={20} color={colors.ivory} />
              </Pressable>
            ) : null}
            {isLoading ? <View style={styles.headerTitleSkeleton} /> : (
              <Text style={styles.headerTitle}>{title}</Text>
            )}
          </View>
          {!isCompleted ? (
            <View style={styles.countdown}>
              {isLoading ? (
                <>
                  <View style={styles.countdownLabelSkeleton} />
                  <View style={styles.countdownValueSkeleton} />
                </>
              ) : (
                <>
                  <Text style={styles.countdownLabel}>Kick off in</Text>
                  <Text style={[styles.countdownValue, { color: countdownColor }]}>
                    {countdownText}
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </View>
      </MatchHeaderContainer>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {isCompleted ? (
          <>
            {renderSegmentedControl()}
            {activeTab === 'match-details' && renderMatchDetailsTab()}
            {activeTab === 'report' && renderReportTab()}
            {activeTab === 'runsheet' && renderRunsheetTab()}
          </>
        ) : (
          <>
            <GameCard
              leagueName={match?.competition ?? 'Competition'}
              leagueIcon={null}
              dateTime={matchDateTime}
              homeTeam={match?.home_team ?? 'Home team'}
              awayTeam={match?.away_team ?? 'Away team'}
            />
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoHeaderTitle}>Match officials</Text>
              </View>
              <View style={styles.infoBody}>
                {officialRows.length > 0
                  ? officialRows.map((row) => (
                      <View key={row.key} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{row.label}</Text>
                        <Text style={styles.infoValue}>{row.value}</Text>
                      </View>
                    ))
                  : null}
              </View>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoHeaderTitle}>Match details</Text>
              </View>
              <View style={styles.infoBody}>
                {matchDetailsRows.map((row) => (
                  <View key={row.label} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={styles.infoValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      {!isCompleted ? (
        <View style={styles.ctaContainer}>
          <PrimaryButton
            title="Get ready"
            onPress={() => {
              router.push({ pathname: '/live-recording', params: { gameId } });
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[24],
    paddingBottom: spacing[64] + spacing[32] + spacing[16],
  },
  backButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[12],
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: spacing[8],
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.ivory,
    ...typography.title.large,
    flexShrink: 1,
  },
  headerTitleSkeleton: {
    height: 24,
    width: 160,
    borderRadius: 12,
    backgroundColor: colors.softGrey,
  },
  countdown: {
    alignItems: 'flex-end',
    marginLeft: spacing[12],
  },
  countdownLabel: {
    ...typography.label.small,
    color: colors.softBlack,
    textAlign: 'right',
  },
  countdownValue: {
    ...typography.label.medium,
    textAlign: 'right',
  },
  countdownLabelSkeleton: {
    height: 12,
    width: 72,
    borderRadius: 6,
    backgroundColor: colors.softGrey,
    marginBottom: spacing[4],
  },
  countdownValueSkeleton: {
    height: 16,
    width: 84,
    borderRadius: 8,
    backgroundColor: colors.softGrey,
  },
  infoCard: {
    backgroundColor: colors.warmGrey,
    borderRadius: spacing[8],
    marginBottom: spacing[12],
    overflow: 'hidden',
  },
  infoHeader: {
    minHeight: 32,
    padding: spacing[8],
    backgroundColor: colors.softGrey,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoHeaderTitle: {
    ...typography.label.medium,
    color: colors.black,
  },
  infoBody: {
    padding: spacing[12],
    rowGap: spacing[8],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[12],
  },
  infoLabel: {
    ...typography.label.medium,
    color: colors.black,
    minWidth: 72,
  },
  infoValue: {
    ...typography.paragraph.medium,
    color: colors.black,
    flex: 1,
    textAlign: 'right',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.softGrey,
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[16],
  },
  segment: {
    flex: 1,
    paddingVertical: spacing[8],
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.black,
  },
  segmentText: {
    color: colors.softBlack,
    ...typography.label.medium,
  },
  segmentTextActive: {
    color: colors.ivory,
  },
  preliminaryReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    marginBottom: spacing[16],
    backgroundColor: colors.iceGrey,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.softGrey,
  },
  preliminaryReportButtonText: {
    ...typography.label.medium,
    color: colors.forest,
  },
  reportCardHeader: {
    minHeight: 32,
    padding: spacing[8],
    backgroundColor: colors.softGrey,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  reportCardRole: {
    color: colors.softBlack,
    ...typography.title.medium,
  },
  reportCardHeaderGap: {
    width: spacing[8],
  },
  reportCardName: {
    color: colors.black,
    ...typography.title.medium,
  },
  reportCardBody: {
    padding: spacing[12],
    minHeight: 48,
    justifyContent: 'center',
  },
  reportCardEmpty: {
    color: colors.darkGrey,
    ...typography.paragraph.medium,
  },
  reportCardPlaceholder: {
    color: colors.softBlack,
    ...typography.paragraph.medium,
  },
  ctaContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
    paddingBottom: spacing[32] + spacing[4],
    backgroundColor: colors.ivory,
    opacity: 0.9,
  },
});
