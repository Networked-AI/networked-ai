import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent
} from '@ionic/angular/standalone';
import { IUser } from '@/interfaces/IUser';
import { EventService } from '@/services/event.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Searchbar } from '@/components/common/searchbar';
import { SocketService } from '@/services/socket.service';
import { EmptyState } from '@/components/common/empty-state';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { UserCardList } from '@/components/card/user-card-list';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationService } from '@/services/navigation.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { IEventAttendee, IPagination } from '@/interfaces/IEventAttendee';
import { Component, inject, signal, ChangeDetectionStrategy, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'event-user-list',
  styleUrl: './event-user-list.scss',
  templateUrl: './event-user-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonRefresherContent,
    IonRefresher,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonToolbar,
    IonHeader,
    IonContent,
    IonSpinner,
    CommonModule,
    Searchbar,
    EmptyState,
    UserCardList
  ]
})
export class EventUserList implements OnInit, OnDestroy {
  navigationService = inject(NavigationService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  private socketService = inject(SocketService);
  private eventService = inject(EventService);
  private toasterService = inject(ToasterService);

  private searchSubject = new Subject<string>();

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  title = signal<string>('Host(s)');
  searchQuery = signal<string>('');
  eventTitle = signal<string>('');
  eventId = signal<string | null>(null);

  users = signal<IUser[]>([]);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  pagination = signal<IPagination | null>(null);

  private readonly PAGE_SIZE = 20;

  hasMore = computed(() => {
    const pag = this.pagination();
    return !!pag && pag.currentPage < pag.totalPages;
  });

  filteredUsers = computed(() => this.users());

  ngOnInit(): void {
    const nav = this.router.currentNavigation();
    const state = nav?.extras?.state as { eventTitle?: string };

    if (state?.eventTitle) {
      this.eventTitle.set(state.eventTitle);
    }
    const eventId = this.route.snapshot.paramMap.get('eventId');
    const section = this.route.snapshot.paramMap.get('section');

    if (eventId) this.eventId.set(eventId);
    if (section) this.title.set(decodeURIComponent(section));

    this.loadUsers(1, true);
    this.setupNetworkConnectionListener();

    this.searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => {
      this.loadUsers(1, true); // reset pagination + reload
    });
  }

  onSearchChange(value: string) {
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  onClearSearch() {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  async onRefresh(event: any) {
    try {
      this.pagination.set(null);
      this.users.set([]);
      await this.loadUsers(1, true);
    } finally {
      event.target.complete();
    }
  }

  private getSectionType(): 'attendees' | 'participants' | 'viewers' {
    const title = this.title().toLowerCase();

    if (title.startsWith('viewers')) {
      return 'viewers';
    }

    if (title.startsWith('going') || title.startsWith('maybe')) {
      return 'attendees';
    }

    return 'participants';
  }

  private getFilters() {
    const title = this.title().toLowerCase();

    if (title.startsWith('going')) return { rsvp_status: 'Yes' };
    if (title.startsWith('maybe')) return { rsvp_status: 'Maybe' };

    if (title.startsWith('host')) return { role: 'Host' };
    if (title.startsWith('co-host')) return { role: 'CoHost' };
    if (title.startsWith('sponsor')) return { role: 'Sponsor' };
    if (title.startsWith('staff')) return { role: 'Staff' };
    if (title.startsWith('speaker')) return { role: 'Speaker' };

    return {};
  }

  private mapAttendeeToUser(attendee: IEventAttendee) {
    return {
      id: attendee.user_id,
      name: attendee.parent_user_id ? attendee?.name : attendee?.user?.name,
      username: attendee.parent_user_id ? '' : attendee?.user?.username,
      thumbnail_url: attendee.parent_user_id ? '' : attendee?.user?.thumbnail_url,
      total_gamification_points: attendee?.user?.total_gamification_points,
      connection_status: attendee?.user?.connection_status,
      parent_user_id: attendee.parent_user_id
    };
  }

  async loadUsers(page: number, replace = false): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;

    const sectionType = this.getSectionType();
    const filters = this.getFilters();

    try {
      if (page === 1) this.isLoading.set(true);

      let mappedUsers: IUser[] = [];
      let pagination: any = null;

      if (sectionType === 'viewers') {
        const res = await this.eventService.getEventViewersList(eventId, {
          page,
          limit: this.PAGE_SIZE,
          search: this.searchQuery()
        });

        mappedUsers = (res.data || []).map((v: any) => v.user ?? { id: v.id, name: v.name }) as IUser[];
        pagination = res.pagination;
      } else if (sectionType === 'attendees') {
        const res = await this.eventService.getEventAttendeesList(eventId, {
          page,
          limit: this.PAGE_SIZE,
          rsvp_status: filters.rsvp_status,
          search: this.searchQuery()
        });

        mappedUsers = (res.data || []).map((a) => this.mapAttendeeToUser(a)).filter(Boolean) as IUser[];

        pagination = res.pagination;
      } else {
        const res = await this.eventService.getEventParticipantsList(eventId, {
          page,
          limit: this.PAGE_SIZE,
          role: filters.role,
          search: this.searchQuery()
        });
        mappedUsers = (res.data || []).map((p) => p.user).filter(Boolean) as IUser[];

        pagination = res.pagination;
      }

      if (replace) this.users.set(mappedUsers);
      else this.users.update((u) => [...u, ...mappedUsers]);

      this.pagination.set(pagination);
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to load data.');
      this.toasterService.showError(message);
    } finally {
      if (page === 1) this.isLoading.set(false);
    }
  }

  loadMoreUsers = async (event: Event) => {
    const infinite = event.target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infinite.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);
      const nextPage = (this.pagination()?.currentPage ?? 1) + 1;
      await this.loadUsers(nextPage, false);
    } finally {
      this.isLoadingMore.set(false);
      infinite.complete();
    }
  };

  private setupNetworkConnectionListener(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    this.users.update((list) => list.map((u) => (u.id === payload.id ? { ...u, connection_status: payload.connection_status } : u)));
  };

  ngOnDestroy(): void {
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }
}
