import { Button } from '@/components/form/button';
import { ReactiveFormsModule } from '@angular/forms';
import { UserService } from '@/services/user.service';
import { AuthService } from '@/services/auth.service';
import { ProfileFormService } from '@/services/profile-form.service';
import { ProfileImageInput } from '@/components/form/profile-image-input';
import { UserPersonalInfo } from '@/components/common/user-personal-info';
import { UserAdditionalInfo } from '@/components/common/user-additional-info';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import { signal, inject, Component, viewChild, AfterViewInit } from '@angular/core';
import { IonFooter, IonHeader, IonToolbar, IonContent, NavController } from '@ionic/angular/standalone';

type Tab = 'profile' | 'preferences';

@Component({
  selector: 'edit-profile',
  styleUrl: './edit-profile.scss',
  templateUrl: './edit-profile.html',
  imports: [
    Button,
    IonHeader,
    IonFooter,
    IonToolbar,
    IonContent,
    SegmentButton,
    UserPersonalInfo,
    ProfileImageInput,
    UserAdditionalInfo,
    ReactiveFormsModule
  ]
})
export class EditProfile implements AfterViewInit {
  // services
  navCtrl = inject(NavController);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private profileFormService = inject(ProfileFormService);
  userAdditionalInfo = viewChild(UserAdditionalInfo);  
  // signals
  tab = signal<Tab>('profile');
  currentUser = this.authService.currentUser;

  // view children
  userPersonalInfo = viewChild(UserPersonalInfo);

  // variables
  tabItems: SegmentButtonItem[] = [
    {
      value: 'profile',
      label: 'Profile Details',
      icon: '/assets/svg/profile-details.svg',
      activeIcon: '/assets/svg/profile-details-active.svg'
    },
    {
      value: 'preferences',
      label: 'Preferences',
      icon: '/assets/svg/preferences.svg',
      activeIcon: '/assets/svg/preferences-active.svg'
    }
  ];

  // getters to access profile form service
  get profileForm() {
    return this.profileFormService.profileForm();
  }

  get isLoading() {
    return this.profileFormService.isLoading();
  }

  get isSubmitted() {
    return this.profileFormService.isSubmitted();
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.profileFormService.initializeForm();
      const user = await this.userService.getCurrentUser();
      this.profileFormService.initializeFields(this.userPersonalInfo(), user);
      this.userAdditionalInfo()?.socialInput()?.syncVisibleLinksFromValues()
    } catch (error) {}
  }

  editPreferences(type: 'vibe' | 'interest' | 'hobby'): void {
    this.navCtrl.navigateForward('/profile/preferences', {
      queryParams: { type: type as string, returnTo: '/profile/edit' }
    });
  }

  async save(): Promise<void> {
    this.profileFormService.isSubmitted.set(true);
    const success = await this.profileFormService.save(
      this.userPersonalInfo(),
      this.userAdditionalInfo()?.socialInput()
    );
    if (success) this.navCtrl.back();
  }

  onSegmentChange(value: string): void {
    this.tab.set(value as Tab);
  }
}
