import type { NavigatorScreenParams } from '@react-navigation/native';

export type PassengerTabParamList = {
  Search: undefined;
  MyTickets: undefined;
  Profile: undefined;
};

export type DriverTabParamList = {
  DriverHome: undefined;
  DriverProfile: undefined;
};

export type AppStackParamList = {
  Search: undefined;
  TripDetail: { tripId: number };
  Login: undefined;
  Register: undefined;
  PassengerTabs: NavigatorScreenParams<PassengerTabParamList> | undefined;
  SeatSelection: { tripId: number };
  BookingCheckout: { tripId: number; seatCodes: string[]; ownerRef: string };
  PaymentWebView: { bookingId: string; paymentUrl: string };
  BookingDetail: { bookingId: string };
  TicketDetail: { ticketId: string };
  EditProfile: undefined;
  ChangePassword: undefined;
  DriverTabs: NavigatorScreenParams<DriverTabParamList> | undefined;
  DriverTripDetail: { tripId: number };
  DriverScan: { tripId?: number } | undefined;
};
