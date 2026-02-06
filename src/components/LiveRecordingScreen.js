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
import { Ionicons } from '@expo/vector-icons';
import { MatchHeaderContainer } from './headers';
import PrimaryButton from './PrimaryButton';
import { colors, spacing, typography } from '../theme';
import { supabase } from '../lib/supabase';
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


export default function LiveRecordingScreen({ gameId }) {
  const [match, setMatch] = useState(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const [tree, setTree] = useState(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
  const [activeTab, setActiveTab] = useState('record');
  const [isLive, setIsLive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState('1H');
  const [selectedIncidentType, setSelectedIncidentType] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepSelections, setStepSelections] = useState({});
  const [noteText, setNoteText] = useState('');
  const [lastDraft, setLastDraft] = useState(null);
  const incidentsChannelRef = useRef(null);

  const halfLengthSeconds = useMemo(() => {
    const minutes = match?.half_length_minutes;
    if (!Number.isFinite(minutes)) {
      return 0;
    }
    return Math.max(0, Math.floor(minutes) * 60);
  }, [match]);

  const periodLabel = useMemo(() => {
    switch (currentPeriod) {
      case '1H':
        return '1st';
      case '2H':
        return '2nd';
      case '1ET':
        return '1ET';
      case '2ET':
        return '2ET';
      case 'PK':
        return 'PK';
      default:
        return currentPeriod;
    }
  }, [currentPeriod]);

  const incidentTypes = useMemo(() => tree?.incidentTypes ?? [], [tree]);

  const activeIncident = useMemo(() => {
    if (!selectedIncidentType) {
      return null;
    }
    return incidentTypes.find((type) => type.typeCode === selectedIncidentType) ?? null;
  }, [incidentTypes, selectedIncidentType]);

  const activeSteps = activeIncident?.steps ?? [];
  const currentStepKey = activeSteps[stepIndex];
  const currentStepDefinition = currentStepKey
    ? activeIncident?.stepDefinitions?.[currentStepKey]
    : null;

  const stepOptions = useMemo(() => {
    const options = getStepOptions(currentStepDefinition, stepSelections, tree?.dictionaries);
    return filterOptionsByConditions(options, stepSelections);
  }, [currentStepDefinition, stepSelections, tree]);

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
      stepIndex < activeSteps.length - 1
    ) {
      setStepIndex((prev) => prev + 1);
    }
  }, [
    activeSteps.length,
    currentStepDefinition,
    currentStepKey,
    stepIndex,
    stepOptions,
    stepSelections,
  ]);

  const resetIncidentFlow = useCallback(() => {
    setSelectedIncidentType(null);
    setStepIndex(0);
    setStepSelections({});
    setNoteText('');
  }, []);

  const buildDraft = useCallback(() => {
    if (!activeIncident?.typeCode) {
      return null;
    }
    const pathCodes = activeSteps
      .flatMap((step) => {
        if (stepSelections[step]) {
          return [stepSelections[step]];
        }
        const prefix = `${step}.`;
        return Object.entries(stepSelections)
          .filter(([key]) => key.startsWith(prefix))
          .map(([, value]) => value)
          .filter(Boolean);
      })
      .filter(Boolean);
    return {
      period: currentPeriod,
      clock_second_in_period: elapsedSeconds,
      incident_type_code: activeIncident.typeCode,
      path_codes: pathCodes,
      note_text: noteText?.trim() || null,
    };
  }, [activeIncident, activeSteps, currentPeriod, elapsedSeconds, noteText, stepSelections]);

  const handleOptionSelect = (stepKey, optionCode) => {
    setStepSelections((prev) => ({ ...prev, [stepKey]: optionCode }));
    if (stepIndex < activeSteps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      const draft = buildDraft();
      setLastDraft(draft);
      resetIncidentFlow();
    }
  };

  const handleNoteSubmit = () => {
    const draft = buildDraft();
    setLastDraft(draft);
    resetIncidentFlow();
  };

  const setGroupFieldValue = useCallback((stepKey, fieldKey, value) => {
    setStepSelections((prev) => ({
      ...prev,
      [`${stepKey}.${fieldKey}`]: value,
    }));
  }, []);

  const handleGroupContinue = () => {
    if (stepIndex < activeSteps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      const draft = buildDraft();
      setLastDraft(draft);
      resetIncidentFlow();
    }
  };

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
    } else {
      setTree(data?.tree_json ?? null);
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
        ].join(','),
      )
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });

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
    if (!timerRunning || !halfLengthSeconds) {
      return;
    }
    if (elapsedSeconds >= halfLengthSeconds) {
      setElapsedSeconds(halfLengthSeconds);
      setTimerRunning(false);
    }
  }, [elapsedSeconds, halfLengthSeconds, timerRunning]);

  const handleStart = () => {
    if (!halfLengthSeconds) {
      Alert.alert('Missing half length', 'Set a half length before recording.');
      return;
    }
    setIsLive(true);
    setTimerRunning(true);
  };

  const confirmEndHalf = useCallback(() => {
    Alert.alert(
      'End half',
      'Do you want to continue recording or end the half?',
      [
        { text: 'Continue recording', style: 'cancel' },
        {
          text: 'End half',
          style: 'destructive',
          onPress: () => {
            setTimerRunning(false);
          },
        },
      ],
    );
  }, []);

  const handleMoreOptions = useCallback(() => {
    Alert.alert('Recording options', 'Choose an action', [
      {
        text: 'Restart half',
        onPress: () => {
          setElapsedSeconds(0);
          setTimerRunning(true);
        },
      },
      {
        text: 'Pause recording',
        onPress: () => setTimerRunning(false),
      },
      {
        text: 'End half',
        style: 'destructive',
        onPress: confirmEndHalf,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [confirmEndHalf]);

  const renderHeader = () => (
    <MatchHeaderContainer>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTeam}>{match?.home_team ?? 'Home team'}</Text>
        <Text style={styles.headerVs}>vs</Text>
        <Text style={styles.headerTeam}>{match?.away_team ?? 'Away team'}</Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.headerHalfLabel}>{periodLabel}</Text>
        <Text style={styles.headerTimer}>{FORMAT_CLOCK(elapsedSeconds)}</Text>
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
                setSelectedIncidentType(type.typeCode);
                setStepIndex(0);
                setStepSelections({});
                setNoteText('');
              }}
            >
              <Text style={styles.incidentTypeText}>{type.label}</Text>
            </Pressable>
          ))}
        </View>
        {!incidentTypes.length && !isLoadingTree ? (
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
          <PrimaryButton title="Finish" onPress={handleNoteSubmit} style={styles.finishButton} />
          {stepIndex > 0 ? (
            <Pressable
              style={styles.backButton}
              onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
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
          {stepIndex > 0 ? (
            <Pressable
              style={styles.backButton}
              onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
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
        {stepIndex > 0 ? (
          <Pressable
            style={styles.backButton}
            onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
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
      {selectedIncidentType ? renderStep() : renderIncidentTypes()}
      {lastDraft ? (
        <View style={styles.draftCard}>
          <Text style={styles.draftTitle}>Last incident draft</Text>
          <Text style={styles.draftText}>
            {lastDraft.incident_type_code} · {FORMAT_CLOCK(lastDraft.clock_second_in_period)}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderRunsheet = () => (
    <View>
      {incidents.map((incident) => (
        <View key={incident.id} style={styles.incidentRow}>
          <View>
            <Text style={styles.incidentType}>{incident.incident_type_code}</Text>
            <Text style={styles.incidentMeta}>
              {incident.period} · {FORMAT_CLOCK(incident.clock_second_in_period)}
            </Text>
          </View>
          <Text style={styles.incidentPath}>
            {(incident.path_codes ?? []).join(' > ')}
          </Text>
        </View>
      ))}
      {!incidents.length && !isLoadingIncidents ? (
        <Text style={styles.emptyText}>No incidents recorded yet.</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      {renderHeader()}
      {!isLive ? (
        <View style={styles.startBody}>
          <Text style={styles.startLabel}>
            Start the match to start recording incidents.
          </Text>
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>start</Text>
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
      {isLive ? (
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
  incidentRow: {
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.iceGrey,
    gap: spacing[4],
  },
  incidentType: {
    color: colors.black,
    ...typography.label.large,
  },
  incidentMeta: {
    color: colors.softBlack,
    ...typography.label.small,
  },
  incidentPath: {
    color: colors.darkGrey,
    ...typography.paragraph.small,
  },
  draftCard: {
    padding: spacing[12],
    borderRadius: 12,
    backgroundColor: colors.softGrey,
  },
  draftTitle: {
    color: colors.black,
    marginBottom: spacing[4],
    ...typography.label.small,
  },
  draftText: {
    color: colors.softBlack,
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
