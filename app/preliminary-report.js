import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MatchHeaderContainer } from '../src/components/headers';
import { colors, spacing, typography } from '../src/theme';
import { supabase } from '../src/lib/supabase';
import { buildPayloadForClaude } from '../src/lib/preliminaryReportPayload';
import {
  buildDefaultPeriodSequence,
  buildPeriodSequenceFromRules,
} from '../src/lib/periodSequence';

const officialRoleLabels = {
  REF: 'Referee',
  AR1: 'Assistant Referee 1',
  AR2: 'Assistant Referee 2',
  FOURTH: 'Fourth Official',
};

export default function PreliminaryReportScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams();
  const [match, setMatch] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [tree, setTree] = useState(null);
  const [sportRules, setSportRules] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const hasTriggeredRef = useRef(false);

  const periodSequence = useMemo(() => {
    const fromRules = buildPeriodSequenceFromRules(
      sportRules,
      match?.has_extra_time,
      match,
    );
    if (fromRules?.length) return fromRules;
    return buildDefaultPeriodSequence(match);
  }, [sportRules, match]);

  const officialsWithDrafts = useMemo(() => {
    const entries = match?.game_officials ?? [];
    return entries
      .filter((e) => e?.role && e?.officials?.full_name)
      .map((entry) => {
        const report = Array.isArray(entry.reports) ? entry.reports[0] : entry.reports;
        const drafts = report?.report_ai_drafts ?? [];
        const sortedDrafts = Array.isArray(drafts)
          ? [...drafts].sort(
              (a, b) =>
                new Date(b.generated_at || 0).getTime() -
                new Date(a.generated_at || 0).getTime(),
            )
          : [];
        const latestDraft = sortedDrafts[0];
        return {
          id: entry.id,
          role: entry.role,
          roleLabel: officialRoleLabels[entry.role] ?? entry.role,
          name: entry.officials?.full_name ?? '',
          reportId: report?.id,
          draftText: latestDraft?.generated_text ?? null,
        };
      });
  }, [match?.game_officials]);

  const hasAnyDraft = officialsWithDrafts.some((o) => o.draftText);
  const canGenerate = Boolean(match);

  const loadData = useCallback(async () => {
    if (!gameId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data: matchData, error: matchError } = await supabase
        .from('games')
        .select(
          [
            'id',
            'status',
            'home_team',
            'away_team',
            'competition',
            'ground',
            'half_length_minutes',
            'has_extra_time',
            'orgs(sport_id)',
            'game_officials(id, role, officials(full_name), reports(id, report_ai_drafts(generated_text, generated_at, model_name)))',
          ].join(','),
        )
        .eq('id', gameId)
        .maybeSingle();

      if (matchError) throw matchError;
      setMatch(matchData ?? null);

      const sportId = matchData?.orgs?.sport_id;
      if (sportId) {
        const [{ data: rulesData }, { data: treeData }, { data: incidentsData }] =
          await Promise.all([
            supabase.from('sports').select('rules').eq('id', sportId).maybeSingle(),
            supabase
              .from('sport_trees')
              .select('tree_json')
              .eq('sport_id', sportId)
              .order('published_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('incidents')
              .select(
                [
                  'id',
                  'period',
                  'clock_second_in_period',
                  'incident_type_code',
                  'path_codes',
                  'note_text',
                  'incident_json',
                  'sanction_code',
                  'offence_code',
                  'reason_code',
                ].join(','),
              )
              .eq('game_id', gameId)
              .order('created_at', { ascending: true }),
          ]);
        setSportRules(rulesData?.rules ?? null);
        setTree(treeData?.tree_json ?? null);
        setIncidents(incidentsData ?? []);
      } else {
        setSportRules(null);
        setTree(null);
        setIncidents([]);
      }
    } catch (err) {
      console.warn('Failed to load preliminary report data:', err);
      setError(err?.message ?? 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runGenerate = useCallback(async () => {
    const officials = match?.game_officials ?? [];
    const payload = buildPayloadForClaude(
      match,
      officials,
      incidents,
      tree,
      periodSequence,
    );

    let { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      session = refreshData?.session;
    }
    if (!session?.access_token) {
      throw new Error('Please sign in to generate the preliminary report.');
    }
    const { data, error: invokeError } = await supabase.functions.invoke(
      'generate-preliminary-report',
      {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    if (invokeError) {
      let errMsg = invokeError?.message ?? 'Failed to generate report';
      const ctx = invokeError?.context;
      if (ctx && typeof ctx?.json === 'function') {
        try {
          const body = await ctx.json();
          if (body?.message) errMsg = body.message;
          else if (body?.error) errMsg = String(body.error);
        } catch (_) {}
      }
      throw new Error(errMsg);
    }
    if (data?.error) {
      throw new Error(data.message ?? data.error ?? 'Generation failed');
    }
    const sections = data?.sections ?? {};
    if (Object.keys(sections).length === 0) {
      throw new Error('No report sections returned');
    }

    for (const official of officialsWithDrafts) {
      if (!official.reportId) continue;
      const text = sections[official.role] ?? '';
      if (!text) continue;
      await supabase.from('report_ai_drafts').insert({
        report_id: official.reportId,
        generated_text: text,
        generated_at: new Date().toISOString(),
        model_name: 'claude-3-5-sonnet-20241022',
      });
    }

    await loadData();
  }, [
    match,
    incidents,
    tree,
    periodSequence,
    officialsWithDrafts,
    loadData,
  ]);

  useEffect(() => {
    if (
      !isLoading &&
      canGenerate &&
      !hasAnyDraft &&
      !isGenerating &&
      !hasTriggeredRef.current
    ) {
      hasTriggeredRef.current = true;
      setIsGenerating(true);
      setError(null);
      runGenerate()
        .catch((err) => {
          console.warn('Generate preliminary report failed:', err);
          setError(err?.message ?? 'Failed to generate report');
        })
        .finally(() => {
          setIsGenerating(false);
        });
    }
  }, [
    isLoading,
    canGenerate,
    hasAnyDraft,
    isGenerating,
    runGenerate,
  ]);

  const handleTryAgain = useCallback(() => {
    hasTriggeredRef.current = false;
    setError(null);
    setIsGenerating(true);
    runGenerate()
      .catch((err) => {
        console.warn('Generate preliminary report failed:', err);
        setError(err?.message ?? 'Failed to generate report');
      })
      .finally(() => {
        setIsGenerating(false);
      });
  }, [runGenerate]);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <MatchHeaderContainer>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color={colors.ivory} />
              </Pressable>
              <Text style={styles.headerTitle}>Preliminary report</Text>
            </View>
          </View>
        </MatchHeaderContainer>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.forest} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MatchHeaderContainer>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={colors.ivory} />
            </Pressable>
            <Text style={styles.headerTitle}>Preliminary report</Text>
          </View>
        </View>
      </MatchHeaderContainer>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            {!hasAnyDraft && canGenerate ? (
              <Pressable
                style={styles.tryAgainButton}
                onPress={handleTryAgain}
                disabled={isGenerating}
              >
                <Text style={styles.tryAgainButtonText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isGenerating && !hasAnyDraft ? (
          <View style={styles.generatingCard}>
            <ActivityIndicator size="small" color={colors.forest} />
            <Text style={styles.generatingText}>Generating preliminary report…</Text>
          </View>
        ) : null}

        {officialsWithDrafts.map((official) => (
          <View key={official.id} style={styles.officialCard}>
            <View style={styles.officialHeader}>
              <Text style={styles.officialRole}>{official.roleLabel}</Text>
              <View style={styles.officialNameWrapper} />
              <Text style={styles.officialName}>{official.name}</Text>
            </View>
            <View style={styles.officialBody}>
              {official.draftText ? (
                <Text style={styles.draftText}>{official.draftText}</Text>
              ) : (
                <Text style={styles.emptyDraft}>No report generated yet.</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ivory,
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
  backButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
  },
  headerTitle: {
    color: colors.ivory,
    ...typography.title.large,
    flexShrink: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[24],
    paddingBottom: spacing[64],
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[12],
  },
  loadingText: {
    ...typography.paragraph.small,
    color: colors.darkGrey,
  },
  errorCard: {
    padding: spacing[16],
    backgroundColor: colors.iceGrey,
    borderRadius: 8,
    marginBottom: spacing[16],
    gap: spacing[12],
  },
  errorText: {
    ...typography.paragraph.small,
    color: colors.racing,
  },
  tryAgainButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.forest,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[24],
    borderRadius: 8,
  },
  tryAgainButtonText: {
    ...typography.ui.cta,
    color: colors.ivory,
  },
  generatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[16],
    marginBottom: spacing[24],
  },
  generatingText: {
    ...typography.paragraph.small,
    color: colors.softBlack,
  },
  officialCard: {
    backgroundColor: colors.warmGrey,
    borderRadius: 8,
    marginBottom: spacing[16],
    overflow: 'hidden',
  },
  officialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.softGrey,
  },
  officialRole: {
    ...typography.label.medium,
    color: colors.black,
  },
  officialNameWrapper: {
    flex: 1,
  },
  officialName: {
    ...typography.paragraph.small,
    color: colors.softBlack,
  },
  officialBody: {
    padding: spacing[16],
  },
  draftText: {
    ...typography.paragraph.small,
    color: colors.black,
    lineHeight: 22,
  },
  emptyDraft: {
    ...typography.paragraph.small,
    color: colors.darkGrey,
    fontStyle: 'italic',
  },
});
