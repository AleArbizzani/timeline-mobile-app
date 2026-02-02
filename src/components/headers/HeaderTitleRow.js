import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';

export default function HeaderTitleRow({
  title,
  leftSlot,
  rightSlot,
  style,
  titleStyle,
}) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        {leftSlot ? <View style={styles.leftSlot}>{leftSlot}</View> : null}
        <Text style={[styles.title, titleStyle]}>{title}</Text>
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing[8],
    flexShrink: 1,
  },
  leftSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing[8],
  },
  title: {
    color: colors.ivory,
    ...typography.title.large,
  },
});
