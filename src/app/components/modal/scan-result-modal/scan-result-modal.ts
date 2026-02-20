import { CommonModule } from '@angular/common';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { Component, Input, inject } from '@angular/core';
import { IonIcon, IonToolbar, IonHeader } from '@ionic/angular/standalone';

@Component({
  selector: 'scan-result-modal',
  templateUrl: './scan-result-modal.html',
  styleUrl: './scan-result-modal.scss',
  imports: [IonHeader, IonToolbar, IonIcon, CommonModule, Button]
})
export class ScanResultModal {
  @Input() isSuccess = false;
  @Input() message = '';

  private modalService = inject(ModalService);

  async close() {
    await this.modalService.close();
  }

  async scanAgain() {
    await this.modalService.close('scan-again');
  }
}
