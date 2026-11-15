import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index';

// Always use these typed hooks instead of the plain react-redux ones.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
