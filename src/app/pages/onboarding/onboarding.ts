import { Button } from '@/components/form/button';
import type { SwiperContainer } from 'swiper/element';
import { PermissionsService } from '@/services/permissions.service';
import { KEYS, LocalStorageService } from '@/services/localstorage.service';
import { IonContent, IonicSlides, NavController } from '@ionic/angular/standalone';
import { signal, inject, Component, viewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { AuthService } from '@/services/auth.service';

@Component({
  selector: 'onboarding',
  imports: [IonContent, Button],
  styleUrl: './onboarding.scss',
  templateUrl: './onboarding.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Onboarding {
  // services
  navCtrl = inject(NavController);
  private permissionsService = inject(PermissionsService);
  private localStorageService = inject(LocalStorageService);
  private authService = inject(AuthService);
  // signals
  currentSlide = signal(0);

  // viewChilds
  profileSwiperEl = viewChild<ElementRef<SwiperContainer>>('onboardingSwiper');

  // variables
  swiperModules = [IonicSlides];

  onSlideChange(event: Event) {
    const { activeIndex } = (event.target as SwiperContainer).swiper;
    this.currentSlide.set(activeIndex);

    // request permissions for the current slide
    if (activeIndex === 0) {
      this.permissionsService.requestCameraPermission();
    } else if (activeIndex === 1) {
      this.permissionsService.requestLocationPermission();
    } else if (activeIndex === 2) {
      this.permissionsService.requestContactsPermission();
    }

    // request camera permission for the initial slide
    this.permissionsService.requestCameraPermission();
  }

  goToSlide(index: number) {
    const swiper = this.profileSwiperEl()?.nativeElement?.swiper;
    if (swiper && index >= 0 && index <= 2) {
      swiper.slideTo(index, 100);
    }
  }

  completeOnboarding() {
    this.localStorageService.setItem(KEYS.ONBOARDED, 'true');

    // navigate to login page
    if(this.authService.currentUser()) {
      this.navCtrl.navigateForward('/');
    } else {
      this.navCtrl.navigateForward('/login');
    }
  }
}
