import { AuthService } from './auth.service';
import { Injectable, signal, inject, computed } from '@angular/core';
import { BaseApiService } from '@/services/base-api.service';
import { ModalService } from './modal.service';
import { MenuItem } from '@/components/modal/menu-modal/menu-modal';
import { Capacitor } from '@capacitor/core';
import { NavigationService } from './navigation.service';
import { ToasterService } from './toaster.service';
import { EventService } from './event.service';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHintALLOption } from '@capacitor/barcode-scanner';

@Injectable({ providedIn: 'root' })
export class ManageEventService extends BaseApiService {
  private authService = inject(AuthService);
  modalService = inject(ModalService);
  navigationService = inject(NavigationService);
  toasterService = inject(ToasterService);
  eventService = inject(EventService);
  currentEventData = signal<any | null>(null);

  isNativePlatform = computed(() => Capacitor.isNativePlatform());

  isEventCompleted = computed(() => {
    const eventData = this.currentEventData();
    const now = Date.now();
    if (!eventData) return false;
    const eventStart = new Date(eventData.end_date).getTime();

    // event is completed if end date is in the past
    return eventStart < now;
  });

  menuItems = computed<MenuItem[]>(() => {
    const isCompleted = this.isEventCompleted();
    const displayData = this.currentEventData();

    const isHost = displayData.participants.some((p: any) => {
      const userId = p.user?.id;
      const role = (p.role || '').toLowerCase();
      return userId === this.authService.currentUser()?.id && role === 'host';
    });

    const isCoHost = displayData.participants.some((p: any) => {
      const userId = p.user?.id;
      const role = (p.role || '').toLowerCase();
      return userId === this.authService.currentUser()?.id && role === 'cohost';
    });
    const hasQuestionnaire = displayData.questionnaire && displayData.questionnaire.length > 0;

    let baseItems: MenuItem[] = [
      { label: 'Edit', icon: 'assets/svg/manage-event/edit.svg', iconType: 'svg', action: 'editEvent' },
      { label: 'Analytics', icon: 'assets/svg/manage-event/analytics.svg', iconType: 'svg', action: 'viewEventAnalytics' },
      { label: 'Questionnaire Responses', icon: 'assets/svg/manage-event/questionnaire.svg', iconType: 'svg', action: 'viewQuestionnaireResponses' },
      { label: 'Create Duplicate Event', icon: 'duplicate-outline', iconType: 'ion', action: 'duplicateEvent' },
      { label: 'Manage Roles', icon: 'assets/svg/manage-event/settings.svg', iconType: 'svg', action: 'manageRoles' },
      { label: 'Guest List', icon: 'assets/svg/manage-event/users.svg', iconType: 'svg', action: 'viewGuestList' },
      { label: 'Event Page QR', icon: 'assets/svg/scanner.svg', iconType: 'svg', action: 'viewEventPageQr' },
      { label: 'Share Event', icon: 'assets/svg/manage-event/share-event.svg', iconType: 'svg', action: 'shareEvent' },
      { label: 'Cancel Event', icon: 'assets/svg/manage-event/calendar-x.svg', iconType: 'svg', danger: true, action: 'cancelEvent' }
    ];

    // 👉 NEW: questionnaire condition
    if (!hasQuestionnaire) {
      baseItems = baseItems.filter((item) => item['action'] !== 'viewQuestionnaireResponses');
    }

    if (isCoHost && !isHost) {
      const allowedActions = ['viewEventAnalytics', 'viewGuestList', 'viewEventPageQr', 'shareEvent', 'duplicateEvent'];

      return baseItems.filter((item) => allowedActions.includes(item['action'] || ''));
    }

    if (isCompleted) {
      baseItems = baseItems.filter((item) => !['editEvent', 'manageRoles'].includes(item['action'] || ''));
    }

    // RSVP Approval
    if (displayData?.settings?.is_rsvp_approval_required) {
      const rsvpApprovalItem: MenuItem = {
        label: 'RSVP Approval',
        icon: 'pi pi-check-circle',
        iconType: 'pi',
        action: 'viewRsvpApproval'
      };

      const qrIndex = baseItems.findIndex((i) => i['action'] === 'viewEventPageQr');
      if (qrIndex !== -1) {
        baseItems.splice(qrIndex + 1, 0, rsvpApprovalItem);
      }
    }

    // Ticket Scanner
    if (isHost && this.isNativePlatform() && !isCompleted) {
      const scannerItem: MenuItem = {
        label: 'Ticket Scanner',
        icon: 'assets/svg/scanner.svg',
        iconType: 'svg',
        action: 'scanQRCode'
      };

      const qrIndex = baseItems.findIndex((i) => i['action'] === 'viewEventPageQr');
      if (qrIndex !== -1) {
        baseItems.splice(qrIndex + 1, 0, scannerItem);
      }
    }

    return baseItems;
  });

