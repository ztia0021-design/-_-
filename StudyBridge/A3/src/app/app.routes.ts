import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { Dashboard } from './dashboard/dashboard';
import { authGuard } from './auth/auth.guard';
import { learnerGuard } from './auth/learner.guard';
import { tutorGuard } from './auth/tutor.guard';
import { TutorSearch } from './tutors/tutor-search';
import { TutorDetail } from './tutors/tutor-detail';
import { MyProfile } from './my-profile/my-profile';
import { MySlots } from './my-slots/my-slots';
import { MyBookings } from './my-bookings/my-bookings';
import { MySessions } from './my-sessions/my-sessions';
import { NotFound } from './not-found/not-found';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'tutors', component: TutorSearch, canActivate: [authGuard] },
  { path: 'tutors/:userId', component: TutorDetail, canActivate: [authGuard] },
  { path: 'my-profile', component: MyProfile, canActivate: [authGuard, tutorGuard] },
  { path: 'my-slots', component: MySlots, canActivate: [authGuard, tutorGuard] },
  { path: 'my-bookings', component: MyBookings, canActivate: [authGuard, learnerGuard] },
  { path: 'my-sessions', component: MySessions, canActivate: [authGuard, tutorGuard] },
  { path: '**', component: NotFound },
];
