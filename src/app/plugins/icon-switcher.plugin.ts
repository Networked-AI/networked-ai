import { registerPlugin } from '@capacitor/core';

interface IconSwitcherPlugin {
  getAvailableIcons(): Promise<{ icons: string[] }>;
  setIcon(options: { iconName: string }): Promise<void>;
}

const IconSwitcher = registerPlugin<IconSwitcherPlugin>('IconSwitcher');

export default IconSwitcher;