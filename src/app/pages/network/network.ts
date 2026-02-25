import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { Searchbar } from '@/components/common/searchbar';
import { NetworkMapView } from '@/pages/network/components/network-map-view';
import { NetworkListView } from '@/pages/network/components/network-list-view';
import { AuthEmptyState } from '@/components/common/auth-empty-state';
import { AuthService } from '@/services/auth.service';
import { inject, signal, computed, Component, ChangeDetectionStrategy } from '@angular/core';
import { IonIcon, IonHeader, IonToolbar, IonContent, NavController } from '@ionic/angular/standalone';
import { ScrollHandlerDirective } from '@/directives/scroll-handler.directive';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationService } from '@/services/navigation.service';
import { Router } from '@angular/router';

@Component({
  selector: 'network',
  styleUrl: './network.scss',
  templateUrl: './network.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, IonIcon, IonHeader, Searchbar, IonToolbar, IonContent, NetworkMapView, NetworkListView, AuthEmptyState, ScrollHandlerDirective]
})
export class Network {
  // signals
  radius = signal<number>(20);
  latitude = signal<string>('');
  longitude = signal<string>('');
  locationAddress = signal<string>('');
  searchQuery = signal<string>('');
  segmentValue = signal<string>('list');
  userId = signal<string | null>(null);

  // services
  private navCtrl = inject(NavController);
  private modalService = inject(ModalService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private navigationService = inject(NavigationService);
  private router = inject(Router);

  currentUser = signal<any>(null);
  viewedUser = signal<any>(null);

  // computed
  isLoggedIn = computed(() => !!this.authService.currentUser());
  isViewingOtherUser = computed(() => {
    const uid = this.userId();
    const currentUser = this.authService.currentUser();
    return !!uid && !!currentUser && uid !== currentUser.id;
  });
  shouldShowSegments = computed(() => !this.isViewingOtherUser());

  // Check if location filter is active
  isFilterActive = computed(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    const radius = this.radius();
    return !!(lat || lng || radius !== 20);
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const userId = params.get('userId');

      if (userId) {
        this.userId.set(userId);
        this.segmentValue.set('list');

        const navigation = this.router.currentNavigation();
        const state = navigation?.extras?.state || history.state;
        if (state?.user) {
          this.viewedUser.set(state.user);
        }
      } else {
        this.userId.set(this.authService.currentUser()!.id);
        this.viewedUser.set(null);
      }
    });
  }

  // Computed property for header text
  headerText = computed(() => {
    const user = this.viewedUser();
    if (!user) return '';

    const name = user.name || user.username || '';
    if (name) return `${name}'s Network`;

    return '';
  });

  goBack(): void {
    this.navCtrl.back();
  }

  async openLocationFilterModal() {
    const result = await this.modalService.openLocationFilterModal({
      location: this.locationAddress(),
      latitude: this.latitude(),
      longitude: this.longitude(),
      radius: this.radius()
    });
    if (result === null) {
      // Reset was clicked - clear location filters
      this.radius.set(20);
      this.latitude.set('');
      this.longitude.set('');
      this.locationAddress.set('');
    } else if (result && typeof result === 'object') {
      // Apply was clicked with location data
      this.searchQuery.set('');
      this.radius.set(result.radius || 20);
      this.latitude.set(result.latitude || '');
      this.longitude.set(result.longitude || '');
      if (result.location) {
        this.locationAddress.set(result.location);
      }
    }
  }

  navigateToAddNetwork() {
    this.navigationService.navigateForward('/add-network');
  }
}
