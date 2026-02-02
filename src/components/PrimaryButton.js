import { Pressable, Text, View, StyleSheet } from 'react-native';
import { impactAsync, ImpactFeedbackStyle } from '../lib/haptics';
import { colors, typography } from '../theme';

export default function PrimaryButton({
  title,
  onPress,
  iconLeft,
  iconRight,
  style,
  textStyle,
  disabled = false,
}) {
  const handlePress = () => {
    if (disabled) {
      return;
    }

    void impactAsync(ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={handlePress}
      disabled={disabled}
    >
      <View style={styles.content}>
        {iconLeft ? <View style={styles.iconSlot}>{iconLeft}</View> : null}
        <Text style={[styles.text, textStyle]}>{title}</Text>
        {iconRight ? <View style={styles.iconSlot}>{iconRight}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.ivory,
    ...typography.ui.cta,
  },
});
