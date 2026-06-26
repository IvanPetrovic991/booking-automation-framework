import type { AttractionsQuery, CarRentalQuery, FlightRoute } from './types';

/**
 * Central, named test data. Tests reference these by intent
 * (FLIGHT_ROUTES.europeanShortHaul) instead of hardcoding strings, so a
 * data change is a one-line edit here.
 */

export const DESTINATIONS = {
  capital: 'Belgrade',
  mediterranean: 'Barcelona',
  cityBreak: 'Paris',
  longHaul: 'New York',
} as const;

// `satisfies` (instead of a Record annotation) keeps the literal keys, so a
// typo'd lookup is a compile error rather than a runtime undefined — this is
// what makes noUncheckedIndexedAccess actually bite in specs.
export const FLIGHT_ROUTES = {
  europeanShortHaul: {
    fromQuery: 'BEG',
    fromMatch: 'Belgrade',
    toQuery: 'LHR',
    toMatch: 'Heathrow',
  },
  transatlantic: {
    fromQuery: 'LHR',
    fromMatch: 'Heathrow',
    toQuery: 'JFK',
    toMatch: 'John F. Kennedy',
  },
} satisfies Record<string, FlightRoute>;

export const CAR_RENTAL_QUERIES = {
  belgradeAirport: {
    pickupLocation: 'Belgrade Airport',
    pickupMatch: 'Belgrade',
  },
  barcelonaCity: {
    pickupLocation: 'Barcelona',
    pickupMatch: 'Barcelona',
  },
} satisfies Record<string, CarRentalQuery>;

export const ATTRACTIONS_QUERIES = {
  paris: {
    destination: 'Paris',
    destinationMatch: 'Paris',
  },
} satisfies Record<string, AttractionsQuery>;
