import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

const noopAsync = async () => {};

const Haptics = Platform.OS === 'web'
  ? {
      impactAsync: noopAsync,
      notificationAsync: noopAsync,
      selectionAsync: noopAsync,
      ImpactFeedbackStyle: ExpoHaptics.ImpactFeedbackStyle,
      NotificationFeedbackType: ExpoHaptics.NotificationFeedbackType,
    }
  : ExpoHaptics;

export default Haptics;
export const {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} = Haptics;
