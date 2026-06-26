import { addDays, futureDate } from '../../core/utils/dates';
import type { StaysSearchQuery } from '../types';

/**
 * Builder for stays search queries. Defaults produce a valid near-future
 * search so tests only override what they actually assert on:
 *
 *   const query = new StaysQueryBuilder().withDestination('Paris').withNights(5).build();
 */
export class StaysQueryBuilder {
  private destination = 'Belgrade';
  private checkInOffsetDays = 30;
  private nights = 3;
  private adults = 2;
  private children = 0;
  private rooms = 1;

  withDestination(destination: string): this {
    this.destination = destination;
    return this;
  }

  withCheckInOffset(daysFromNow: number): this {
    this.checkInOffsetDays = daysFromNow;
    return this;
  }

  withNights(nights: number): this {
    this.nights = nights;
    return this;
  }

  withAdults(adults: number): this {
    this.adults = adults;
    return this;
  }

  withChildren(children: number): this {
    this.children = children;
    return this;
  }

  withRooms(rooms: number): this {
    this.rooms = rooms;
    return this;
  }

  build(): StaysSearchQuery {
    const checkIn = futureDate(this.checkInOffsetDays);
    return {
      destination: this.destination,
      checkIn,
      checkOut: addDays(checkIn, this.nights),
      adults: this.adults,
      children: this.children,
      rooms: this.rooms,
    };
  }
}
