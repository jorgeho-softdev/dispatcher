import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EquipmentType } from '@dispatcher/shared';

interface UiState {
  loadsEquipmentFilter: EquipmentType | 'all';
  showSimulated: boolean;
}

const initialState: UiState = {
  loadsEquipmentFilter: 'all',
  showSimulated: true,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoadsEquipmentFilter(state, action: PayloadAction<UiState['loadsEquipmentFilter']>) {
      state.loadsEquipmentFilter = action.payload;
    },
    setShowSimulated(state, action: PayloadAction<boolean>) {
      state.showSimulated = action.payload;
    },
  },
  selectors: {
    selectLoadsEquipmentFilter: (s) => s.loadsEquipmentFilter,
    selectShowSimulated: (s) => s.showSimulated,
  },
});

export const { setLoadsEquipmentFilter, setShowSimulated } = uiSlice.actions;
export const { selectLoadsEquipmentFilter, selectShowSimulated } = uiSlice.selectors;
