import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { setUnauthorizedHandler } from './src/api/client';
import { RootNavigator } from './src/navigation/RootNavigator';
import { subscribeToAppResume } from './src/services/app-lifecycle';
import { reconnectTrackedTripSockets } from './src/services/socket';
import { store } from './src/store';
import { bootstrapAuth, logout } from './src/store/authSlice';
import { useAppDispatch } from './src/store/hooks';
import { colors } from './src/theme/colors';

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

function AppContent() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await dispatch(logout());
    });
    void dispatch(bootstrapAuth());

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [dispatch]);

  useEffect(() => subscribeToAppResume(reconnectTrackedTripSockets), []);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="dark" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
