import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BootSplashScreen } from '../features/auth/BootSplashScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { RegisterScreen } from '../features/auth/RegisterScreen';
import { UnsupportedRoleScreen } from '../features/auth/UnsupportedRoleScreen';
import { BookingCheckoutScreen } from '../features/bookings/BookingCheckoutScreen';
import { BookingDetailScreen } from '../features/bookings/BookingDetailScreen';
import { PaymentWebViewScreen } from '../features/bookings/PaymentWebViewScreen';
import { DriverHomeScreen } from '../features/driver/DriverHomeScreen';
import { DriverTripDetailScreen } from '../features/driver/DriverTripDetailScreen';
import { ScanTicketScreen } from '../features/driver/ScanTicketScreen';
import { ChangePasswordScreen } from '../features/profile/ChangePasswordScreen';
import { EditProfileScreen } from '../features/profile/EditProfileScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { SearchScreen } from '../features/search/SearchScreen';
import { SeatSelectionScreen } from '../features/seats/SeatSelectionScreen';
import { MyTicketsScreen } from '../features/tickets/MyTicketsScreen';
import { TicketDetailScreen } from '../features/tickets/TicketDetailScreen';
import { TripDetailScreen } from '../features/trips/TripDetailScreen';
import { useAppSelector } from '../store/hooks';
import { selectAuth } from '../store/authSlice';
import { colors } from '../theme/colors';
import type { AppStackParamList, DriverTabParamList, PassengerTabParamList } from './types';

const RootStack = createNativeStackNavigator<AppStackParamList>();
const PassengerTab = createBottomTabNavigator<PassengerTabParamList>();
const DriverTab = createBottomTabNavigator<DriverTabParamList>();

const stackOptions = {
  headerShadowVisible: false,
  headerTintColor: colors.brand,
  headerTitleStyle: { fontWeight: '700' as const },
  headerStyle: { backgroundColor: colors.surface },
  contentStyle: { backgroundColor: colors.background },
};

const tabOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.brand,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 62,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
};

function GuestNavigator() {
  return (
    <RootStack.Navigator screenOptions={stackOptions} initialRouteName="Search">
      <RootStack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <RootStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Chi tiết chuyến' }}
      />
      <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <RootStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
    </RootStack.Navigator>
  );
}

function PassengerTabs() {
  return (
    <PassengerTab.Navigator screenOptions={tabOptions}>
      <PassengerTab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Đặt vé',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bus-outline" size={size} color={color} />
          ),
        }}
      />
      <PassengerTab.Screen
        name="MyTickets"
        component={MyTicketsScreen}
        options={{
          title: 'Vé của tôi',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size} color={color} />
          ),
        }}
      />
      <PassengerTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </PassengerTab.Navigator>
  );
}

function PassengerNavigator() {
  return (
    <RootStack.Navigator screenOptions={stackOptions}>
      <RootStack.Screen
        name="PassengerTabs"
        component={PassengerTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Chi tiết chuyến' }}
      />
      <RootStack.Screen
        name="SeatSelection"
        component={SeatSelectionScreen}
        options={{ title: 'Chọn ghế' }}
      />
      <RootStack.Screen
        name="BookingCheckout"
        component={BookingCheckoutScreen}
        options={{ title: 'Xác nhận đặt vé' }}
      />
      <RootStack.Screen
        name="PaymentWebView"
        component={PaymentWebViewScreen}
        options={{ title: 'Thanh toán VNPAY' }}
      />
      <RootStack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Chi tiết đơn vé' }}
      />
      <RootStack.Screen
        name="TicketDetail"
        component={TicketDetailScreen}
        options={{ title: 'Vé điện tử' }}
      />
      <RootStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Chỉnh sửa hồ sơ' }}
      />
      <RootStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Đổi mật khẩu' }}
      />
    </RootStack.Navigator>
  );
}

function DriverTabs() {
  return (
    <DriverTab.Navigator screenOptions={tabOptions}>
      <DriverTab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{
          title: 'Chuyến xe',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bus-outline" size={size} color={color} />
          ),
        }}
      />
      <DriverTab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </DriverTab.Navigator>
  );
}

function DriverNavigator() {
  return (
    <RootStack.Navigator screenOptions={stackOptions}>
      <RootStack.Screen name="DriverTabs" component={DriverTabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="DriverTripDetail"
        component={DriverTripDetailScreen}
        options={{ title: 'Chi tiết chuyến' }}
      />
      <RootStack.Screen
        name="DriverScan"
        component={ScanTicketScreen}
        options={{ title: 'Soát mã QR' }}
      />
      <RootStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Chỉnh sửa hồ sơ' }}
      />
      <RootStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Đổi mật khẩu' }}
      />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const auth = useAppSelector(selectAuth);

  if (auth.status === 'bootstrapping') {
    return <BootSplashScreen />;
  }

  if (auth.status !== 'authenticated' || !auth.user) {
    return <GuestNavigator />;
  }

  if (auth.user.ten_vai_tro === 'KHACH_HANG') {
    return <PassengerNavigator />;
  }

  if (auth.user.ten_vai_tro === 'TAI_XE') {
    return <DriverNavigator />;
  }

  return <UnsupportedRoleScreen />;
}
