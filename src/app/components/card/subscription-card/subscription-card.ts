import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule, DatePipe, NgOptimizedImage } from '@angular/common';
import { Button } from '@/components/form/button';
import { IonIcon } from '@ionic/angular/standalone';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { FormControl } from '@angular/forms';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { HapticService } from '@/services/haptic.service';

export type SubscriptionCardType = 'event' | 'sponsor';

export interface ISubscription {
  id?: string;
  type?: SubscriptionCardType;
  // For subscription plans
  name?: string;
  subscribers?: number;
  priceRange?: string;
  // For subscriptions
  planName?: string;
  creatorName?: string;
  renewDate?: Date;
  cancelDate?: Date;
  price?: string;
  thumbnail_url?: string;
}

export type SubscriptionCardMode = 'plan' | 'subscription' | 'select';

@Component({
  selector: 'app-subscription-card',
  templateUrl: './subscription-card.html',
  styleUrl: './subscription-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Button, IonIcon, CheckboxModule, FormsModule, NgOptimizedImage, CommonModule]
})
export class SubscriptionCard {
  hapticService = inject(HapticService);
  data = input.required<ISubscription>();
  mode = input<SubscriptionCardMode>('plan');

  // For select mode
  checkboxControl = input<FormControl<boolean> | null>(null);
  isSelected = input<boolean>(false);

  // Outputs for plan mode
  manage = output<ISubscription>();
  events = output<ISubscription>();
  delete = output<ISubscription>();

  // Output for subscription mode
  click = output<ISubscription>();

  // Output for select mode
  selectionChange = output<boolean>();

  onManage(): void {
    this.manage.emit(this.data());
  }

  onEvents(): void {
    this.events.emit(this.data());
  }

  onDelete(event: Event): void {
    event.stopPropagation(); // Prevent card click event
    this.hapticService.onClick();
    this.delete.emit(this.data());
  }

  onClick(): void {
    this.click.emit(this.data());
  }

  onCheckboxChange(value: boolean): void {
    this.selectionChange.emit(value);
  }

  toggleCheckbox(value?: boolean): void {
    const control = this.checkboxControl();
    if (control) {
      const newValue = value !== undefined ? value : !control.value;
      control.setValue(newValue);
      this.onCheckboxChange(newValue);
    }
  }

  // Helper methods
  getDisplayName(): string {
    return this.mode() === 'plan' || this.mode() === 'select' ? this.data().name || '' : this.data().planName || '';
  }

  isPlanMode(): boolean {
    return this.mode() === 'plan';
  }

  isSelectMode(): boolean {
    return this.mode() === 'select';
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: any): void {
    onImageError(event);
  }
}
