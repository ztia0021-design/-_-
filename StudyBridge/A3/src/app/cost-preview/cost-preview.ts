import { Component, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface CostBreakdown {
  subtotal: number;
  platformFee: number;
  total: number;
}

@Component({
  selector: 'app-cost-preview',
  templateUrl: './cost-preview.html',
})
export class CostPreview {
  private http = inject(HttpClient);

  agreedRate = input.required<number>();
  durationMinutes = input.required<number>();
  cost = signal<CostBreakdown | null>(null);
  errorMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.agreedRate();
      this.durationMinutes();
      this.cost.set(null);
      this.errorMessage.set(null);
    });
  }

  calculateCost(): void {
    const agreedRate = this.agreedRate();
    const durationMinutes = this.durationMinutes();
    this.cost.set(null);
    this.errorMessage.set(null);

    this.http.post<CostBreakdown>(environment.costServiceUrl + '/calculate-cost', {
      agreedRate,
      durationMinutes,
    }).subscribe({
      next: cost => {
        if (agreedRate === this.agreedRate() && durationMinutes === this.durationMinutes()) {
          this.cost.set(cost);
        }
      },
      error: err => this.errorMessage.set(err.error?.error ?? 'Unable to calculate cost.'),
    });
  }
}
