import { Pressable, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export default function HeaderIconButton({
  children,
  onPress,
  size = 32,
  backgroundColor = colors.ivory,
  disabled = false,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          opacity: pressed || disabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[0],
  },
});
