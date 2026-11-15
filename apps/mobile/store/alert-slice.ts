import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Only serializable data lives in Redux. Button callbacks are kept outside
// the store, keyed by alert id (see lib/app-alert.ts).
export interface AppAlertButtonView {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertView {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButtonView[];
}

interface AlertState {
  // A single slot, not a queue — a new alert replaces the current one.
  current: AppAlertView | null;
}

const initialState: AlertState = { current: null };

export const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    alertShown(state, action: PayloadAction<AppAlertView>) {
      state.current = action.payload;
    },
    alertHidden(state) {
      state.current = null;
    },
  },
  selectors: {
    selectCurrentAlert: (s) => s.current,
  },
});

export const { alertShown, alertHidden } = alertSlice.actions;
export const { selectCurrentAlert } = alertSlice.selectors;
