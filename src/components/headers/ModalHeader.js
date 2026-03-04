import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import HeaderBase from './HeaderBase';
import HeaderTitleRow from './HeaderTitleRow';
import HeaderIconButton from './HeaderIconButton';

export default function ModalHeader({ title, onClose, onSave, saveDisabled, style }) {
  const rightSlot = (
    <View style={styles.rightGroup}>
      {onSave ? (
        <HeaderIconButton
          onPress={onSave}
          backgroundColor={colors.forest}
          disabled={saveDisabled}
        >
          <Ionicons name="checkmark" size={16} color={colors.ivory} />
        </HeaderIconButton>
      ) : null}
      <HeaderIconButton onPress={onClose} backgroundColor={colors.racing}>
        <Ionicons name="close" size={16} color={colors.ivory} />
      </HeaderIconButton>
    </View>
  );

  return (
    <HeaderBase style={style}>
      <HeaderTitleRow title={title} rightSlot={rightSlot} />
    </HeaderBase>
  );
}

const styles = StyleSheet.create({
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing[8],
  },
});
