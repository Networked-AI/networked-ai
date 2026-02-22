import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';
import { ModalService } from '@/services/modal.service';
import { inject, Injectable, signal } from '@angular/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { ToasterService } from '@/services/toaster.service';

type GithubAsset = {
  name: string;
  size: number;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name: string;
  assets: GithubAsset[];
};

@Injectable({ providedIn: 'root' })
export class LiveUpdateService {
  // constants
  private readonly GITHUB_REPO = 'networked-ai';
  private readonly GITHUB_OWNER = 'freelancework00700';

  // services
  private http = inject(HttpClient);
  private modalService = inject(ModalService);
  private toasterService = inject(ToasterService);

  // signals
  private confirmButtonLabel = signal('Download');

  /**
   * Call once on app start (native only).
   * - Notifies Capgo that the app is ready
   * - Checks GitHub Releases for a newer build.zip
   */
  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    this.addCapgoListenersOnce();

    try {
      await CapacitorUpdater.notifyAppReady();
    } catch (error) {
      console.error('CapacitorUpdater.notifyAppReady failed:', error);
    }

    await this.checkForUpdates({ interactive: false });
  }

  private async checkForUpdates({ interactive }: { interactive: boolean }): Promise<void> {
    const release = await this.getLatestRelease();
    if (!release) {
      if (interactive) await this.toasterService.showError('Failed to fetch latest release.');
      return;
    }

    const buildAsset = release.assets.find((a) => a.name === 'build.zip');
    if (!buildAsset) {
      if (interactive) await this.toasterService.showError('No build.zip found in the latest GitHub release.');
      return;
    }

    const currentVersion = await this.getCurrentAppVersion();
    const nextVersion = release.tag_name;

    if (currentVersion && currentVersion === nextVersion) {
      if (interactive) await this.toasterService.showError('You are already on the latest version.');
      return;
    }

    // show prompt and (if accepted) download + apply
    await this.promptAndUpdate({ tag: nextVersion, sizeBytes: buildAsset.size, url: buildAsset.browser_download_url });
  }

  private async promptAndUpdate(info: { tag: string; sizeBytes: number; url: string }): Promise<void> {
    this.confirmButtonLabel.set('Download');
    await this.modalService.openConfirmModal({
      iconPosition: 'left',
      iconBgColor: '#C73838',
      backdropDismiss: false,
      title: 'Update Available',
      confirmButtonColor: 'danger',
      confirmButtonLabel: 'Download',
      icon: 'assets/svg/alert-white.svg',
      confirmButtonLabelSignal: this.confirmButtonLabel,
      onConfirm: async () => await this.startDownload(info),
      description: `A new version of the app is available.<br/>Version: ${info.tag}<br/>Size: ${this.formatFileSize(info.sizeBytes)}`
    });
  }

  private async startDownload(info: { tag: string; url: string }): Promise<void> {
    this.confirmButtonLabel.set('Downloading… 0%');

    try {
      const version = await CapacitorUpdater.download({
        url: info.url,
        version: info.tag
      });

      if (!version) {
        throw new Error('Download returned no version');
      }

      this.confirmButtonLabel.set('Applying update…');
      await CapacitorUpdater.set(version);
    } catch (error) {
      console.error('Update download/apply failed:', error);
      await this.toasterService.showError(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.confirmButtonLabel.set('Download');
    }
  }

  private async getLatestRelease(): Promise<GithubRelease | null> {
    try {
      const url = `https://api.github.com/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/latest`;
      return await firstValueFrom(this.http.get<GithubRelease>(url));
    } catch (error) {
      console.error('Failed to fetch latest GitHub release:', error);
      return null;
    }
  }

  private async getCurrentAppVersion(): Promise<string | null> {
    try {
      const { bundle } = await CapacitorUpdater.current();
      const version = bundle?.version;
      if (!version || version === 'builtin') return null;
      return version;
    } catch (error) {
      console.log('Could not get current bundle version:', error);
      return null;
    }
  }

  private async addCapgoListenersOnce(): Promise<void> {
    await CapacitorUpdater.removeAllListeners();

    CapacitorUpdater.addListener('download', (info: { percent: number }) => {
      const pct = Math.max(0, Math.min(100, info.percent ?? 0));
      this.confirmButtonLabel.set(`Downloading… ${Math.round(pct)}%`);
    });

    CapacitorUpdater.addListener('downloadFailed', (err: any) => {
      console.error('Download failed:', err);
    });

    CapacitorUpdater.addListener('updateFailed', (err: any) => {
      console.error('Update failed:', err);
    });
  }

  private formatFileSize(bytes: number): string {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
