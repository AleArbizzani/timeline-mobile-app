import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '../src/theme';
import { supabase } from '../src/lib/supabase';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error) {
        console.warn('Session check failed:', error.message);
      }

      const destination = data?.session ? '/home' : '/login';
      router.replace(destination);
    };

    checkSession();

    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Timeline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory,
    paddingTop: 44,
    paddingBottom: 44,
  },
  title: {
    ...typography.title.large,
    color: colors.black,
  },
});
