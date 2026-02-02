import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';

export default function GameCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.placeholder, styles.headerIcon]} />
          <View style={[styles.placeholder, styles.headerTitle]} />
        </View>
        <View style={[styles.placeholder, styles.headerDate]} />
      </View>
      <View style={styles.body}>
        <View style={styles.bodyRow}>
          <View style={styles.bodyTeamSlotLeft}>
            <View style={[styles.placeholder, styles.bodyTeam]} />
          </View>
          <View style={styles.bodyTimeStack}>
            <View style={[styles.placeholder, styles.bodyTime]} />
            <View style={[styles.placeholder, styles.bodyMeridiem]} />
          </View>
          <View style={styles.bodyTeamSlotRight}>
            <View style={[styles.placeholder, styles.bodyTeam]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.warmGrey,
    borderRadius: spacing[8],
    marginBottom: spacing[12],
    overflow: 'hidden',
  },
  header: {
    minHeight: 32,
    padding: spacing[8],
    backgroundColor: colors.softGrey,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing[8],
  },
  headerIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  headerTitle: {
    width: 120,
    height: 12,
    borderRadius: 6,
  },
  headerDate: {
    width: 72,
    height: 12,
    borderRadius: 6,
  },
  body: {
    padding: spacing[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bodyTeamSlotLeft: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: spacing[8],
  },
  bodyTimeStack: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    maxWidth: 64,
  },
  bodyTeamSlotRight: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: spacing[8],
  },
  bodyTeam: {
    width: 84,
    height: 12,
    borderRadius: 6,
  },
  bodyTime: {
    width: 40,
    height: 12,
    borderRadius: 6,
    marginBottom: spacing[6],
  },
  bodyMeridiem: {
    width: 28,
    height: 10,
    borderRadius: 6,
  },
  placeholder: {
    backgroundColor: colors.ivory,
    opacity: 0.7,
  },
});
