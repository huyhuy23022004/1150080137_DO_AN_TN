import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ticketsApi } from '../../api/endpoints/tickets';
import { getErrorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { LoadingView } from '../../components/StatusView';
import { TextField } from '../../components/TextField';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme/colors';
import type { CheckinResult } from '../../types/ticket';
import { formatCurrency, formatDateTime } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverScan'>;

function ResultCard({
  result,
  onScanAgain,
  onDone,
}: {
  result: CheckinResult;
  onScanAgain: () => void;
  onDone: () => void;
}) {
  const { ve, already_checked_in: alreadyCheckedIn } = result;

  return (
    <View style={styles.resultCard}>
      <View
        style={[
          styles.resultIcon,
          alreadyCheckedIn ? styles.resultIconWarning : styles.resultIconSuccess,
        ]}
      >
        <Ionicons
          name={alreadyCheckedIn ? 'alert-circle-outline' : 'checkmark-circle-outline'}
          size={34}
          color={alreadyCheckedIn ? colors.warning : colors.success}
        />
      </View>

      <Text style={styles.resultTitle}>
        {alreadyCheckedIn ? 'Vé đã được soát trước đó' : 'Soát vé thành công'}
      </Text>
      <Text style={styles.resultSubtitle}>
        {alreadyCheckedIn
          ? 'Không ghi nhận thêm lượt lên xe cho vé này.'
          : 'Hành khách đã được ghi nhận lên xe.'}
      </Text>

      <View style={styles.resultDetails}>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Hành khách</Text>
          <Text style={styles.resultValue}>{ve.ho_ten_khach}</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Ghế</Text>
          <Text style={styles.resultValue}>{ve.ky_hieu_ghe}</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Tuyến</Text>
          <Text style={styles.resultValue} numberOfLines={2}>
            {ve.ten_tuyen}
          </Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Khởi hành</Text>
          <Text style={styles.resultValue}>{formatDateTime(ve.thoi_gian_xuat_ben)}</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Giá vé</Text>
          <Text style={styles.resultValue}>{formatCurrency(ve.gia_ve)}</Text>
        </View>
        {ve.thoi_gian_soat_ve ? (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Thời gian soát</Text>
            <Text style={styles.resultValue}>{formatDateTime(ve.thoi_gian_soat_ve)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.resultActions}>
        <Button title="Quét tiếp" onPress={onScanAgain} style={styles.flexButton} />
        <Button title="Xong" variant="secondary" onPress={onDone} style={styles.flexButton} />
      </View>
    </View>
  );
}

function ManualEntry({
  tripId,
  submitting,
  onSubmit,
}: {
  tripId?: number;
  submitting: boolean;
  onSubmit: (token: string) => Promise<void>;
}) {
  const [token, setToken] = useState('');

  return (
    <View style={styles.manualCard}>
      <Text style={styles.manualTitle}>Nhập mã vé thủ công</Text>
      <Text style={styles.manualHint}>
        Nhập mã QR in trên vé nếu camera không đọc được.
        {tripId ? ` Chuyến #${tripId}.` : ''}
      </Text>
      <TextField
        label="Mã QR"
        placeholder="Dán hoặc nhập mã vé"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (token.trim()) {
            void onSubmit(token.trim());
          }
        }}
      />
      <Button
        title="Xác nhận soát vé"
        loading={submitting}
        disabled={!token.trim()}
        onPress={() => {
          void onSubmit(token.trim());
        }}
      />
    </View>
  );
}

export function ScanTicketScreen({ route, navigation }: Props) {
  const tripId = route.params?.tripId;
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanLocked = useRef(false);

  const checkIn = async (token: string) => {
    if (submitting || !token) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const checkin = await ticketsApi.checkIn(token);
      setResult(checkin);
      scanLocked.current = true;
    } catch (checkinError) {
      setError(getErrorMessage(checkinError));
      scanLocked.current = true;
    } finally {
      setSubmitting(false);
    }
  };

  const handleBarcode = (scan: BarcodeScanningResult) => {
    if (scanLocked.current || submitting || manualMode) {
      return;
    }

    scanLocked.current = true;
    void checkIn(scan.data);
  };

  const scanAgain = () => {
    setResult(null);
    setError(null);
    setManualMode(false);
    scanLocked.current = false;
  };

  if (!permission) {
    return <LoadingView message="Đang kiểm tra quyền camera..." />;
  }

  if (result) {
    return (
      <Screen scroll contentContainerStyle={styles.resultScreen}>
        <ResultCard result={result} onScanAgain={scanAgain} onDone={() => navigation.goBack()} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen scroll contentContainerStyle={styles.permissionScreen}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={38} color={colors.brand} />
        </View>
        <Text style={styles.permissionTitle}>Cần quyền truy cập camera</Text>
        <Text style={styles.permissionText}>
          Ứng dụng cần camera để quét mã QR trên vé của hành khách.
        </Text>

        {permission.canAskAgain ? (
          <Button title="Cho phép camera" onPress={() => void requestPermission()} />
        ) : (
          <Button title="Mở cài đặt" onPress={() => void Linking.openSettings()} />
        )}

        <Button
          title="Nhập mã thủ công"
          variant="secondary"
          onPress={() => setManualMode((value) => !value)}
        />

        {manualMode ? (
          <ManualEntry tripId={tripId} submitting={submitting} onSubmit={checkIn} />
        ) : null}

        {error ? <InlineNotice tone="error" message={error} /> : null}
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={manualMode ? undefined : handleBarcode}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.topBar}>
            <View style={styles.tripChip}>
              <Ionicons name="bus-outline" size={14} color={colors.white} />
              <Text style={styles.tripChipText}>
                {tripId ? `Chuyến #${tripId}` : 'Soát vé toàn bộ chuyến'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={torch ? 'Tắt đèn' : 'Bật đèn'}
              onPress={() => setTorch((value) => !value)}
              style={styles.torchButton}
            >
              <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>

          <Text style={styles.scanHint}>Đưa mã QR trên vé vào khung hình</Text>
        </View>
      </CameraView>

      <SafeAreaView edges={['bottom']} style={styles.bottomPanel}>
        {error ? <InlineNotice tone="error" message={error} /> : null}

        {submitting ? (
          <View style={styles.submittingRow}>
            <Ionicons name="sync-outline" size={18} color={colors.brand} />
            <Text style={styles.submittingText}>Đang xác thực vé...</Text>
          </View>
        ) : null}

        {manualMode ? (
          <ManualEntry
            tripId={tripId}
            submitting={submitting}
            onSubmit={async (token) => {
              scanLocked.current = true;
              await checkIn(token);
            }}
          />
        ) : (
          <>
            <Text style={styles.bottomHint}>
              Hệ thống tự động kiểm tra vé và ghi nhận hành khách lên xe.
            </Text>
            {error ? (
              <Button
                title="Thử quét lại"
                disabled={submitting}
                onPress={() => {
                  setError(null);
                  scanLocked.current = false;
                }}
              />
            ) : null}
            <Button
              title="Nhập mã thủ công"
              variant="secondary"
              disabled={submitting}
              onPress={() => setManualMode(true)}
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08130C',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  tripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  tripChipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  torchButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    alignSelf: 'center',
    width: 250,
    height: 250,
    marginVertical: spacing.xl,
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.accent,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanHint: {
    alignSelf: 'center',
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  bottomPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.lg,
    gap: spacing.md,
  },
  bottomHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submittingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brand,
  },
  manualCard: {
    gap: spacing.md,
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  manualHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  resultScreen: {
    paddingBottom: spacing.xxl,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconSuccess: {
    backgroundColor: colors.successSoft,
  },
  resultIconWarning: {
    backgroundColor: colors.warningSoft,
  },
  resultTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  resultSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  resultDetails: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  resultLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  resultValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  flexButton: {
    flex: 1,
  },
  permissionScreen: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  permissionIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
