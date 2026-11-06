import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { bookingsApi } from '../../api/endpoints/bookings';
import { getErrorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { env } from '../../config/env';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'PaymentWebView'>;

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 1_500;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function PaymentWebViewScreen({ route, navigation }: Props) {
  const { bookingId, paymentUrl } = route.params;
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledReturn = useRef(false);
  const finished = useRef(false);

  const finish = useCallback(async () => {
    if (finished.current) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        const order = await bookingsApi.getById(bookingId);
        if (order.trang_thai_don !== 'CHO_THANH_TOAN') {
          finished.current = true;
          navigation.reset({
            index: 1,
            routes: [
              { name: 'PassengerTabs', params: { screen: 'MyTickets' } },
              { name: 'BookingDetail', params: { bookingId } },
            ],
          });
          return;
        }

        if (attempt < POLL_ATTEMPTS - 1) {
          await sleep(POLL_INTERVAL_MS);
        }
      }

      finished.current = true;
      navigation.reset({
        index: 1,
        routes: [
          { name: 'PassengerTabs', params: { screen: 'MyTickets' } },
          { name: 'BookingDetail', params: { bookingId } },
        ],
      });
    } catch (pollError) {
      setError(getErrorMessage(pollError));
      setProcessing(false);
    }
  }, [bookingId, navigation]);

  const handleReturnUrl = useCallback(
    async (url: string) => {
      if (handledReturn.current) {
        return;
      }

      handledReturn.current = true;
      setProcessing(true);

      try {
        await fetch(url, { headers: { Accept: 'application/json' } });
      } catch {
        // The booking status poll below is the source of truth.
      }

      await finish();
    },
    [finish],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      if (request.url.includes(env.vnpayReturnPath)) {
        void handleReturnUrl(request.url);
        return false;
      }

      return true;
    },
    [handleReturnUrl],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && handledReturn.current) {
        void finish();
      }
    });

    return () => subscription.remove();
  }, [finish]);

  const openInBrowser = async () => {
    await WebBrowser.openBrowserAsync(paymentUrl);
    setProcessing(true);
    await finish();
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: paymentUrl }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={(state) => {
          if (state.url.includes(env.vnpayReturnPath)) {
            void handleReturnUrl(state.url);
          }
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>Đang mở cổng thanh toán VNPAY...</Text>
          </View>
        )}
      />

      {processing ? (
        <View style={styles.overlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.processingTitle}>Đang xác nhận thanh toán</Text>
            <Text style={styles.processingText}>
              Vui lòng không tắt ứng dụng. Hệ thống đang kiểm tra kết quả giao dịch.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        {error ? <InlineNotice tone="error" message={error} /> : null}
        <Text style={styles.hint}>
          Nếu ứng dụng ngân hàng được mở, hãy hoàn tất thanh toán rồi quay lại và kiểm tra kết quả.
        </Text>
        <View style={styles.actions}>
          <Button
            title="Kiểm tra lại"
            variant="secondary"
            loading={processing}
            onPress={() => {
              handledReturn.current = true;
              void finish();
            }}
            style={styles.flexButton}
          />
          <Button
            title="Mở trình duyệt"
            variant="outline"
            onPress={() => {
              void openInBrowser();
            }}
            style={styles.flexButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(13, 31, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  processingCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  processingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  processingText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
});
