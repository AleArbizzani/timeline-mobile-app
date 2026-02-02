import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MatchHeaderContainer } from './headers';
import GameCard from './GameCard';
import PrimaryButton from './PrimaryButton';
import { colors, spacing, typography } from '../theme';
import { supabase } from '../lib/supabase';

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
  const [match, setMatch] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let isActive = true;

    const loadMatch = async () => {
      if (!gameId) {
        if (isActive) {
          setMatch(null);
        }
        return;
      }
      const { data, error } = await supabase
        .from('games')
        .select(
          [
            'id',
            'game_date',
            'kickoff_time',
            'home_team',
            'away_team',
            'competition',
            'ground',
            'half_length_minutes',
            'has_extra_time',
            'extra_time_length_minutes',
            'orgs(name)',
            'game_officials(role, officials(full_name))',
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
        return;
      }
      setMatch(data ?? null);
    };

    void loadMatch();

    return () => {
      isActive = false;
    };
  }, [gameId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const kickoffTime = useMemo(() => getDateTimeFromMatch(match), [match]);
  const diffMinutes = useMemo(() => {
    if (!kickoffTime) {
      return 0;
    }
    const diffMs = kickoffTime.getTime() - now.getTime();
    return Math.floor(diffMs / 60000);
  }, [kickoffTime, now]);
  const countdownColor = useMemo(() => getCountdownColor(diffMinutes), [diffMinutes]);
  const title = kickoffTime && kickoffTime > now ? 'Upcoming match' : 'Match details';
  const countdownText = formatCountdown(diffMinutes);

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

  const matchDetailsRows = [
    { label: 'Fed/Org', value: match?.orgs?.name ?? '—' },
    { label: 'Location', value: match?.ground ?? '—' },
    { label: 'Half length', value: match?.half_length_minutes ?? '—' },
    { label: 'Extra time', value: match?.has_extra_time ? 'Yes' : 'No' },
    ...(match?.has_extra_time
      ? [{ label: 'Extra time length', value: match?.extra_time_length_minutes ?? '—' }]
      : []),
  ];

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
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
          <View style={styles.countdown}>
            <Text style={styles.countdownLabel}>Kick off in</Text>
            <Text style={[styles.countdownValue, { color: countdownColor }]}>
              {countdownText}
            </Text>
          </View>
        </View>
      </MatchHeaderContainer>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
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
      </ScrollView>
      <View style={styles.ctaContainer}>
        <PrimaryButton title="Get ready" onPress={() => {}} />
      </View>
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
