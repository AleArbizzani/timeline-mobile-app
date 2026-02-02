import { View, StyleSheet } from 'react-native';
import HeaderBase from './HeaderBase';

export default function MatchHeaderContainer({ children, style }) {
  return (
    <HeaderBase style={[styles.container, style]}>
      <View style={styles.row}>{children}</View>
    </HeaderBase>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
