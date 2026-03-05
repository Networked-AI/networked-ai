import { Home } from '@/pages/home';
import { Routes } from '@angular/router';
import { Messages } from '@/pages/messages';
import { NotFound } from '@/pages/not-found';
import { TabLayout } from '@/layout/tab-layout';
import { Profile } from '@/pages/profile/profile';
import { Network } from '@/pages/network/network';
import { authGuard } from '@/guards/auth.guard';
import { onboardingGuard } from '@/guards/onboarding.guard';

export const appRoutes: Routes = [
  {
    path: '',
    component: TabLayout,
    canActivate: [onboardingGuard],
    children: [
      { path: '', component: Home },
      { path: 'profile', component: Profile },
      { path: 'network', component: Network },
      { path: 'messages', component: Messages }
    ]
  },
  { path: 'profile', loadChildren: () => import('@/pages/profile/profile.routes') },
  { path: 'event', loadChildren: () => import('@/pages/event/event.routes') },
  { path: 'subscription', loadChildren: () => import('@/pages/subscription-plans/subscription.routes').then((m) => m.default) },

  // authentication routes (lazy loaded)
  {
    path: 'login',
    canActivate: [onboardingGuard],
    loadComponent: () => import('@/pages/login').then((m) => m.Login)
  },
  {
    path: 'signup',
    canActivate: [onboardingGuard],
    loadComponent: () => import('@/pages/signup/signup').then((m) => m.Signup)
  },
  {
    path: 'onboarding',
    canActivate: [onboardingGuard],
    loadComponent: () => import('@/pages/onboarding').then((m) => m.Onboarding)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('@/pages/forgot-password').then((m) => m.ForgotPassword)
  },
  // message routes (lazy loaded)
  {
    path: 'new-chat',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/messages/components/new-chat').then((m) => m.NewChat)
  },
  {
    path: 'chat-room',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/messages/components/chat-room').then((m) => m.ChatRoom)
  },
  {
    path: 'chat-info',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/messages/components/chat-info').then((m) => m.ChatInfo)
  },
  {
    path: 'create-group',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/messages/components/create-group').then((m) => m.CreateGroup)
  },
  {
    path: 'create-group/:id',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/messages/components/create-group').then((m) => m.CreateGroup)
  },
  {
    path: 'group-invitation/:id',
    loadComponent: () => import('@/pages/messages/components/chat-info').then((m) => m.ChatInfo)
  },
  // profile routes (lazy loaded)
  {
    path: 'profile/edit',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/profile/edit-profile').then((m) => m.EditProfile)
  },
  {
    path: 'business-card/:username',
    loadComponent: () => import('@/pages/profile/business-card/business-card').then(m => m.BusinessCardPage)
  },
  {
    path: 'profile/preferences',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/profile/profile-preferences').then((m) => m.ProfilePreferences)
  },
  // network routes (lazy loaded)
  {
    path: 'add-network',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/network/components/add-network').then((m) => m.AddNetwork)
  },
  {
    path: 'post/:id',
    // canActivate: [authGuard],
    loadComponent: () => import('@/pages/new-post/components/post-comments').then((m) => m.PostComments)
  },
  {
    path: 'new-post',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/new-post').then((m) => m.NewPost)
  },
  {
    path: 'terms',
    loadComponent: () => import('@/pages/terms-of-service').then((m) => m.TermsOfService)
  },
  {
    path: 'policy',
    loadComponent: () => import('@/pages/privacy-policy').then((m) => m.PrivacyPolicy)
  },
  {
    path: 'about-achievements',
    loadComponent: () => import('@/pages/about-achievements').then((m) => m.AboutAchievements)
  },
  {
    path: 'achievements',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/profile/components/profile-achievement').then((m) => m.ProfileAchievement)
  },
  {
    path: 'leaderboard',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/leaderboard').then((m) => m.Leaderboard)
  },
  {
    path: 'notification',
    canActivate: [authGuard],
    loadComponent: () => import('@/pages/notification').then((m) => m.Notification)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadChildren: () => import('@/pages/settings/settings.routes').then((m) => m.default)
  },
  { path: 'not-found', component: NotFound },
  {
    path: ':username',
    loadComponent: () => import('@/pages/profile/profile').then((m) => m.Profile)
  },
  { path: '**', redirectTo: '/not-found' }
];
