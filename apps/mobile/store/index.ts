import { combineSlices, configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { dispatcherApi } from './api';
import { alertSlice } from './alert-slice';
import { authSlice, meUpdated, sessionStarted } from './auth-slice';
import { persistSettingsState, settingsSlice } from './settings-slice';

// Redux Toolkit store. Conventions (docs/conventions.md#state-management):
//  - Server data → RTK Query (dispatcherApi from @dispatcher/api-client).
//  - Client state → one slice per domain with co-located selectors.
//  - Side effects → thunks (store/session.ts) or the listener middleware.
const rootReducer = combineSlices(dispatcherApi, settingsSlice, alertSlice, authSlice);

const listener = createListenerMiddleware();

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(dispatcherApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// Persist the settings slice to MMKV whenever it changes.
listener.startListening.withTypes<RootState, AppDispatch>()({
  predicate: (_action, current, previous) => current.settings !== previous.settings,
  effect: (_action, api) => persistSettingsState(api.getState().settings),
});

// Keep the user's profile language in sync with the app language, so
// server-side messages (push, email — later phases) use it too. Runs when the
// language changes while signed in, and right after signing in.
listener.startListening.withTypes<RootState, AppDispatch>()({
  predicate: (action, current, previous) =>
    current.auth.status === 'signedIn' &&
    (sessionStarted.match(action) || current.settings.settings.language !== previous.settings.settings.language),
  effect: async (_action, api) => {
    const { settings, auth } = api.getState();
    const locale = settings.settings.language;
    if (auth.me?.user.locale === locale) return;
    const result = await api.dispatch(dispatcherApi.endpoints.updateMe.initiate({ locale }));
    if (result.data) api.dispatch(meUpdated(result.data));
  },
});

// Refetch on app focus / reconnect.
setupListeners(store.dispatch);
