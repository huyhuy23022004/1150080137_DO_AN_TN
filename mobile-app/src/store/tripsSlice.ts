import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { tripsApi } from '../api/endpoints/trips';
import { getErrorMessage } from '../api/errors';
import { toVietnamDateString } from '../utils/datetime';
import type { Trip, TripSearchParams, TripSearchResult } from '../types/trip';
import type { RootState } from './index';

interface TripsState {
  items: Trip[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  isLoadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  lastQuery: Required<Pick<TripSearchParams, 'tinh_di' | 'tinh_den' | 'ngay'>>;
  meta: TripSearchResult['meta'];
}

const today = toVietnamDateString();

const initialState: TripsState = {
  items: [],
  status: 'idle',
  isLoadingMore: false,
  error: null,
  loadMoreError: null,
  lastQuery: {
    tinh_di: '',
    tinh_den: '',
    ngay: today,
  },
  meta: {
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  },
};

export const searchTrips = createAsyncThunk<
  TripSearchResult,
  TripSearchParams,
  { rejectValue: string }
>('trips/search', async (params, { rejectWithValue }) => {
  try {
    return await tripsApi.search(params);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const loadMoreTrips = createAsyncThunk<
  TripSearchResult,
  void,
  { state: RootState; rejectValue: string }
>('trips/loadMore', async (_, { getState, rejectWithValue }) => {
  const { trips } = getState();

  try {
    return await tripsApi.search({
      ...trips.lastQuery,
      page: trips.meta.page + 1,
      limit: trips.meta.limit,
    });
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const tripsSlice = createSlice({
  name: 'trips',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(searchTrips.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        state.loadMoreError = null;
        state.isLoadingMore = false;
        state.lastQuery = {
          tinh_di: action.meta.arg.tinh_di ?? '',
          tinh_den: action.meta.arg.tinh_den ?? '',
          ngay: action.meta.arg.ngay ?? toVietnamDateString(),
        };
      })
      .addCase(searchTrips.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
        state.meta = action.payload.meta;
      })
      .addCase(searchTrips.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Không thể tải danh sách chuyến xe.';
      })
      .addCase(loadMoreTrips.pending, (state) => {
        state.isLoadingMore = true;
        state.loadMoreError = null;
      })
      .addCase(loadMoreTrips.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        const existing = new Set(state.items.map((trip) => trip.ma_chuyen));
        state.items = [
          ...state.items,
          ...action.payload.items.filter((trip) => !existing.has(trip.ma_chuyen)),
        ];
        state.meta = action.payload.meta;
      })
      .addCase(loadMoreTrips.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.loadMoreError = action.payload ?? 'Không thể tải thêm chuyến xe.';
      });
  },
});

export const selectTrips = (state: RootState) => state.trips;

export default tripsSlice.reducer;
