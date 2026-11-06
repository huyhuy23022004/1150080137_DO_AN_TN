import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import tripsReducer from './tripsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    trips: tripsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
