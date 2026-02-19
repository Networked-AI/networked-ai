import { Subscription } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { Button } from '@/components/form/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '@/services/auth.service';
import { EventService } from '@/services/event.service';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MediaService } from '@/services/media.service';
import { ModalService } from '@/services/modal.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { EventDisplay } from '@/components/common/event-display';
import { NavigationService } from '@/services/navigation.service';
import { EventDetails } from '@/pages/event/components/event-details';
import { EventTickets } from '@/pages/event/components/event-tickets';
import { SegmentButtonItem } from '@/components/common/segment-button';
import { EventSettings } from '@/pages/event/components/event-settings';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonHeader, IonFooter, IonContent, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { Ticket, PromoCode, EventForm, EventDisplayData, RepeatingFrequencyType, SubscriptionPlan, IEvent } from '@/interfaces/event';
import { Input, signal, inject, computed, Component, ChangeDetectionStrategy, ViewChild, OnInit, OnDestroy, effect } from '@angular/core';

const EVENT_STEPS = {
  EVENT_DETAILS: 1,
  EVENT_TICKETS: 2,
  EVENT_SETTINGS: 3,
  EVENT_PREVIEW: 4
};

@Component({
  imports: [
    Button,
    IonHeader,
    IonFooter,
    IonToolbar,
    IonContent,
    CommonModule,
    EventDetails,
    EventTickets,
    EventSettings,
    EventDisplay,
    DragDropModule,
    CheckboxModule,
    InputTextModule,
    ReactiveFormsModule
  ],
  selector: 'create-event',
  styleUrl: './create-event.scss',
  templateUrl: './create-event.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateEvent implements OnInit, OnDestroy {
  @ViewChild(EventTickets) eventTickets!: EventTickets;
  private datePipe = new DatePipe('en-US');

  // inputs
  @Input() isModalMode: boolean = false;
  @Input() eventData: any | null = null;

  // services
  fb = inject(FormBuilder);
  router = inject(Router);
  route = inject(ActivatedRoute);
  authService = inject(AuthService);
  modalService = inject(ModalService);
  modalCtrl = inject(ModalController);
  mediaService = inject(MediaService);
  eventService = inject(EventService);
  toasterService = inject(ToasterService);
  navigationService = inject(NavigationService);

  // subscriptions
  queryParamsSubscription!: Subscription;
  previewFormValueSubscription?: Subscription;

  // signals
  eventForm = signal<FormGroup<EventForm>>(
    this.fb.group<EventForm>({
      medias: this.fb.control<(string | File)[] | null>(null),
      until_finished: this.fb.control<boolean>(false),
      vibes: this.fb.control<string[]>([], [Validators.required]),
      category_id: this.fb.control<string | null>(null),
      category: this.fb.control<string | null>(null),
      address: this.fb.control<string | null>(null, [Validators.required]),
      latitude: this.fb.control<string | null>(null),
      longitude: this.fb.control<string | null>(null),
      city: this.fb.control<string | null>(null),
      state: this.fb.control<string | null>(null),
      country: this.fb.control<string | null>(null),
      tickets: this.fb.control<Ticket[] | null>([]),
      promo_codes: this.fb.control<PromoCode[] | null>([]),
      is_subscription: this.fb.control<boolean | null>(false),
      subscription_plan: this.fb.control<string | null>(null),
      plan_ids: this.fb.control<string[] | null>([]),
      is_subscriber_exclusive: this.fb.control<boolean | null>(false),
      host_pays_platform_fee: this.fb.control<boolean | null>(false),
      guest_fee_enabled: this.fb.control<boolean | null>(false),
      additional_fees: this.fb.control<string | null>(''),
      participants: this.fb.control<Array<{ user_id: string; role: string; thumbnail_url?: string; name?: string }> | null>([]),
      is_public: this.fb.control<boolean | null>(true),
      max_attendees_per_user: this.fb.control<number | null>(null),
      allow_plus_ones: this.fb.control<boolean | null>(false),
      is_repeating_event: this.fb.control<boolean | null>(false),
      repeating_frequency: this.fb.control<RepeatingFrequencyType | null>('weekly'),
      repeat_count: this.fb.control<number | 'custom' | null>(null),
      repeating_events: this.fb.control<any[] | null>([]),
      custom_repeat_count: this.fb.control<number | null>(null),
      questionnaire: this.fb.control<any | null>(null)
    })
  );

  allowLeave = signal(false);
  isLoading = signal(false);
  isCreating = signal(false);
  isEditMode = signal(false);
  isSubmitted = signal(false);
  isUploadingMedia = signal(false);
  selectedDate = signal<string>('');
  previewFormChangeTrigger = signal(0);
  steps = signal<number[]>([1, 2, 3, 4]);
  editingEventId = signal<string | null>(null);
  currentStep = signal<number>(EVENT_STEPS.EVENT_DETAILS);

  step1Fields = ['title', 'date', 'address', 'category_id', 'description', 'vibes', 'start_time', 'end_time', 'until_finished'];
  step2Fields = ['tickets', 'promo_codes', 'is_subscription', 'subscription_plan', 'host_pays_platform_fee', 'additional_fees'];

  stepHeading = computed(() => {
    const stepHeadings: Record<number, string> = {
      [EVENT_STEPS.EVENT_DETAILS]: 'Event Details',
      [EVENT_STEPS.EVENT_TICKETS]: 'Event Tickets',
      [EVENT_STEPS.EVENT_SETTINGS]: 'Event Settings',
      [EVENT_STEPS.EVENT_PREVIEW]: 'Event Preview'
    };
    return stepHeadings[this.currentStep()] || 'Event Details';
  });

  buttonLabel = computed(() => {
    if (this.isUploadingMedia()) {
      return 'Uploading media...';
    }
    if (this.isCreating()) {
      return 'Saving event data...';
    }
    const labels: Record<number, string> = {
      [EVENT_STEPS.EVENT_DETAILS]: 'Setup Tickets',
      [EVENT_STEPS.EVENT_TICKETS]: 'Event Settings',
      [EVENT_STEPS.EVENT_SETTINGS]: 'Preview Before Publishing',
      [EVENT_STEPS.EVENT_PREVIEW]: this.isEditMode() ? 'Republish Event' : 'Publish Event'
    };
    return labels[this.currentStep()] || 'Next';
  });

  isButtonDisabled = computed(() => {
    return this.isUploadingMedia() || this.isCreating();
  });

  buttonIcon = computed(() => {
    if (this.isUploadingMedia() || this.isCreating()) {
      return '';
    }
    const step = this.currentStep();
    return step === EVENT_STEPS.EVENT_PREVIEW ? 'pi-check' : 'pi-arrow-right';
  });

  iconPos = computed(() => {
    return this.currentStep() === EVENT_STEPS.EVENT_PREVIEW ? 'left' : 'right';
  });

  hasQuestionnaire = computed(() => {
    this.previewFormChangeTrigger();
    const selectedEvent = this.selectedEventData();
    const questionnaire = selectedEvent?.questionnaire || this.eventForm().get('questionnaire')?.value;
    return questionnaire && Array.isArray(questionnaire) && questionnaire.length > 0;
  });

  repeatingEvents = computed(() => {
    this.previewFormChangeTrigger();
    return this.eventForm().get('repeating_events')?.value || [];
  });

  isRepeatingEvent = computed(() => {
    this.previewFormChangeTrigger();
    const isRepeating = this.eventForm().get('is_repeating_event')?.value ?? false;
    const repeating = this.repeatingEvents();
    return isRepeating || (Array.isArray(repeating) && repeating.length > 0);
  });

  baseEventDate = computed(() => {
    this.previewFormChangeTrigger();
    return this.eventForm().get('date')?.value || '';
  });

  selectedEventData = computed(() => {
    const selected = this.selectedDate();
    const repeating = this.repeatingEvents();
    const baseDate = this.baseEventDate();
    if (selected && baseDate) {
      const baseDateKey = this.eventService.formatDateKey(baseDate);
      if (baseDateKey === selected) {
        return null;
      }
    }

    if (selected && repeating && repeating.length > 0) {
      const event = repeating.find((e: any) => {
        const dateStr = e.date;
        return dateStr ? this.eventService.formatDateKey(dateStr) === selected : false;
      });
      if (event) {
        return event;
      }
    }

    return null;
  });

  eventDate = computed(() => {
    const selectedEvent = this.selectedEventData();
    if (selectedEvent?.date) {
      return selectedEvent.date;
    }

    const selectedDateStr = this.selectedDate();
    if (selectedDateStr) {
      const [month, day] = selectedDateStr.split('/');
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return this.baseEventDate();
  });

  participants = computed(() => {
    this.previewFormChangeTrigger();
    const selectedEvent = this.selectedEventData();
    return selectedEvent?.participants || this.eventForm().get('participants')?.value || [];
  });

  formattedLocation = computed(() => {
    this.previewFormChangeTrigger();
    const selectedEvent = this.selectedEventData();
    const form = this.eventForm();
    const address = selectedEvent?.address || form.get('address')?.value || '';
    const city = selectedEvent?.city || form.get('city')?.value || '';
    const state = selectedEvent?.state || form.get('state')?.value || '';
    const country = selectedEvent?.country || form.get('country')?.value || '';
    return this.eventService.formatLocation(address, city, state, country);
  });

  userSections = computed(() => {
    this.previewFormChangeTrigger();
    const participants = this.participants();
    if (!participants || !Array.isArray(participants)) return [];

    return this.eventService.getUserSections(participants, []);
  });

  dateItems = computed<SegmentButtonItem[]>(() => {
    return this.eventService.createDateItemsFromForm(this.repeatingEvents(), this.baseEventDate(), this.isRepeatingEvent());
  });

  eventDisplayData = computed<Partial<EventDisplayData>>(() => {
    this.previewFormChangeTrigger();
    const form = this.eventForm();
    const selectedEvent = this.selectedEventData();

    const eventData: any = {
      medias: selectedEvent?.medias || form.get('medias')?.value || [],
      title: selectedEvent?.title || form.get('title')?.value || '',
      description: selectedEvent?.description || form.get('description')?.value || '',
      date: selectedEvent?.date || form.get('date')?.value,
      start_time: selectedEvent?.start_time || form.get('start_time')?.value || '',
      end_time: selectedEvent?.end_time || form.get('end_time')?.value || '',
      until_finished: selectedEvent?.until_finished ?? form.get('until_finished')?.value ?? false,
      tickets: selectedEvent?.tickets || form.get('tickets')?.value || [],
      is_public: selectedEvent?.is_public ?? form.get('is_public')?.value ?? true,
      latitude: selectedEvent?.latitude || form.get('latitude')?.value,
      longitude: selectedEvent?.longitude || form.get('longitude')?.value,
      address: selectedEvent?.address || form.get('address')?.value || '',
      city: selectedEvent?.city || form.get('city')?.value || '',
      state: selectedEvent?.state || form.get('state')?.value || '',
      country: selectedEvent?.country || form.get('country')?.value || '',
      is_subscriber_exclusive: selectedEvent?.is_subscriber_exclusive || form.get('is_subscriber_exclusive')?.value || '',
      plan_ids: selectedEvent?.plan_ids || form.get('plan_ids')?.value || '',
      participants: this.participants()
    };

    return this.eventService.transformEventDataForDisplay(eventData, null, null, {
      userSections: this.userSections(),
      dateItems: this.dateItems(),
      isRepeatingEvent: this.isRepeatingEvent(),
      formattedLocation: this.formattedLocation()
    });
  });

  onDateChange(date: string): void {
    this.selectedDate.set(date);
  }

  constructor() {
    effect(() => {
      const items = this.dateItems();
      if (items.length > 0 && !this.selectedDate()) {
        this.selectedDate.set(items[0].value);
      }
    });

    // Trigger preview update when navigating to preview step
    effect(() => {
      if (this.currentStep() === EVENT_STEPS.EVENT_PREVIEW) {
        this.previewFormChangeTrigger.update((v) => v + 1);
      }
    });
  }

  beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    if (this.isModalMode) {
      return;
    }

    const eventId = this.route.snapshot.paramMap.get('id');
    if (eventId) {
      this.editingEventId.set(eventId);
      this.isEditMode.set(true);
      this.loadEventForEdit();
    }

    const initialStep = this.route.snapshot.queryParams['step'];
    if (initialStep) {
      const step = parseInt(initialStep, 10);
      if (this.steps().includes(step)) {
        this.currentStep.set(step);
      }
    }

    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      const currentStep = params.get('step');
      if (!currentStep) return;

      const requestedStep = parseInt(currentStep, 10);
      if (this.steps().includes(requestedStep) && requestedStep !== this.currentStep()) {
        this.currentStep.set(requestedStep);
      }
    });
  }

  async ionViewWillEnter(): Promise<void> {
    const form = this.eventForm();
    const currentUser = this.authService.currentUser();

    if (this.eventData && this.isModalMode) {
      form.patchValue(this.eventData as any);
    } else if (this.isEditMode() && this.editingEventId()) {
      await this.loadEventForEdit();
    } else {
      const defaultParticipants: Array<{ user_id: string; role: string; thumbnail_url?: string; name?: string }> = [];

      if (currentUser?.id) {
        defaultParticipants.push({
          user_id: currentUser.id,
          role: 'Host',
          thumbnail_url: currentUser.thumbnail_url,
          name: currentUser.name
        });
      }

      form.patchValue({
        date: this.datePipe.transform(new Date(), 'yyyy-MM-dd'),
        start_time: this.eventService.addMinutesToTime(this.eventService.getCurrentTime(), 30),
        is_public: true,
        participants: defaultParticipants
      });
    }

    form.get('start_time')?.valueChanges.subscribe((value) => {
      if (value) {
        const endTimeControl = form.get('end_time');
        const currentEndTime = endTimeControl?.value;

        if (!currentEndTime || this.eventService.isTimeAfter(value, currentEndTime)) {
          endTimeControl?.setValue(this.eventService.addMinutesToTime(value, 30));
        }
      }
    });

    form.get('custom_repeat_count')?.valueChanges.subscribe((value) => {
      if (value) {
        form.patchValue({ repeat_count: value });
        this.generateRepeatingEventsIfReady();
      }
    });

    form.get('until_finished')?.valueChanges.subscribe((value) => {
      const endTimeControl = form.get('end_time');

      if (value) {
        endTimeControl?.setValue('23:59', { emitEvent: false });
      }
    });

    form.get('is_repeating_event')?.valueChanges.subscribe((value) => {
      if (!value) {
        form.patchValue({
          repeating_events: [],
          repeating_frequency: null,
          repeat_count: null,
          custom_repeat_count: null
        });
      }
    });

    this.previewFormValueSubscription = form.valueChanges.subscribe(() => {
      this.previewFormChangeTrigger.update((v) => v + 1);
    });
  }

  async loadEventForEdit(): Promise<void> {
    const eventId = this.editingEventId();
    if (!eventId) return;

    try {
      this.isLoading.set(true);
      const eventData = await this.eventService.getEventById(eventId);

      if (eventData) {
        const formData = this.eventService.transformEventDataToForm(eventData);
        this.eventForm().patchValue(formData);
      }
    } catch (error) {
      const errorMessage = BaseApiService.getErrorMessage(error, 'Failed to load event data.');
      this.toasterService.showError(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }

  getFieldValue<T>(field: string): T | null {
    return this.eventForm().get(field)?.value ?? null;
  }

  get tickets(): any[] {
    this.previewFormChangeTrigger();
    return this.eventForm().get('tickets')?.value ?? [];
  }

  async previousStep(): Promise<void> {
    if (this.currentStep() === EVENT_STEPS.EVENT_DETAILS) {
      if (this.isModalMode) {
        this.modalService.close();
        return;
      }
      const confirmed = await this.showLeaveConfirm();

      if (confirmed) {
        this.allowLeave.set(true);

        if (this.router.currentNavigation()?.previousNavigation) {
          this.navigationService.back();
        } else {
          this.navigationService.navigateForward('/', true);
        }
      }
    } else {
      const previousStep = this.currentStep() - 1;
      this.navigateToStep(previousStep);
    }
  }

  private async showLeaveConfirm(): Promise<boolean> {
    const confirmed = await this.modalService.openConfirmModal({
      icon: 'assets/svg/alert-white.svg',
      title: 'Unsaved Changes',
      description: 'Are you sure you want to go back? Any unsaved changes will be lost.',
      confirmButtonLabel: 'Go',
      cancelButtonLabel: 'Stay',
      confirmButtonColor: 'danger',
      iconBgColor: '#C73838',
      iconPosition: 'left'
    });

    return confirmed?.data;
  }

  async confirmLeave(): Promise<boolean> {
    if (this.allowLeave()) return true;

    const confirmed = await this.showLeaveConfirm();

    if (confirmed) {
      this.allowLeave.set(true);
    }

    return confirmed;
  }

  navigateToStep(step: number): void {
    this.currentStep.set(step);

    // Trigger preview update when navigating to preview step
    if (step === EVENT_STEPS.EVENT_PREVIEW) {
      this.previewFormChangeTrigger.update((v) => v + 1);
    }

    if (!this.isModalMode) {
      this.router.navigate([], {
        queryParams: { step },
        relativeTo: this.route,
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  handleButtonClick(): void {
    const step = this.currentStep();
    if (this.isModalMode && step === EVENT_STEPS.EVENT_SETTINGS) {
      this.saveRepeatingEventChanges();
      return;
    }
    if (step === EVENT_STEPS.EVENT_PREVIEW) {
      this.createEvent();
    } else {
      this.nextStep();
    }
  }

  validateFields(fieldNames: string[]): boolean {
    this.isSubmitted.set(true);
    const form = this.eventForm();
    const isValid = fieldNames.every((field) => {
      const control = form.get(field);
      return control ? control.disabled || control.valid : false;
    });

    if (!isValid) {
      fieldNames.forEach((field) => {
        const control = form.get(field);
        if (control && !control.disabled) {
          control.markAsTouched();
          control.updateValueAndValidity();
        }
      });
    }

    return isValid;
  }

  nextStep(): void {
    if (this.currentStep() === EVENT_STEPS.EVENT_DETAILS) {
      const form = this.eventForm();
      const untilFinished = form.get('until_finished')?.value;
      const fieldsToValidate = untilFinished ? this.step1Fields.filter((field) => field !== 'end_time') : this.step1Fields;

      if (!this.validateFields(fieldsToValidate)) {
        this.toasterService.showError('Please fill all required fields.');
        return;
      }

      const mediaItems = this.getFieldValue<Array<{ id: string; type: string; file?: File; url: string }>>('medias') || [];
      if (mediaItems.length === 0 || (mediaItems[0].type !== 'image' && mediaItems[0].type !== 'gif')) {
        this.toasterService.showError('Please add at least one image or GIF.');
        return;
      }

      this.navigateToStep(EVENT_STEPS.EVENT_TICKETS);
    } else if (this.currentStep() === EVENT_STEPS.EVENT_TICKETS) {
      const isSubscriberExclusive = this.getFieldValue<boolean>('is_subscriber_exclusive') ?? false;

      if (isSubscriberExclusive) {
        // Validate that at least one plan is selected when subscriber exclusive is enabled
        const planIds = this.getFieldValue<string[]>('plan_ids') || [];
        if (planIds.length === 0) {
          this.toasterService.showError('Please select at least one subscription plan for subscribers exclusive events.');
          return;
        }
      } else {
        // Regular validation: require at least one ticket
        const tickets = this.getFieldValue<Ticket[]>('tickets') || [];
        if (tickets.length === 0) {
          this.toasterService.showError('Please add at least one ticket.');
          return;
        }
      }

      this.navigateToStep(EVENT_STEPS.EVENT_SETTINGS);
    } else if (this.currentStep() === EVENT_STEPS.EVENT_SETTINGS) {
      this.navigateToStep(EVENT_STEPS.EVENT_PREVIEW);
    }
  }

  async saveRepeatingEventChanges(): Promise<void> {
    if (this.isModalMode) {
      this.isModalMode = false;
      this.modalCtrl.dismiss(this.eventForm().value, 'save');
      return;
    }
    this.modalService.close();
  }

  cancelModal(): void {
    this.modalService.close();
  }

  generateRepeatingEventsIfReady(): void {
    const form = this.eventForm();
    const frequency = form.get('repeating_frequency')?.value;
    const count = form.get('repeat_count')?.value;
    const customCount = form.get('custom_repeat_count')?.value;

    if (!frequency || !count) {
      return;
    }

    const finalCount = count === 'custom' ? customCount || 0 : count;
    if (finalCount <= 0) {
      return;
    }
    this.generateRepeatingEvents();
  }

  generateRepeatingEvents(): void {
    const form = this.eventForm();
    const values = form.getRawValue();

    const { repeating_frequency: frequency, repeat_count: count, custom_repeat_count: customCount, date } = values;

    const finalCount = count === 'custom' ? customCount || 0 : count || 0;
    if (!date || finalCount <= 0) return;

    const [year, month, day] = date.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);

    const events: Array<Record<string, unknown>> = [];

    const baseDay = baseDate.getDate();
    const lastDayOfBaseMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();

    const isLastDayOfMonth = baseDay === lastDayOfBaseMonth;

    for (let i = 2; i <= finalCount; i++) {
      let eventDate = new Date(baseDate);

      if (frequency === 'weekly') {
        eventDate.setDate(baseDate.getDate() + (i - 1) * 7);
      } else if (frequency === 'monthly') {
        const targetMonthIndex = baseDate.getMonth() + (i - 1);

        const targetYear = baseDate.getFullYear() + Math.floor(targetMonthIndex / 12);
        const targetMonth = targetMonthIndex % 12;

        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

        const targetDay = isLastDayOfMonth ? lastDayOfTargetMonth : Math.min(baseDay, lastDayOfTargetMonth);

        eventDate = new Date(targetYear, targetMonth, targetDay);
      }

      events.push({
        ...values,
        id: `repeating-event-${i}-${Date.now()}-${i}`,
        eventNumber: i,
        date: this.datePipe.transform(eventDate, 'yyyy-MM-dd') ?? ''
      });
    }

    form.patchValue({
      repeating_events: events as unknown as IEvent[]
    });
  }

  async uploadAndFormatMedia(mediaItems: Array<{ id: string; type: string; file?: File; url: string }>): Promise<any[]> {
    if (mediaItems.length === 0) {
      return [];
    }

    // Upload files that need upload (only files)
    const filesToUpload = mediaItems.filter((item) => item.file).map((item) => item.file!);

    let uploadedResults: any[] = [];

    if (filesToUpload.length > 0) {
      this.isUploadingMedia.set(true);
      try {
        const uploadResponse = await this.mediaService.uploadMedia('Event', filesToUpload);
        uploadedResults = uploadResponse?.data || [];
      } finally {
        this.isUploadingMedia.set(false);
      }
    }

    // Build medias array maintaining original order
    const medias: Array<{
      id: string;
      media_url: string;
      media_type: 'Image' | 'Video';
      order: number;
    }> = [];

    let uploadedIndex = 0;

    for (const item of mediaItems) {
      let mediaUrl: string | undefined;
      let mediaType: 'Image' | 'Video' | undefined;

      if (item.file) {
        // Use uploaded URL (new file)
        const uploaded = uploadedResults[uploadedIndex++];

        if (!uploaded?.url && !uploaded?.media_url && !uploaded?.path) continue;

        mediaUrl = uploaded.url || uploaded.media_url || uploaded.path;
        mediaType = this.getMediaTypeFromMimetype(uploaded.mimetype);
      } else if (item.url) {
        // Use existing URL
        if (this.isBlobUrl(item.url)) continue;

        mediaUrl = item.url;
        mediaType = item.type === 'video' ? 'Video' : 'Image';
      }

      if (mediaUrl && mediaType) {
        medias.push({
          id: item.id, // ✅ added id here
          media_url: mediaUrl,
          media_type: mediaType,
          order: medias.length + 1
        });
      }
    }

    return medias;
  }

  private getMediaTypeFromMimetype(mimetype?: string): 'Image' | 'Video' {
    return mimetype?.startsWith('video') ? 'Video' : 'Image';
  }

  isBlobUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    return url.startsWith('blob:');
  }

  async createEvent(): Promise<void> {
    if (this.isCreating()) return;

    try {
      this.isCreating.set(true);
      const form = this.eventForm();
      const formData = form.getRawValue();

      if (this.isEditMode() && this.editingEventId()) {
        await this.updateSingleEvent(formData);
        return;
      }

      const eventsToCreate = await this.prepareEventsToCreate(formData);
      await this.createEvents(eventsToCreate);
    } catch (error) {
      const errorMessage = BaseApiService.getErrorMessage(error, 'Failed to create event. Please try again.');
      this.toasterService.showError(errorMessage);
    } finally {
      this.isCreating.set(false);
    }
  }

  async updateSingleEvent(formData: any): Promise<void> {
    // Show modal with two options
    const result = await this.showRepublishEventConfirmationModal();
    if (result.dismissed) return;

    const eventPayload = await this.processEventData(formData);

    // Add notify flag if user chose to notify
    if (result.notify) eventPayload.notify = true;

    const response: any = await this.eventService.updateEvent(this.editingEventId()!, eventPayload);
    await this.modalService.openConfirmModal({
      icon: 'assets/svg/launch.svg',
      title: 'Event Republished!',
      description: result.notify
        ? 'Your event has been successfully republished and attendees and participants will be notified.'
        : 'Your event has been successfully republished.',
      confirmButtonLabel: 'Done',
      confirmButtonColor: 'primary',
      shareButtonLabel: 'Share',
      iconBgColor: '#F5BC61',
      onShare: async () => {
        await this.modalService.openShareModal(response?.data.id, 'Event');
      }
    });
    this.allowLeave.set(true);
    if (this.isModalMode) {
      this.modalCtrl.dismiss(response, 'updated');
    } else {
      this.navigationService.navigateForward(`/event/${this.editingEventId()!}`, true);
    }
  }

  async prepareEventsToCreate(formData: any): Promise<any[]> {
    const repeatingEvents = formData.repeating_events || [];

    const mainEventPayload = await this.processEventData(formData);

    if (repeatingEvents.length === 0) {
      return [mainEventPayload];
    }

    const repeatingEventPayloads = await Promise.all(
      repeatingEvents.map(async (repeatingEvent: any) => {
        return this.processEventData(repeatingEvent);
      })
    );

    return [mainEventPayload, ...repeatingEventPayloads];
  }

  async processEventData(eventData: any): Promise<any> {
    const mediaItems = Array.isArray(eventData.medias) && eventData.medias.length > 0 ? eventData.medias : [];

    const eventDate = eventData.date ?? null;
    const eventStartTime = eventData.start_time ?? null;
    const eventEndTime = eventData.end_time ?? null;
    const untilFinished = eventData.until_finished ?? false;

    const mediasWithOrder = await this.uploadAndFormatMedia(mediaItems);
    const startDate = this.eventService.combineDateAndTime(eventDate, eventStartTime);
    const endDate = untilFinished ? null : this.eventService.combineDateAndTime(eventDate, eventEndTime);

    // Add subscriber exclusive ticket if is_subscriber_exclusive is true
    let tickets = eventData.tickets || [];
    const isSubscriberExclusive = eventData.is_subscriber_exclusive || eventData.settings?.is_subscriber_exclusive || false;

    if (isSubscriberExclusive) {
      // Check if subscriber exclusive ticket already exists
      const existingSubscriberTicket = tickets.find((t: any) => t.name === 'Subscriber exclusive' && t.ticket_type === 'Free');

      if (!existingSubscriberTicket) {
        const subscriberExclusiveTicket: any = {
          name: 'Subscriber exclusive',
          ticket_type: 'Free',
          price: 0,
          quantity: 999,
          description: 'This event is exclusively for subscribers. Join us for this special experience!',
          sales_start_date: this.datePipe.transform(new Date(), 'yyyy-MM-dd') ?? '',
          sales_end_date: endDate,
          end_at_event_start: true,
          order: 1
        };
        tickets = [subscriberExclusiveTicket, ...tickets];
      }
    }

    const formattedTickets = this.eventService.formatTickets(tickets, eventDate, eventStartTime);
    const formattedPromoCodes = this.eventService.formatPromoCodes(eventData.promo_codes || []);
    const formattedQuestionnaire = this.eventService.formatQuestionnaire(eventData.questionnaire || []);
    const settings = this.eventService.buildEventSettings(eventData);

    const payload: any = {
      ...eventData,
      medias: mediasWithOrder,
      start_date: startDate,
      end_date: endDate,
      tickets: formattedTickets,
      promo_codes: formattedPromoCodes,
      questionnaire: formattedQuestionnaire
    };

    if (eventData.is_subscription === true && eventData.plan_ids) {
      payload.plan_ids = eventData.plan_ids;
    } else {
      payload.plan_ids = [];
    }

    return this.eventService.cleanupEventPayload(payload, settings);
  }

  async createEvents(eventsToCreate: any[]): Promise<void> {
    const createResponse: any = await this.eventService.createEvents(eventsToCreate);
    if (this.isModalMode) {
      this.modalCtrl.dismiss(createResponse, 'created');
    } else {
      const slug =
        createResponse?.data && Array.isArray((createResponse.data as any).events) && (createResponse.data as any).events.length > 0
          ? (createResponse.data as any).events[0].slug
          : undefined;

      await this.modalService.openConfirmModal({
        icon: 'assets/svg/launch.svg',
        title: 'Event Published!',
        description: 'Your event has been successfully published!',
        confirmButtonLabel: 'Done',
        confirmButtonColor: 'primary',
        shareButtonLabel: 'Share',
        iconBgColor: '#F5BC61',
        onShare: async () => {
          await this.modalService.openShareModal(createResponse?.data?.events[0].id, 'Event');
        }
      });
      this.allowLeave.set(true);
      if (slug) {
        this.navigationService.navigateForward(`/event/${slug}`, true);
      } else {
        this.navigationService.navigateForward('/event', true);
      }
    }
  }

  async openQuestionnairePreview(): Promise<void> {
    const questionnaire = this.selectedEventData()?.questionnaire || this.eventForm().get('questionnaire')?.value;
    if (!questionnaire || questionnaire.length === 0) {
      return;
    }
    await this.modalService.openQuestionnairePreviewModal(questionnaire, true);
  }

  handleConfirmModal = async (message: string): Promise<boolean> => {
    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/deleteWhiteIcon.svg',
      iconBgColor: '#C73838',
      title: 'Delete Confirmation',
      description: message,
      confirmButtonLabel: 'Delete',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left'
    });

    return result?.role === 'confirm';
  };

  async showRepublishEventConfirmationModal(): Promise<{ dismissed: boolean; notify: boolean }> {
    const result = await this.modalService.openConfirmModal({
      iconPosition: 'left',
      iconBgColor: '#F5BC61',
      title: 'Republish Event?',
      icon: 'assets/svg/launch.svg',
      confirmButtonColor: 'primary',
      cancelButtonLabel: 'Republish Only',
      confirmButtonLabel: 'Republish and Notify',
      description: 'Please review your changes. Once confirmed, the event will be updated with the new information.'
    });

    if (result?.role === 'confirm') {
      return { dismissed: false, notify: true };
    } else if (result?.role === 'cancel') {
      return { dismissed: false, notify: false };
    } else {
      return { dismissed: true, notify: false };
    }
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.previewFormValueSubscription?.unsubscribe();
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }
}
