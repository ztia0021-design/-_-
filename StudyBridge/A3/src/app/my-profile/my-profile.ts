import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { TutorService, Subject } from '../tutors/tutor.service';

@Component({
  selector: 'app-my-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './my-profile.html',
})
export class MyProfile implements OnInit {
  private auth = inject(AuthService);
  private tutorService = inject(TutorService);
  private formBuilder = inject(FormBuilder);

  subjects = signal<Subject[]>([]);
  profileExists = signal(false);
  ready = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  profileForm = this.formBuilder.nonNullable.group({
    bio: ['', Validators.maxLength(500)],
    hourlyRate: [5, [Validators.required, Validators.min(5), Validators.max(200)]],
    subjects: this.formBuilder.nonNullable.control<string[]>([], Validators.required),
  });

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.tutorService.getSubjects().subscribe({
      next: subjects => {
        this.subjects.set(subjects);
        this.loadProfile(user.userId);
      },
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(err.error?.error ?? 'Unable to load subjects.'),
    });
  }

  private loadProfile(userId: string): void {
    this.tutorService.getTutor(userId).subscribe({
      next: profile => {
        const subjectNames = profile.subjects.map(name => name.toLowerCase());
        const subjectIds = this.subjects()
          .filter(subject => subjectNames.includes(subject.name.toLowerCase()))
          .map(subject => subject._id);

        this.profileForm.setValue({
          bio: profile.bio ?? '',
          hourlyRate: profile.hourlyRate,
          subjects: subjectIds,
        });
        this.profileExists.set(true);
        this.ready.set(true);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.ready.set(true);
        } else {
          this.errorMessage.set(err.error?.error ?? 'Unable to load profile.');
        }
      },
    });
  }

  onSubmit(): void {
    if (!this.ready()) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    const payload = this.profileForm.getRawValue();
    const request = this.profileExists()
      ? this.tutorService.updateProfile(payload)
      : this.tutorService.createProfile(payload);

    request.subscribe({
      next: () => {
        this.profileExists.set(true);
        this.successMessage.set('Profile saved.');
      },
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(err.error?.error ?? 'Unable to save profile.'),
    });
  }
}
