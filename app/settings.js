import { View, StyleSheet } from 'react-native';
import MainHeader from '../src/components/headers/MainHeader';
import BottomTabBar from '../src/components/BottomTabBar';
import { colors, spacing } from '../src/theme';

export default function SettingsScreen() {
  return (
    <View style={styles.screen}>
      <MainHeader title="Settings" />
      <View style={styles.content} />
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.warmGrey,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
});
