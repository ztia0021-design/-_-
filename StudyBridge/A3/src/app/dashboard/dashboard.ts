import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { DashboardService, Booking, Slot, Subject } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit, OnDestroy {
  protected auth = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private router = inject(Router);

  bookings = signal<Booking[]>([]);
  slots = signal<Slot[]>([]);
  subjects = signal<Subject[]>([]);
  errorMessage = signal<string | null>(null);

  bookingSummary = computed(() => [
    { status: 'requested', count: this.bookings().filter(b => b.status === 'requested').length },
    { status: 'confirmed', count: this.bookings().filter(b => b.status === 'confirmed').length },
    { status: 'completed', count: this.bookings().filter(b => b.status === 'completed').length },
    { status: 'cancelled', count: this.bookings().filter(b => b.status === 'cancelled').length },
  ]);

  openSlotCount = computed(() => this.slots().filter(slot => !slot.isBooked).length);
  subjectCount = computed(() => this.subjects().length);

  private refreshTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.loadStatistics();
    this.refreshTimer = setInterval(() => this.loadStatistics(), 30000);
  }

  loadStatistics(): void {
    const role = this.auth.currentUser()?.role;
    this.errorMessage.set(null);

    if (role === 'learner' || role === 'tutor') {
      this.dashboardService.getBookings().subscribe({
        next: bookings => this.bookings.set(bookings),
        error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load bookings.'),
      });
    }

    if (role === 'tutor') {
      this.dashboardService.getSlots().subscribe({
        next: slots => this.slots.set(slots),
        error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load slots.'),
      });
    }

    if (role === 'admin') {
      this.dashboardService.getSubjects().subscribe({
        next: subjects => this.subjects.set(subjects),
        error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load subjects.'),
      });
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
  }

  logout(): void {
    clearInterval(this.refreshTimer);
    this.auth.logout().pipe(
      finalize(() => this.router.navigate(['/login'])),
    ).subscribe({
      error: () => {
        
      },
    });
  }
}
