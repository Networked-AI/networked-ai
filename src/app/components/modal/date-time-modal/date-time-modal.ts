import { DatePipe } from '@angular/common';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { Input, inject, OnInit, Component, ChangeDetectionStrategy } from '@angular/core';
import { IonFooter, IonHeader, IonToolbar, IonDatetime, ModalController } from '@ionic/angular/standalone';

@Component({
  selector: 'date-time-modal',
  styleUrl: './date-time-modal.scss',
  templateUrl: './date-time-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, IonHeader, IonFooter, IonToolbar, IonDatetime]
})
export class DateTimeModal implements OnInit {
  // inputs
  @Input() title = 'Select Date';
  @Input() type: 'date' | 'time' = 'date';
  @Input() value = ''; // format: YYYY-MM-DD or HH:mm
  @Input() min: string | null = null; // format: YYYY-MM-DD or HH:mm
  @Input() max: string | null = null; // format: YYYY-MM-DD or HH:mm

  // services
  private modalCtrl = inject(ModalController);
  private modalService = inject(ModalService);
  private datePipe = new DatePipe('en-US');

  ngOnInit(): void {
    if (!this.value) {
      const now = new Date();
      if (this.type === 'time') {
        // default to current time format: HH:mm
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        this.value = `${hours}:${minutes}`;
      } else {
        // default to current date format: YYYY-MM-DD
        const year = now.getFullYear();
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        this.value = `${year}-${month}-${day}`;
      }
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss(this.value);
    this.modalService.close();
  }

  getMaxValue(): string | undefined {
    if (!this.max) {
      const futureDate = new Date(2050, 11, 31);
      return this.datePipe.transform(futureDate, 'yyyy-MM-dd') ?? '';
    }

    return this.max;
  }
}
