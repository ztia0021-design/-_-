import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingService, Review } from './booking.service';

@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule],
  templateUrl: './review-form.html',
})
export class ReviewForm {
  private bookingService = inject(BookingService);
  private formBuilder = inject(FormBuilder);

  bookingId = input.required<string>();
  submittedReview = signal<Review | null>(null);
  reviewBlocked = signal(false);
  errorMessage = signal<string | null>(null);

  reviewForm = this.formBuilder.nonNullable.group({
    rating: [5, [
      Validators.required,
      Validators.min(1),
      Validators.max(5),
      Validators.pattern(/^[1-5]$/),
    ]],
    comment: ['', Validators.maxLength(500)],
  });

  onSubmit(): void {
    if (this.submittedReview() || this.reviewBlocked()) 
      return;
    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.bookingService.submitReview(this.bookingId(), this.reviewForm.getRawValue())
    .subscribe({
      next: review => this.submittedReview.set(review),
      error: err => {
        this.errorMessage.set(err.error?.error ?? 'Unable to submit review.');
        if (err.status === 409) {
          this.reviewBlocked.set(true);
        }
      },
    });
  }
}
