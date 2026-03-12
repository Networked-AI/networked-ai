import { IonIcon } from '@ionic/angular/standalone';
import { signal, Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { IAuthUser } from '@/interfaces/IAuth';

interface SocialLink {
  type: 'website' | 'facebook' | 'twitter' | 'instagram' | 'snapchat' | 'linkedin' | 'phone';
  icon: string;
  value: string;
  href: string;
}

@Component({
  imports: [IonIcon],
  selector: 'profile-link',
  styleUrl: './profile-link.scss',
  templateUrl: './profile-link.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileLink {
  isExpanded = signal(false);
  currentUser = input<IAuthUser | null>(null);
  showMobile = input<boolean>(true);

  private readonly socialConfigs = [
    { type: 'website', icon: 'globe-outline', key: 'website' },
    { type: 'facebook', icon: 'logo-facebook', key: 'facebook' },
    { type: 'twitter', icon: 'logo-twitter', key: 'twitter' },
    { type: 'instagram', icon: 'logo-instagram', key: 'instagram' },
    { type: 'snapchat', icon: 'logo-snapchat', key: 'snapchat' },
    { type: 'linkedin', icon: 'logo-linkedin', key: 'linkedin' }
  ] as const;

  private extractUsername(value: string, type: string): string {
    if (!value || value.trim() === '') return '';

    const trimmedValue = value.trim();

    // If not a URL, return as is (already just username)
    if (!trimmedValue.startsWith('http://') && !trimmedValue.startsWith('https://')) {
      return type === 'website' ? trimmedValue : trimmedValue.startsWith('@') ? trimmedValue : `@${trimmedValue}`;
    }

    try {
      const url = new URL(trimmedValue);
      const pathname = url.pathname.replace(/^\/+|\/+$/g, '');

      if (type === 'website') {
        return trimmedValue.replace(/^https?:\/\//, '');
      }

      if (type === 'linkedin') {
        const username = pathname.replace(/^in\/+/, '');
        return username.startsWith('@') ? username : `@${username}`;
      }

      const username = pathname || trimmedValue;
      return username.startsWith('@') ? username : `@${username}`;
    } catch {
      return type === 'website' ? trimmedValue : trimmedValue.startsWith('@') ? trimmedValue : `@${trimmedValue}`;
    }
  }

  socialLinks = computed(() => {
    const user = this.currentUser();
    if (!user) return [];

    const links: SocialLink[] = [];

    if (user.mobile?.trim() && this.showMobile()) {
      const mobileValue = user.mobile.trim();
      links.push({
        type: 'phone',
        icon: 'call-outline',
        value: mobileValue,
        href: `sms:${mobileValue}`
      });
    }

    if (user.socials) {
      for (const config of this.socialConfigs) {
        const value = user.socials[config.key as keyof typeof user.socials];
        if (value?.trim()) {
          const trimmedValue = value.trim();
          const displayValue = this.extractUsername(trimmedValue, config.type);
          if (displayValue) {
            links.push({
              type: config.type,
              icon: config.icon,
              value: displayValue,
              href: trimmedValue
            });
          }
        }
      }
    }
    return links;
  });

  linksCount = computed(() => this.socialLinks().length);

  toggleLinks(): void {
    this.isExpanded.update((value) => !value);
  }
}
