import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Booking {
  _id: string;
  learnerId: string;
  tutorId: string;
  subjectId: string;
  slotId: string;
  agreedRate: number;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  createdDate: string;
}

export interface Review {
  rating: number;
  comment?: string;
}

export interface BookingPayload {
  slotId: string;
  subjectId: string;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);
  createBooking(payload: BookingPayload): Observable<unknown> {
    return this.http.post(environment.apiBaseUrl + '/bookings', payload);
  }

  getMyBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(environment.apiBaseUrl + '/bookings/mine');
  }

  confirmBooking(bookingId: string): Observable<Booking> {
    return this.http.patch<Booking>(environment.apiBaseUrl + '/bookings/' + bookingId + '/confirm',{});
  }
  completeBooking(bookingId: string): Observable<Booking> {
    return this.http.patch<Booking>(environment.apiBaseUrl + '/bookings/' + bookingId + '/complete', {});
  }
  cancelBooking(bookingId: string): Observable<Booking> {
    return this.http.patch<Booking>(environment.apiBaseUrl + '/bookings/' + bookingId + '/cancel', {});
  }

  submitReview(bookingId: string, payload: Review): Observable<Review> {
    return this.http.post<Review>(environment.apiBaseUrl + '/bookings/' + bookingId + '/review', payload);
  }
}
