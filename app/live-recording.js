import { useLocalSearchParams } from 'expo-router';
import LiveRecordingScreen from '../src/components/LiveRecordingScreen';

export default function LiveRecordingRoute() {
  const { gameId } = useLocalSearchParams();

  return <LiveRecordingScreen gameId={gameId} />;
}
