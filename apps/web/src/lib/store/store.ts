import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { dispatcherApi } from './api';
import { uiSlice } from './ui-slice';

// Server state lives in RTK Query (dispatcherApi); slices hold only client
// UI state. See docs/conventions.md#state-management.
const rootReducer = combineSlices(dispatcherApi, uiSlice);

/**
 * A new store per request/tab — never a module-level singleton — so state
 * can't leak between users during SSR (official Redux + App Router pattern).
 */
export function makeStore() {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault().concat(dispatcherApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
