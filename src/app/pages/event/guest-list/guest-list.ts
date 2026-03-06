import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ActivatedRoute } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { EventService } from '@/services/event.service';
import { SocketService } from '@/services/socket.service';
import { Searchbar } from '@/components/common/searchbar';
import { NetworkService } from '@/services/network.service';
import { PopoverService } from '@/services/popover.service';
import { ToasterService } from '@/services/toaster.service';
import { EmptyState } from '@/components/common/empty-state';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { NavigationService } from '@/services/navigation.service';
import { IonContent, IonToolbar, IonHeader } from '@ionic/angular/standalone';
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy, effect, DOCUMENT } from '@angular/core';
import {
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/angular/standalone';
import { IUser } from '@/interfaces/IUser';
import { IEventAttendee, IEventAttendeesCounts, IGetEventAttendeesParams, IPagination, IRefundAttendeeResponse } from '@/interfaces/IEventAttendee';
import { Button } from '@/components/form/button';
import { HapticService } from '@/services/haptic.service';
import { IEvent } from '@/interfaces/event';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { BaseApiService } from '@/services/base-api.service';

type GuestFilter = {
  attending: boolean;
  maybe: boolean;
  notAttending: boolean;
  checkedIn: boolean;
  notCheckedIn: boolean;
  myNetwork: boolean;
  notMyNetwork: boolean;
  earlyBird: boolean;
  standard: boolean;
  free: boolean;
  sponsor: boolean;
};

@Component({
  selector: 'guest-list',
  styleUrl: './guest-list.scss',
  templateUrl: './guest-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonSpinner,
    IonHeader,
    IonToolbar,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    Searchbar,
    IonIcon,
    ButtonModule,
    EmptyState,
    NgOptimizedImage,
    Button
  ]
})
export class GuestList implements OnInit, OnDestroy {
  private popoverService = inject(PopoverService);
  modalService = inject(ModalService);
  route = inject(ActivatedRoute);
  eventService = inject(EventService);
  authService = inject(AuthService);
  toasterService = inject(ToasterService);
  networkService = inject(NetworkService);
  navigationService = inject(NavigationService);
  hapticService = inject(HapticService);
  private socketService = inject(SocketService);
  private readonly document = inject(DOCUMENT);
  isLoggedIn = computed(() => !!this.authService.currentUser());

  selectedGuestId = signal<string>('');
  selectedGuest = signal<IEventAttendee | null>(null);
  searchQuery = signal('');
  isDownloading = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isChecking = signal<boolean>(false);
  eventId = signal<string | null>(null);
  eventData = signal<IEvent | null>(null);

  private readonly DEFAULT_FILTER: GuestFilter = {
    attending: true,
    maybe: true,
    notAttending: true,
    checkedIn: true,
    notCheckedIn: true,
    myNetwork: true,
    notMyNetwork: true,
    earlyBird: true,
    standard: true,
    free: true,
    sponsor: true
  };

  filter = signal<GuestFilter>({ ...this.DEFAULT_FILTER });

  private readonly PAGE_SIZE = 20;
  attendees = signal<IEventAttendee[]>([]);
  pagination = signal<IPagination | null>(null);
  counts = signal<IEventAttendeesCounts | null>(null);
  isLoadingMore = signal<boolean>(false);
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  hasMore = computed(() => {
    const p = this.pagination();
    if (!p) return false;
    return p.currentPage < p.totalPages;
  });

  isFilterActive = computed(() => {
    const f = this.filter();
    return (Object.keys(this.DEFAULT_FILTER) as Array<keyof GuestFilter>).some((key) => f[key] !== this.DEFAULT_FILTER[key]);
  });

