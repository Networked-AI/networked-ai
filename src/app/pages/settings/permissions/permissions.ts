import { Component, inject, ChangeDetectionStrategy, signal, OnInit, OnDestroy } from '@angular/core';
import { NavController, IonHeader, IonToolbar, IonContent, IonToggle } from '@ionic/angular/standalone';
import { PermissionsService } from '@/services/permissions.service';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { FormsModule } from '@angular/forms';
import { HapticService } from '@/services/haptic.service';
export interface Permission {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  accessLevel?: 'denied' | 'ask' | 'always';
}

@Component({
  selector: 'permissions',
  templateUrl: './permissions.html',
  styleUrl: './permissions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonContent, IonToggle, FormsModule]
})
export class Permissions implements OnInit, OnDestroy {
  // services
  navCtrl = inject(NavController);
  private permissionsService = inject(PermissionsService);
  hapticService = inject(HapticService);
  // listener
  private appResumeListener?: PluginListenerHandle;

  // signals
  permissions = signal<Permission[]>([
    {
      id: 'contact',
      name: 'Contact Sync',
      description: 'Allow Get Networked to access your contacts',
      icon: 'pi pi-users',
      enabled: false,
      accessLevel: 'denied'
    },
    {
      id: 'location',
      name: 'Location',
      description: 'Allow Get Networked to access your location',
      icon: 'pi pi-map-marker',
      enabled: false,
      accessLevel: 'ask'
    },
    {
      id: 'camera',
      name: 'Camera',
      description: 'Allow Get Networked to access your camera',
      icon: 'pi pi-camera',
      enabled: false,
      accessLevel: 'denied'
    }
  ]);

  ngOnInit(): void {
    this.loadPermissionStates();
    this.setupAppResumeListener();
  }

  private async setupAppResumeListener(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    this.appResumeListener = await App.addListener('resume', () => {
      this.loadPermissionStates();
    });
  }

  ngOnDestroy(): void {
    if (this.appResumeListener) {
      this.appResumeListener.remove();
    }
  }

  async loadPermissionStates(): Promise<void> {
    const permissions = this.permissions();
    const updatedPermissions = await Promise.all(
      permissions.map(async (permission) => {
        let result: any;
        switch (permission.id) {
          case 'camera':
            result = await this.permissionsService.checkCameraPermission();
            break;
          case 'location':
            result = await this.permissionsService.checkLocationPermission();
            console.log('checkLocationPermission-result', result);
            break;
          case 'contact':
            result = await this.permissionsService.checkContactsPermission();
            break;
          default:
            return permission;
        }

        return {
          ...permission,
          enabled: result.granted,
          accessLevel: this.permissionsService.statusToAccessLevel(result.status)
        };
      })
    );

    this.permissions.set(updatedPermissions);
    console.log('this.permissions() updated:', permissions);
  }

  back(): void {
    this.navCtrl.back();
  }

  async onToggleChange(permissionId: string, event: CustomEvent): Promise<void> {
    event.stopPropagation();
    const checked = event.detail.checked;
    const permission = this.permissions().find((p) => p.id === permissionId);

    if (permission) {
      if (checked) {
        await this.requestPermission(permission);
      } else {
        if (permission.accessLevel !== 'denied') {
          NativeSettings.open({
            optionAndroid: AndroidSettings.ApplicationDetails,
            optionIOS: IOSSettings.App
          });
        }
      }
    }
  }

  private updatePermission(permissionId: string, enabled: boolean, accessLevel?: 'denied' | 'ask' | 'always'): void {
    const currentPermissions = this.permissions();
    const updatedPermissions = currentPermissions.map((p) =>
      p.id === permissionId ? { ...p, enabled, accessLevel: accessLevel || p.accessLevel } : p
    );
    console.log('updatedPermissions', updatedPermissions);
    this.permissions.set(updatedPermissions);
  }

  async requestPermission(permission: Permission): Promise<void> {
    if (permission.id !== 'camera' && permission.id !== 'location' && permission.id !== 'contact') {
      return;
    }

    const { result, settingsOpened } = await this.permissionsService.requestPermission(permission.id as 'camera' | 'location' | 'contact');

    if (settingsOpened) {
      return;
    }

    // Update permission state based on actual result from native prompt
    const actualAccessLevel = this.permissionsService.statusToAccessLevel(result.status);
    const enabled = result.granted;
    this.updatePermission(permission.id, enabled, actualAccessLevel);
  }
}
