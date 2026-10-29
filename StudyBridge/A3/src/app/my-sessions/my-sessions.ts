import { Component, inject, signal, OnInit } from '@angular/core';
import { BookingService, Booking } from '../my-bookings/booking.service';

@Component({
  selector: 'app-my-sessions',
  templateUrl: './my-sessions.html',
})
export class MySessions implements OnInit {
  private bookingService = inject(BookingService);

  bookings = signal<Booking[]>([]);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.bookingService.getMyBookings().subscribe({
      next: bookings => this.bookings.set(bookings),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load sessions.'),
    });
  }

  confirm(bookingId: string): void {
    this.errorMessage.set(null);
    this.bookingService.confirmBooking(bookingId).subscribe({
      next: updated => this.bookings.update(bookings =>
        bookings.map(booking => booking._id === updated._id ? updated : booking),
      ),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to confirm booking.'),
    });
  }

  complete(bookingId: string): void {
    this.errorMessage.set(null);
    this.bookingService.completeBooking(bookingId).subscribe({
      next: updated => this.bookings.update(bookings =>
        bookings.map(booking => booking._id === updated._id ? updated : booking),
      ),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to complete booking.'),
    });
  }

  cancel(bookingId: string): void {
    this.errorMessage.set(null);
    this.bookingService.cancelBooking(bookingId).subscribe({
      next: updated => this.bookings.update(bookings =>
        bookings.map(booking => booking._id === updated._id ? updated : booking),
      ),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to cancel booking.'),
    });
  }
}
