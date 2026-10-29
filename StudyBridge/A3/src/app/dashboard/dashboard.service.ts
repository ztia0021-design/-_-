import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Booking {
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
}

export interface Slot {
  isBooked: boolean;
}

export interface Subject {
  _id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  getBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(environment.apiBaseUrl + '/bookings/mine');
  }

  getSlots(): Observable<Slot[]> {
    return this.http.get<Slot[]>(environment.apiBaseUrl + '/slots/mine');
  }

  getSubjects(): Observable<Subject[]> {
    return this.http.get<Subject[]>(environment.apiBaseUrl + '/subjects');
  }
}
