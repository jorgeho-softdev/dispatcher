import { store } from './index';
import { resetSettings } from './settings-slice';

// Cross-slice operations live here — the one place allowed to touch several
// slices at once, so slices never import each other.
export function resetData() {
  store.dispatch(resetSettings());
}
