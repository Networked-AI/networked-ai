import { Subscription } from 'rxjs';
import { VibeItem } from '@/interfaces/IUser';
import { ActivatedRoute } from '@angular/router';
import { Button } from '@/components/form/button';
import { UserService } from '@/services/user.service';
import { AuthService } from '@/services/auth.service';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { NavigationService } from '@/services/navigation.service';
import { IonFooter, IonHeader, IonSpinner, IonToolbar, IonContent } from '@ionic/angular/standalone';
import { OnInit, signal, inject, computed, OnDestroy, Component, ChangeDetectionStrategy } from '@angular/core';

export type PreferenceType = 'vibe' | 'hobby' | 'interest' | 'all';

@Component({
  selector: 'profile-preferences',
  styleUrl: './profile-preferences.scss',
  templateUrl: './profile-preferences.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, IonHeader, IonFooter, IonToolbar, IonContent, IonSpinner]
})
export class ProfilePreferences implements OnInit, OnDestroy {
  // services
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private toasterService = inject(ToasterService);
  private navigationService = inject(NavigationService);

  // signals
  maxSelections = 3;
  loading = signal(false);
  isLoading = signal(false);
  currentStep = signal<number>(1);
  type = signal<PreferenceType>('all');

  vibes = signal<VibeItem[]>([]);
  hobbies = signal<VibeItem[]>([]);
  interests = signal<VibeItem[]>([]);
  currentUser = this.authService.currentUser();
  selectedVibesIds = signal<Set<string>>(new Set(this.currentUser?.vibe_ids || []));
  selectedHobbiesIds = signal<Set<string>>(new Set(this.currentUser?.hobby_ids || []));
  selectedInterestsIds = signal<Set<string>>(new Set(this.currentUser?.interest_ids || []));

  // subscriptions
  private queryParamsSubscription?: Subscription;

  // variables
  readonly steps = [
    {
      title: "What's your vibe?",
      type: 'vibe' as PreferenceType,
      description: 'Choose up to 3 vibes that best describe your world. These help us tailor your feed and connections.'
    },
    {
      title: 'Who to connect?',
      type: 'interest' as PreferenceType,
      description: 'Select up to 3 types of people you want to meet through the app - from colleagues to hobby buddies.'
    },
    {
      type: 'hobby' as PreferenceType,
      title: 'What gets you fired up?',
      description: 'Pick your top 3 hobbies and interests to shape the content you see and the events you get invited to.'
    }
  ];

  // computed properties
  currentStepData = computed(() => {
    const step = this.steps[this.currentStep() - 1];
    return step || this.steps[0];
  });

  currentItems = computed(() => {
    const stepType = this.currentStepData().type;
    if (stepType === 'vibe') return this.vibes();
    if (stepType === 'interest') return this.interests();
    if (stepType === 'hobby') return this.hobbies();
    return [];
  });

  hasNoData = computed(() => {
    return !this.loading() && this.currentItems().length === 0;
  });

  currentSelected = computed(() => {
    const stepType = this.currentStepData().type;
    if (stepType === 'vibe') return this.selectedVibesIds();
    if (stepType === 'hobby') return this.selectedHobbiesIds();
    if (stepType === 'interest') return this.selectedInterestsIds();

    return new Set<string>();
  });

  isMultiStep = computed(() => this.type() === 'all');

  totalSteps = computed(() => (this.isMultiStep() ? 3 : 1));

  async ngOnInit(): Promise<void> {
    // check for type query parameter
    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      const typeParam = params['type'] as PreferenceType | undefined;

      if (typeParam === 'vibe') {
        this.currentStep.set(1);
        this.type.set(typeParam);
      } else if (typeParam === 'interest') {
        this.currentStep.set(2);
        this.type.set(typeParam);
      } else if (typeParam === 'hobby') {
        this.currentStep.set(3);
        this.type.set(typeParam);
      }
    });

    await this.loadData();
    this.sortItemsBySelection();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const preferenceType = this.type();

      if (preferenceType === 'all' || preferenceType === 'vibe') {
        const vibesData = await this.userService.getVibes();
        this.vibes.set(vibesData || []);
      }

      if (preferenceType === 'all' || preferenceType === 'interest') {
        const interestsData = await this.userService.getInterests();
        this.interests.set(interestsData || []);
      }

      if (preferenceType === 'all' || preferenceType === 'hobby') {
        const hobbiesData = await this.userService.getHobbies();
        this.hobbies.set(hobbiesData || []);
      }
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to load preferences.');
      this.toasterService.showError(message);
    } finally {
      this.loading.set(false);
    }
  }

  private sortItemsBySelection(): void {
    // helper function to sort items by selection status
    const sortBySelection = <T extends VibeItem>(items: T[], selectedIds: Set<string>): T[] => {
      if (items.length === 0 || selectedIds.size === 0) return items;
      return [...items].sort((a, b) => {
        const aSelected = selectedIds.has(a.id);
        const bSelected = selectedIds.has(b.id);
        return aSelected === bSelected ? 0 : aSelected ? -1 : 1;
      });
    };

    this.vibes.set(sortBySelection(this.vibes(), this.selectedVibesIds()));
    this.hobbies.set(sortBySelection(this.hobbies(), this.selectedHobbiesIds()));
    this.interests.set(sortBySelection(this.interests(), this.selectedInterestsIds()));
  }

  isSelected(itemId: string): boolean {
    return this.currentSelected().has(itemId);
  }

  canSelectMore(): boolean {
    return this.currentSelected().size < this.maxSelections;
  }

  toggleItem(itemId: string): void {
    const stepType = this.currentStepData().type;
    let selectedSignal: typeof this.selectedVibesIds;

    if (stepType === 'vibe') {
      selectedSignal = this.selectedVibesIds;
    } else if (stepType === 'interest') {
      selectedSignal = this.selectedInterestsIds;
    } else {
      selectedSignal = this.selectedHobbiesIds;
    }

    const selected = new Set(selectedSignal());
    if (selected.has(itemId)) {
      selected.delete(itemId);
    } else if (selected.size < this.maxSelections) {
      selected.add(itemId);
    }
    selectedSignal.set(selected);
  }

  skip(): void {
    this.navigationService.navigateForward('/', true);
  }

  goBack(): void {
    if (this.isMultiStep() && this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    } else {
      this.navigationService.back('/profile/edit');
    }
  }

  async next(): Promise<void> {
    if (this.isMultiStep()) {
      // multi-step flow: move to next step or finish
      if (this.currentStep() < this.totalSteps()) {
        this.currentStep.set(this.currentStep() + 1);
      } else {
        // last step - save all preferences
        await this.savePreferences();
      }
    } else {
      // single type selection - save and go back
      await this.savePreferences();
    }
  }

  async savePreferences(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.userService.updatePreferences(
        Array.from(this.selectedVibesIds()),
        Array.from(this.selectedInterestsIds()),
        Array.from(this.selectedHobbiesIds())
      );
      this.toasterService.showSuccess('Preferences saved successfully.');

      const returnTo = this.route.snapshot.queryParams['returnTo'];
      if (returnTo) {
        this.navigationService.navigateForward(returnTo, true);
      } else {
        this.navigationService.navigateForward('/', true);
      }
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to save preferences.');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }
}
