import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SlotService, Slot } from './slot.service';
import { ConfirmDialog } from '../shared/confirm-dialog';

@Component({
  selector: 'app-my-slots',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, ConfirmDialog],
  templateUrl: './my-slots.html',
})
export class MySlots implements OnInit {
  private slotService = inject(SlotService);
  private formBuilder = inject(FormBuilder);

  slots = signal<Slot[]>([]);
  errorMessage = signal<string | null>(null);
  profileRequired = signal(false);
  showConfirm = signal(false);
  selectedSlot = signal<Slot | null>(null);

  slotForm = this.formBuilder.nonNullable.group({
    date: ['', Validators.required],
    startTime: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    durationMinutes: [60, [Validators.required, Validators.min(30), Validators.max(180)]],
  });

  ngOnInit(): void {
    this.slotService.getMySlots().subscribe({
      next: slots => this.slots.set(slots),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(err.error?.error ?? 'Unable to load slots.'),
    });
  }

  onSubmit(): void {
    if (this.slotForm.invalid) {
      this.slotForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.profileRequired.set(false);
    this.slotService.createSlot(this.slotForm.getRawValue()).subscribe({
      next: slot => this.slots.update(slots => [...slots, slot]),
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.error ?? 'Unable to create slot.');
        this.profileRequired.set(
          err.status === 409 &&
          err.error?.error === 'Tutor profile must be created before publishing slots',
        );
      },
    });
  }

  requestDelete(slot: Slot): void {
    if (slot.isBooked) return;
    this.selectedSlot.set(slot);
    this.showConfirm.set(true);
  }

  onConfirmed(): void {
    const slot = this.selectedSlot();
    if (!slot || slot.isBooked) return;

    this.errorMessage.set(null);
    this.slotService.deleteSlot(slot._id).subscribe({
      next: () => this.slots.update(slots => slots.filter(item => item._id !== slot._id)),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(err.error?.error ?? 'Unable to delete slot.'),
    });
  }
}
