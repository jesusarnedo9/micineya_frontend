import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { isAuthError } from '../api/errors';
import { fetchOnboardingStatus } from '../api/onboarding';
import { clearSession, getRefreshToken, getToken } from '../auth/session';

type Destination = '/(auth)/login' | '/onboarding' | '/(app)';

export default function Index() {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    let mounted = true;

    const readSession = async () => {
      try {
        const [token, refreshToken] = await Promise.all([getToken(), getRefreshToken()]);
        if (!token && !refreshToken) {
          if (mounted) setDestination('/(auth)/login');
          return;
        }

        try {
          const status = await fetchOnboardingStatus();
          if (mounted) setDestination(status.completed ? '/(app)' : '/onboarding');
        } catch (error) {
          if (isAuthError(error)) {
            await clearSession();
            if (mounted) setDestination('/(auth)/login');
          } else if (mounted) {
            // No bloqueamos a un usuario autenticado por una demora temporal del servidor.
            setDestination('/(app)');
          }
        }
      } catch {
        if (mounted) setDestination('/(auth)/login');
      }
    };

    void readSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (destination == null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#e50914" size="large" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#000',
    flex: 1,
    justifyContent: 'center',
  },
});
