import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Subject {
  _id: string;
  name: string;
}

export interface TutorSummary {
  userId: string;
  fullName: string;
  bio: string;
  hourlyRate: number;
  subjects: string[];
  averageRating: number | null;
  reviewCount: number;
}

export interface TutorProfile {
  fullName: string;
  bio: string;
  hourlyRate: number;
  subjects: string[];
  averageRating: number | null;
  reviewCount: number;
  availableSlots: {
    _id: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    isBooked: boolean;
  }[];
  reviews: {
    _id: string;
    rating: number;
    comment?: string;
    createdDate: string;
  }[];
}



export interface TutorFilters {
  subject?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  availableThisWeek?: boolean;
}

export interface ProfilePayload {
  bio: string;
  hourlyRate: number;
  subjects: string[];
}

@Injectable({ providedIn: 'root' })
export class TutorService {
  private http = inject(HttpClient);
  private subjectCatalogue = signal<Subject[] | null>(null);

  getSubjects(): Observable<Subject[]> {
    const subjects = this.subjectCatalogue();
    if (subjects !== null) {
      return of(subjects);
    }

    return this.http.get<Subject[]>(environment.apiBaseUrl + '/subjects').pipe(
      tap(subjects => this.subjectCatalogue.set(subjects)),
    );
  }

  searchTutors(filters: TutorFilters = {}): Observable<TutorSummary[]> {
    let params = new HttpParams();

    if (filters.subject) {
      params = params.set('subject', filters.subject);
    }
    if (filters.minPrice !== null && filters.minPrice !== undefined) {
      params = params.set('minPrice', filters.minPrice);
    }
    if (filters.maxPrice !== null && filters.maxPrice !== undefined) {
      params = params.set('maxPrice', filters.maxPrice);
    }
    if (filters.minRating !== null && filters.minRating !== undefined) {
      params = params.set('minRating', filters.minRating);
    }
    if (filters.availableThisWeek) {
      params = params.set('availableThisWeek', 'true');
    }

    return this.http.get<TutorSummary[]>(environment.apiBaseUrl + '/tutors/search', { params });
  }

  getTutor(userId: string): Observable<TutorProfile> {
    return this.http.get<TutorProfile>(environment.apiBaseUrl + '/tutors/' + userId);
  }

  createProfile(payload: ProfilePayload): Observable<unknown> {
    return this.http.post(environment.apiBaseUrl + '/tutors/profile', payload);
  }

  updateProfile(payload: ProfilePayload): Observable<unknown> {
    return this.http.put(environment.apiBaseUrl + '/tutors/profile', payload);
  }
}
