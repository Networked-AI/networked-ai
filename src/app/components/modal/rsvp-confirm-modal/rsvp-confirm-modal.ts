import { Button } from '@/components/form/button';
import { Component, Input, inject } from '@angular/core';
import { ModalService } from '@/services/modal.service';
import { NavigationService } from '@/services/navigation.service';
import { IonToolbar, IonFooter, ModalController, NavController } from '@ionic/angular/standalone';

@Component({
  selector: 'rsvp-confirm-modal',
  imports: [IonFooter, IonToolbar, Button],
  templateUrl: './rsvp-confirm-modal.html',
  styleUrl: './rsvp-confirm-modal.scss'
})
export class RsvpConfirmModal {
  @Input() eventData: any;
  @Input() showFinishProfileSetup: boolean = false;

  private modalService = inject(ModalService);
  private navigationService = inject(NavigationService);
  private navCtrl = inject(NavController);
  modalctrl = inject(ModalController);

  share(): void {
    this.modalctrl.dismiss();
    this.modalService.openShareModal(this.eventData.id, 'Event', this.eventData?.image_url);
  }

  async addEvent(): Promise<void> {
    await this.modalService.openAddToCalendarModal(this.eventData);
  }

  done(): void {
    this.modalctrl.dismiss();
    this.modalService.close();
  }

  finishProfileSetup(): void {
    this.done();
    const slug = this.eventData?.slug || this.eventData?.id;
    const returnTo = `/event/${slug}`;
    this.navCtrl.navigateForward('/profile/setup', {
      queryParams: { returnTo }
    });
  }
}
