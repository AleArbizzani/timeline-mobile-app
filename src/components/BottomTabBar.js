import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { impactAsync, ImpactFeedbackStyle } from '../lib/haptics';
import { colors, spacing, typography } from '../theme';

const tabs = [
  { key: 'matches', label: 'Matches', route: '/home', icon: 'football-sharp' },
  { key: 'reports', label: 'Reports', route: '/reports', icon: 'file-tray-sharp' },
  { key: 'settings', label: 'Settings', route: '/settings', icon: 'cog-sharp' },
];

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const animatedValuesRef = useRef(
    tabs.map((tab) => new Animated.Value(pathname === tab.route ? 1 : 0))
  );
  const animatedValues = animatedValuesRef.current;

  useEffect(() => {
    const animations = tabs.map((tab, index) =>
      Animated.timing(animatedValues[index], {
        toValue: pathname === tab.route ? 1 : 0,
        duration: 150,
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [pathname, animatedValues]);

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {tabs.map((tab, index) => {
          const animatedValue = animatedValues[index];
          const activeOpacity = animatedValue;
          const inactiveOpacity = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          });
          const handlePress = async () => {
            await impactAsync(ImpactFeedbackStyle.Medium);
            router.push(tab.route);
          };
          return (
            <Pressable key={tab.key} onPress={handlePress} style={styles.tab}>
              <Animated.View
                style={[styles.tabFill, { opacity: activeOpacity }]}
              />
              <View style={styles.tabContent}>
                <View style={styles.iconStack}>
                  <Animated.View style={[styles.iconLayer, { opacity: inactiveOpacity }]}>
                    <Ionicons name={tab.icon} size={20} color={colors.black} />
                  </Animated.View>
                  <Animated.View style={[styles.iconLayer, { opacity: activeOpacity }]}>
                    <Ionicons name={tab.icon} size={20} color={colors.ivory} />
                  </Animated.View>
                </View>
                <View style={styles.textStack}>
                  <Animated.Text style={[styles.tabLabel, styles.textLayer, { opacity: inactiveOpacity }]}>
                    {tab.label}
                  </Animated.Text>
                  <Animated.Text
                    style={[
                      styles.tabLabel,
                      styles.tabLabelActive,
                      styles.textLayer,
                      { opacity: activeOpacity },
                    ]}
                  >
                    {tab.label}
                  </Animated.Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 95,
    paddingTop: spacing[12],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[16],
    backgroundColor: 'rgba(252, 248, 238, 0.9)',
  },
  bar: {
    flex: 1,
    padding: spacing[4],
    backgroundColor: colors.softGrey,
    flexDirection: 'row',
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  tabContent: {
    alignItems: 'center',
    rowGap: spacing[4],
  },
  tabFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
    borderRadius: 999,
  },
  tabLabel: {
    ...typography.ui.tabBar,
    color: colors.black,
  },
  tabLabelActive: {
    color: colors.ivory,
  },
  iconStack: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
  },
  textStack: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: typography.ui.tabBar.lineHeight,
  },
  textLayer: {
    position: 'absolute',
  },
});
