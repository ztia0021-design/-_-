import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TutorSummary } from './tutor.service';

@Component({
  selector: 'app-tutor-card',
  imports: [RouterLink],
  template: `
    <article>
      <h2><a [routerLink]="['/tutors', tutor().userId]">{{ tutor().fullName }}</a></h2>
      <p>{{ tutor().bio }}</p>
      <p>Rate: $ {{ tutor().hourlyRate }} per hour</p>
      <h3>Subjects</h3>
      <ul>
        @for (subject of tutor().subjects; track subject) {
          <li>{{ subject }}</li>
        }
      </ul>
      @if (tutor().averageRating === null) {
        <p>No ratings yet</p>
      } @else {
        <p>Rating: {{ tutor().averageRating }} / 5</p>
      }
    </article>
  `,
})
export class TutorCard {
  tutor = input.required<TutorSummary>();
}
