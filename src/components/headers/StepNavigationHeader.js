import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import HeaderBase from './HeaderBase';
import HeaderTitleRow from './HeaderTitleRow';

export default function StepNavigationHeader({
  title,
  onBack,
  style,
}) {
  const leftSlot = (
    <Pressable
      onPress={onBack}
      style={({ pressed }) => [
        styles.backButton,
        pressed && styles.backButtonPressed,
      ]}
    >
      <Ionicons name="chevron-back" size={24} color={colors.ivory} />
    </Pressable>
  );

  return (
    <HeaderBase style={style}>
      <HeaderTitleRow title={title} leftSlot={leftSlot} />
    </HeaderBase>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: spacing[2],
  },
  backButtonPressed: {
    opacity: 0.7,
  },
});
