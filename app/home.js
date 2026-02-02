import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import MainHeader from '../src/components/headers/MainHeader';
import ModalHeader from '../src/components/headers/ModalHeader';
import StepNavigationHeader from '../src/components/headers/StepNavigationHeader';
import BottomTabBar from '../src/components/BottomTabBar';
import GameCard from '../src/components/GameCard';
import GameCardSkeleton from '../src/components/GameCardSkeleton';
import PrimaryButton from '../src/components/PrimaryButton';
import SingleLineInput from '../src/components/SingleLineInput';
import { colors, spacing, typography } from '../src/theme';
import { supabase } from '../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { impactAsync, ImpactFeedbackStyle } from '../src/lib/haptics';
import { useRouter } from 'expo-router';
import MatchDetailsPlaceholder from '../src/components/MatchDetailsPlaceholder';

const GAMES_CACHE_TTL_MS = 60 * 1000;
const gamesCacheByUser = new Map();

const getGamesCache = (userId) => {
  if (!userId) {
    return null;
  }
  return gamesCacheByUser.get(userId) ?? null;
};

const setGamesCache = (userId, games) => {
  if (!userId) {
    return;
  }
  gamesCacheByUser.set(userId, { games, updatedAt: Date.now() });
};

const isGamesCacheFresh = (entry) => {
  if (!entry?.updatedAt) {
    return false;
  }
  return Date.now() - entry.updatedAt < GAMES_CACHE_TTL_MS;
};

