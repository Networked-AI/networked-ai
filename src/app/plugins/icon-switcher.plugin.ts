import { registerPlugin } from '@capacitor/core';

interface IconSwitcherPlugin {
  getAvailableIcons(): Promise<{ icons: string[] }>;
  setIcon(options: { iconName: string }): Promise<void>;
  getCurrentIcon(): Promise<{ iconName: string | null }>;
}

const IconSwitcher = registerPlugin<IconSwitcherPlugin>('IconSwitcher');

export default IconSwitcher;