import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MatchHeaderContainer } from './headers';
import PrimaryButton from './PrimaryButton';
import RunsheetView from './RunsheetView';
import { colors, spacing, typography } from '../theme';
import { supabase } from '../lib/supabase';
import { enqueueIncident, getIncidentQueue, removeIncidentByLocalIds } from '../lib/incidentQueue';
import { impactAsync, ImpactFeedbackStyle } from '../lib/haptics';

const FORMAT_CLOCK = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) {
    return '00:00';
  }
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const createLocalIncidentId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getStepOptions = (definition, selections, dictionaries) => {
  if (!definition) {
    return [];
  }
  const dicts = dictionaries ?? {};
  if (definition.optionsSource) {
    return dicts[definition.optionsSource] ?? [];
  }
  if (definition.conditionalSources?.length) {
    const match = definition.conditionalSources.find((source) => {
      if (!source.when) {
        return false;
      }
      return Object.entries(source.when).every(
        ([stepKey, value]) => selections[stepKey] === value,
      );
    });
    return match ? dicts[match.optionsSource] ?? [] : [];
  }
  return [];
};

const filterOptionsByConditions = (options, selections) => {
  if (!options?.length) {
    return [];
  }
  return options.filter((option) => {
    if (!option.conditions?.length) {
      return true;
    }
    return option.conditions.every((condition) => selections[condition.step] === condition.equals);
  });
};

const getOptionFillColor = (option, isSelected) => {
  if (option?.color && option.color !== 'default') {
    return option.color;
  }
  return isSelected ? colors.black : colors.softGrey;
};

const getOptionTextColor = (option, isSelected) => {
  if (option?.color && option.color !== 'default') {
    return isSelected ? colors.ivory : colors.black;
  }
  return isSelected ? colors.ivory : colors.black;
};

import { getIconNamesFromPathCodes } from './CustomIcons';
import {
  buildDefaultPeriodSequence,
  buildPeriodSequenceFromRules,
} from '../lib/periodSequence';

