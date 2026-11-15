import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EquipmentType, LoadView } from '@dispatcher/shared';

interface UiState {
  loadsView: LoadView;
  loadsEquipmentFilter: EquipmentType | 'all';
  showSimulated: boolean;
}

const initialState: UiState = {
  loadsView: 'recommended',
  loadsEquipmentFilter: 'all',
  showSimulated: true,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoadsView(state, action: PayloadAction<LoadView>) {
      state.loadsView = action.payload;
    },
    setLoadsEquipmentFilter(state, action: PayloadAction<UiState['loadsEquipmentFilter']>) {
      state.loadsEquipmentFilter = action.payload;
    },
    setShowSimulated(state, action: PayloadAction<boolean>) {
      state.showSimulated = action.payload;
    },
  },
  selectors: {
    selectLoadsView: (s) => s.loadsView,
    selectLoadsEquipmentFilter: (s) => s.loadsEquipmentFilter,
    selectShowSimulated: (s) => s.showSimulated,
  },
});

export const { setLoadsView, setLoadsEquipmentFilter, setShowSimulated } = uiSlice.actions;
export const { selectLoadsView, selectLoadsEquipmentFilter, selectShowSimulated } = uiSlice.selectors;
