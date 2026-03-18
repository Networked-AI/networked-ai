import { IonIcon } from '@ionic/angular/standalone';
import { ModalService } from '@/services/modal.service';
import { Input, inject, Component } from '@angular/core';

export interface MenuItem {
  label: string;
  icon: string;
  iconType: 'svg' | 'pi' | 'ion';
  action?: string;
  danger?: boolean;
  iconSize?: string;
}
@Component({
  imports: [IonIcon],
  selector: 'menu-modal',
  styleUrl: './menu-modal.scss',
  templateUrl: './menu-modal.html'
})
export class MenuModal {
  // services
  private modalService = inject(ModalService);

  // inputs
  @Input() items: MenuItem[] = [];

  onItemClick(item: MenuItem) {
    this.modalService.close({
      data: item,
      role: item.action
    });
  }
}
