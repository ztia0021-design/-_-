import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TutorService, Subject, TutorSummary } from './tutor.service';
import { TutorCard } from './tutor-card';

@Component({
  selector: 'app-tutor-search',
  imports: [ReactiveFormsModule, TutorCard],
  templateUrl: './tutor-search.html',
})
export class TutorSearch implements OnInit {
  private tutorService = inject(TutorService);
  private formBuilder = inject(FormBuilder);

  subjects = signal<Subject[]>([]);
  tutors = signal<TutorSummary[]>([]);
  errorMessage = signal<string | null>(null);

  searchForm = this.formBuilder.nonNullable.group({
    subject: [''],
    minPrice: this.formBuilder.control<number | null>(null),
    maxPrice: this.formBuilder.control<number | null>(null),
    minRating: this.formBuilder.control<number | null>(null),
    availableThisWeek: [false],
  });

  ngOnInit(): void {
    this.onSubmit();
    this.tutorService.getSubjects().subscribe({
      next: subjects => this.subjects.set(subjects),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load subjects.'),
    });
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    this.tutorService.searchTutors(this.searchForm.getRawValue()).subscribe({
      next: tutors => this.tutors.set(tutors),
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to load tutors.'),
    });
  }
}
