import { DOCUMENT } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { inject, Injectable, afterNextRender } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HapticService {
  private readonly document = inject(DOCUMENT);

  constructor() {
    if (!Capacitor.isNativePlatform()) return;

    afterNextRender(() => {
      this.document.addEventListener('click', this.onClick, { passive: true });
    });
  }

  onClick = (): void => {
    void Haptics.impact({ style: ImpactStyle.Light });
  };
}
