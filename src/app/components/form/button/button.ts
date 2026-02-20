import { ButtonModule } from 'primeng/button';
import { IonIcon } from '@ionic/angular/standalone';
import { HapticService } from '@/services/haptic.service';
import { input, output, Component, inject } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [IonIcon, ButtonModule],
  styleUrl: './button.scss',
  templateUrl: './button.html'
})
export class Button {
  // inputs
  width = input('100%');
  height = input('unset');
  radius = input<string>('8px');
  icon = input<string>('');
  label = input<string>('');
  iconName = input<string>('');
  ionIconName = input<string>('');
  disabled = input<boolean>(false);
  isLoading = input<boolean>(false);
  iconPos = input<'right' | 'left'>('left');
  color = input<'secondary' | 'primary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast'>('primary');
  variant = input<'outlined' | 'text' | undefined>(undefined);
  customColor = input<string | undefined>(undefined);

  // outputs
  click = output<void>();

  private hapticService = inject(HapticService);

  onClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.hapticService.onClick();
    this.click.emit();
  }
}