  constructor() {
    effect(() => {
      const evId = this.eventId();
      this.filter();
      this.searchQuery();
      if (!evId) return;

      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.loadAttendeesOnly();
        this.searchDebounceTimer = null;
      }, 300);
    });
  }
  stats = computed(() => {
    const c = this.counts();
    if (c) {
      return [
        { key: 'total', label: 'Total', value: c.total_guest, class: 'stat-total' },
        { key: 'attending', label: 'Attending', value: c.total_attending_guest, class: 'stat-attending' },
        { key: 'maybe', label: 'Maybe', value: c.total_maybe_guest, class: 'stat-maybe' },
        { key: 'not', label: 'Not', value: c.total_no_guest, class: 'stat-not' }
      ];
    }
    return [];
  });

  checkedInCount = computed(() => {
    const c = this.counts();
    if (c) return c.total_checkedin_guest;
    return 0;
  });

  getMenuItems(guest: IEventAttendee): MenuItem[] {
    const items: MenuItem[] = [];

    const isCash = guest?.payment_mode === 'cash';
    const amountPaid = guest?.amount_paid ?? 0;

    if (guest?.parent_user_id == null) {
      if (guest.user?.connection_status === 'NotConnected') {
        items.push({
          label: 'Add as Network',
          command: () => this.addAsNetwork(),
          iconPath: 'assets/svg/guest-list/add-network.svg'
        });
      }

      if (guest.user?.connection_status === 'Connected') {
        items.push({
          label: 'Send Message',
          command: () => this.sendMessage(),
          iconPath: 'assets/svg/guest-list/send-message.svg'
        });
      }
    }
    // Issue Refund → only for non-cash, succeeded payments with actual amount
    if (guest?.payment_status === 'succeeded' && !isCash && amountPaid > 0) {
      items.push({
        label: 'Issue Refund',
        command: () => this.issueRefund(),
        iconPath: 'assets/svg/guest-list/refund-issue.svg'
      });
    }

    // Mark as Unpaid → only for succeeded payments with actual amount
    if (guest?.payment_status === 'succeeded' && amountPaid > 0) {
      items.push({
        label: 'Mark as Unpaid',
        command: () => this.markAsUnpaid(),
        icon: 'times-circle'
      });
    }

    // Mark as Paid → only for pending with actual amount paid
    if (guest?.payment_status === 'pending' && amountPaid > 0) {
      items.push({
        label: 'Mark as Paid',
        command: () => this.markAsPaid(),
        icon: 'check-circle'
      });
    }

    if (guest.is_checked_in) {
      items.push({
        label: 'Uncheck-in',
        command: () => this.uncheckIn(),
        iconPath: 'assets/svg/guest-list/uncheck-in.svg'
      });
    } else {
      items.push({
        label: 'Check-in',
        command: () => this.checkInFromMenu(),
        iconPath: 'assets/svg/guest-list/check-in.svg'
      });
    }

    items.push({
      label: 'Remove Guest',
      command: () => this.removeGuest(),
      iconPath: 'assets/svg/deleteIcon.svg'
    });

    return items;
  }
  async issueRefund() {
    this.closePopover();

    const guestId = this.selectedGuestId();
    if (!guestId) return;

    const guest = this.attendees().find((a) => a.id === guestId);
    const guestName = guest?.user?.name || guest?.user?.username || 'Guest';

    // Show confirmation modal
    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/guest-list/refund-issue-white.svg',
      iconBgColor: '#C73838',
      title: 'Issue Refund',
      description: `Are you sure you want to issue a refund to ${guestName}? This action cannot be undone.`,
      confirmButtonLabel: 'Issue Refund',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left',
      onConfirm: async () => {
        try {
          const response: IRefundAttendeeResponse = await this.eventService.refundAttendee(guestId);

          // Update the attendee in the current listing with the updated attendee from API response
          if (response?.data) {
            this.attendees.update((list) => list.map((attendee) => (attendee.id === guestId ? { ...attendee, ...response.data } : attendee)));
          }
          this.toasterService.showSuccess(response.message || 'Refund processed successfully');
        } catch (error) {
          const message = BaseApiService.getErrorMessage(error, 'Failed to process refund.');
          this.toasterService.showError(message);
        }
      }
    });

    // If user cancelled, do nothing
    if (!result || result.role !== 'confirm') return;
  }

  openPopover(event: Event, user: IEventAttendee): void {
    this.popoverService.openCommonPopover(event, this.getMenuItems(user));
    this.selectedGuest.set(user);
    this.selectedGuestId.set(user.id);
  }

  async addAsNetwork(): Promise<void> {
    this.closePopover();
    this.isChecking.set(true);
    const guestId = this.selectedGuest()?.user?.id;
    if (!guestId) return;

    try {
      await this.networkService.sendNetworkRequest(guestId);
      this.toasterService.showSuccess('Network request sent successfully');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to send network request.');
      this.toasterService.showError(message);
    } finally {
      this.isChecking.set(false);
    }
  }

  sendMessage() {
    this.closePopover();

    const guestId = this.selectedGuest()?.user?.id;
    if (!guestId) return;
    const currentUserId = this.authService.currentUser()?.id;
    if (currentUserId && guestId) {
      this.navigationService.navigateForward('/chat-room', false, {
        user_ids: [currentUserId, guestId],
        is_personal: true
      });
    }
  }

  async removeGuest() {
    this.closePopover();

    const guestId = this.selectedGuestId();
    if (!guestId) return;

    const guest = this.attendees().find((a) => a.id === guestId);
    const guestName = guest?.user?.name || guest?.user?.username || 'Guest';

    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/deleteWhiteIcon.svg',
      iconBgColor: '#C73838',
      title: 'Remove Guest',
      description: `Are you sure you want to remove ${guestName} from this event? This action cannot be undone.`,
      confirmButtonLabel: 'Remove Guest',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left',
      onConfirm: async () => {
        this.isChecking.set(true);

        try {
          await this.eventService.deleteAttendees(guestId);

          this.attendees.update((list) => list.filter((a) => a.id !== guestId));

          this.toasterService.showSuccess('Guest removed successfully.');
        } catch (error) {
          const message = BaseApiService.getErrorMessage(error, 'Failed to remove guest.');
          this.toasterService.showError(message);
        } finally {
          this.isChecking.set(false);
        }
      }
    });

    // if cancelled → do nothing
    if (!result || result.role !== 'confirm') return;
  }

  async ngOnInit(): Promise<void> {
    if (!this.isLoggedIn()) {
      const result = await this.modalService.openLoginModal();
      if (!result?.success) {
        this.navigationService.back();
        return;
      }
    }

    const eventId = this.route.snapshot.paramMap.get('id');
    if (eventId) {
      this.eventId.set(eventId);
      await this.loadAttendees();
    }
    this.setupNetworkConnectionListener();
  }

  async loadAttendees(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;

    try {
      this.isLoading.set(true);
      const eventData = await this.eventService.getEventById(eventId);
      if (eventData) {
        if (!this.eventService.checkHostOrCoHostAccess(eventData)) {
          this.toasterService.showError('You do not have permission to view this page');
          this.navigationService.navigateForward(`/event/${eventId}`, true);
          return;
        }
        this.eventData.set(eventData);
      }
    } catch (error) {
      console.error('Error loading attendees:', error);
      const message = BaseApiService.getErrorMessage(error, 'Error loading attendees:');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadAttendeesOnly(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;
    const apiParams = this.buildAttendeeParams(1);
    const { data, pagination, counts } = await this.eventService.getEventAttendees(eventId, apiParams);
    this.attendees.set(data);
    this.pagination.set(pagination);
    if (counts) this.counts.set(counts);
  }

  async loadMoreAttendees(): Promise<void> {
    const eventId = this.eventId();
    const pag = this.pagination();
    if (!eventId || !pag || !this.hasMore() || this.isLoadingMore()) return;

    const nextPage = pag.currentPage + 1;
    try {
      this.isLoadingMore.set(true);
      const apiParams = this.buildAttendeeParams(nextPage);
      const { data, pagination, counts } = await this.eventService.getEventAttendees(eventId, apiParams);
      this.attendees.update((list) => [...list, ...data]);
      this.pagination.set(pagination);
      if (counts) this.counts.set(counts);
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Error loading more attendees.');
      this.toasterService.showError(message);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  private buildAttendeeParams(page: number): IGetEventAttendeesParams {
    const f = this.filter();
    const params: IGetEventAttendeesParams = { page, limit: this.PAGE_SIZE };

    if (this.searchQuery()?.trim()) params['search'] = this.searchQuery().trim();

    const rsvpParts: string[] = [];
    if (f.attending) rsvpParts.push('Yes');
    if (f.maybe) rsvpParts.push('Maybe');
    if (f.notAttending) rsvpParts.push('No');
    if (rsvpParts.length > 0 && rsvpParts.length < 3) params['rsvp_status'] = rsvpParts.join(',');

    if (f.checkedIn && !f.notCheckedIn) params['is_checked_in'] = true;
    else if (f.notCheckedIn && !f.checkedIn) params['is_checked_in'] = false;

    if (f.myNetwork && !f.notMyNetwork) params['is_connected'] = true;
    else if (f.notMyNetwork && !f.myNetwork) params['is_connected'] = false;

    const ticketParts: string[] = [];
    if (f.earlyBird) ticketParts.push('Early Bird');
    if (f.standard) ticketParts.push('Standard');
    if (f.sponsor) ticketParts.push('Sponsor');
    if (f.free) ticketParts.push('Free');
    if (ticketParts.length > 0 && ticketParts.length < 4) params['ticket_type'] = ticketParts.join(',');

    return params;
  }

  getImageUrl(imageUrl?: string): string {
    return getImageUrlOrDefault(imageUrl || '');
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getDiamondPath(points = 0) {
    if (points >= 50000) {
      return '/assets/svg/gamification/diamond-50k.svg';
    } else if (points >= 40000) {
      return '/assets/svg/gamification/diamond-40k.svg';
    } else if (points >= 30000) {
      return '/assets/svg/gamification/diamond-30k.svg';
    } else if (points >= 20000) {
      return '/assets/svg/gamification/diamond-20k.svg';
    } else if (points >= 10000) {
      return '/assets/svg/gamification/diamond-10k.svg';
    } else if (points >= 5000) {
      return '/assets/svg/gamification/diamond-5k.svg';
    } else {
      return '/assets/svg/gamification/diamond-1k.svg';
    }
  }

  back() {
    this.navigationService.back();
  }

  async downloadGuestList() {
    this.isDownloading.set(true);

    try {
      const csv = await this.eventService.downloadEventAttendeesCSV(this.eventId()!);

      const BOM = '\uFEFF';
      const content = BOM + csv;

      const eventName = this.eventData()?.slug || 'guest-list';
      const fileName = `${eventName}-${Date.now()}.csv`;

      if (Capacitor.getPlatform() === 'web') {
        const blob = new Blob([content], {
          type: 'text/csv;charset=utf-8;'
        });

        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const base64Data = btoa(unescape(encodeURIComponent(content)));

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents
      });

      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Event Attendees',
          url: savedFile.uri
        });
      } else {
        this.toasterService.showSuccess('CSV saved successfully!');
      }
    } catch (error) {
      console.error('CSV download failed', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to download CSV');
      this.toasterService.showError(message);
    } finally {
      this.isDownloading.set(false);
    }
  }

  async openFilterModal() {
    const result = await this.modalService.openGuestFilterModal(this.filter());
    if (result) this.filter.set(result);
  }

  private async updateCheckInStatus(guestId: string, isCheckedIn: boolean): Promise<void> {
    const event = this.eventData();
    if (!event?.id) return;

    try {
      this.isChecking.set(true);
      await this.eventService.changeCheckInStatus({ event_id: event.id, attendee_id: guestId, is_checked_in: isCheckedIn });
      this.attendees.update((list) => list.map((a) => (a.id === guestId ? { ...a, is_checked_in: isCheckedIn } : a)));
      this.counts.update((counts: any) => {
        if (!counts) return { total_checkedin_guest: isCheckedIn ? 1 : 0 };
        return { ...counts, total_checkedin_guest: counts.total_checkedin_guest + (isCheckedIn ? 1 : -1) };
      });
      this.toasterService.showSuccess(isCheckedIn ? 'Check-in successfully' : 'Uncheck-in successfully');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, isCheckedIn ? 'Failed to check in' : 'Failed to uncheck in');
      this.toasterService.showError(message);
    } finally {
      this.isChecking.set(false);
    }
  }

  async checkIn(id: string): Promise<void> {
    this.selectedGuestId.set(id);
    await this.updateCheckInStatus(id, true);
  }

  async checkInFromMenu(): Promise<void> {
    this.closePopover();
    const guestId = this.selectedGuestId();
    if (!guestId) return;
    await this.updateCheckInStatus(guestId, true);
  }

  async uncheckIn(): Promise<void> {
    this.closePopover();
    const guestId = this.selectedGuestId();
    if (!guestId) return;
    await this.updateCheckInStatus(guestId, false);
  }

  onCardClick(user: IEventAttendee) {
    if (user?.parent_user_id) {
      return;
    }
    const username = user?.user?.username;
    if (username) {
      this.navigationService.navigateForward(`/${username}`);
    }
  }

  private setupNetworkConnectionListener(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    if (!payload?.id) return;

    const userId = payload.id;
    const newStatus = payload.connection_status;

    this.attendees.update((users) =>
      users.map((attendee) =>
        attendee.user?.id === userId
          ? {
              ...attendee,
              user: {
                ...attendee.user,
                connection_status: newStatus
              }
            }
          : attendee
      )
    );
  };

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }

  closePopover(): void {
    this.popoverService.close();
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.loadAttendeesOnly();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete();
    }
  }

  async onInfiniteScroll(event: Event): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;
    try {
      await this.loadMoreAttendees();
    } finally {
      infiniteScroll.complete();
    }
  }

  async addGuest(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;

    const tickets = this.eventData()?.tickets ?? [];
    const settings = this.eventData()?.settings as any | undefined;
    const hostPaysFees = settings?.host_pays_platform_fee ?? false;
    const additionalFees = settings?.additional_fees ?? null;

    const result = await this.modalService.openAddGuestModal(eventId, tickets, hostPaysFees, additionalFees);
    // User cancelled the form
    if (!result || result !== 'save') {
      return;
    }

    // Refresh list after successful add
    await this.loadAttendeesOnly();

    // Show success confirm modal
    const successResult = await this.modalService.openConfirmModal({
      iconName: 'pi-check',
      iconBgColor: 'linear-gradient(138.06deg, #F5BC61 8.51%, #C89034 48.28%, #9E660A 85.69%)',
      title: 'Guest Confirmed!',
      description: 'You can check your RSVP details in your profile › attending events.',
      confirmButtonLabel: 'Done',
      cancelButtonLabel: 'Create Another',
      iconPosition: 'center',
      cancelButtonIcon: '/assets/svg/addUserIconGray.svg'
    });

    if (!successResult || successResult.role === 'cancel') {
      this.addGuest();
    }
  }

  async markAsPaid(): Promise<void> {
    await this.updatePaymentStatus(true);
  }

  async markAsUnpaid(): Promise<void> {
    await this.updatePaymentStatus(false);
  }

  private async updatePaymentStatus(isPaid: boolean): Promise<void> {
    this.closePopover();

    const guestId = this.selectedGuestId();
    const eventId = this.eventId();
    if (!guestId || !eventId) return;

    const guest = this.attendees().find((a) => a.id === guestId);
    const guestName = guest?.user?.name || guest?.user?.username || 'Guest';

    const config = isPaid
      ? {
          iconName: 'pi pi-check',
          iconBgColor: 'linear-gradient(138.06deg, #F5BC61 8.51%, #C89034 48.28%, #9E660A 85.69%)',
          title: 'Mark as Paid',
          description: `Are you sure you want to mark ${guestName} as paid?`,
          confirmButtonLabel: 'Mark as Paid',
          confirmButtonColor: undefined,
          fallbackStatus: 'succeeded'
        }
      : {
          iconName: 'pi pi-times',
          iconBgColor: '#C73838',
          title: 'Mark as Unpaid',
          description: `Are you sure you want to mark ${guestName} as unpaid?`,
          confirmButtonLabel: 'Mark as Unpaid',
          confirmButtonColor: 'danger' as const,
          fallbackStatus: 'pending'
        };

    const result = await this.modalService.openConfirmModal({
      iconName: config.iconName,
      iconBgColor: config.iconBgColor,
      title: config.title,
      description: config.description,
      confirmButtonLabel: config.confirmButtonLabel,
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: config.confirmButtonColor,
      iconPosition: 'left',
      onConfirm: async () => {
        try {
          this.isChecking.set(true);
          const response: any = await this.eventService.markAsPaid(eventId, guestId, isPaid);

          this.attendees.update((list) =>
            list.map((attendee) =>
              attendee.id === guestId ? { ...attendee, ...(response?.data ?? { payment_status: config.fallbackStatus }) } : attendee
            )
          );

          this.toasterService.showSuccess(response?.message || `${config.title} successfully`);
        } catch (error) {
          const message = BaseApiService.getErrorMessage(error, `Failed to ${config.title.toLowerCase()}`);
          this.toasterService.showError(message);
        } finally {
          this.isChecking.set(false);
        }
      }
    });

    if (!result || result.role !== 'confirm') return;
  }
}
