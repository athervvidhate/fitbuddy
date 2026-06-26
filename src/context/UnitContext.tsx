import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WeightUnit = 'kg' | 'lbs';
export type DistanceUnit = 'km' | 'mi';
export type LengthUnit = 'cm' | 'in';

type UnitContextType = {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  lengthUnit: LengthUnit;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setDistanceUnit: (unit: DistanceUnit) => Promise<void>;
  setLengthUnit: (unit: LengthUnit) => Promise<void>;
  // Conversion and formatting helpers
  formatWeight: (weightInKg: number, showSymbol?: boolean) => string;
  formatDistance: (distanceInKm: number, showSymbol?: boolean) => string;
  formatLength: (lengthInCm: number, showSymbol?: boolean) => string;
  parseWeightInput: (inputVal: number) => number; // Converts display value to standard kg
  parseDistanceInput: (inputVal: number) => number; // Converts display value to standard km
  displayWeightValue: (weightInKg: number) => number; // Returns raw display number
};

const UnitContext = createContext<UnitContextType | undefined>(undefined);

const WEIGHT_KEY = '@fitbuddy_unit_weight';
const DISTANCE_KEY = '@fitbuddy_unit_distance';
const LENGTH_KEY = '@fitbuddy_unit_length';

const KG_TO_LBS = 2.20462;
const KM_TO_MI = 0.621371;
const CM_TO_IN = 0.393701;

// Helper to detect default units based on device locale (Hermes Intl API)
const getDefaultUnits = () => {
  let weight: WeightUnit = 'kg';
  let distance: DistanceUnit = 'km';
  let length: LengthUnit = 'cm';

  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const parts = locale.split(/[-_]/);
    const countryCode = parts[parts.length - 1]?.toUpperCase() || '';
    
    if (countryCode === 'US') {
      weight = 'lbs';
      distance = 'mi';
      length = 'in';
    }
  } catch (e) {
    console.warn('Failed to detect device locale, defaulting to metric:', e);
  }

  return { weight, distance, length };
};

const defaultUnits = getDefaultUnits();

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>(defaultUnits.weight);
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>(defaultUnits.distance);
  const [lengthUnit, setLengthUnitState] = useState<LengthUnit>(defaultUnits.length);

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const [w, d, l] = await Promise.all([
          AsyncStorage.getItem(WEIGHT_KEY),
          AsyncStorage.getItem(DISTANCE_KEY),
          AsyncStorage.getItem(LENGTH_KEY),
        ]);
        if (w) setWeightUnitState(w as WeightUnit);
        if (d) setDistanceUnitState(d as DistanceUnit);
        if (l) setLengthUnitState(l as LengthUnit);
      } catch (e) {
        console.error('Failed to load units settings', e);
      }
    };
    loadUnits();
  }, []);

  const setWeightUnit = async (unit: WeightUnit) => {
    setWeightUnitState(unit);
    await AsyncStorage.setItem(WEIGHT_KEY, unit);
  };

  const setDistanceUnit = async (unit: DistanceUnit) => {
    setDistanceUnitState(unit);
    await AsyncStorage.setItem(DISTANCE_KEY, unit);
  };

  const setLengthUnit = async (unit: LengthUnit) => {
    setLengthUnitState(unit);
    await AsyncStorage.setItem(LENGTH_KEY, unit);
  };

  // Helper: Format weight for display
  const formatWeight = (weightInKg: number, showSymbol = true): string => {
    if (weightUnit === 'lbs') {
      const val = weightInKg * KG_TO_LBS;
      return `${Math.round(val * 10) / 10}${showSymbol ? ' lbs' : ''}`;
    }
    return `${Math.round(weightInKg * 10) / 10}${showSymbol ? ' kg' : ''}`;
  };

  // Helper: Get raw display number
  const displayWeightValue = (weightInKg: number): number => {
    if (weightUnit === 'lbs') {
      return Math.round((weightInKg * KG_TO_LBS) * 10) / 10;
    }
    return Math.round(weightInKg * 10) / 10;
  };

  // Helper: Format distance for display
  const formatDistance = (distanceInKm: number, showSymbol = true): string => {
    if (distanceUnit === 'mi') {
      const val = distanceInKm * KM_TO_MI;
      return `${Math.round(val * 100) / 100}${showSymbol ? ' mi' : ''}`;
    }
    return `${Math.round(distanceInKm * 100) / 100}${showSymbol ? ' km' : ''}`;
  };

  // Helper: Format length for display
  const formatLength = (lengthInCm: number, showSymbol = true): string => {
    if (lengthUnit === 'in') {
      const val = lengthInCm * CM_TO_IN;
      return `${Math.round(val * 10) / 10}${showSymbol ? ' in' : ''}`;
    }
    return `${Math.round(lengthInCm * 10) / 10}${showSymbol ? ' cm' : ''}`;
  };

  // Helper: Convert displayed weight back to database kilograms
  const parseWeightInput = (inputVal: number): number => {
    if (weightUnit === 'lbs') {
      return inputVal / KG_TO_LBS;
    }
    return inputVal;
  };

  // Helper: Convert displayed distance back to database kilometers
  const parseDistanceInput = (inputVal: number): number => {
    if (distanceUnit === 'mi') {
      return inputVal / KM_TO_MI;
    }
    return inputVal;
  };

  return (
    <UnitContext.Provider
      value={{
        weightUnit,
        distanceUnit,
        lengthUnit,
        setWeightUnit,
        setDistanceUnit,
        setLengthUnit,
        formatWeight,
        formatDistance,
        formatLength,
        parseWeightInput,
        parseDistanceInput,
        displayWeightValue,
      }}
    >
      {children}
    </UnitContext.Provider>
  );
};

export const useUnits = () => {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error('useUnits must be used within a UnitProvider');
  }
  return context;
};
