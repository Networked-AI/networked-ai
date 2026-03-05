import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { IonFooter, IonToolbar } from '@ionic/angular/standalone';
import { Input, inject, Component, ChangeDetectionStrategy, signal, type Signal } from '@angular/core';

export interface ConfirmModalConfig {
  icon?: string; // SVG path
  title: string;
  iconName?: string;
  iconBgColor?: string;
  description?: string;
  cancelButtonLabel?: string;
  confirmButtonLabel?: string;
  confirmButtonColor?: 'success' | 'info' | 'warn' | 'danger' | 'help' | 'primary' | 'secondary' | 'contrast' | null;
}

@Component({
  selector: 'confirm-modal',
  styleUrl: './confirm-modal.scss',
  templateUrl: './confirm-modal.html',
  imports: [Button, IonFooter, IonToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmModal {
  // services
  private modalService = inject(ModalService);

  // inputs
  @Input() icon = '';
  @Input() iconName = '';
  @Input() description = '';
  @Input() title = 'Confirm';
  @Input() iconBgColor?: string;
  @Input() customColor?: string;
  @Input() cancelButtonLabel = '';
  @Input() cancelButtonIcon = '';
  @Input() confirmButtonLabel = 'Confirm';
  @Input() confirmButtonLabelSignal?: Signal<string>;
  @Input() iconPosition: 'left' | 'center' = 'center';
  @Input() confirmButtonColor: 'success' | 'info' | 'warn' | 'danger' | 'help' | 'primary' | 'secondary' | 'contrast' = 'primary';
  @Input() onConfirm?: () => Promise<any>;
  @Input() shareButtonLabel?: string;
  @Input() onShare?: () => void | Promise<void>;

  isLoading = signal(false);

  confirmLabel(): string {
    return this.confirmButtonLabelSignal?.() ?? this.confirmButtonLabel;
  }

  async confirm(): Promise<void> {
    if (!this.onConfirm) {
      this.modalService.close(true, 'confirm');
      return;
    }
    try {
      this.isLoading.set(true);
      await this.onConfirm();
      this.modalService.close(true, 'confirm');
    } catch (error) {
      this.modalService.close(false, 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  cancel(): void {
    if (!this.isLoading()) {
      this.modalService.close(false, 'cancel');
    }
  }

  async share(): Promise<void> {
    if (this.onShare) {
      await this.onShare();
    }
  }
}
