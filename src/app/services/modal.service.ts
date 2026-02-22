import { Login } from '@/pages/login';
import { IUser } from '@/interfaces/IUser';
import { Signup } from '@/pages/signup/signup';
import { EventQr } from '@/pages/event/event-qr';
import { SubscriptionPlan } from '@/interfaces/event';
import { MenuItem } from '@/components/modal/menu-modal';
import { CreateEvent } from '@/pages/event/create-event';
import { RsvpModal } from '@/components/modal/rsvp-modal';
import { MenuModal } from '@/components/modal/menu-modal';
import { DOCUMENT, inject, Injectable, Signal } from '@angular/core';
import { TitleModal } from '@/components/modal/title-modal';
import { TicketsModal } from '@/components/modal/tickets-modal';
import { LoadingModal } from '@/components/modal/loading-modal';
import { ConfirmModal } from '@/components/modal/confirm-modal';
import { LocationModal } from '@/components/modal/location-modal';
import { AIPromptModal } from '@/components/modal/ai-prompt-modal';
import { DateTimeModal } from '@/components/modal/date-time-modal';
import { UserDetail } from '@/pages/network/components/user-detail';
import { VerifyOtpModal } from '@/components/modal/verify-otp-modal';
import { PostEventModal } from '@/components/modal/post-event-modal';
import { ShareGroup } from '@/pages/messages/components/share-group';
import { ModalController, NavController, Platform } from '@ionic/angular/standalone';
import { GifGalleryModal } from '@/components/modal/gif-gallery-modal';
import { BlockModal } from '@/components/modal/block-modal/block-modal';
import { TicketTypeModal } from '@/components/modal/ticket-type-modal';
import { ShareModal } from '@/components/modal/share-modal/share-modal';
import { AccountTypeModal } from '@/components/modal/account-type-modal';
import { TicketFormModal } from '@/components/modal/ticket-form-modal';
import { TicketsListModal } from '@/components/modal/tickets-list-modal';
import { EventFilterModal } from '@/components/modal/event-filter-modal';
import { GuestFilterModal } from '@/components/modal/guest-filter-modal';
import { ForgotPassword } from '@/pages/forgot-password/forgot-password';
import { RsvpConfirmModal } from '@/components/modal/rsvp-confirm-modal';
import { ReportModal } from '@/components/modal/report-modal/report-modal';
import { ImageGalleryModal } from '@/components/modal/image-gallery-modal';
import { CitySelectionModal } from '@/components/modal/city-selection-modal';
import { ShareProfileModal } from '@/components/modal/share-profile-modal';
import { EventCategoryModal } from '@/components/modal/event-category-modal';
import { DeleteAccountModal } from '@/components/modal/delete-account-modal';
import { PasswordSavedModal } from '@/components/modal/password-saved-modal';
import { SuccessModal } from '@/components/modal/success-modal/success-modal';
import { GroupInvitation } from '@/pages/messages/components/group-invitation';
import { PromoCodeFormModal } from '@/components/modal/promo-code-form-modal';
import { LocationFilterModal } from '@/components/modal/location-filter-modal';
import { NetworkTagModal, NetworkTag } from '@/components/modal/network-tag-modal';
import { AchievementDetailModal } from '@/components/modal/achievement-detail-modal';
import { QuestionnaireFormModal } from '@/components/modal/questionnaire-form-modal';
import { SubscriptionPlansModal } from '@/components/modal/subscription-plans-modal';
import { UnsubscribeConfirmModal } from '@/components/modal/unsubscribe-confirm-modal';
import { PhoneEmailVerifiedModal } from '@/components/modal/phone-email-verified-modal';
import { PromoCodeFormModalData, TicketFormData, TicketType } from '@/interfaces/event';
import { ManageRoleModal } from '@/components/modal/manage-role-modal/manage-role-modal';
import { RsvpDetailsData, RsvpDetailsModal } from '@/components/modal/rsvp-details-modal';
import { ProfileImageConfirmModal } from '@/components/modal/profile-image-confirm-modal';
import { QuestionnairePreviewModal } from '@/components/modal/questionnaire-preview-modal';
import { StripePaymentComponent } from '@/components/common/stripe-payment/stripe-payment';
import { ImagePreviewModal } from '@/components/modal/image-preview-modal/image-preview-modal';
import { ChatRoom } from '@/interfaces/IChat';
import { AddToCalendarModal } from '@/components/modal/add-to-calendar-modal';
import { UserSubscriptionPlans } from '@/pages/subscription-plans/user-subscription-plans';
import { ScanResultModal } from '@/components/modal/scan-result-modal';

