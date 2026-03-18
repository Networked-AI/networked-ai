import { Subscription } from 'rxjs';
import { Button } from '@/components/form/button';
import { ReactiveFormsModule } from '@angular/forms';
import { UserService } from '@/services/user.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { NavigationService } from '@/services/navigation.service';
import { ProfileFormService } from '@/services/profile-form.service';
import { ProfileImageInput } from '@/components/form/profile-image-input';
import { UserPersonalInfo } from '@/components/common/user-personal-info';
import { UserAdditionalInfo } from '@/components/common/user-additional-info';
import { IonFooter, IonHeader, IonToolbar, IonContent, NavController } from '@ionic/angular/standalone';
import { ProfileSetupUserSuggestion } from '@/pages/profile/components/profile-setup-user-suggestion';
import { signal, inject, OnInit, Component, viewChild, OnDestroy, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';

const PROFILE_STEPS = {
  PERSONAL_INFO: 1,
  PROFILE_IMAGE: 3,
  ADDITIONAL_INFO: 2,
  NETWORK_SUGGESTIONS: 4
} as const;

@Component({
  selector: 'profile-setup',
  styleUrl: './profile-setup.scss',
  templateUrl: './profile-setup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    IonHeader,
    IonFooter,
    IonToolbar,
    IonContent,
    UserPersonalInfo,
    ProfileImageInput,
    UserAdditionalInfo,
    ReactiveFormsModule,
    ProfileSetupUserSuggestion
  ]
})
export class ProfileSetup implements OnInit, OnDestroy, AfterViewInit {
  // services
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private userService = inject(UserService);
  private toasterService = inject(ToasterService);
  private navigationService = inject(NavigationService);
  private profileFormService = inject(ProfileFormService);

  // signals
  readonly steps = [1, 2, 3, 4];
  currentStep = signal<number>(PROFILE_STEPS.PERSONAL_INFO);

  // view children
  userPersonalInfo = viewChild(UserPersonalInfo);

  // subscriptions
  private queryParamsSubscription!: Subscription;

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

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParamMap.subscribe(async (params) => {
      const currentStep = params.get('step');
      if (!currentStep) return;

      // return if the requested step is not in the steps array or is the same as the current step
      const requestedStep = parseInt(currentStep, 10);
      if (!this.steps.includes(requestedStep) || requestedStep === this.currentStep()) return;

      this.currentStep.set(requestedStep);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.profileFormService.initializeForm();
      const currentUser = await this.userService.getCurrentUser();
      this.profileFormService.initializeFields(this.userPersonalInfo(), currentUser);
    } catch (error) {
      // Error already handled in service
    }
  }

  async save(): Promise<void> {
    try {
      const current = this.currentStep();
      this.profileFormService.isSubmitted.set(true);

      // validate step 1
      if (current === PROFILE_STEPS.PERSONAL_INFO) {
        if (!(await this.userPersonalInfo()?.validate())) {
          this.toasterService.showError('Please fill all required fields.');
          return;
        }

        this.navigateToStep(PROFILE_STEPS.ADDITIONAL_INFO);
      }

      // validate step 2
      else if (current === PROFILE_STEPS.ADDITIONAL_INFO) {
        // validate step 1
        if (!(await this.userPersonalInfo()?.validate())) {
          this.toasterService.showError('Please complete step 1 first.');
          return;
        }

        this.navigateToStep(PROFILE_STEPS.PROFILE_IMAGE);
      }

      // validate step 3
      else if (current === PROFILE_STEPS.PROFILE_IMAGE) {
        // validate step 1
        if (!(await this.userPersonalInfo()?.validate())) {
          this.toasterService.showError('Please complete step 1 first.');
          return;
        }

        // use profile form service's save method
        const success = await this.profileFormService.save(this.userPersonalInfo());
        if (!success) return; // verification failed or was cancelled

        this.navigateToStep(PROFILE_STEPS.NETWORK_SUGGESTIONS);
      }

      // step 4
      else {
        const returnTo = this.route.snapshot.queryParams['returnTo'];
        if (returnTo) {
          const url = `/profile/preferences?returnTo=${encodeURIComponent(returnTo)}`;
          this.navigationService.navigateForward(url, true);
        } else {
          this.navigationService.navigateForward('/profile/preferences', true);
        }
      }
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to update user profile.');
      this.toasterService.showError(message);
    }
  }

  async goBack(): Promise<void> {
    if (this.currentStep() === PROFILE_STEPS.PERSONAL_INFO) {
      this.navigationService.back();
    } else {
      const previousStep = this.currentStep() - 1;
      this.navigateToStep(previousStep);
    }
  }

  private navigateToStep(step: number): void {
    this.currentStep.set(step);

    this.router.navigate([], {
      queryParams: { step },
      relativeTo: this.route,
      queryParamsHandling: 'merge'
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
  }
}
