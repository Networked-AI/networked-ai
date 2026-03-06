import { Chip } from '@/components/common/chip';
import { Button } from '@/components/form/button';
import { CheckboxModule } from 'primeng/checkbox';
import { EventTicket } from '@/interfaces/event';
import { ModalService } from '@/services/modal.service';
import { EventService } from '@/services/event.service';
import { TextInput } from '@/components/form/text-input';
import { EmailInput } from '@/components/form/email-input';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { IGuestFormData } from '@/interfaces/IEventAttendee';
import { FormGroup, Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Input, inject, signal, Component, ChangeDetectionStrategy } from '@angular/core';
import { IonHeader, IonFooter, IonContent, IonToolbar, ModalController } from '@ionic/angular/standalone';

@Component({
  selector: 'guest-form-modal',
  styleUrl: './guest-form-modal.scss',
  templateUrl: './guest-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chip, Button, IonFooter, IonHeader, IonToolbar, IonContent, ReactiveFormsModule, CheckboxModule, TextInput, EmailInput]
})
export class GuestFormModal {
  fb = inject(FormBuilder);
  eventService = inject(EventService);
  toasterService = inject(ToasterService);
  modalService = inject(ModalService);
  modalCtrl = inject(ModalController);
  @Input() initialData?: Partial<IGuestFormData> | null;
  @Input() eventId?: string;
  @Input() tickets: EventTicket[] = [];
  @Input() hostPaysFees: boolean = false;
  @Input() additionalFees: number | null = null;

  isSubmitted = signal(false);
  isSubmitting = signal<boolean>(false);
  selectedTicket = signal<EventTicket | null>(null);

  guestForm = signal<FormGroup>(
    this.fb.group({
      event_ticket_id: [null, Validators.required],

      platform_fee_amount: [0],
      amount_paid: [0],
      host_payout_amount: [0],

      payment_mode: ['cash'],
      is_paid: [false],
      send_link: [false]
    })
  );

  paymentMethod = signal<'Cash' | 'InApp'>('Cash');

  ionViewWillEnter(): void {
    const paymentControl = this.guestForm().get('paymentMethod');
    if (paymentControl) {
      paymentControl.valueChanges.subscribe((value) => {
        this.paymentMethod.set(value);
      });
    }
  }

  setPaymentMethod(method: 'cash' | 'in-app'): void {
    const form = this.guestForm();

    if (method === 'in-app') {
      form.patchValue({
        payment_mode: 'in-app',
        send_link: true,
        is_paid: false
      });
    } else {
      form.patchValue({
        payment_mode: 'cash',
        send_link: false
      });
    }
  }

  async addGuest(): Promise<void> {
    this.isSubmitted.set(true);

    if (this.guestForm().invalid) {
      this.toasterService.showError('Please fill all required fields.');
      this.guestForm().markAllAsTouched();
      return;
    }

    try {
      this.isSubmitting.set(true);
      const raw = this.guestForm().value as any;
      const attendee = {
        name: `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim(),
        email: raw.email,
        event_ticket_id: raw.event_ticket_id,
        platform_fee_amount: raw.platform_fee_amount,
        amount_paid: raw.amount_paid,
        host_payout_amount: raw.host_payout_amount,
        payment_mode: raw.payment_mode,
        is_paid: raw.is_paid,
        send_link: raw.send_link
      };

      const payload = {
        event_id: this.eventId!,
        attendee
      };

      await this.eventService.addGuest(payload);

      this.modalCtrl.dismiss({ success: true }, 'save');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to add guest.');
      this.toasterService.showError(message);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  close(): void {
    this.modalCtrl.dismiss();
  }

  async openTicketSelector(): Promise<void> {
    const result = await this.modalService.openRsvpTicketModal(
      this.tickets,
      this.eventId!,
      'Select Ticket',
      this.hostPaysFees,
      this.additionalFees,
      this.selectedTicket()
    );

    if (result?.selectedTicket) {
      this.selectedTicket.set(result.selectedTicket);

      const attendee = result.attendeeAmounts;
      const ticket = result.selectedTicket;
      const ticketDisplay = `${ticket.name}`;

      this.guestForm().patchValue({
        ticket_name: ticketDisplay,
        event_ticket_id: attendee?.event_ticket_id ?? ticket.id,
        amount_paid: attendee?.amount_paid ?? ticket.price,
        host_payout_amount: attendee?.host_payout_amount ?? ticket.price,
        platform_fee_amount: attendee?.platform_fee_amount ?? 0
      });
    }
  }
}
