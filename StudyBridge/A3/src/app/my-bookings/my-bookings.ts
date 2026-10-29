import { Component, inject, input, signal, OnInit } from '@angular/core';
import { BookingService, Booking } from './booking.service';
import { ReviewForm } from './review-form';

@Component({
  selector: 'app-my-bookings',
  imports: [ReviewForm],
  templateUrl: './my-bookings.html',
})
export class MyBookings implements OnInit {
  private bookingService = inject(BookingService);

  booked = input<string>();
  myBookings = signal<Booking[]>([]);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.bookingService.getMyBookings().subscribe({
      next: bookings => this.myBookings.set(bookings),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load bookings.'),
    });
  }

  cancel(bookingId: string): void {
    this.errorMessage.set(null);
    this.bookingService.cancelBooking(bookingId).subscribe({
      next: updated => this.myBookings.update(bookings =>
        bookings.map(booking => booking._id === updated._id ? updated : booking),
      ),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to cancel booking.'),
    });
  }
}
