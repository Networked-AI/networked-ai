import { HttpClient } from '@angular/common/http';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { environment } from 'src/environments/environment';
import { IonHeader, IonToolbar, IonContent, ModalController } from '@ionic/angular/standalone';
import { of, Subject, catchError, switchMap, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { Input, inject, OnInit, signal, computed, Component, ChangeDetectionStrategy } from '@angular/core';

interface LocationResult {
  city?: string;
  state?: string;
  address: string;
  country?: string;
  latitude: number;
  distance: number; // in miles
  longitude: number;
}

interface GoogleAutocompleteResponse {
  suggestions: GoogleSuggestion[];
}

interface GoogleSuggestion {
  placePrediction?: GooglePlacePrediction;
}

interface GooglePlacePrediction {
  place: string;
  placeId: string;
  text: {
    text: string;
  };
  structuredFormat?: {
    mainText?: {
      text: string;
    };
    secondaryText?: {
      text: string;
    };
  };
  types?: string[];
}

interface GooglePlaceDetailsResponse {
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  addressComponents?: GoogleAddressComponent[];
}

interface GoogleAddressComponent {
  longText: string;
  shortText?: string;
  types?: string[];
  languageCode?: string;
}

@Component({
  selector: 'location-modal',
  templateUrl: './location-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonContent, IconFieldModule, InputIconModule, InputTextModule]
})
export class LocationModal implements OnInit {
  // inputs
  @Input() location = '';
  @Input() title = 'Select Location';

  // services
  private modalCtrl = inject(ModalController);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private searchSubject = new Subject<string>();

  // signals
  searchQuery = signal('');
  isSearching = signal(true);
  searchResults = signal<LocationResult[]>([]);

  // default coordinates: 33.7501° N, 84.3885° W (Atlanta, GA)
  private readonly DEFAULT_LAT = 33.7501;
  private readonly DEFAULT_LNG = -84.3885;

  // computed coordinates from current user or defaults
  private readonly currentLat = computed(() => {
    const user = this.authService.currentUser();
    return user?.latitude ?? this.DEFAULT_LAT;
  });

  private readonly currentLng = computed(() => {
    const user = this.authService.currentUser();
    return user?.longitude ?? this.DEFAULT_LNG;
  });

  ngOnInit(): void {
    // set search query
    this.searchQuery.set(this.location);

    // setup debounced search first
    this.searchSubject
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((query: string) => {
          if (!query || query.trim().length < 2) {
            return this.searchLocations('Atlanta, GA');
          }
          return this.searchLocations(query);
        })
      )
      .subscribe({
        next: (results) => {
          this.searchResults.set(results);
          this.isSearching.set(false);
        },
        error: () => {
          this.isSearching.set(false);
          this.searchResults.set([]);
        }
      });

    // trigger the search by emitting to the subject
    this.searchSubject.next(this.searchQuery() || 'Atlanta, GA');
  }

  /**
   * Searches for locations using MapTiler Geocoding API
   * @param query - Search query string
   * @returns Observable of location results with distance calculations
   */
  private searchLocations(query: string) {
    this.isSearching.set(true);

    return this.http.post<GoogleAutocompleteResponse>(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        input: query
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': environment.firebaseConfig.apiKey
        }
      }
    ).pipe(
      switchMap((autoResponse: GoogleAutocompleteResponse) => {

        const predictions = autoResponse.suggestions
          .map(s => s.placePrediction)
          .filter(Boolean);

        if (!predictions.length) {
          return of([]);
        }

        // Fetch details for each place
        const detailRequests = predictions.map(pred =>
          this.getPlaceDetails(pred!.placeId)
        );

        return detailRequests.length
          ? forkJoin(detailRequests)
          : of([]);
      }),
      catchError(err => {
        console.error('Google Places error:', err);
        return of([]);
      })
    );
  }

  private getPlaceDetails(placeId: string) {
    return this.http.get<GooglePlaceDetailsResponse>(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': environment.firebaseConfig.apiKey,
          'X-Goog-FieldMask': 'location,addressComponents,formattedAddress'
        }
      }
    ).pipe(
      switchMap((details: GooglePlaceDetailsResponse) => {
        let city: string | undefined;
        let state: string | undefined;
        let country: string | undefined;

        for (const comp of details?.addressComponents || []) {
          const types = comp.types || [];

          if (!city && (
            types.includes('locality') ||
            types.includes('administrative_area_level_3')
          )) {
            city = comp.longText;
          }

          if (!state && types.includes('administrative_area_level_1')) {
            state = comp.longText;
          }

          if (!country && types.includes('country')) {
            country = comp.longText;
          }
        }

        const latitude = details.location?.latitude;
        const longitude = details.location?.longitude;

        const distance = this.calculateDistance(
          this.currentLat(),
          this.currentLng(),
          latitude,
          longitude
        );

        const result: LocationResult = {
          address: details.formattedAddress,
          latitude,
          longitude,
          city,
          state,
          country,
          distance
        };
        return of(result);
      })
    );
  }

  /**
   * Calculates the distance between two coordinates using the Haversine formula
   * @param lat1 - Latitude of first point
   * @param lon1 - Longitude of first point
   * @param lat2 - Latitude of second point
   * @param lon2 - Longitude of second point
   * @returns Distance in miles
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Radius of the Earth in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  // converts degrees to radians
  private toRad(degrees: number) {
    return degrees * (Math.PI / 180);
  }

  // formats distance for display
  formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 5280)}ft`; // Convert to feet
    }
    return `${distance}mi`;
  }

  // formats location address for display
  formatAddress(result: LocationResult): string {
    const parts: string[] = [];
    if (result.city) parts.push(result.city);
    if (result.state) parts.push(result.state);
    if (parts.length === 0 && result.country) parts.push(result.country);
    return parts.join(', ');
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  selectLocation(result: LocationResult): void {
    this.searchQuery.set(result.address);
    this.modalCtrl.dismiss({
      address: result.address,
      latitude: String(result.latitude),
      longitude: String(result.longitude),
      city: result.city || '',
      state: result.state || '',
      country: result.country || ''
    });
  }

  clearSearch(): void {
    this.searchQuery.set('');
    // set default location and trigger search
    this.searchSubject.next('Atlanta, GA');
  }
}
