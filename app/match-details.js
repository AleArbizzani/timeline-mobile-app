import { useLocalSearchParams, useRouter } from 'expo-router';
import MatchDetailsPlaceholder from '../src/components/MatchDetailsPlaceholder';

export default function MatchDetailsScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams();

  return (
    <MatchDetailsPlaceholder
      gameId={gameId}
      onBack={() => router.back()}
    />
  );
}
