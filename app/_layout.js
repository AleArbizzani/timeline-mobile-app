import { useEffect } from 'react';
import { Slot, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
        return;
      }

      if (session) {
        router.replace('/home');
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [router]);

  if (!fontsLoaded) {
    return null;
  }

  return <Slot />;
}
