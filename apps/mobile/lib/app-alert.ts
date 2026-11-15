import { store } from '@/store';
import { alertHidden, alertShown, type AppAlertButtonView } from '@/store/alert-slice';

export interface AppAlertButton extends AppAlertButtonView {
  onPress?: () => void;
}

// Callbacks aren't serializable, so they stay out of Redux, keyed by alert id.
let nextId = 1;
const callbacks = new Map<number, (AppAlertButton['onPress'] | undefined)[]>();

// Drop-in replacement for React Native's Alert.alert — same (title, message?,
// buttons?) signature — rendered by the themed AppAlertHost. Callable from
// anywhere, not just components.
export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]): void {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  const id = nextId++;
  callbacks.clear();
  callbacks.set(id, list.map((b) => b.onPress));
  store.dispatch(
    alertShown({ id, title, message, buttons: list.map(({ text, style }) => ({ text, style })) }),
  );
}

/** Called by AppAlertHost when a button is pressed. */
export function pressAlertButton(alertId: number, index: number): void {
  const onPress = callbacks.get(alertId)?.[index];
  callbacks.delete(alertId);
  store.dispatch(alertHidden());
  onPress?.();
}
