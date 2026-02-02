import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import HeaderBase from './HeaderBase';
import HeaderTitleRow from './HeaderTitleRow';
import HeaderIconButton from './HeaderIconButton';

export default function MainHeader({
  title,
  onPressCalendar,
  onPressAdd,
  showCalendar = true,
  showAdd = true,
  style,
}) {
  const rightSlot = showCalendar || showAdd ? (
    <View style={styles.rightSlot}>
      {showCalendar ? (
        <HeaderIconButton onPress={onPressCalendar}>
          <Ionicons name="calendar-sharp" size={16} color={colors.black} />
        </HeaderIconButton>
      ) : null}
      {showAdd ? (
        <HeaderIconButton onPress={onPressAdd}>
          <Ionicons name="add-sharp" size={16} color={colors.black} />
        </HeaderIconButton>
      ) : null}
    </View>
  ) : null;

  return (
    <HeaderBase style={style}>
      <HeaderTitleRow title={title} rightSlot={rightSlot} />
    </HeaderBase>
  );
}

const styles = StyleSheet.create({
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing[8],
  },
});