@Injectable({ providedIn: 'root' })
export class ModalService {
  // services
  private modalCtrl = inject(ModalController);
  platform = inject(Platform);
  navCtrl = inject(NavController);
  private document = inject(DOCUMENT);

  /** References to all login modals when open (e.g. so signup can close them with success data). */
  private loginModalRefs: HTMLIonModalElement[] = [];

  async openLoadingModal(message: string): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      component: LoadingModal,
      componentProps: { message },
      cssClass: 'auto-hight-modal'
    });

    await modal.present();
    return modal;
  }

  async openPhoneEmailVerifiedModal(type: 'email' | 'mobile'): Promise<boolean> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      componentProps: { type },
      cssClass: 'auto-hight-modal',
      component: PhoneEmailVerifiedModal
    });

    await modal.present();

    await modal.onDidDismiss();
    return true;
  }

  async openPasswordSavedModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'auto-hight-modal',
      component: PasswordSavedModal
    });

    await modal.present();
  }

  async openSuccessModal(config: {
    title: string;
    description?: string;
    buttonLabel?: string;
    navigateBack?: boolean;
    navigateTo?: string;
    onClose?: () => void | Promise<void>;
  }): Promise<void> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'auto-hight-modal',
      component: SuccessModal,
      componentProps: config
    });

    await modal.present();

    if (config.onClose) {
      modal.onDidDismiss().then(() => config.onClose!());
    }
  }

  async openDeleteAccountModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'auto-hight-modal',
      component: DeleteAccountModal
    });

    await modal.present();
    await modal.onWillDismiss();
  }

  async openTitleModal(value: string): Promise<string> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: TitleModal,
      backdropDismiss: true,
      componentProps: { value },
      cssClass: 'auto-hight-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    // return original value if dismissed via backdrop without data
    return data || value;
  }

  async openDateTimeModal(type: 'date' | 'time', value?: string, min?: string, max?: string): Promise<string> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      component: DateTimeModal,
      cssClass: 'auto-hight-modal',
      componentProps: { type, value, min, max }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    // return original value if dismissed via backdrop without data
    return data || value;
  }

  async openAccountTypeModal(value: 'Individual' | 'Business'): Promise<'Individual' | 'Business'> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      componentProps: { value },
      component: AccountTypeModal,
      cssClass: 'auto-hight-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    // return original value if dismissed via backdrop without data
    return data || value;
  }

  async openLocationModal(
    location = ''
  ): Promise<{ address: string; latitude: string; longitude: string; city: string; state: string; country: string }> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      component: LocationModal,
      componentProps: { location },
      cssClass: 'modal-60-percent-height'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    // return original value if dismissed via backdrop without data
    return data || { address: location || '', latitude: '', longitude: '', city: '', state: '', country: '' };
  }

  async openEventCategoryModal(value?: string, categories?: any[]): Promise<string> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'auto-hight-modal',
      component: EventCategoryModal,
      componentProps: { value, categories }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    return data;
  }

  async openNetworkTagModal(tags: NetworkTag[], initialSelectedTags: string[]): Promise<string[] | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: NetworkTagModal,
      backdropDismiss: true,
      cssClass: 'modal-60-percent-height ',
      componentProps: {
        title: 'Networked Meta Tags',
        subtitle: 'Select up to 5',
        tags,
        initialSelectedTags,
        maxSelections: 5
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data && Array.isArray(data) ? data : null;
  }

  async openAIPromptModal(conversation: any[], isEvent?: boolean): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'modal-60-percent-height',
      component: AIPromptModal,
      componentProps: {
        conversation,
        isEvent
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openTicketModal(
    ticketType: TicketType,
    initialData?: Partial<TicketFormData>,
    eventDate?: string | null,
    eventStartTime?: string | null,
    eventEndTime?: string | null
  ): Promise<{ data: TicketFormData; role: string } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: TicketFormModal,
      cssClass: 'modal-60-percent-height',
      backdropDismiss: false,
      componentProps: {
        ticketType,
        initialData,
        eventDate,
        eventStartTime,
        eventEndTime
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    return data && role === 'save' ? { data, role } : null;
  }

  async openTicketTypeModal(isPaid: boolean = true, hasFreeTicket: boolean = false): Promise<TicketType | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: TicketTypeModal,
      cssClass: 'auto-hight-modal',
      backdropDismiss: true,
      componentProps: { isPaid, hasFreeTicket }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    return role === 'select' && data ? (data as TicketType) : null;
  }

  async openPromoCodeModal(initialData?: Partial<PromoCodeFormModalData>): Promise<{ data: PromoCodeFormModalData; role: string } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: PromoCodeFormModal,
      cssClass: 'modal-60-percent-height',
      backdropDismiss: false,
      componentProps: {
        initialData
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    return data && role === 'save' ? { data, role } : null;
  }

  async openSubscriptionPlansModal(plans: SubscriptionPlan[], selectedPlanIds: string[] = []): Promise<string[] | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: SubscriptionPlansModal,
      cssClass: 'modal-60-percent-height',
      backdropDismiss: true,
      componentProps: {
        plans,
        selectedPlanIds
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data && Array.isArray(data) ? data : null;
  }

  async openConfirmModal(config: {
    icon?: string;
    title: string;
    iconName?: string;
    description: string;
    customColor?: string;
    iconBgColor?: string;
    shareButtonLabel?: string;
    backdropDismiss?: boolean;
    confirmButtonLabel: string;
    cancelButtonLabel?: string;
    confirmButtonColor?: string;
    onConfirm?: () => Promise<any>;
    iconPosition?: 'left' | 'center';
    onShare?: () => void | Promise<void>;
    confirmButtonLabelSignal?: Signal<string>;
  }): Promise<{ data: any; role: string } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      componentProps: config,
      component: ConfirmModal,
      cssClass: 'auto-hight-modal',
      backdropDismiss: config.backdropDismiss
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    return { data, role: role || '' };
  }

  async openRepeatingEventModal(eventData: any): Promise<{ data: any; role: string } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: CreateEvent,
      cssClass: 'modal-80-percent-height',
      backdropDismiss: false,
      componentProps: {
        isModalMode: true,
        eventData: eventData
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    return data && role === 'save' ? { data, role } : null;
  }

  async openQuestionnaireFormModal(type: 'pre-event' | 'post-event', initialData?: any): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: QuestionnaireFormModal,
      componentProps: {
        type,
        initialData
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openOtpModal(email: string, mobile: string): Promise<boolean> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      component: VerifyOtpModal,
      cssClass: 'auto-hight-modal',
      componentProps: { email, mobile }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    return data;
  }

  async showProfileImageConfirmationModal(file: File): Promise<{ action: 'confirm' | 'retake' | 'cancel'; file?: File }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        const imageDataUrl = e.target.result as string;

        const modal = await this.modalCtrl.create({
          mode: 'ios',
          handle: true,
          breakpoints: [0, 1],
          initialBreakpoint: 1,
          backdropDismiss: false,
          cssClass: 'auto-hight-modal',
          componentProps: { imageDataUrl },
          component: ProfileImageConfirmModal
        });

        await modal.present();

        const { data } = await modal.onWillDismiss();

        if (data && data.action === 'confirm') {
          const returnedUrl = (data.imageDataUrl as string) || imageDataUrl;

          let croppedFile: any;

          if (returnedUrl.startsWith('blob:')) {
            const response = await fetch(returnedUrl);
            const blob = await response.blob();
            croppedFile = new File([blob], file.name, { type: blob.type || file.type });
          }
          resolve({ action: 'confirm', file: croppedFile });
        } else if (data && data.action === 'retake') {
          resolve({ action: 'retake' });
        } else {
          resolve({ action: 'cancel' });
        }
      };
      reader.readAsDataURL(file);
    });
  }

  async openImageGalleryModal(title = 'Select Image', multiSelect = true): Promise<string | string[] | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      component: ImageGalleryModal,
      cssClass: 'modal-80-percent-height',
      componentProps: { title, multiSelect }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    return data;
  }

  async openGifGalleryModal(title = 'Select GIF', multiSelect = true): Promise<string | string[] | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      component: GifGalleryModal,
      cssClass: 'modal-80-percent-height',
      componentProps: { title, multiSelect }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    return data;
  }

  async openMenuModal(items: MenuItem[]): Promise<{ role: string; data?: MenuItem } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: MenuModal,
      cssClass: 'auto-hight-modal',
      componentProps: {
        items
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data ?? null;
  }

  async openShareGroupModal(data: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: ShareGroup,
      cssClass: 'auto-hight-modal',
      componentProps: {
        data: data
      }
    });
    await modal.present();
    const { data: shareGroupData } = await modal.onWillDismiss();
    return shareGroupData;
  }

  async openGroupInvitationModal(room: ChatRoom | null): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: GroupInvitation,
      backdropDismiss: false,
      cssClass: 'auto-hight-modal',
      componentProps: { room }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openLocationFilterModal(initialValues?: {
    location?: string;
    latitude?: string;
    longitude?: string;
    radius?: number;
  }): Promise<{ location?: string; latitude?: string; longitude?: string; radius?: number } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'auto-hight-modal',
      component: LocationFilterModal,
      componentProps: { initialValues }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openUserDetailModal(user: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'auto-hight-modal',
      component: UserDetail,
      componentProps: { user }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openManageRoleModal(participants: any[], eventId: string): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: ManageRoleModal,
      cssClass: 'modal-60-percent-height',
      componentProps: { participants, eventId }
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data ?? null;
  }

  async openGuestFilterModal(filter: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: GuestFilterModal,
      cssClass: 'auto-hight-modal',
      componentProps: { initialFilter: filter }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openShareModal(id: any, type: 'Event' | 'Post' | 'Plan'): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: ShareModal,
      cssClass: 'modal-60-percent-height',
      componentProps: { id, type }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openShareProfileModal(user: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: ShareProfileModal,
      cssClass: 'auto-hight-modal',
      componentProps: { user }
    });
    await modal.present();
    const height = this.platform.height() - 180;
    const innerContent = this.document.getElementsByClassName('inner-content')[0];
    if (innerContent && innerContent instanceof HTMLElement) {
      innerContent.style.maxHeight = `${height}px`;
    }
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openPostEventModal(): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: PostEventModal
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openImagePreviewModal(url: string): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      component: ImagePreviewModal,
      componentProps: { url }
    });
    await modal.present();
  }

  async openReportModal(type: 'Post' | 'Event' | 'Comment' | 'User', user?: IUser): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: ReportModal,
      cssClass: 'auto-hight-modal',
      componentProps: { type, user }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openBlockModal(user: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: BlockModal,
      componentProps: { user },
      cssClass: 'auto-hight-modal'
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openAchievementDetailModal(achievement: any, categoryKey?: string): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: AchievementDetailModal,
      cssClass: 'auto-hight-modal',
      componentProps: {
        achievement,
        categoryKey
      }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data;
  }

  async openEventFilterModal(initialValues?: {
    location?: string;
    eventDate?: string;
    distance?: number;
    latitude?: string;
    longitude?: string;
  }): Promise<{ location?: string; eventDate?: string; distance?: number; latitude?: string; longitude?: string } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'auto-hight-modal',
      component: EventFilterModal,
      componentProps: { initialValues }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async openRsvpModal(
    tickets: any[],
    eventTitle?: string,
    questionnaire?: any,
    promo_codes?: any[],
    hostPaysFees?: boolean,
    additionalFees?: string | number | null,
    maxAttendeesPerUser?: number,
    hostName?: string,
    eventId?: string,
    hasPlans?: boolean,
    hasSubscribed?: boolean,
    isSubscriberExclusive?: boolean,
    plans?: any[],
    date?: string,
    location?: string,
    participants?: Array<{ user_id?: string; user?: { id?: string }; role?: string }>
  ): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'modal-60-percent-height',
      component: RsvpModal,
      componentProps: {
        tickets,
        eventTitle,
        questionnaire,
        promo_codes,
        hostPaysFees,
        additionalFees,
        maxAttendeesPerUser,
        hostName,
        eventId,
        hasPlans,
        hasSubscribed,
        isSubscriberExclusive,
        plans,
        date,
        location,
        participants: participants ?? []
      }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    return data || null;
  }

  async openQuestionnairePreviewModal(questions: any[], isPreviewMode: boolean = false): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'modal-60-percent-height',
      component: QuestionnairePreviewModal,
      componentProps: {
        questions,
        isPreviewMode
      }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    return data || null;
  }

  async openRsvpDetailsModal(
    eventTitle: string,
    date: string,
    location: string,
    eventId: string,
    rsvpData: RsvpDetailsData,
    hostPaysFees?: boolean,
    additionalFees?: string | number | null,
    hostName?: string
  ): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'modal-60-percent-height',
      component: RsvpDetailsModal,
      componentProps: { eventTitle, date, location, eventId, rsvpData, hostPaysFees, additionalFees, hostName }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    return data || null;
  }

  async openCitySelectionModal(selectedCity?: { city: string; state: string }): Promise<{ city: string; state: string; fullName: string } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: true,
      component: CitySelectionModal,
      componentProps: {
        selectedCity: selectedCity
      },
      cssClass: 'modal-60-percent-height'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    return data || null;
  }

  async openRsvpConfirmModal(eventData: any, options?: { showFinishProfileSetup?: boolean }): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: RsvpConfirmModal,
      cssClass: 'auto-hight-modal',
      componentProps: {
        eventData,
        showFinishProfileSetup: options?.showFinishProfileSetup ?? false
      }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    return data ?? null;
  }

  async openUnsubscribeConfirmModal(config: {
    planName: string;
    endDate: string;
    onConfirm?: () => Promise<void>;
  }): Promise<{ confirmed: boolean } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: UnsubscribeConfirmModal,
      cssClass: 'auto-hight-modal',
      componentProps: config,
      backdropDismiss: false
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async openLoginModal(returnUrl?: string): Promise<{ success: boolean; isNewUser?: boolean } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'modal-80-percent-height',
      component: Login,

      componentProps: {
        isRsvpModal: true,
        onLoginSuccess: (isNewUser?: boolean) => {
          if (returnUrl) {
            this.navCtrl.navigateForward(returnUrl);
          }
          // Close all login modals when login succeeds (similar to signup)
          const payload = { success: true, isNewUser: isNewUser ?? false };
          const loginModals = [...this.loginModalRefs];
          this.loginModalRefs = [];
          loginModals.forEach((loginModal) => loginModal.dismiss(payload));
        }
      }
    });

    if (!modal) return null;
    this.loginModalRefs.push(modal);
    modal.onWillDismiss().then(() => {
      const index = this.loginModalRefs.indexOf(modal);
      if (index > -1) this.loginModalRefs.splice(index, 1);
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data ?? null;
  }

  async openSignupModal(): Promise<{ success: boolean; isNewUser?: boolean } | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'modal-80-percent-height',
      component: Signup,
      componentProps: {
        isRsvpModal: true,
        onSignupSuccess: (isNewUser?: boolean) => {
          const payload = { success: true, isNewUser: isNewUser ?? true };
          modal.dismiss(payload);
          // Force-close all login modals by reference so awaited flow gets success data
          const loginModals = [...this.loginModalRefs];
          this.loginModalRefs = [];
          loginModals.forEach((loginModal) => loginModal.dismiss(payload));
        }
      }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data ?? null;
  }

  async openForgotPasswordModal(): Promise<any> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: ForgotPassword,
      componentProps: {
        isRsvpModal: true,
        onForgotPasswordSuccess: () => {
          modal.dismiss();
          this.close();
        }
      }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async dismissAllModals(): Promise<void> {
    let topModal = await this.modalCtrl.getTop();
    while (topModal) {
      await this.modalCtrl.dismiss();
      topModal = await this.modalCtrl.getTop();
    }
  }

  async close(data?: any, role?: string): Promise<void> {
    const modal = await this.modalCtrl.getTop();
    if (modal) await modal.dismiss(data, role);
  }

  async openSubscriptionPaymentModal(config: {
    clientSecret: string;
    amount: number;
    summary: { label: string; amount: number }[];
  }): Promise<{ success: boolean; subscriptionId?: string } | null> {
    const modal = await this.modalCtrl.create({
      component: StripePaymentComponent,
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'auto-hight-modal',
      componentProps: {
        amount: config.amount,
        summary: config.summary,
        clientSecretInput: config.clientSecret,
        showButtons: true,
        isModalMode: true
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'success') {
      return { success: true, subscriptionId: data?.subscriptionId };
    }

    return null;
  }

  async openTicketsListModal(tickets: any[]): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: TicketsListModal,
      cssClass: 'modal-60-percent-height',
      componentProps: { tickets }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async openAddToCalendarModal(eventData: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: AddToCalendarModal,
      cssClass: 'auto-hight-modal',
      componentProps: { eventData }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async openMyTicketsModal(eventData: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: TicketsModal,
      cssClass: 'modal-80-percent-height',
      componentProps: { eventData }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async openEventQrModal(event: any): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: EventQr,
      cssClass: 'modal-80-percent-height',
      componentProps: { event }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async openSubscriptionModal(id: string): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: UserSubscriptionPlans,
      cssClass: 'modal-80-percent-height',
      componentProps: { id }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    return data || null;
  }

  async openScanResult(isSuccess: boolean, message: string): Promise<any | null> {
    const modal = await this.modalCtrl.create({
      mode: 'ios',
      handle: true,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      component: ScanResultModal,
      cssClass: 'auto-hight-modal',
      componentProps: { isSuccess, message }
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    return data || null;
  }
}
