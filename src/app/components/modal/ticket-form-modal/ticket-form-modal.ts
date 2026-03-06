import { DatePipe } from '@angular/common';
import { CheckboxModule } from 'primeng/checkbox';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { TextInput } from '@/components/form/text-input';
import { ToasterService } from '@/services/toaster.service';
import { NumberInput } from '@/components/form/number-input';
import { TicketFormData, TicketType } from '@/interfaces/event';
import { TextAreaInput } from '@/components/form/text-area-input';
import { DescriptionGeneratorService } from '@/services/description-generator.service';
import { FormGroup, Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IonHeader, IonFooter, IonContent, IonToolbar, IonSpinner } from '@ionic/angular/standalone';
import { Input, OnInit, inject, signal, computed, Component, ChangeDetectionStrategy } from '@angular/core';
import { BaseApiService } from '@/services/base-api.service';

@Component({
  selector: 'ticket-form-modal',
  styleUrl: './ticket-form-modal.scss',
  templateUrl: './ticket-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonSpinner,
    ReactiveFormsModule,
    Button,
    TextInput,
    NumberInput,
    TextAreaInput,
    IonHeader,
    IonToolbar,
    IonContent,
    IonFooter,
    IonSpinner,
    CheckboxModule
  ]
})
export class TicketFormModal implements OnInit {
  // services
  private fb = inject(FormBuilder);
  private modalService = inject(ModalService);
  private descriptionGenerator = inject(DescriptionGeneratorService);
  private toasterService = inject(ToasterService);
  private datePipe = new DatePipe('en-US');

  // inputs
  @Input() ticketType: TicketType = 'Free';
  @Input() initialData?: Partial<TicketFormData> | null;
  @Input() eventDate?: string | null;
  @Input() eventStartTime?: string | null;
  @Input() eventEndTime?: string | null;

  // signals
  ticketForm = signal<FormGroup>(
    this.fb.group({
      free_for_subscribers: false,
      end_at_event_start: true
    })
  );

  isFreeTicket = signal<boolean>(true);
  showDescriptionEditor = signal<boolean>(false);
  endSaleOnEventStart = signal<boolean>(true);
  conversation = signal<any[]>([]);
  isGeneratingDescription = signal<boolean>(false);

  showEndSaleInputs = computed(() => !this.endSaleOnEventStart());
  isCustomize = computed(() => this.showDescriptionEditor());

  ngOnInit(): void {
    const isFree = this.ticketType === 'Free';
    this.isFreeTicket.set(isFree);

    const now = new Date();
    const currentDate = this.datePipe.transform(now, 'yyyy-MM-dd')!;
    const currentTime = this.datePipe.transform(now, 'HH:mm')!;

    const salesStartDateValue = this.initialData?.sales_start_date ?? currentDate;
    const salesStartTimeValue = this.initialData?.sale_start_time ?? currentTime;

    const endSaleOnEventStart = this.initialData?.end_at_event_start ?? true;
    this.endSaleOnEventStart.set(endSaleOnEventStart);

    const salesEndDateValue = this.initialData?.sales_end_date ?? (!endSaleOnEventStart && this.eventDate ? this.eventDate : '');

    const salesEndTimeValue = this.initialData?.sale_end_time ?? (!endSaleOnEventStart && this.eventEndTime ? this.eventEndTime : '');

    const form = this.fb.group({
      name: [this.initialData?.name ?? '', Validators.required],
      price: [isFree ? '0.00' : (this.initialData?.price ?? '5.00'), Validators.required],
      quantity: [this.initialData?.quantity ?? 500, Validators.required],
      description: [this.initialData?.description ?? ''],

      sales_start_date: [salesStartDateValue, Validators.required],
      sale_start_time: [salesStartTimeValue, Validators.required],

      sales_end_date: [salesEndDateValue],
      sale_end_time: [salesEndTimeValue],

      end_at_event_start: [endSaleOnEventStart],
      free_for_subscribers: [this.initialData?.free_for_subscribers ?? false]
    });

    this.ticketForm.set(form);

    if (isFree) form.get('price')?.disable();

    const salesEndDateControl = form.get('sales_end_date');
    const salesEndTimeControl = form.get('sale_end_time');

    form.get('end_at_event_start')?.valueChanges.subscribe((value) => {
      const isEndAtEventStart = value ?? true;
      this.endSaleOnEventStart.set(isEndAtEventStart);

      if (isEndAtEventStart) {
        salesEndDateControl?.clearValidators();
        salesEndTimeControl?.clearValidators();
        salesEndDateControl?.setValue('');
        salesEndTimeControl?.setValue('');
      } else {
        salesEndDateControl?.setValidators(Validators.required);
        salesEndTimeControl?.setValidators(Validators.required);

        if (!salesEndDateControl?.value && this.eventDate) {
          salesEndDateControl?.setValue(this.eventDate);
        }
        if (!salesEndTimeControl?.value && this.eventEndTime) {
          salesEndTimeControl?.setValue(this.eventEndTime);
        }
      }

      salesEndDateControl?.updateValueAndValidity();
      salesEndTimeControl?.updateValueAndValidity();
    });
  }

