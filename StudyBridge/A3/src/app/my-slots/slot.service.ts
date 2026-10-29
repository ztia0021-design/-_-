import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Slot {
  _id: string;
  tutorId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  isBooked: boolean;
}

export interface SlotPayload {
  date: string;
  startTime: string;
  durationMinutes: number;
}

@Injectable({ providedIn: 'root' })
export class SlotService {
  private http = inject(HttpClient);

  getMySlots(): Observable<Slot[]> {
    return this.http.get<Slot[]>(environment.apiBaseUrl + '/slots/mine');
  }

  createSlot(payload: SlotPayload): Observable<Slot> {
    return this.http.post<Slot>(environment.apiBaseUrl + '/slots', payload);
  }

  deleteSlot(slotId: string): Observable<unknown> {
    return this.http.delete(environment.apiBaseUrl + '/slots/' + slotId);
  }
}
