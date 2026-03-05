import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // static routes - can be pre-rendered at build time
  {
    path: '',
    renderMode: RenderMode.Server
  },
  {
    path: 'login',
    renderMode: RenderMode.Client
  },
  {
    path: 'signup',
    renderMode: RenderMode.Client
  },
  {
    path: 'onboarding',
    renderMode: RenderMode.Client
  },
  {
    path: 'forgot-password',
    renderMode: RenderMode.Client
  },
  {
    path: 'terms',
    renderMode: RenderMode.Client
  },
  {
    path: 'profile',
    renderMode: RenderMode.Server
  },
  {
    path: 'policy',
    renderMode: RenderMode.Client
  },
  {
    path: 'leaderboard',
    renderMode: RenderMode.Client
  },
  {
    path: 'notification',
    renderMode: RenderMode.Client
  },
  {
    path: 'not-found',
    renderMode: RenderMode.Client
  },
  // dynamic routes with params - must use server-side rendering
  {
    path: 'chat-room',
    renderMode: RenderMode.Client
  },
  {
    path: 'chat-info',
    renderMode: RenderMode.Client
  },
  {
    path: 'create-group/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'post/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'event/:slug',
    renderMode: RenderMode.Server
  },
  {
    path: 'event/guests/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'group-invitation/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'event/questionnaire-response/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/questionnaire-response/guests/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/analytics/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/analytics/guests/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/rsvp-approval/:eventId',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/guests/:eventId/:section',
    renderMode: RenderMode.Client
  },
  // routes without params - can be server-rendered
  {
    path: 'event',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/edit/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/city',
    renderMode: RenderMode.Client
  },
  {
    path: 'event/all',
    renderMode: RenderMode.Client
  },
  {
    path: 'new-chat',
    renderMode: RenderMode.Client
  },
  {
    path: 'create-group',
    renderMode: RenderMode.Client
  },
  {
    path: 'profile/edit',
    renderMode: RenderMode.Client
  },
  {
    path: 'profile/preferences',
    renderMode: RenderMode.Client
  },
  {
    path: 'add-network',
    renderMode: RenderMode.Client
  },
  {
    path: 'new-post',
    renderMode: RenderMode.Client
  },
  {
    path: 'settings',
    renderMode: RenderMode.Client
  },
  {
    path: 'settings/account',
    renderMode: RenderMode.Client
  },
  {
    path: 'settings/change-account-info/:type',
    renderMode: RenderMode.Client
  },
  {
    path: 'settings/verify-otp',
    renderMode: RenderMode.Client
  },
  {
    path: 'settings/payment-history',
    renderMode: RenderMode.Client
  },
  {
    path: 'settings/permissions',
    renderMode: RenderMode.Client
  },
  {
    path: 'subscription/plans',
    renderMode: RenderMode.Client
  },
  {
    path: 'subscription/create',
    renderMode: RenderMode.Client
  },
  {
    path: 'subscription/manage/:planId',
    renderMode: RenderMode.Client
  },
  {
    path: 'subscription/user/:userId',
    renderMode: RenderMode.Client
  },
  {
    path: 'subscription/:planId',
    renderMode: RenderMode.Client
  },
  {
    path: 'subscription/:planId/events',
    renderMode: RenderMode.Client
  },
  {
    path: 'subscription/:planId/subscribers',
    renderMode: RenderMode.Client
  },
  {
    path: ':username',
    renderMode: RenderMode.Server
  },
  // catch-all for any other routes
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
