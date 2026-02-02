import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '../src/theme';
import SingleLineInput from '../src/components/SingleLineInput';
import PrimaryButton from '../src/components/PrimaryButton';
import { supabase } from '../src/lib/supabase';

export default function LoginScreen() {
  const emailInputRef = useRef(null);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (data?.session) {
        router.replace('/home');
      }
    };

    checkSession();

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleLogin = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.warn('Login failed:', error.message);
        return;
      }

      router.replace('/home');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome to Touchline</Text>
          <Text style={styles.subtitle}>
            Enter your email and password to get started
          </Text>
          <View style={styles.inputs}>
            <SingleLineInput
              ref={emailInputRef}
              placeholder="Email"
              autoFocus
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <SingleLineInput
              placeholder="Password"
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Login"
            style={styles.button}
            onPress={handleLogin}
            disabled={isSubmitting}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
    paddingTop: 44,
    paddingBottom: 44,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  formContainer: {
    marginTop: 36,
    paddingHorizontal: 16,
  },
  title: {
    ...typography.title.large,
    color: colors.black,
    paddingBottom: 8,
  },
  subtitle: {
    ...typography.paragraph.medium,
    color: colors.black,
    paddingBottom: 24,
  },
  inputs: {
    gap: 12,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  button: {
    width: '100%',
  },
});