  async openMenu(event: any) {
    this.currentEventData.set(event);
    const result = await this.modalService.openMenuModal(this.menuItems());
    if (!result?.role) return;

    const actions: Record<string, () => void> = {
      editEvent: () => this.editEvent(),
      viewEventAnalytics: () => this.viewEventAnalytics(),
      viewQuestionnaireResponses: () => this.viewQuestionnaireResponses(),
      manageRoles: () => this.manageRoles(),
      viewGuestList: () => this.viewGuestList(),
      viewEventPageQr: () => this.viewEventPageQr(),
      viewRsvpApproval: () => this.viewRsvpApproval(),
      viewTapToPay: () => this.viewTapToPay(),
      shareEvent: () => this.shareEvent(),
      cancelEvent: () => this.cancelEvent(),
      scanQRCode: () => this.scanQRCode(),
      duplicateEvent: () => this.duplicateEvent(),
    };
    actions[result.role]?.();
  }

  editEvent() {
    const eventId = this.currentEventData()?.id;
    if (eventId) {
      this.navigationService.navigateForward(`/event/edit/${eventId}`);
    }
  }

  viewEventAnalytics() {
    const eventId = this.currentEventData()?.id;
    if (eventId) {
      this.navigationService.navigateForward(`/event/analytics/${eventId}`);
    }
  }

  viewQuestionnaireResponses() {
    const eventId = this.currentEventData()?.id;
    if (eventId) {
      this.navigationService.navigateForward(`/event/questionnaire-response/${eventId}`);
    }
  }

  async manageRoles() {
    const eventId = this.currentEventData()?.id;
    if (eventId) {
      const participants = this.currentEventData()?.participants || [];
      const result = await this.modalService.openManageRoleModal(participants, eventId);
    }
  }

  viewGuestList() {
    const eventId = this.currentEventData()?.id;
    if (eventId) {
      this.navigationService.navigateForward(`/event/guests/${eventId}`);
    }
  }

  async viewEventPageQr() {
    const currentEventData = this.currentEventData();
    if (currentEventData) {
      const result = await this.modalService.openEventQrModal(currentEventData);
    }
  }

  viewRsvpApproval() {
    const eventId = this.currentEventData()?.id;
    if (!eventId) return;

    this.navigationService.navigateForward(`/event/rsvp-approval/${eventId}`, true);
  }

  viewTapToPay() {}

  async shareEvent() {
    const eventId = this.currentEventData()?.id;
    if (eventId) {
      const result = await this.modalService.openShareModal(eventId, 'Event', this.currentEventData()?.image_url);
      if (result) {
        this.toasterService.showSuccess('Event shared');
      }
    }
  }

  async scanQRCode(): Promise<void> {
    try {
      const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHintALLOption.ALL });
      if (ScanResult) {
        await this.handleQRCodeScanned(ScanResult);
      } else {
        this.toasterService.showError('No QR code detected');
      }
    } catch (error: any) {
      this.toasterService.showError(error?.toString()|| 'Unable to scan QR code');
    }
  }

  async cancelEvent() {
    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/deleteWhiteIcon.svg',
      iconBgColor: '#C73838',
      title: 'Cancel This Event',
      description: "Are you sure you want to cancel this event? We'll notify everyone that have registered, and issue automatic refunds.",
      confirmButtonLabel: 'Cancel Event',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left'
    });
    if (result && result.role === 'confirm') {
      const eventId = this.currentEventData()?.id;
      if (!eventId) return;

      try {
        await this.eventService.deleteEvent(eventId);
        this.toasterService.showSuccess('Event cancelled');
        this.navigationService.navigateForward('/', true);
      } catch (error) {
        console.error('Error cancelling event:', error);
        this.toasterService.showError('Failed to cancel event. Please try again.');
      }
    }
  }

  private async handleQRCodeScanned(decodedText: string): Promise<void> {
    try {
      const payload = {
        event_id: this.currentEventData().id,
        attendee_id: decodedText,
        is_checked_in: true,
        is_scanned: true
      };

      if (decodedText) {
        await this.eventService.changeCheckInStatus(payload);

        const result = await this.modalService.openScanResult(true, 'Check-in successful');

        if (result === 'scan-again') {
          this.scanQRCode();
        }
      } else {
      const result = await this.modalService.openScanResult(false, 'Invalid QR code');

        if (result === 'scan-again') {
          this.scanQRCode();
        }
      }
    } catch (error) {
      const result = await this.modalService.openScanResult(false, 'Scan failed. Please try again.');

      if (result === 'scan-again') {
        this.scanQRCode();
      }
    }
  }

  duplicateEvent(): void {
    const eventId = this.currentEventData()?.id;
    if (!eventId) return;
    this.navigationService.navigateForward('/event', false, { duplicateEventId: eventId });
  }
}