export default function HomeScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesRefreshing, setGamesRefreshing] = useState(false);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [isOrgOpen, setIsOrgOpen] = useState(false);
  const [isLeagueOpen, setIsLeagueOpen] = useState(false);
  const [orgOptions, setOrgOptions] = useState([]);
  const [leagueOptions, setLeagueOptions] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [location, setLocation] = useState('');
  const [matchDate, setMatchDate] = useState(null);
  const [matchTime, setMatchTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState(null);
  const [pendingTime, setPendingTime] = useState(null);
  const [halfLength, setHalfLength] = useState(null);
  const [hasExtraTime, setHasExtraTime] = useState(false);
  const [extraTimeLength, setExtraTimeLength] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [touchedDate, setTouchedDate] = useState(false);
  const [touchedTime, setTouchedTime] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardAccessoryVisible, setKeyboardAccessoryVisible] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [officialOptions, setOfficialOptions] = useState([]);
  const [officialSelectOpenRole, setOfficialSelectOpenRole] = useState(null);
  const [officialSearch, setOfficialSearch] = useState('');
  const [officialQuery, setOfficialQuery] = useState('');
  const [officialPage, setOfficialPage] = useState(0);
  const [officialHasMore, setOfficialHasMore] = useState(true);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [overlayMatchId, setOverlayMatchId] = useState(null);
  const [isMatchOverlayVisible, setIsMatchOverlayVisible] = useState(false);
  const [selectedOfficials, setSelectedOfficials] = useState({
    REF: null,
    AR1: null,
    AR2: null,
    FOURTH: null,
  });
  const [visibleOptionalRoles, setVisibleOptionalRoles] = useState({
    AR1: true,
    AR2: true,
    FOURTH: true,
  });

  const { width: screenWidth } = Dimensions.get('window');
  const stepTranslateX = useRef(new Animated.Value(0)).current;
  const matchOverlayTranslateX = useRef(new Animated.Value(screenWidth)).current;
  const keyboardAccessoryAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const step1ScrollRef = useRef(null);
  const step1FieldOffsets = useRef({});
  const homeTeamInputRef = useRef(null);
  const awayTeamInputRef = useRef(null);
  const locationInputRef = useRef(null);
  const officialFetchId = useRef(0);
  const toastTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const gamesRefreshingRef = useRef(false);

  const OFFICIALS_PAGE_SIZE = 25;

  const halfLengthOptions = ['25 mins', '30 mins', '35 mins', '40 mins', '45 mins'];
  const extraTimeOptions = ['5 mins', '10 mins', '15 mins'];

  useEffect(() => {
    Animated.timing(stepTranslateX, {
      toValue: -(currentStep - 1) * screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [currentStep, screenWidth, stepTranslateX]);


  const formatTime = (value) => {
    if (!value) {
      return 'Pick time';
    }
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (value) => {
    if (!value) {
      return 'Pick date';
    }
    return value.toLocaleDateString();
  };

  const formatDateForDb = (value) => {
    if (!value) {
      return null;
    }
    return value.toLocaleDateString('en-CA');
  };

  const formatTimeForDb = (value) => {
    if (!value) {
      return null;
    }
    return value.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const parseMinutes = (value) => {
    if (!value) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getStep1Errors = () => {
    const errors = [];

    if (!selectedOrg?.id) {
      errors.push('Organisation is required.');
    }
    if (!selectedLeague?.name) {
      errors.push('League is required.');
    }
    if (!homeTeam.trim()) {
      errors.push('Home team is required.');
    }
    if (!awayTeam.trim()) {
      errors.push('Away team is required.');
    }
    if (!matchTime || !touchedTime) {
      errors.push('Kickoff time is required.');
    }
    if (!matchDate || !touchedDate) {
      errors.push('Game date is required.');
    }
    if (!location.trim()) {
      errors.push('Location is required.');
    }
    if (!halfLength) {
      errors.push('Half length is required.');
    }
    if (hasExtraTime && !extraTimeLength) {
      errors.push('Extra time length is required.');
    }

    return errors;
  };

  const getStep2Errors = () => {
    const errors = [];
    const selectedEntries = Object.entries(selectedOfficials).filter(([, value]) => value);

    if (!selectedOfficials.REF) {
      errors.push('Referee is required.');
    }

    const uniqueIds = new Set();
    for (const [, value] of selectedEntries) {
      if (uniqueIds.has(value.id)) {
        errors.push('Officials must be unique.');
        break;
      }
      uniqueIds.add(value.id);
    }

    return errors;
  };

  const reviewErrors = useMemo(() => {
    return [...getStep1Errors(), ...getStep2Errors()];
  }, [
    selectedOrg,
    selectedLeague,
    homeTeam,
    awayTeam,
    matchTime,
    touchedTime,
    matchDate,
    touchedDate,
    location,
    halfLength,
    hasExtraTime,
    extraTimeLength,
    selectedOfficials,
  ]);

  const handleDateChange = (event, selected) => {
    if (event?.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (selected) {
      setPendingDate(selected);
    }
  };

  const handleTimeChange = (event, selected) => {
    if (event?.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    if (selected) {
      setPendingTime(selected);
    }
  };

  const closeSelects = () => {
    setIsOrgOpen(false);
    setIsLeagueOpen(false);
    setOfficialSelectOpenRole(null);
  };

  const triggerHaptic = () => {
    void impactAsync(ImpactFeedbackStyle.Light);
  };

  const resetCreateMatchForm = () => {
    setSelectedOrg(null);
    setSelectedLeague(null);
    setHomeTeam('');
    setAwayTeam('');
    setLocation('');
    setMatchDate(null);
    setMatchTime(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setHalfLength(null);
    setHasExtraTime(false);
    setExtraTimeLength(null);
    setCurrentStep(1);
    setIsSavingMatch(false);
    setTouchedDate(false);
    setTouchedTime(false);
    setPendingDate(null);
    setPendingTime(null);
    setOfficialOptions([]);
    setOfficialSelectOpenRole(null);
    setSelectedOfficials({
      REF: null,
      AR1: null,
      AR2: null,
      FOURTH: null,
    });
    setVisibleOptionalRoles({
      AR1: true,
      AR2: true,
      FOURTH: true,
    });
    closeSelects();
  };

  const openDatePicker = () => {
    triggerHaptic();
    Keyboard.dismiss();
    setPendingDate(matchDate ?? new Date());
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    triggerHaptic();
    Keyboard.dismiss();
    setPendingTime(matchTime ?? new Date());
    setShowTimePicker(true);
  };

  const confirmDatePicker = () => {
    triggerHaptic();
    setTouchedDate(true);
    setMatchDate(pendingDate ?? new Date());
    setShowDatePicker(false);
  };

  const confirmTimePicker = () => {
    triggerHaptic();
    setTouchedTime(true);
    setMatchTime(pendingTime ?? new Date());
    setShowTimePicker(false);
  };

  const cancelDatePicker = () => {
    setShowDatePicker(false);
  };

  const cancelTimePicker = () => {
    setShowTimePicker(false);
  };

  const focusFieldByKey = (key) => {
    const map = {
      homeTeam: homeTeamInputRef,
      awayTeam: awayTeamInputRef,
      location: locationInputRef,
    };
    map[key]?.current?.focus?.();
  };

  const handleAccessoryNext = () => {
    const order = ['homeTeam', 'awayTeam', 'location'];
    const currentIndex = order.indexOf(focusedField);
    if (currentIndex === -1) {
      focusFieldByKey(order[0]);
      return;
    }
    const nextKey = order[Math.min(order.length - 1, currentIndex + 1)];
    focusFieldByKey(nextKey);
  };

  const handleAccessoryPrev = () => {
    const order = ['homeTeam', 'awayTeam', 'location'];
    const currentIndex = order.indexOf(focusedField);
    if (currentIndex <= 0) {
      focusFieldByKey(order[0]);
      return;
    }
    const prevKey = order[currentIndex - 1];
    focusFieldByKey(prevKey);
  };

  const handleAccessoryDone = () => {
    triggerHaptic();
    Keyboard.dismiss();
  };

  const scrollToFieldOffset = (key) => {
    const offset = step1FieldOffsets.current[key];
    if (offset === undefined || offset === null || !step1ScrollRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      step1ScrollRef.current?.scrollTo({
        y: Math.max(0, offset - spacing[16]),
        animated: true,
      });
    });
  };

  const handleFieldFocus = (key) => {
    setFocusedField(key);
    scrollToFieldOffset(key);
  };

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
      setKeyboardAccessoryVisible(true);
      keyboardAccessoryAnim.stopAnimation();
      Animated.timing(keyboardAccessoryAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      keyboardAccessoryAnim.stopAnimation();
      Animated.timing(keyboardAccessoryAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setKeyboardAccessoryVisible(false);
          setKeyboardHeight(0);
        }
      });
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [keyboardAccessoryAnim]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    gamesRefreshingRef.current = gamesRefreshing;
  }, [gamesRefreshing]);

  const hideToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastAnim.stopAnimation();
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setToastVisible(false);
      }
    });
  };

  const showToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastVisible(true);
    toastAnim.stopAnimation();
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    toastTimerRef.current = setTimeout(() => {
      hideToast();
    }, 5000);
  };

  useEffect(() => {
    if (keyboardVisible && focusedField) {
      scrollToFieldOffset(focusedField);
    }
  }, [keyboardVisible, keyboardHeight, focusedField]);

  useEffect(() => {
    let isActive = true;

    const fetchUserOrgs = async () => {
      if (!userId) {
        if (isActive) {
          setOrgOptions([]);
          setSelectedOrg(null);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.org_id) {
        if (isActive) {
          setOrgOptions([]);
          setSelectedOrg(null);
        }
        return;
      }

      const { data: orgs, error: orgsError } = await supabase
        .from('orgs')
        .select('id, name')
        .eq('id', profile.org_id);

      if (orgsError) {
        if (isActive) {
          setOrgOptions([]);
          setSelectedOrg(null);
        }
        return;
      }

      if (isActive) {
        const options = orgs ?? [];
        setOrgOptions(options);
        if (options.length > 0) {
          setSelectedOrg((current) => {
            if (!current || !options.some((option) => option.id === current.id)) {
              return options[0];
            }
            return current;
          });
        } else {
          setSelectedOrg(null);
        }
      }
    };

    fetchUserOrgs();

    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    let isActive = true;

    const fetchLeagues = async () => {
      if (!selectedOrg?.id) {
        if (isActive) {
          setLeagueOptions([]);
          setSelectedLeague(null);
        }
        return;
      }

    const { data, error } = await supabase
      .from('leagues')
      .select('id, name, icon')
      .eq('org_id', selectedOrg.id);

      if (error) {
        if (isActive) {
          setLeagueOptions([]);
          setSelectedLeague(null);
        }
        return;
      }

      if (isActive) {
        const options = data ?? [];
        setLeagueOptions(options);
        setSelectedLeague(null);
      }
    };

    fetchLeagues();

    return () => {
      isActive = false;
    };
  }, [selectedOrg?.id]);

  useEffect(() => {
    setSelectedOfficials({
      REF: null,
      AR1: null,
      AR2: null,
      FOURTH: null,
    });
    setVisibleOptionalRoles({
      AR1: true,
      AR2: true,
      FOURTH: true,
    });
    setOfficialSelectOpenRole(null);
    setOfficialOptions([]);
    setOfficialSearch('');
    setOfficialQuery('');
    setOfficialPage(0);
    setOfficialHasMore(true);
    setOfficialLoading(false);
  }, [selectedOrg?.id]);

  useEffect(() => {
    if (!officialSelectOpenRole) {
      return;
    }

    setOfficialSearch('');
    setOfficialQuery('');
    setOfficialPage(0);
    setOfficialHasMore(true);
    setOfficialOptions([]);
    setOfficialLoading(false);
  }, [officialSelectOpenRole]);

  useEffect(() => {
    if (!officialSelectOpenRole) {
      return;
    }

    const handle = setTimeout(() => {
      const trimmed = officialSearch.trim();
      setOfficialQuery(trimmed);
      setOfficialPage(0);
      setOfficialHasMore(true);
      setOfficialOptions([]);
    }, 300);

    return () => clearTimeout(handle);
  }, [officialSearch]);

  useEffect(() => {
    let isActive = true;

    const fetchOfficials = async () => {
      if (!officialSelectOpenRole || !selectedOrg?.id || !officialHasMore) {
        return;
      }

      const currentFetchId = officialFetchId.current + 1;
      officialFetchId.current = currentFetchId;
      setOfficialLoading(true);

      const from = officialPage * OFFICIALS_PAGE_SIZE;
      const to = from + OFFICIALS_PAGE_SIZE - 1;

      let request = supabase
        .from('officials')
        .select('id, full_name, active')
        .eq('org_id', selectedOrg.id)
        .eq('active', true);

      if (officialQuery) {
        request = request.ilike('full_name', `%${officialQuery}%`);
      }

      const { data, error } = await request.order('full_name').range(from, to);

      if (!isActive || currentFetchId !== officialFetchId.current) {
        return;
      }

      if (error) {
        console.warn('Failed to fetch officials:', error.message);
        setOfficialOptions([]);
        setOfficialHasMore(false);
        setOfficialLoading(false);
        return;
      }

      const nextPage = data ?? [];

      setOfficialOptions((current) =>
        officialPage === 0 ? nextPage : [...current, ...nextPage],
      );
      setOfficialHasMore(nextPage.length === OFFICIALS_PAGE_SIZE);
      setOfficialLoading(false);
    };

    fetchOfficials();

    return () => {
      isActive = false;
    };
  }, [officialSelectOpenRole, selectedOrg?.id, officialPage, officialQuery, officialHasMore]);

  useEffect(() => {
    if (!hasExtraTime) {
      setExtraTimeLength(null);
    }
  }, [hasExtraTime]);

  const confirmCloseCreateMatch = () => {
    Alert.alert(
      'Close create match?',
      'Closing will reset this form and no match will be created.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () => {
            resetCreateMatchForm();
            setIsCreateMatchOpen(false);
            Keyboard.dismiss();
          },
        },
      ],
    );
  };

  const handleClosePress = () => {
    triggerHaptic();
    confirmCloseCreateMatch();
  };

  useEffect(() => {
    if (!isCreateMatchOpen) {
      setShowDatePicker(false);
      setShowTimePicker(false);
      setPendingDate(null);
      setPendingTime(null);
      setFocusedField(null);
      Keyboard.dismiss();
    }
  }, [isCreateMatchOpen]);

  useEffect(() => {
    if (isCreateMatchOpen && !selectedOrg && orgOptions.length > 0) {
      setSelectedOrg(orgOptions[0]);
    }
  }, [isCreateMatchOpen, orgOptions, selectedOrg]);

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (isActive) {
        if (error) {
          console.warn('Session check failed for matches:', error.message);
          setUserId(null);
        } else {
          setUserId(data?.session?.user?.id ?? null);
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive) {
        setUserId(session?.user?.id ?? null);
      }
    });

    loadSession();

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchGames = async () => {
    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from('games')
      .select('id, game_date, kickoff_time, status, home_team, away_team, competition')
      .eq('created_by', userId);

    if (error) {
      console.warn('Failed to fetch matches:', error.message);
      return [];
    }

    return data ?? [];
  };

  useEffect(() => {
    let isActive = true;

    const loadGames = async () => {
      if (!userId) {
        if (isActive) {
          setGames([]);
          setGamesLoading(false);
        }
        return;
      }

      const cacheEntry = getGamesCache(userId);
      if (cacheEntry && isGamesCacheFresh(cacheEntry)) {
        if (isActive) {
          setGames(cacheEntry.games);
          setGamesLoading(false);
        }
        return;
      }

      if (isActive) {
        setGamesLoading(!cacheEntry);
      }
      const data = await fetchGames();
      if (isActive) {
        setGames(data);
        setGamesLoading(false);
        setGamesCache(userId, data);
      }
    };

    loadGames();

    return () => {
      isActive = false;
    };
  }, [userId]);

  const refreshGames = async () => {
    if (!userId || gamesRefreshingRef.current) {
      return;
    }
    setGamesRefreshing(true);
    const data = await fetchGames();
    setGames(data);
    setGamesCache(userId, data);
    setGamesRefreshing(false);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive =
        appStateRef.current === 'inactive' || appStateRef.current === 'background';
      if (wasInactive && nextState === 'active') {
        void refreshGames();
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [userId]);

  const gamesWithDateTime = useMemo(() => {
    return games
      .map((game) => {
        if (!game?.game_date) {
          return null;
        }

        const rawTime = game.kickoff_time ?? '00:00:00';
        const normalizedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
        const dateTime = new Date(`${game.game_date}T${normalizedTime}`);

        if (Number.isNaN(dateTime.getTime())) {
          return null;
        }

        return { ...game, dateTime };
      })
      .filter(Boolean);
  }, [games]);

  const now = new Date();
  const upcomingMatches = gamesWithDateTime
    .filter((game) => game.dateTime > now && game.status !== 'complete')
    .sort((a, b) => a.dateTime - b.dateTime);
  const pastMatches = gamesWithDateTime
    .filter((game) => game.dateTime < now)
    .sort((a, b) => b.dateTime - a.dateTime);
  const showGamesSkeleton = gamesLoading && games.length === 0;
  const skeletonSectionData = useMemo(
    () => ({
      upcoming: Array.from({ length: 3 }, (_value, index) => ({
        id: `upcoming-skeleton-${index}`,
      })),
      past: Array.from({ length: 3 }, (_value, index) => ({ id: `past-skeleton-${index}` })),
    }),
    [],
  );
  const gameSections = useMemo(() => {
    if (showGamesSkeleton) {
      return [
        {
          title: 'Upcoming matches',
          emptyText: 'No upcoming matches',
          isSkeleton: true,
          data: skeletonSectionData.upcoming,
        },
        {
          title: 'Past matches',
          emptyText: 'No past matches',
          isSkeleton: true,
          data: skeletonSectionData.past,
        },
      ];
    }

    return [
      {
        title: 'Upcoming matches',
        emptyText: 'No upcoming matches',
        data: upcomingMatches,
      },
      {
        title: 'Past matches',
        emptyText: 'No past matches',
        data: pastMatches,
      },
    ];
  }, [pastMatches, showGamesSkeleton, skeletonSectionData, upcomingMatches]);

  const leagueIconByName = useMemo(() => {
    const entries = leagueOptions
      .filter((option) => option?.name)
      .map((option) => [option.name, option.icon]);
    return new Map(entries);
  }, [leagueOptions]);

  const filteredOfficialOptions = useMemo(() => {
    if (!officialSelectOpenRole) {
      return officialOptions;
    }

    const selectedIdForOpenRole = selectedOfficials[officialSelectOpenRole]?.id;
    const selectedIdsForOtherRoles = new Set(
      Object.entries(selectedOfficials)
        .filter(([role, value]) => value && role !== officialSelectOpenRole)
        .map(([, value]) => value.id),
    );

    return officialOptions.filter(
      (option) =>
        option.id === selectedIdForOpenRole || !selectedIdsForOtherRoles.has(option.id),
    );
  }, [officialOptions, selectedOfficials, officialSelectOpenRole]);

  const handleOfficialsScroll = ({ nativeEvent }) => {
    if (!officialSelectOpenRole || officialLoading || !officialHasMore) {
      return;
    }

    const paddingToBottom = spacing[24];
    const isCloseToBottom =
      nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
      nativeEvent.contentSize.height - paddingToBottom;

    if (isCloseToBottom) {
      setOfficialPage((current) => current + 1);
    }
  };

  const handleStepBack = () => {
    triggerHaptic();
    closeSelects();
    setCurrentStep((current) => Math.max(1, current - 1));
  };

  const handleStep1Next = () => {
    const errors = getStep1Errors();
    if (errors.length > 0) {
      Alert.alert('Missing match details', errors.join('\n'));
      return;
    }
    triggerHaptic();
    closeSelects();
    setCurrentStep(2);
  };

  const handleStep2Review = () => {
    const errors = getStep2Errors();
    if (errors.length > 0) {
      Alert.alert('Match officials needed', errors.join('\n'));
      return;
    }
    triggerHaptic();
    closeSelects();
    setCurrentStep(3);
  };

  const buildOfficialsPayload = () => {
    return Object.entries(selectedOfficials)
      .filter(([, value]) => value)
      .map(([role, value]) => ({
        role,
        official_id: value.id,
      }));
  };

  const handleCreateMatch = async () => {
    if (reviewErrors.length > 0 || isSavingMatch) {
      return;
    }

    if (!userId) {
      Alert.alert('Unable to create match', 'Please sign in again.');
      return;
    }

    setIsSavingMatch(true);
    closeSelects();

    const payload = {
      p_org_id: selectedOrg?.id ?? null,
      p_competition: selectedLeague?.name ?? null,
      p_home_team: homeTeam.trim(),
      p_away_team: awayTeam.trim(),
      p_game_date: formatDateForDb(matchDate),
      p_kickoff_time: formatTimeForDb(matchTime),
      p_ground: location.trim(),
      p_half_length_minutes: parseMinutes(halfLength),
      p_has_extra_time: hasExtraTime,
      p_extra_time_length_minutes: hasExtraTime ? parseMinutes(extraTimeLength) : null,
      p_officials: buildOfficialsPayload(),
    };

    const { data, error } = await supabase.rpc('create_game_with_officials', payload);

    if (error) {
      console.warn('Create match failed:', error.message);
      Alert.alert('Match creation failed', error.message);
      setIsSavingMatch(false);
      return;
    }

    const gameId = data?.game_id ?? data?.[0]?.game_id;
    if (!gameId) {
      Alert.alert('Match creation failed', 'Unexpected response from server.');
      setIsSavingMatch(false);
      return;
    }

    const updatedGames = await fetchGames();
    setGames(updatedGames);
    setGamesCache(userId, updatedGames);
    resetCreateMatchForm();
    setIsCreateMatchOpen(false);
    showToast();
  };

  const officialRoles = [
    { key: 'REF', label: 'Referee', removable: false },
    { key: 'AR1', label: 'Assistant Referee 1', removable: true },
    { key: 'AR2', label: 'Assistant Referee 2', removable: true },
    { key: 'FOURTH', label: 'Fourth Official', removable: true },
  ];
  const officialRoleDisplay = {
    REF: 'REF',
    AR1: 'AR1',
    AR2: 'AR2',
    FOURTH: '4O',
  };
  const handleMatchPress = (gameId) => {
    if (isMatchOverlayVisible) {
      return;
    }
    void impactAsync(ImpactFeedbackStyle.Soft);
    setOverlayMatchId(gameId);
    setIsMatchOverlayVisible(true);
    matchOverlayTranslateX.setValue(screenWidth);
    Animated.timing(matchOverlayTranslateX, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setIsMatchOverlayVisible(false);
        return;
      }
      router.push({
        pathname: '/match-details',
        params: { gameId },
      });
      requestAnimationFrame(() => {
        setIsMatchOverlayVisible(false);
      });
    });
  };

  const handleOverlayBack = () => {
    if (!isMatchOverlayVisible) {
      return;
    }
    matchOverlayTranslateX.stopAnimation();
    Animated.timing(matchOverlayTranslateX, {
      toValue: screenWidth,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsMatchOverlayVisible(false);
      setOverlayMatchId(null);
    });
  };

  return (
    <View style={styles.screen}>
      <MainHeader
        title="Match Centre"
        onPressAdd={() => {
          triggerHaptic();
          setIsCreateMatchOpen(true);
        }}
      />
        <SectionList
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          sections={gameSections}
          keyExtractor={(item) => String(item.id)}
          refreshing={gamesRefreshing}
          onRefresh={refreshGames}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderSectionFooter={({ section }) => {
            if (section.isSkeleton) {
              return <View style={styles.sectionFooterSpacer} />;
            }
            if (!section.data || section.data.length === 0) {
              return (
                <>
                  <Text style={styles.emptyText}>{section.emptyText}</Text>
                  <View style={styles.sectionFooterSpacer} />
                </>
              );
            }
            return <View style={styles.sectionFooterSpacer} />;
          }}
          renderItem={({ item, section }) =>
            section.isSkeleton ? (
              <GameCardSkeleton />
            ) : (
              <Pressable onPress={() => handleMatchPress(item.id)}>
                <GameCard
                  leagueName={item.competition ?? ''}
                  leagueIcon={leagueIconByName.get(item.competition ?? '')}
                  dateTime={item.dateTime}
                  homeTeam={item.home_team}
                  awayTeam={item.away_team}
                />
              </Pressable>
            )
          }
          stickySectionHeadersEnabled={false}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
        <BottomTabBar />
        {toastVisible ? (
          <Animated.View
            style={[
              styles.toastWrapper,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [spacing[24], 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="box-none"
          >
            <Pressable style={styles.toast} onPress={hideToast}>
              <Text style={styles.toastText}>Match created succesfully</Text>
              <Ionicons name="close-sharp" size={16} color={colors.ivory} />
            </Pressable>
          </Animated.View>
        ) : null}
      <Modal
        visible={isCreateMatchOpen}
        animationType="slide"
        onRequestClose={confirmCloseCreateMatch}
      >
        <View style={styles.modalScreen}>
          {currentStep === 1 ? (
            <ModalHeader title="Create match" onClose={handleClosePress} />
          ) : (
            <StepNavigationHeader
              title={currentStep === 2 ? 'Add match officials' : 'Review'}
              onBack={handleStepBack}
            />
          )}
          <View style={styles.stepViewport}>
            <Animated.View
              style={[
                styles.stepTrack,
                {
                  width: screenWidth * 3,
                  transform: [{ translateX: stepTranslateX }],
                },
              ]}
            >
              <View style={[styles.stepPanel, { width: screenWidth }]}>
                <ScrollView
                  ref={step1ScrollRef}
                  style={styles.modalContent}
                  contentContainerStyle={[
                    styles.modalContentContainer,
                    keyboardVisible && currentStep === 1
                      ? { paddingBottom: spacing[64] + spacing[64] + keyboardHeight + spacing[16] }
                      : null,
                  ]}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Organisation</Text>
                    <View style={styles.selectField}>
                      <Pressable
                        style={[styles.selectInput, styles.selectInputDisabled]}
                        disabled
                      >
                        <Text
                          style={[
                            styles.selectText,
                            !selectedOrg && styles.selectPlaceholder,
                            styles.selectTextDisabled,
                          ]}
                        >
                          {selectedOrg?.name ?? 'Pick a fed/org'}
                        </Text>
                        <Ionicons
                          name="caret-down-sharp"
                          size={16}
                          color={colors.darkGrey}
                          style={[styles.selectCaret, styles.selectCaretDisabled]}
                        />
                      </Pressable>
                      <Text style={styles.fieldHelperText}>
                        This field is defined by your organisation.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowDivider} />

                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>League</Text>
                    <View style={styles.selectField}>
                      <Pressable
                        style={styles.selectInput}
                        onPress={() => {
                          triggerHaptic();
                          setIsLeagueOpen(true);
                          setIsOrgOpen(false);
                          setOfficialSelectOpenRole(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.selectText,
                            !selectedLeague && styles.selectPlaceholder,
                          ]}
                        >
                          {selectedLeague?.name ?? 'Pick a league'}
                        </Text>
                        <Ionicons
                          name="caret-down-sharp"
                          size={16}
                          color={colors.black}
                          style={[styles.selectCaret, isLeagueOpen && styles.selectCaretOpen]}
                        />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.rowDivider} />

                  <View
                    style={styles.fieldRow}
                    onLayout={({ nativeEvent }) => {
                      step1FieldOffsets.current.homeTeam = nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>Home team</Text>
                    <SingleLineInput
                      ref={homeTeamInputRef}
                      placeholder="Team name"
                      value={homeTeam}
                      onChangeText={setHomeTeam}
                      returnKeyType="next"
                      onFocus={() => handleFieldFocus('homeTeam')}
                      onSubmitEditing={() => focusFieldByKey('awayTeam')}
                    />
                  </View>
                  <View style={styles.rowDivider} />

                  <View
                    style={styles.fieldRow}
                    onLayout={({ nativeEvent }) => {
                      step1FieldOffsets.current.awayTeam = nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>Away team</Text>
                    <SingleLineInput
                      ref={awayTeamInputRef}
                      placeholder="Team name"
                      value={awayTeam}
                      onChangeText={setAwayTeam}
                      returnKeyType="next"
                      onFocus={() => handleFieldFocus('awayTeam')}
                      onSubmitEditing={() => focusFieldByKey('location')}
                    />
                  </View>
                  <View style={styles.rowDivider} />

                  <View style={styles.fieldRow}>
                    <View style={styles.timeDateRow}>
                      <Text style={styles.fieldLabelInline}>Time & Date</Text>
                      <View style={styles.chipRow}>
                        <Pressable
                          style={[styles.chip, matchTime && styles.chipActive]}
                          onPress={openTimePicker}
                        >
                          <Text style={[styles.chipText, matchTime && styles.chipTextActive]}>
                            {formatTime(matchTime)}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.chip, matchDate && styles.chipActive]}
                          onPress={openDatePicker}
                        >
                          <Text style={[styles.chipText, matchDate && styles.chipTextActive]}>
                            {formatDate(matchDate)}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  <View style={styles.rowDivider} />

                  <View
                    style={styles.fieldRow}
                    onLayout={({ nativeEvent }) => {
                      step1FieldOffsets.current.location = nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>Location</Text>
                    <SingleLineInput
                      ref={locationInputRef}
                      placeholder="Insert location"
                      value={location}
                      onChangeText={setLocation}
                      returnKeyType="done"
                      onFocus={() => handleFieldFocus('location')}
                      onSubmitEditing={handleAccessoryDone}
                    />
                  </View>
                  <View style={styles.rowDivider} />

                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Half length</Text>
                    <View style={styles.chipWrap}>
                      {halfLengthOptions.map((option) => {
                        const isActive = option === halfLength;
                        return (
                          <Pressable
                            key={option}
                            style={[styles.chip, isActive && styles.chipActive]}
                            onPress={() => {
                              triggerHaptic();
                              setHalfLength(option);
                            }}
                          >
                            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.rowDivider} />

                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Has Extra Time</Text>
                    <Switch
                      value={hasExtraTime}
                      onValueChange={setHasExtraTime}
                      trackColor={{ false: colors.softGrey, true: colors.black }}
                      thumbColor={hasExtraTime ? colors.ivory : colors.ivory}
                    />
                  </View>
                  <View style={styles.rowDivider} />
                  {hasExtraTime ? (
                    <>
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Extra Time length</Text>
                        <View style={styles.chipWrap}>
                          {extraTimeOptions.map((option) => {
                            const isActive = option === extraTimeLength;
                            return (
                              <Pressable
                                key={option}
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => {
                                  triggerHaptic();
                                  setExtraTimeLength(option);
                                }}
                              >
                                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                  {option}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                      <View style={styles.rowDivider} />
                    </>
                  ) : null}

                </ScrollView>
              </View>

              <View style={[styles.stepPanel, { width: screenWidth }]}>
                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={styles.modalContentContainer}
                >
                  {officialRoles.map((role, index) => {
                    const selectedOfficial = selectedOfficials[role.key];
                    const isVisible = role.removable ? visibleOptionalRoles[role.key] : true;

                    if (!isVisible) {
                      return (
                        <View key={role.key}>
                          <View style={styles.fieldRow}>
                            <Pressable
                              onPress={() => {
                                triggerHaptic();
                                setVisibleOptionalRoles((current) => ({
                                  ...current,
                                  [role.key]: true,
                                }));
                              }}
                            >
                              <Text style={styles.addOfficialText}>Add {role.label}</Text>
                            </Pressable>
                          </View>
                          {index < officialRoles.length - 1 ? (
                            <View style={styles.rowDivider} />
                          ) : null}
                        </View>
                      );
                    }

                    return (
                      <View key={role.key}>
                        <View style={styles.fieldRow}>
                          <View style={styles.officialLabelRow}>
                            <Text style={styles.fieldLabelInline}>{role.label}</Text>
                            {role.removable ? (
                              <Pressable
                                style={styles.officialRemoveButton}
                                onPress={() => {
                                  triggerHaptic();
                                  setSelectedOfficials((current) => ({
                                    ...current,
                                    [role.key]: null,
                                  }));
                                  setVisibleOptionalRoles((current) => ({
                                    ...current,
                                    [role.key]: false,
                                  }));
                                  setOfficialSelectOpenRole(null);
                                }}
                              >
                                <Ionicons name="trash-outline" size={24} color={colors.darkGrey} />
                              </Pressable>
                            ) : null}
                          </View>
                          <View style={styles.selectField}>
                            <Pressable
                              style={styles.selectInput}
                              onPress={() => {
                                triggerHaptic();
                                setIsLeagueOpen(false);
                                setIsOrgOpen(false);
                                setOfficialSelectOpenRole(role.key);
                              }}
                            >
                              <Text
                                style={[
                                  styles.selectText,
                                  !selectedOfficial && styles.selectPlaceholder,
                                ]}
                              >
                                {selectedOfficial?.full_name ?? 'Select an official'}
                              </Text>
                              <Ionicons
                                name="caret-down-sharp"
                                size={16}
                                color={colors.black}
                                style={[
                                  styles.selectCaret,
                                  officialSelectOpenRole === role.key && styles.selectCaretOpen,
                                ]}
                              />
                            </Pressable>
                          </View>
                        </View>
                        {index < officialRoles.length - 1 ? (
                          <View style={styles.rowDivider} />
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={[styles.stepPanel, { width: screenWidth }]}>
                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={styles.modalContentContainer}
                >
                  {reviewErrors.length > 0 ? (
                    <View style={styles.reviewErrorBlock}>
                      <Text style={styles.reviewErrorTitle}>Missing required details</Text>
                      {reviewErrors.map((error, index) => (
                        <Text key={`${error}-${index}`} style={styles.reviewErrorText}>
                          {error}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <GameCard
                    leagueName={selectedLeague?.name ?? ''}
                    leagueIcon={leagueIconByName.get(selectedLeague?.name ?? '')}
                    dateTime={
                      matchDate
                        ? new Date(
                            matchDate.getFullYear(),
                            matchDate.getMonth(),
                            matchDate.getDate(),
                            matchTime?.getHours?.() ?? 0,
                            matchTime?.getMinutes?.() ?? 0,
                            0,
                            0,
                          )
                        : null
                    }
                    homeTeam={homeTeam.trim() || 'Home team'}
                    awayTeam={awayTeam.trim() || 'Away team'}
                  />
                  <View style={styles.reviewInfoCard}>
                    <View style={styles.reviewInfoHeader}>
                      <Text style={styles.reviewInfoHeaderTitle}>Match officials</Text>
                    </View>
                    <View style={styles.reviewInfoBody}>
                      {officialRoles.map((role) => {
                        const official = selectedOfficials[role.key];
                        if (!official) {
                          return null;
                        }
                        return (
                          <View key={role.key} style={styles.reviewInfoRow}>
                            <Text style={styles.reviewInfoLabel}>
                              {officialRoleDisplay[role.key]}
                            </Text>
                            <Text style={styles.reviewInfoValue}>{official.full_name}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.reviewInfoCard}>
                    <View style={styles.reviewInfoHeader}>
                      <Text style={styles.reviewInfoHeaderTitle}>Match details</Text>
                    </View>
                    <View style={styles.reviewInfoBody}>
                      <View style={styles.reviewInfoRow}>
                        <Text style={styles.reviewInfoLabel}>Fed/Org</Text>
                        <Text style={styles.reviewInfoValue}>{selectedOrg?.name ?? '—'}</Text>
                      </View>
                      <View style={styles.reviewInfoRow}>
                        <Text style={styles.reviewInfoLabel}>Location</Text>
                        <Text style={styles.reviewInfoValue}>{location.trim() || '—'}</Text>
                      </View>
                      <View style={styles.reviewInfoRow}>
                        <Text style={styles.reviewInfoLabel}>Half length</Text>
                        <Text style={styles.reviewInfoValue}>{halfLength ?? '—'}</Text>
                      </View>
                      <View style={styles.reviewInfoRow}>
                        <Text style={styles.reviewInfoLabel}>Extra time</Text>
                        <Text style={styles.reviewInfoValue}>{hasExtraTime ? 'Yes' : 'No'}</Text>
                      </View>
                      {hasExtraTime ? (
                        <View style={styles.reviewInfoRow}>
                          <Text style={styles.reviewInfoLabel}>Extra time length</Text>
                          <Text style={styles.reviewInfoValue}>
                            {extraTimeLength ?? '—'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </ScrollView>
              </View>
            </Animated.View>
          </View>
          <View style={styles.ctaContainer}>
            {currentStep === 1 ? (
              <PrimaryButton
                title="Next"
                iconRight={<Ionicons name="caret-forward-sharp" size={16} color={colors.ivory} />}
                onPress={handleStep1Next}
              />
            ) : null}
            {currentStep === 2 ? (
              <PrimaryButton title="Review" onPress={handleStep2Review} />
            ) : null}
            {currentStep === 3 ? (
              <PrimaryButton
                title="Create match"
                onPress={handleCreateMatch}
                disabled={reviewErrors.length > 0 || isSavingMatch}
              />
            ) : null}
          </View>
          {keyboardAccessoryVisible && isCreateMatchOpen && currentStep === 1 ? (
            <Animated.View
              style={[
                styles.keyboardAccessory,
                {
                  bottom: keyboardHeight,
                  opacity: keyboardAccessoryAnim,
                  transform: [
                    {
                      translateY: keyboardAccessoryAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.keyboardAccessoryLeftGroup}>
                <Pressable
                  style={[
                    styles.keyboardAccessoryButton,
                    !focusedField && styles.keyboardAccessoryButtonDisabled,
                  ]}
                  onPress={handleAccessoryPrev}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.black} />
                </Pressable>
                <Pressable
                  style={[
                    styles.keyboardAccessoryButton,
                    !focusedField && styles.keyboardAccessoryButtonDisabled,
                  ]}
                  onPress={handleAccessoryNext}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.black} />
                </Pressable>
              </View>
              <Pressable
                style={[styles.keyboardAccessoryButton, styles.keyboardAccessoryButtonDone]}
                onPress={handleAccessoryDone}
              >
                <Ionicons name="chevron-down" size={20} color={colors.ivory} />
              </Pressable>
            </Animated.View>
          ) : null}
          {showDatePicker ? (
            <View style={styles.pickerOverlay}>
              <Pressable style={styles.pickerBackdrop} onPress={cancelDatePicker} />
              <View style={styles.pickerSheet}>
                <View style={styles.pickerHeader}>
                  <Pressable
                    style={styles.pickerHeaderButton}
                    hitSlop={styles.pickerHeaderHitSlop}
                    onPress={cancelDatePicker}
                  >
                    <Text style={styles.pickerHeaderText}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.pickerTitle}>Select date</Text>
                  <Pressable
                    style={styles.pickerHeaderButton}
                    hitSlop={styles.pickerHeaderHitSlop}
                    onPress={confirmDatePicker}
                  >
                    <Text style={styles.pickerHeaderText}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={pendingDate ?? matchDate ?? new Date()}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  style={styles.picker}
                />
              </View>
            </View>
          ) : null}
          {showTimePicker ? (
            <View style={styles.pickerOverlay}>
              <Pressable style={styles.pickerBackdrop} onPress={cancelTimePicker} />
              <View style={styles.pickerSheet}>
                <View style={styles.pickerHeader}>
                  <Pressable
                    style={styles.pickerHeaderButton}
                    hitSlop={styles.pickerHeaderHitSlop}
                    onPress={cancelTimePicker}
                  >
                    <Text style={styles.pickerHeaderText}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.pickerTitle}>Select time</Text>
                  <Pressable
                    style={styles.pickerHeaderButton}
                    hitSlop={styles.pickerHeaderHitSlop}
                    onPress={confirmTimePicker}
                  >
                    <Text style={styles.pickerHeaderText}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={pendingTime ?? matchTime ?? new Date()}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  style={styles.picker}
                />
              </View>
            </View>
          ) : null}
          {isLeagueOpen ? (
            <View style={styles.overlayContainer}>
              <Pressable style={styles.sheetBackdrop} onPress={closeSelects} />
              <View style={styles.sheetContainer}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Select league</Text>
                  <Pressable onPress={closeSelects} hitSlop={styles.sheetCloseHitSlop}>
                    <Ionicons name="close" size={18} color={colors.black} />
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.overlayList}
                  contentContainerStyle={styles.overlayListContent}
                >
                  {leagueOptions.length === 0 ? (
                    <Text style={styles.overlayEmptyText}>No leagues available</Text>
                  ) : (
                    leagueOptions.map((option, index) => {
                      const isSelected = selectedLeague?.id === option.id;

                      return (
                      <View key={option.id}>
                        <Pressable
                          style={[
                            styles.overlayOption,
                            isSelected && styles.overlayOptionSelected,
                          ]}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedLeague(option);
                            closeSelects();
                          }}
                        >
                          <View style={styles.overlayOptionRow}>
                            <Text
                              style={[
                                styles.overlayOptionText,
                                isSelected && styles.overlayOptionTextSelected,
                              ]}
                            >
                              {option.name}
                            </Text>
                            {isSelected ? (
                              <Ionicons name="checkmark-sharp" size={24} color={colors.black} />
                            ) : (
                              <View style={styles.overlayOptionIconPlaceholder} />
                            )}
                          </View>
                        </Pressable>
                        {index < leagueOptions.length - 1 ? (
                          <View style={styles.rowDivider} />
                        ) : null}
                      </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </View>
          ) : null}
          {officialSelectOpenRole ? (
            <View style={styles.overlayContainer}>
              <Pressable style={styles.sheetBackdrop} onPress={closeSelects} />
              <View style={styles.sheetContainer}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    {officialRoles.find((role) => role.key === officialSelectOpenRole)?.label ||
                      'Select official'}
                  </Text>
                  <Pressable onPress={closeSelects} hitSlop={styles.sheetCloseHitSlop}>
                    <Ionicons name="close" size={18} color={colors.black} />
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.overlayList}
                  contentContainerStyle={styles.overlayListContent}
                  onScroll={handleOfficialsScroll}
                  scrollEventThrottle={16}
                >
                  <View style={styles.overlaySearchContainer}>
                    <SingleLineInput
                      value={officialSearch}
                      onChangeText={setOfficialSearch}
                      placeholder="Search officials"
                      autoCorrect={false}
                      autoCapitalize="none"
                      clearButtonMode="while-editing"
                    />
                  </View>
                  {officialLoading && officialOptions.length === 0 ? (
                    <View style={styles.overlayLoader}>
                      <ActivityIndicator
                        size="small"
                        color={colors.black}
                        style={styles.overlayLoaderIndicator}
                      />
                    </View>
                  ) : filteredOfficialOptions.length === 0 ? (
                    <Text style={styles.overlayEmptyText}>
                      {officialOptions.length === 0
                        ? officialQuery
                          ? 'No officials match your search'
                          : 'No officials available'
                        : 'All officials already assigned'}
                    </Text>
                  ) : (
                    <>
                      {filteredOfficialOptions.map((option) => {
                        const isSelected =
                          selectedOfficials[officialSelectOpenRole]?.id === option.id;

                        return (
                          <Pressable
                            key={option.id}
                            style={[styles.overlayOption, isSelected && styles.overlayOptionSelected]}
                            onPress={() => {
                              triggerHaptic();
                              setSelectedOfficials((current) => ({
                                ...current,
                                [officialSelectOpenRole]: option,
                              }));
                              closeSelects();
                            }}
                          >
                            <View style={styles.overlayOptionRow}>
                              <Text
                                style={[
                                  styles.overlayOptionText,
                                  isSelected && styles.overlayOptionTextSelected,
                                ]}
                              >
                                {option.full_name}
                              </Text>
                              {isSelected ? (
                                <Ionicons name="checkmark-sharp" size={24} color={colors.black} />
                              ) : (
                                <View style={styles.overlayOptionIconPlaceholder} />
                              )}
                            </View>
                          </Pressable>
                        );
                      })}
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
      {isMatchOverlayVisible ? (
        <Animated.View
          style={[
            styles.matchOverlay,
            { transform: [{ translateX: matchOverlayTranslateX }] },
          ]}
        >
          <MatchDetailsPlaceholder
            gameId={overlayMatchId}
            onBack={handleOverlayBack}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  matchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ivory,
    zIndex: 10,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[24],
    paddingBottom: spacing[64] + spacing[32] + spacing[24],
  },
  sectionTitle: {
    ...typography.title.medium,
    color: colors.black,
    marginBottom: spacing[12],
  },
  sectionFooterSpacer: {
    height: spacing[24],
  },
  emptyText: {
    ...typography.paragraph.medium,
    color: colors.darkGrey,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingTop: spacing[24],
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[64] + spacing[64],
  },
  stepViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  stepTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  stepPanel: {
    flex: 1,
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
  fieldRow: {
    paddingVertical: spacing[16],
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.softGrey,
  },
  fieldLabel: {
    ...typography.label.large,
    color: colors.black,
    marginBottom: spacing[12],
  },
  fieldHelperText: {
    ...typography.label.small,
    color: colors.darkGrey,
    marginTop: spacing[8],
  },
  fieldLabelInline: {
    ...typography.label.large,
    color: colors.black,
  },
  officialLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[12],
  },
  officialRemoveButton: {
    padding: spacing[2],
  },
  addOfficialText: {
    ...typography.paragraph.medium,
    color: colors.black,
  },
  selectField: {
    position: 'relative',
  },
  selectInput: {
    height: 52,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.black,
    backgroundColor: colors.ivory,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputDisabled: {
    borderColor: colors.softGrey,
  },
  selectText: {
    ...typography.input.singleLine,
    color: colors.black,
  },
  selectPlaceholder: {
    color: colors.darkGrey,
  },
  selectTextDisabled: {
    color: colors.darkGrey,
  },
  selectCaret: {
    marginLeft: spacing[8],
    transform: [{ rotate: '0deg' }],
  },
  selectCaretOpen: {
    transform: [{ rotate: '180deg' }],
  },
  selectCaretDisabled: {
    transform: [{ rotate: '0deg' }],
  },
  reviewInfoCard: {
    backgroundColor: colors.warmGrey,
    borderRadius: spacing[8],
    marginBottom: spacing[12],
    overflow: 'hidden',
  },
  reviewInfoHeader: {
    minHeight: 32,
    padding: spacing[8],
    backgroundColor: colors.softGrey,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewInfoHeaderTitle: {
    ...typography.label.medium,
    color: colors.black,
  },
  reviewInfoBody: {
    padding: spacing[12],
    rowGap: spacing[8],
  },
  reviewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[12],
  },
  reviewInfoLabel: {
    ...typography.label.medium,
    color: colors.black,
    minWidth: 56,
  },
  reviewInfoValue: {
    ...typography.paragraph.medium,
    color: colors.black,
    flex: 1,
    textAlign: 'right',
  },
  reviewErrorBlock: {
    borderWidth: 1,
    borderColor: colors.black,
    padding: spacing[12],
    marginBottom: spacing[16],
  },
  reviewErrorTitle: {
    ...typography.label.large,
    color: colors.black,
    marginBottom: spacing[8],
  },
  reviewErrorText: {
    ...typography.paragraph.medium,
    color: colors.darkGrey,
    marginBottom: spacing[4],
  },
  timeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing[12],
    flexWrap: 'wrap',
  },
  chipRow: {
    flexDirection: 'row',
    columnGap: spacing[8],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  chip: {
    paddingVertical: spacing[4] + spacing[2],
    paddingHorizontal: spacing[12],
    borderRadius: 999,
    backgroundColor: colors.softGrey,
  },
  chipActive: {
    backgroundColor: colors.black,
  },
  chipText: {
    ...typography.label.medium,
    color: colors.black,
  },
  chipTextActive: {
    color: colors.ivory,
  },
  keyboardAccessory: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    backgroundColor: colors.ivory,
    borderTopWidth: 1,
    borderTopColor: colors.softGrey,
  },
  keyboardAccessoryLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 24,
  },
  keyboardAccessoryButton: {
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[12],
    borderRadius: spacing[8],
    backgroundColor: colors.softGrey,
  },
  keyboardAccessoryButtonDisabled: {
    opacity: 0.5,
  },
  keyboardAccessoryButtonDone: {
    backgroundColor: colors.black,
  },
  keyboardAccessoryText: {
    ...typography.label.medium,
    color: colors.black,
  },
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing[64] + spacing[24],
    paddingHorizontal: spacing[16],
    alignItems: 'stretch',
  },
  toast: {
    backgroundColor: colors.forest,
    borderRadius: spacing[4],
    padding: spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[12],
  },
  toastText: {
    ...typography.label.medium,
    color: colors.ivory,
    flex: 1,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pickerBackdrop: {
    flex: 1,
  },
  pickerSheet: {
    backgroundColor: colors.ivory,
    borderTopLeftRadius: spacing[12],
    borderTopRightRadius: spacing[12],
    paddingBottom: spacing[16],
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.softGrey,
  },
  pickerHeaderButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
  },
  pickerHeaderHitSlop: {
    top: 6,
    bottom: 6,
    left: 10,
    right: 10,
  },
  pickerHeaderText: {
    ...typography.label.medium,
    color: colors.black,
  },
  pickerTitle: {
    ...typography.label.large,
    color: colors.black,
  },
  picker: {
    backgroundColor: colors.ivory,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheetContainer: {
    backgroundColor: colors.warmGrey,
    borderTopLeftRadius: spacing[16],
    borderTopRightRadius: spacing[16],
    paddingBottom: spacing[16],
    maxHeight: '70%',
    height: '70%',
    minHeight: 240,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.softGrey,
  },
  sheetTitle: {
    ...typography.label.large,
    color: colors.black,
  },
  sheetCloseHitSlop: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
  overlayScreen: {
    flex: 1,
    backgroundColor: colors.warmGrey,
  },
  overlayList: {
    flex: 1,
  },
  overlayListContent: {
    padding: spacing[16],
    paddingBottom: spacing[32],
  },
  overlaySearchContainer: {
    marginBottom: spacing[12],
  },
  overlayLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[24],
  },
  overlayLoaderIndicator: {
    width: 24,
    height: 24,
  },
  overlayOption: {
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[12],
  },
  overlayOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[12],
  },
  overlayOptionSelected: {
    backgroundColor: colors.softGrey,
    borderRadius: spacing[12],
  },
  overlayOptionIconPlaceholder: {
    width: 24,
    height: 24,
  },
  overlayOptionText: {
    ...typography.label.medium,
    color: colors.black,
  },
  overlayOptionTextSelected: {
    color: colors.black,
  },
  overlayEmptyText: {
    ...typography.paragraph.medium,
    color: colors.darkGrey,
  },
});
