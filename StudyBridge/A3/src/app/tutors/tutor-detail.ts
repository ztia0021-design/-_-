import { Component, inject, input, effect, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TutorService, TutorProfile, Subject } from './tutor.service';
import { AuthService } from '../auth/auth.service';
import { BookingService } from '../my-bookings/booking.service';
import { CostPreview } from '../cost-preview/cost-preview';
import { SocketService } from '../shared/socket.service';

@Component({
  selector: 'app-tutor-detail',
  imports: [DatePipe, ReactiveFormsModule, CostPreview],
  templateUrl: './tutor-detail.html',
})
export class TutorDetail implements OnInit {
  private tutorService = inject(TutorService);
  private socketService = inject(SocketService);
  private bookingService = inject(BookingService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  protected auth = inject(AuthService);

  userId = input.required<string>();
  tutor = signal<TutorProfile | null>(null);
  errorMessage = signal<string | null>(null);
  subjects = signal<Subject[]>([]);
  bookingError = signal<string | null>(null);
  lostRace = signal(false);
  refreshingSlots = signal(false);

  tutorSubjects = computed(() => {
    const names = this.tutor()?.subjects.map(name => name.toLowerCase()) ?? [];
    return this.subjects().filter(subject => names.includes(subject.name.toLowerCase()));
  });

  bookingForm = this.formBuilder.nonNullable.group({
    slotId: ['', Validators.required],
    subjectId: ['', Validators.required],
  });

  constructor() {

    effect(() => {
      const event = this.socketService.slotBooked();
      if (!event || event.tutorId !== this.userId()) return;

      this.tutor.update(tutor => tutor ? {
        ...tutor,
        availableSlots: tutor.availableSlots.filter(slot => slot._id !== event.slotId),
      } : null);

      if (this.bookingForm.controls.slotId.value === event.slotId) {
        this.bookingForm.controls.slotId.reset();
      }
    });

    effect((onCleanup) => {
      const event = this.socketService.slotFreed();
      if (!event || event.tutorId !== this.userId()) return;

      const request = this.tutorService.getTutor(this.userId()).subscribe({
        next: tutor => this.tutor.set(tutor),
        error: err => this.errorMessage.set(err.error?.error ?? 'Unable to refresh slots.'),
      });
      onCleanup(() => request.unsubscribe());
    });

    effect((onCleanup) => {
      this.tutor.set(null);
      this.errorMessage.set(null);
      this.bookingError.set(null);
      this.lostRace.set(false);
      this.bookingForm.reset();

      const request = this.tutorService.getTutor(this.userId()).subscribe({
        next: tutor => this.tutor.set(tutor),
        error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load tutor.'),
      });
      onCleanup(() => request.unsubscribe());
    });
  }

  ngOnInit(): void {
    if (this.auth.currentUser()?.role !== 'learner') return;

    this.tutorService.getSubjects().subscribe({
      next: subjects => this.subjects.set(subjects),
      error: err => this.bookingError.set(err.error?.error ?? 'Unable to load subjects.'),
    });
  }

  onBook(): void {
    if (this.auth.currentUser()?.role !== 'learner' || this.refreshingSlots()) return;
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.bookingError.set(null);
    this.lostRace.set(false);
    this.bookingService.createBooking(this.bookingForm.getRawValue()).subscribe({
      next: () => this.router.navigate(['/my-bookings'], {
        queryParams: { booked: 'true' },
      }),
      error: err => {
        this.bookingError.set(err.error?.error ?? 'Unable to create booking.');
        if (err.status === 409) {
          this.lostRace.set(true);
          this.bookingForm.controls.slotId.reset();
          this.refreshSlots();
        }
      },
    });
  }

  private refreshSlots(): void {
    this.refreshingSlots.set(true);
    this.tutorService.getTutor(this.userId()).subscribe({
      next: tutor => {
        this.tutor.set(tutor);
        this.refreshingSlots.set(false);
      },
      error: err => {
        this.refreshingSlots.set(false);
        this.bookingError.set(err.error?.error ?? 'Unable to refresh slots.');
      },
    });
  }
}
