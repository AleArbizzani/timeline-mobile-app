import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export default function HeaderBase({ children, style }) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing[64],
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[16],
    backgroundColor: colors.black,
  },
});
