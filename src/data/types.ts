export interface StaysSearchQuery {
  destination: string;
  /** ISO date YYYY-MM-DD */
  checkIn: string;
  /** ISO date YYYY-MM-DD */
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
}

export interface FlightRoute {
  /** IATA code typed into the origin field, e.g. `BEG`. */
  fromQuery: string;
  /** Text expected in the matching autocomplete option, e.g. `Belgrade`. */
  fromMatch: string;
  toQuery: string;
  toMatch: string;
}

export interface CarRentalQuery {
  /** Text typed into the pick-up location field. */
  pickupLocation: string;
  /** Text expected in the matching autocomplete option. */
  pickupMatch: string;
}

export interface AttractionsQuery {
  destination: string;
  destinationMatch: string;
}
