import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { passwordComplexity } from '../password.validator';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private auth = inject(AuthService);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);

  errorMessage = signal<string | null>(null);

  registerForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordComplexity]],
    role: this.formBuilder.nonNullable.control<'learner' | 'tutor'>('learner', Validators.required),
  });

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.auth.register(this.registerForm.getRawValue()).subscribe({
      next: () => this.router.navigate(['/login'], {
        queryParams: { registered: 'true' },
      }),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(err.error?.error ?? 'Some place went wrong. Please try again.'),
    });
  }
}
