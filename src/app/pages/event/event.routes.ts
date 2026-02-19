import { Routes } from '@angular/router';
import { Event } from '@/pages/event/event';
import { EventQr } from '@/pages/event/event-qr';
import { GuestList } from '@/pages/event/guest-list';
import { AllEvents } from '@/pages/home/all-events';
import { CityEvents } from '@/pages/home/city-events';
import { CreateEvent } from '@/pages/event/create-event';
import { RsvpApproval } from '@/pages/event/rsvp-approval';
import { EventAnalytics } from '@/pages/event/event-analytics';
import { EventUserList } from '@/pages/event/components/event-user-list';
import { QuestionnaireResponse } from '@/pages/event/questionnaire-response';
import { AnalyticsUserList } from '@/pages/event/components/analytics-user-list';
import { QuestionnaireUserList } from '@/pages/event/components/questionnaire-user-list';
import { authGuard } from '@/guards/auth.guard';
import { LeaveGuard } from '@/guards/leave.guard';

export default [
  { path: '', component: CreateEvent, canActivate: [authGuard], canDeactivate: [LeaveGuard] },

  { path: 'all', component: AllEvents },
  { path: 'city', component: CityEvents },
  { path: 'edit/:id', component: CreateEvent, canActivate: [authGuard], canDeactivate: [LeaveGuard] },
  { path: 'guests/:id', component: GuestList, canActivate: [authGuard] },
  { path: 'analytics/:id', component: EventAnalytics, canActivate: [authGuard] },
  { path: 'analytics/guests/:id', component: AnalyticsUserList, canActivate: [authGuard] },
  { path: 'questionnaire-response/:id', component: QuestionnaireResponse, canActivate: [authGuard] },
  { path: 'questionnaire-response/guests/:id', component: QuestionnaireUserList, canActivate: [authGuard] },
  { path: 'rsvp-approval/:eventId', component: RsvpApproval, canActivate: [authGuard] },
  { path: 'guests/:eventId/:section', component: EventUserList, canActivate: [authGuard] },

  { path: ':slug', component: Event }
] as Routes;
