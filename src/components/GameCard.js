import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

const formatGameDate = (value) => {
  if (!value) {
    return '';
  }
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

const formatGameTime = (value) => {
  if (!value) {
    return { time: '', meridiem: '' };
  }
  const hours24 = value.getHours();
  const minutes = value.getMinutes();
  const hours12 = ((hours24 + 11) % 12) + 1;
  const paddedMinutes = String(minutes).padStart(2, '0');
  return {
    time: `${hours12}:${paddedMinutes}`,
    meridiem: hours24 >= 12 ? 'PM' : 'AM',
  };
};

export default function GameCard({
  leagueName,
  leagueIcon,
  dateTime,
  homeTeam,
  awayTeam,
  onPress,
}) {
  const { time, meridiem } = formatGameTime(dateTime);

  return (
    <Pressable style={styles.card} onPress={onPress} disabled={!onPress}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {leagueIcon ? (
            <View style={styles.headerIcon}>
              <Image source={{ uri: leagueIcon }} style={styles.headerIconImage} />
            </View>
          ) : null}
          <Text style={styles.headerTitle}>{leagueName}</Text>
        </View>
        <Text style={styles.headerDate}>{formatGameDate(dateTime)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.bodyRow}>
          <View style={styles.bodyTeamSlotLeft}>
            <Text style={styles.bodyTeam}>{homeTeam}</Text>
          </View>
          <View style={styles.bodyTimeStack}>
            <Text style={styles.bodyTime}>{time}</Text>
            <Text style={styles.bodyMeridiem}>{meridiem}</Text>
          </View>
          <View style={styles.bodyTeamSlotRight}>
            <Text style={styles.bodyTeam}>{awayTeam}</Text>
          </View>
        </View>
      </View>
    </Pressable>
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
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerIconImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerTitle: {
    ...typography.label.medium,
    color: colors.black,
  },
  headerDate: {
    ...typography.label.medium,
    color: colors.darkGrey,
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
    ...typography.label.medium,
    color: colors.black,
  },
  bodyTime: {
    ...typography.label.medium,
    color: colors.darkGrey,
  },
  bodyMeridiem: {
    ...typography.label.medium,
    color: colors.darkGrey,
  },
});