  getTitle(): string {
    switch (this.ticketType) {
      case 'Free':
        return 'Free Ticket';
      case 'Early Bird':
        return 'Early Bird Ticket';
      case 'Sponsor':
        return 'Sponsor Ticket';
      case 'Standard':
        return 'Standard Paid Ticket';
      case 'Paid':
        return 'Paid Ticket';
      default:
        return 'Ticket';
    }
  }

  async generateDescription(): Promise<void> {
    const form = this.ticketForm();
    const descriptionControl = form.get('description');

    if (!descriptionControl) return;

    this.isGeneratingDescription.set(true);

    try {
      // Get form values
      const ticketName = form.get('name')?.value || '';
      const price = form.get('price')?.value || '';
      const quantity = form.get('quantity')?.value || '';
      const ticketType = this.ticketType;

      // Generate description using the service
      const generatedDescription = await this.descriptionGenerator.generateTicketDescription({
        ticketName: ticketName || undefined,
        ticketType: ticketType || undefined,
        price: price || undefined,
        quantity: quantity || undefined,
        eventDate: this.eventDate || undefined,
        eventStartTime: this.eventStartTime || undefined
      });

      descriptionControl.setValue(generatedDescription);
      descriptionControl.markAsTouched();
      this.showDescriptionEditor.set(true);
    } catch (error: any) {
      console.error('Error generating ticket description:', error);
      const msg = BaseApiService.getErrorMessage(error, 'Failed to generate description. Please try again.');
      this.toasterService.showError(msg);

      // Set a fallback description on error
      const fallbackDescription = 'This is a generated ticket description. You can customize this content to better match your ticket details.';
      descriptionControl.setValue(fallbackDescription);
      descriptionControl.markAsTouched();
      this.showDescriptionEditor.set(true);
    } finally {
      this.isGeneratingDescription.set(false);
    }
  }

  handleGenerateClick(): void {
    if (this.showDescriptionEditor()) {
      this.openAIPromptModal();
    } else {
      this.generateDescription();
    }
  }

  async openAIPromptModal(): Promise<void> {
    const data = await this.modalService.openAIPromptModal(this.conversation());

    if (data) {
      if (data.type === 'value' && data.data) {
        const form = this.ticketForm();
        const descriptionControl = form.get('description');
        if (descriptionControl) {
          descriptionControl.setValue(data.data);
          descriptionControl.markAsTouched();
        }
      } else if (data.type === 'data' && data.data) {
        this.conversation.set(data.data);
      }
    }
  }

  saveTicket(): void {
    const form = this.ticketForm();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    this.modalService.close({ ...form.value, ticket_type: this.ticketType }, 'save');
  }

  async openDateModal(type: 'sales_start_date' | 'sales_end_date' = 'sales_start_date'): Promise<void> {
    const form = this.ticketForm();
    const currentDate = form.get(type)?.value || '';

    const today = new Date();
    const todayStr = this.datePipe.transform(today, 'yyyy-MM-dd') ?? '';
    const maxDate = this.eventDate || undefined;

    let minDate: string | undefined = todayStr;
    if (type === 'sales_end_date') {
      const salesStartDate = form.get('sales_start_date')?.value;
      if (salesStartDate) {
        minDate = salesStartDate;
      }
    }

    const date = await this.modalService.openDateTimeModal('date', currentDate, minDate, maxDate);
    if (date) {
      const formattedDate = this.datePipe.transform(date, 'yyyy-MM-dd');
      form.patchValue({ [type]: formattedDate });
    }
  }

  async openTimeModal(type: 'sale_start_time' | 'sale_end_time'): Promise<void> {
    const form = this.ticketForm();
    const currentTime = form.get(type)?.value || '';

    const time = await this.modalService.openDateTimeModal('time', currentTime);
    if (time) {
      const timePart = typeof time === 'string' && time.includes('T') ? time.split('T')[1] : time;
      const timeOnly = typeof timePart === 'string' ? timePart.slice(0, 5) : timePart;
      form.patchValue({ [type]: timeOnly });
    }
  }

  close(): void {
    this.modalService.close(null, 'cancel');
  }
}