export default function LiveRecordingScreen({ gameId }) {
  const router = useRouter();
  const [match, setMatch] = useState(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const [tree, setTree] = useState(null);
  const [treeVersion, setTreeVersion] = useState(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
  const [activeTab, setActiveTab] = useState('record');
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [periodIndex, setPeriodIndex] = useState(0);
  const [sportRules, setSportRules] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [viewStepIndex, setViewStepIndex] = useState(null);
  const [stepSelections, setStepSelections] = useState({});
  const [noteText, setNoteText] = useState('');
  const [decisionStartSeconds, setDecisionStartSeconds] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isSavingIncidents, setIsSavingIncidents] = useState(false);
  const [justRecordedAt, setJustRecordedAt] = useState(null);
  const incidentsChannelRef = useRef(null);
  const incidentSaveInFlightRef = useRef(false);
  const incidentFinalizeInFlightRef = useRef(false);

  const isLive = recordingStatus !== 'idle';

  const periodSequence = useMemo(() => {
    const fromRules = buildPeriodSequenceFromRules(sportRules, match?.has_extra_time, match);
    if (fromRules?.length) {
      return fromRules;
    }
    return buildDefaultPeriodSequence(match);
  }, [sportRules, match]);

  const currentPeriodMeta = useMemo(
    () => periodSequence[periodIndex] ?? periodSequence[0] ?? null,
    [periodSequence, periodIndex],
  );

  const currentPeriodCode = currentPeriodMeta?.code ?? '1H';
  const currentPeriodLabel = useMemo(() => {
    if (currentPeriodMeta?.label) {
      return currentPeriodMeta.label;
    }
    switch (currentPeriodCode) {
      case '1H':
        return '1st Half';
      case '2H':
        return '2nd Half';
      case '1ET':
        return 'ET 1st Half';
      case '2ET':
        return 'ET 2nd Half';
      case 'PK':
        return 'Penalties';
      default:
        return currentPeriodCode;
    }
  }, [currentPeriodCode, currentPeriodMeta]);

  const nextPeriod = useMemo(
    () => periodSequence[periodIndex + 1] ?? null,
    [periodSequence, periodIndex],
  );

  const currentPeriodClockRunning = currentPeriodMeta?.isClockRunning ?? true;
  const nextPeriodClockRunning = nextPeriod?.isClockRunning ?? true;

  const currentPeriodLengthSeconds = useMemo(() => {
    const minutes = currentPeriodMeta?.lengthMinutes ?? match?.half_length_minutes;
    if (!Number.isFinite(minutes)) {
      return 0;
    }
    return Math.max(0, Math.floor(minutes) * 60);
  }, [currentPeriodMeta, match]);

  const nextPeriodLengthSeconds = useMemo(() => {
    if (!nextPeriod) {
      return 0;
    }
    const minutes = nextPeriod.lengthMinutes ?? match?.half_length_minutes;
    if (!Number.isFinite(minutes)) {
      return 0;
    }
    return Math.max(0, Math.floor(minutes) * 60);
  }, [nextPeriod, match]);

  const hasEntryFlow = Boolean(tree?.entryFlow?.steps?.length);
  const entryFlow = tree?.entryFlow ?? null;

  const incidentTypes = useMemo(() => tree?.incidentTypes ?? [], [tree]);

  const activeIncident = useMemo(() => {
    if (hasEntryFlow) {
      const typeCode = stepSelections.INCIDENT_TYPE ?? selectedIncidentType;
      const incidentTypeConfig = typeCode
        ? incidentTypes.find((t) => t.typeCode === typeCode)
        : null;
      const entrySteps = entryFlow.steps ?? [];
      const typeSteps = incidentTypeConfig?.steps ?? [];
      const typeDefs = incidentTypeConfig?.stepDefinitions ?? {};
      const steps = [...entrySteps, ...typeSteps];
      const stepDefinitions = {
        ...(entryFlow.stepDefinitions ?? {}),
        ...typeDefs,
      };
      return { steps, stepDefinitions, typeCode: typeCode ?? incidentTypeConfig?.typeCode };
    }
    if (!selectedIncidentType) {
      return null;
    }
    return incidentTypes.find((type) => type.typeCode === selectedIncidentType) ?? null;
  }, [
    entryFlow,
    hasEntryFlow,
    incidentTypes,
    selectedIncidentType,
    stepSelections.INCIDENT_TYPE,
  ]);

  const activeSteps = activeIncident?.steps ?? [];

  const derivedStepIndex = useMemo(() => {
    for (let i = 0; i < activeSteps.length; i++) {
      const stepKey = activeSteps[i];
      const def = activeIncident?.stepDefinitions?.[stepKey];
      if (def?.input?.type === 'text') {
        return i;
      }
      if (def?.input?.type === 'group') {
        const fields = def.input.fields ?? [];
        const complete = fields.every((f) => {
          if (f.required === false) return true;
          const v = stepSelections[`${stepKey}.${f.key}`];
          return v != null && v !== '';
        });
        if (!complete) return i;
      } else {
        const val = stepSelections[stepKey];
        const required = def?.required !== false;
        if (required && (val == null || val === '')) return i;
        // Optional steps with conditionalSources: show them when the condition is met
        // (e.g. REASON when SANCTION is YC/RC) so the user can optionally pick
        if (
          def?.conditionalSources?.length &&
          (val == null || val === '')
        ) {
          const conditionMet = def.conditionalSources.some((source) => {
            if (!source.when) return false;
            return Object.entries(source.when).every(
              ([k, v]) => stepSelections[k] === v,
            );
          });
          if (conditionMet) return i;
        }
      }
    }
    return activeSteps.length - 1;
  }, [activeIncident?.stepDefinitions, activeSteps, stepSelections]);

  const currentStepIndex = viewStepIndex ?? derivedStepIndex;
  const currentStepKey = activeSteps[currentStepIndex];
  const currentStepDefinition = currentStepKey
    ? activeIncident?.stepDefinitions?.[currentStepKey]
    : null;

  const stepOptions = useMemo(() => {
    const options = getStepOptions(currentStepDefinition, stepSelections, tree?.dictionaries);
    return filterOptionsByConditions(options, stepSelections);
  }, [currentStepDefinition, stepSelections, tree]);

  const breadcrumbItems = useMemo(() => {
    if (!selectedIncidentType && Object.keys(stepSelections).length === 0) {
      return [];
    }
    const items = [FORMAT_CLOCK(decisionStartSeconds ?? elapsedSeconds)];
    if (selectedIncidentType) {
      const incidentLabel = incidentTypes.find(
        (type) => type.typeCode === selectedIncidentType,
      )?.label;
      items.push(incidentLabel ?? selectedIncidentType);
    }
    activeSteps.forEach((stepKey) => {
      const stepDefinition = activeIncident?.stepDefinitions?.[stepKey];
      if (!stepDefinition) {
        return;
      }
      if (stepDefinition.input?.type === 'group') {
        const fields = stepDefinition.input.fields ?? [];
        fields.forEach((field) => {
          const fieldKey = `${stepKey}.${field.key}`;
          const selection = stepSelections[fieldKey];
          if (!selection) {
            return;
          }
          const options = tree?.dictionaries?.[field.optionsSource] ?? [];
          const label = options.find((option) => option.code === selection)?.label;
          items.push(label ?? selection);
        });
        return;
      }
      const selection = stepSelections[stepKey];
      if (!selection) {
        return;
      }
      const options = getStepOptions(stepDefinition, stepSelections, tree?.dictionaries);
      const label = options.find((option) => option.code === selection)?.label;
      items.push(label ?? selection);
    });
    return items;
  }, [
    activeIncident?.stepDefinitions,
    activeSteps,
    decisionStartSeconds,
    elapsedSeconds,
    incidentTypes,
    selectedIncidentType,
    stepSelections,
    tree?.dictionaries,
  ]);

  useEffect(() => {
    if (hasEntryFlow && recordingStatus === 'live' && Object.keys(stepSelections).length === 0) {
      setDecisionStartSeconds((prev) => prev ?? elapsedSeconds);
    }
  }, [elapsedSeconds, hasEntryFlow, recordingStatus, stepSelections]);

  useEffect(() => {
    if (!currentStepKey || !currentStepDefinition) {
      return;
    }
    if (currentStepDefinition.input?.type === 'group') {
      const fields = currentStepDefinition.input.fields ?? [];
      const defaults = {};
      fields.forEach((field) => {
        const key = `${currentStepKey}.${field.key}`;
        if (!stepSelections[key] && field.default) {
          defaults[key] = field.default;
        }
      });
      if (Object.keys(defaults).length > 0) {
        setStepSelections((prev) => ({ ...prev, ...defaults }));
      }
      return;
    }
    if (
      !currentStepDefinition.input &&
      (!stepOptions || stepOptions.length === 0) &&
      currentStepDefinition.required === false &&
      currentStepIndex < activeSteps.length - 1
    ) {
      setStepIndex((prev) => prev + 1);
    }
  }, [
    activeSteps.length,
    currentStepDefinition,
    currentStepKey,
    currentStepIndex,
    stepOptions,
    stepSelections,
  ]);

  const resetIncidentFlow = useCallback(() => {
    setSelectedIncidentType(null);
    setStepIndex(0);
    setViewStepIndex(null);
    setStepSelections({});
    setNoteText('');
    setDecisionStartSeconds(null);
    setJustRecordedAt(null);
  }, []);

  const buildDraft = useCallback(
    (selectionOverride = {}) => {
      const merged = { ...stepSelections, ...selectionOverride };
      const typeCode = hasEntryFlow ? merged.INCIDENT_TYPE : activeIncident?.typeCode;
      if (!typeCode) {
        return null;
      }
      const pathCodes = activeSteps
        .flatMap((step) => {
          if (hasEntryFlow && (step === 'OFFICIAL_ROLE' || step === 'OFFICIAL')) return [];
          if (merged[step]) {
            return [merged[step]];
          }
          const prefix = `${step}.`;
          return Object.entries(merged)
            .filter(([key]) => key.startsWith(prefix))
            .map(([, value]) => value)
            .filter(Boolean);
        })
        .filter(Boolean);
      const officialCode = merged.OFFICIAL ?? merged.OFFICIAL_ROLE;
      const iconNamesFromPath = getIconNamesFromPathCodes(pathCodes);
      const incidentJson = {
        ...(hasEntryFlow && officialCode && { official_role: officialCode }),
        ...(iconNamesFromPath.length > 0 && { icon: iconNamesFromPath }),
      };
      const hasIncidentJson = Object.keys(incidentJson).length > 0;
      return {
        period: currentPeriodCode,
        clock_second_in_period: elapsedSeconds,
        incident_type_code: typeCode,
        path_codes: pathCodes,
        note_text: noteText?.trim() || null,
        ...(hasIncidentJson && { incident_json: incidentJson }),
      };
    },
    [
      activeIncident?.typeCode,
      activeSteps,
      currentPeriodCode,
      elapsedSeconds,
      hasEntryFlow,
      noteText,
      stepSelections,
    ],
  );

  const flushQueuedIncidents = useCallback(async () => {
    if (!gameId || incidentSaveInFlightRef.current) {
      return;
    }
    incidentSaveInFlightRef.current = true;
    setIsSavingIncidents(true);
    try {
      const queued = await getIncidentQueue();
      if (!queued.length) {
        return;
      }
      const candidates = queued.filter((item) => item.game_id === gameId);
      if (!candidates.length) {
        return;
      }
      const inserts = [];
      const insertedLocalIds = [];

      candidates.forEach((item) => {
        const resolvedOrgId = item.org_id ?? match?.org_id ?? null;
        const resolvedCreatedBy = item.created_by ?? currentUserId ?? match?.created_by ?? null;
        const resolvedGameId = item.game_id ?? gameId;
        const clockSeconds = item.clock_second_in_period;

        if (
          !resolvedOrgId
          || !resolvedCreatedBy
          || !resolvedGameId
          || !item.period
          || !item.incident_type_code
          || !Number.isFinite(clockSeconds)
        ) {
          return;
        }

        inserts.push({
          org_id: resolvedOrgId,
          game_id: resolvedGameId,
          created_by: resolvedCreatedBy,
          period: item.period,
          clock_second_in_period: clockSeconds,
          real_world_time_utc: item.real_world_time_utc ?? item.created_at ?? new Date().toISOString(),
          note_text: item.note_text ?? null,
          tree_version: item.tree_version ?? treeVersion ?? null,
          path_codes: Array.isArray(item.path_codes) ? item.path_codes : [],
          incident_type_code: item.incident_type_code,
          incident_json: {
            ...(item.incident_json ?? {}),
            client_id: item.local_id,
          },
        });
        if (item.local_id) {
          insertedLocalIds.push(item.local_id);
        }
      });

      if (!inserts.length) {
        return;
      }

      const { error } = await supabase.from('incidents').insert(inserts);
      if (error) {
        console.warn('Failed to save incidents:', error.message);
        return;
      }

      await removeIncidentByLocalIds(insertedLocalIds);
    } finally {
      incidentSaveInFlightRef.current = false;
      setIsSavingIncidents(false);
    }
  }, [currentUserId, gameId, match?.created_by, match?.org_id, treeVersion]);

  const finalizeIncident = useCallback(async (selectionOverride = {}) => {
    if (incidentFinalizeInFlightRef.current) {
      return;
    }
    incidentFinalizeInFlightRef.current = true;
    try {
      const draft = buildDraft(selectionOverride);
      if (!draft) {
        return;
      }
      const queuedItem = {
        local_id: createLocalIncidentId(),
        created_at: new Date().toISOString(),
        game_id: gameId ?? null,
        org_id: match?.org_id ?? null,
        created_by: currentUserId ?? match?.created_by ?? null,
        tree_version: treeVersion ?? null,
        ...draft,
      };
      await enqueueIncident(queuedItem);
      resetIncidentFlow();
    } catch (error) {
      console.warn('Failed to queue incident:', error?.message ?? error);
    } finally {
      void flushQueuedIncidents();
      incidentFinalizeInFlightRef.current = false;
    }
  }, [
    buildDraft,
    currentUserId,
    flushQueuedIncidents,
    gameId,
    match?.created_by,
    match?.org_id,
    resetIncidentFlow,
    treeVersion,
  ]);

  const handleOptionSelect = (stepKey, optionCode) => {
    setViewStepIndex(null);
    setStepSelections((prev) => ({ ...prev, [stepKey]: optionCode }));

    const hasMatchingIncidentType =
      stepKey === 'INCIDENT_TYPE' &&
      incidentTypes.some((t) => t.typeCode === optionCode);

    if (hasMatchingIncidentType || currentStepIndex < activeSteps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      void finalizeIncident({ [stepKey]: optionCode });
    }
  };

  const handleNoteSubmit = () => {
    void finalizeIncident();
  };

  const setGroupFieldValue = useCallback((stepKey, fieldKey, value) => {
    setStepSelections((prev) => ({
      ...prev,
      [`${stepKey}.${fieldKey}`]: value,
    }));
  }, []);

  const handleGroupContinue = () => {
    setViewStepIndex(null);
    if (currentStepIndex < activeSteps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      void finalizeIncident();
    }
  };

  useEffect(() => {
    let isActive = true;
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isActive) {
        return;
      }
      if (error) {
        console.warn('Session check failed for live recording:', error.message);
        setCurrentUserId(null);
      } else {
        setCurrentUserId(data?.session?.user?.id ?? null);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive) {
        setCurrentUserId(session?.user?.id ?? null);
      }
    });

    loadSession();

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadMatch = async () => {
      setIsLoadingMatch(true);
      if (!gameId) {
        if (isActive) {
          setMatch(null);
          setIsLoadingMatch(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from('games')
        .select(
          [
            'id',
            'home_team',
            'away_team',
            'half_length_minutes',
            'has_extra_time',
            'extra_time_length_minutes',
            'org_id',
            'created_by',
            'orgs(sport_id)',
          ].join(','),
        )
        .eq('id', gameId)
        .maybeSingle();

      if (!isActive) {
        return;
      }
      if (error) {
        console.warn('Failed to load live match:', error.message);
        setMatch(null);
      } else {
        setMatch(data ?? null);
      }
      setIsLoadingMatch(false);
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

      if (!isActive) {
        return;
      }
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

  const loadTree = useCallback(async () => {
    const sportId = match?.orgs?.sport_id;
    if (!sportId) {
      setTree(null);
      setIsLoadingTree(false);
      return;
    }
    setIsLoadingTree(true);
    const { data, error } = await supabase
      .from('sport_trees')
      .select(['id', 'version', 'tree_json', 'published_at', 'sport_id'].join(','))
      .eq('sport_id', sportId)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load sport tree:', error.message);
      setTree(null);
      setTreeVersion(null);
    } else {
      setTree(data?.tree_json ?? null);
      setTreeVersion(data?.version ?? null);
    }
    setIsLoadingTree(false);
  }, [match]);

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
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    void flushQueuedIncidents();
  }, [flushQueuedIncidents]);

  useEffect(() => {
    if (!gameId) {
      return undefined;
    }
    if (incidentsChannelRef.current) {
      incidentsChannelRef.current.unsubscribe();
    }
    const channel = supabase
      .channel(`incidents-live-${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: `game_id=eq.${gameId}` },
        () => {
          void loadIncidents();
        },
      )
      .subscribe();
    incidentsChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, loadIncidents]);

  useEffect(() => {
    if (!timerRunning) {
      return undefined;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    if (!timerRunning || !currentPeriodLengthSeconds) {
      return;
    }
    if (elapsedSeconds >= currentPeriodLengthSeconds) {
      setElapsedSeconds(currentPeriodLengthSeconds);
      setTimerRunning(false);
    }
  }, [elapsedSeconds, currentPeriodLengthSeconds, timerRunning]);

  useEffect(() => {
    if (!periodSequence.length) {
      return;
    }
    if (periodIndex >= periodSequence.length) {
      setPeriodIndex(0);
    }
  }, [periodIndex, periodSequence.length]);

  const handleStart = () => {
    if (currentPeriodClockRunning && !currentPeriodLengthSeconds) {
      Alert.alert('Missing period length', 'Set a period length before recording.');
      return;
    }
    setPeriodIndex(0);
    setElapsedSeconds(0);
    setRecordingStatus('live');
    setTimerRunning(currentPeriodClockRunning);
  };

  const handleStartNextPeriod = useCallback(() => {
    if (!nextPeriod) {
      setRecordingStatus('finished');
      setTimerRunning(false);
      return;
    }
    if (nextPeriodClockRunning && !nextPeriodLengthSeconds) {
      Alert.alert('Missing period length', 'Set a period length before recording.');
      return;
    }
    setPeriodIndex((prev) => prev + 1);
    setElapsedSeconds(0);
    setRecordingStatus('live');
    setTimerRunning(nextPeriodClockRunning);
  }, [nextPeriod, nextPeriodClockRunning, nextPeriodLengthSeconds]);

  const completeMatchAndNavigate = useCallback(async () => {
    if (!gameId) {
      return;
    }
    const { error } = await supabase
      .from('games')
      .update({ status: 'complete' })
      .eq('id', gameId);

    if (error) {
      console.warn('Failed to complete game:', error.message);
    }

    setTimerRunning(false);
    setRecordingStatus('finished');
    router.replace({ pathname: '/preliminary-report', params: { gameId } });
  }, [gameId]);

  const confirmEndHalf = useCallback(() => {
    const hasNextPeriod = Boolean(nextPeriod);
    Alert.alert(
      hasNextPeriod ? 'End period' : 'End match',
      hasNextPeriod
        ? 'Do you want to continue recording or end the period?'
        : 'Do you want to end the match?',
      [
        { text: 'Continue recording', style: 'cancel' },
        {
          text: hasNextPeriod ? 'End period' : 'End match',
          style: 'destructive',
          onPress: () => {
            if (hasNextPeriod) {
              setTimerRunning(false);
              setRecordingStatus('break');
            } else {
              void completeMatchAndNavigate();
            }
          },
        },
      ],
    );
  }, [nextPeriod, completeMatchAndNavigate]);

  const handleMoreOptions = useCallback(() => {
    Alert.alert('Recording options', 'Choose an action', [
      {
        text: `Restart ${currentPeriodLabel}`,
        onPress: () => {
          setElapsedSeconds(0);
          setRecordingStatus('live');
          setTimerRunning(currentPeriodClockRunning);
        },
      },
      {
        text: 'Pause recording',
        onPress: () => setTimerRunning(false),
      },
      {
        text: `End ${currentPeriodLabel}`,
        style: 'destructive',
        onPress: confirmEndHalf,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [confirmEndHalf, currentPeriodClockRunning, currentPeriodLabel]);

  const renderHeader = () => (
    <MatchHeaderContainer>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTeam}>{match?.home_team ?? 'Home team'}</Text>
        <Text style={styles.headerVs}>vs</Text>
        <Text style={styles.headerTeam}>{match?.away_team ?? 'Away team'}</Text>
      </View>
      <View style={styles.headerRight}>
        {recordingStatus === 'break' ? (
          <>
            <Text style={styles.headerHalfLabel}>Break</Text>
            <Pressable style={styles.headerBreakButton} onPress={handleStartNextPeriod}>
              <Text style={styles.headerBreakButtonText}>
                {nextPeriod?.label ? `Start ${nextPeriod.label}` : 'Start next period'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.headerHalfLabel}>{currentPeriodLabel}</Text>
            <Text style={styles.headerTimer}>{FORMAT_CLOCK(elapsedSeconds)}</Text>
          </>
        )}
      </View>
    </MatchHeaderContainer>
  );

  const renderSegmentedControl = () => (
    <View style={styles.segmented}>
      {['record', 'runsheet'].map((key) => {
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {key === 'record' ? 'Record' : 'Runsheet'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderIncidentTypes = () => {
    const shouldStretch = incidentTypes.length > 0 && incidentTypes.length <= 3;

    return (
      <View style={styles.section}>
        <View style={styles.buttonGrid}>
          {incidentTypes.map((type) => (
            <Pressable
              key={type.typeCode}
              style={[styles.incidentTypeButton, shouldStretch && styles.optionStretch]}
              onPress={() => {
                void impactAsync(ImpactFeedbackStyle.Medium);
                setDecisionStartSeconds((prev) => prev ?? elapsedSeconds);
                setSelectedIncidentType(type.typeCode);
                setStepIndex(0);
                setViewStepIndex(null);
                setStepSelections({});
                setNoteText('');
              }}
            >
              <Text style={styles.incidentTypeText}>{type.label}</Text>
            </Pressable>
          ))}
        </View>
        {!incidentTypes.length && !hasEntryFlow && !isLoadingTree ? (
          <Text style={styles.emptyText}>No decision tree available.</Text>
        ) : null}
      </View>
    );
  };

  const renderStep = () => {
    if (!currentStepKey || !currentStepDefinition) {
      return null;
    }

    if (currentStepDefinition.input?.type === 'text') {
      return (
        <View style={styles.section}>
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Add notes"
            placeholderTextColor={colors.darkGrey}
            multiline
            autoFocus
          />
          <PrimaryButton
            title="Finish"
            onPress={handleNoteSubmit}
            style={styles.finishButton}
            disabled={isSavingIncidents}
          />
          {currentStepIndex > 0 ? (
            <Pressable
              style={styles.backButton}
              onPress={() => setViewStepIndex(Math.max(0, currentStepIndex - 1))}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : selectedIncidentType ? (
            <Pressable style={styles.backButton} onPress={resetIncidentFlow}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    if (currentStepDefinition.input?.type === 'group') {
      const fields = currentStepDefinition.input.fields ?? [];
      const isComplete = fields.every((field) => {
        if (field.required === false) {
          return true;
        }
        const key = `${currentStepKey}.${field.key}`;
        return Boolean(stepSelections[key]);
      });

      return (
        <View style={styles.section}>
          <View style={styles.groupRow}>
            {fields.map((field) => {
              const fieldKey = `${currentStepKey}.${field.key}`;
              const options = tree?.dictionaries?.[field.optionsSource] ?? [];
              const value = stepSelections[fieldKey] ?? field.default ?? null;
              const fieldShouldStretch = field.type !== 'toggle'
                && options.length > 0
                && options.length <= 3;

              return (
                <View key={field.key} style={styles.groupField}>
                  {field.type === 'toggle' ? (
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>{field.label}</Text>
                      <Switch
                        value={value === options[0]?.code}
                        onValueChange={(nextValue) => {
                          void impactAsync(ImpactFeedbackStyle.Medium);
                          const [onOption, offOption] = options;
                          const nextCode = nextValue ? onOption?.code : offOption?.code;
                          if (nextCode) {
                            setGroupFieldValue(currentStepKey, field.key, nextCode);
                          }
                        }}
                        trackColor={{ false: colors.softGrey, true: colors.black }}
                        thumbColor={colors.ivory}
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.groupLabel}>{field.label}</Text>
                      <View style={styles.groupOptions}>
                      {options.map((option) => {
                        const isSelected = value === option.code;
                        const useDefaultUnselected = options.length === 2 && !isSelected;
                        const baseFill = useDefaultUnselected
                          ? colors.softGrey
                          : getOptionFillColor(option, isSelected);

                        return (
                          <Pressable
                            key={option.code}
                            style={[
                              styles.choiceButton,
                            fieldShouldStretch && styles.optionStretch,
                              {
                              backgroundColor: baseFill,
                              },
                            ]}
                            onPress={() => {
                              void impactAsync(ImpactFeedbackStyle.Medium);
                              setGroupFieldValue(currentStepKey, field.key, option.code);
                            }}
                          >
                            <Text
                              style={[
                                styles.choiceButtonText,
                                { color: getOptionTextColor(option, value === option.code) },
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                      );
                    })}
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </View>
          <PrimaryButton
            title="Continue"
            onPress={handleGroupContinue}
            style={[styles.finishButton, !isComplete && styles.choiceButtonDisabled]}
            disabled={!isComplete}
          />
          {currentStepIndex > 0 ? (
            <Pressable
              style={styles.backButton}
              onPress={() => setViewStepIndex(Math.max(0, currentStepIndex - 1))}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : selectedIncidentType ? (
            <Pressable style={styles.backButton} onPress={resetIncidentFlow}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    const shouldStretch = stepOptions.length > 0 && stepOptions.length <= 3;

    return (
      <View style={styles.section}>
        <View style={styles.buttonGrid}>
          {stepOptions.map((option) => {
            const isSelected = stepSelections[currentStepKey] === option.code;
            const useDefaultUnselected = stepOptions.length === 2 && !isSelected;
            const baseFill = useDefaultUnselected
              ? colors.softGrey
              : getOptionFillColor(option, isSelected);

            return (
            <Pressable
              key={option.code}
              style={[
                styles.choiceButton,
                shouldStretch && styles.optionStretch,
                {
                  backgroundColor: baseFill,
                },
              ]}
              onPress={() => {
                void impactAsync(ImpactFeedbackStyle.Medium);
                handleOptionSelect(currentStepKey, option.code);
              }}
            >
              <Text
                style={[
                  styles.choiceButtonText,
                  {
                    color: getOptionTextColor(
                      option,
                      isSelected,
                    ),
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        </View>
        {!stepOptions.length ? <Text style={styles.emptyText}>No options available.</Text> : null}
        {currentStepIndex > 0 ? (
          <Pressable
            style={styles.backButton}
            onPress={() => setViewStepIndex(Math.max(0, currentStepIndex - 1))}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        ) : selectedIncidentType ? (
          <Pressable style={styles.backButton} onPress={resetIncidentFlow}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderRecordTab = () => (
    <View>
      {recordingStatus === 'break' ? (
        <View style={styles.breakContainer}>
          <Pressable style={styles.startButton} onPress={handleStartNextPeriod}>
            <Text style={styles.startButtonText}>
              {nextPeriod?.label ? `start ${nextPeriod.label}` : 'start next period'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {recordingStatus === 'finished' ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Match complete</Text>
          <Text style={styles.statusText}>All periods are finished.</Text>
        </View>
      ) : null}
      {recordingStatus === 'live' ? (
        <>
          {breadcrumbItems.length ? (
            <View style={styles.breadcrumbRow}>
              {breadcrumbItems.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.breadcrumbPill}>
                  <Text style={styles.breadcrumbText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {hasEntryFlow || selectedIncidentType ? renderStep() : renderIncidentTypes()}
        </>
      ) : null}
    </View>
  );

  const renderRunsheet = () => (
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
      {renderHeader()}
      {!isLive ? (
        <View style={styles.startBody}>
          <Text style={styles.startLabel}>
            {currentPeriodLabel
              ? `Start ${currentPeriodLabel} to start recording incidents.`
              : 'Start the match to start recording incidents.'}
          </Text>
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>
              {currentPeriodLabel ? `start ${currentPeriodLabel}` : 'start'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderSegmentedControl()}
          {activeTab === 'record' ? renderRecordTab() : renderRunsheet()}
        </ScrollView>
      )}
      {recordingStatus === 'live' ? (
        <View style={styles.fabContainer}>
          <Pressable
            style={[styles.fab, styles.fabOptions]}
            onPress={() => {
              void impactAsync(ImpactFeedbackStyle.Light);
              handleMoreOptions();
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.black} />
          </Pressable>
          <Pressable
            style={[styles.fab, styles.fabStop]}
            onPress={() => {
              void impactAsync(ImpactFeedbackStyle.Heavy);
              confirmEndHalf();
            }}
          >
            <Ionicons name="square" size={18} color={colors.ivory} />
          </Pressable>
        </View>
      ) : null}
      {isLoadingMatch && !match ? <View style={styles.loadingOverlay} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.warmGrey,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing[16],
    paddingBottom: spacing[64],
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTeam: {
    color: colors.ivory,
    ...typography.title.medium,
  },
  headerVs: {
    color: colors.softBlack,
    ...typography.label.medium,
  },
  headerTimer: {
    color: colors.ivory,
    ...typography.title.large,
  },
  headerBreakButton: {
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.racing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBreakButtonText: {
    color: colors.ivory,
    ...typography.ui.cta,
  },
  headerHalfLabel: {
    color: colors.softBlack,
    ...typography.label.small,
  },
  headerTimerLive: {
    color: colors.ivory,
    ...typography.title.large,
  },
  headerTeamSmall: {
    color: colors.ivory,
    ...typography.label.medium,
  },
  headerVsSmall: {
    color: colors.softBlack,
    ...typography.label.small,
  },
  startBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
    gap: spacing[24],
  },
  startLabel: {
    color: colors.softBlack,
    textAlign: 'center',
    ...typography.label.medium,
  },
  startButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.racing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: colors.ivory,
    textTransform: 'uppercase',
    ...typography.title.large,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: colors.softGrey,
    borderRadius: 16,
    gap: spacing[12],
    marginBottom: spacing[16],
    padding: spacing[16],
  },
  statusTitle: {
    color: colors.black,
    ...typography.title.medium,
  },
  statusText: {
    color: colors.softBlack,
    textAlign: 'center',
    ...typography.label.medium,
  },
  breakContainer: {
    alignItems: 'center',
    marginBottom: spacing[16],
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.softGrey,
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[16],
  },
  breadcrumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  breadcrumbPill: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: 9999,
    backgroundColor: colors.iceGrey,
    alignSelf: 'flex-start',
  },
  breadcrumbText: {
    color: colors.black,
    ...typography.ui.chip,
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
  section: {
    marginBottom: spacing[24],
  },
  sectionTitle: {
    color: colors.black,
    marginBottom: spacing[12],
    ...typography.label.large,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  incidentTypeButton: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 140,
    height: 76,
    paddingHorizontal: spacing[16],
    borderRadius: 2,
    backgroundColor: colors.softGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentTypeText: {
    color: colors.black,
    textAlign: 'center',
    ...typography.title.large,
  },
  choiceButton: {
    height: 76,
    paddingHorizontal: spacing[16],
    borderRadius: 2,
    backgroundColor: colors.softGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionStretch: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 140,
  },
  choiceButtonDisabled: {
    opacity: 0.5,
  },
  backButton: {
    marginTop: spacing[12],
    alignSelf: 'center',
  },
  choiceButtonText: {
    color: colors.black,
    textAlign: 'center',
    ...typography.title.large,
  },
  finishButton: {
    marginBottom: spacing[4],
  },
  backButtonText: {
    color: colors.racing,
    textDecorationLine: 'underline',
    ...typography.ui.cta,
  },
  groupRow: {
    gap: spacing[16],
    marginBottom: spacing[16],
  },
  groupField: {
    gap: spacing[8],
  },
  groupLabel: {
    color: colors.softBlack,
    ...typography.label.medium,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  toggleLabel: {
    color: colors.black,
    ...typography.title.medium,
  },
  groupOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  noteInput: {
    minHeight: 120,
    borderRadius: 12,
    padding: spacing[12],
    backgroundColor: colors.ivory,
    color: colors.black,
    textAlignVertical: 'top',
    marginBottom: spacing[12],
    ...typography.paragraph.medium,
  },
  emptyText: {
    color: colors.darkGrey,
    marginTop: spacing[12],
    ...typography.paragraph.small,
  },
  fabContainer: {
    position: 'absolute',
    right: spacing[24],
    bottom: 36,
    alignItems: 'center',
    gap: spacing[12],
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabStop: {
    backgroundColor: colors.racing,
  },
  fabOptions: {
    backgroundColor: colors.softGrey,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
  },
});
