import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { IonFooter, IonHeader, IonRange, IonToolbar } from '@ionic/angular/standalone';
import { Input, inject, Component, ChangeDetectionStrategy } from '@angular/core';
import { ImageCropperComponent, ImageCroppedEvent, ImageTransform } from 'ngx-image-cropper';

@Component({
  selector: 'profile-image-confirm-modal',
  styleUrl: './profile-image-confirm-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-image-confirm-modal.html',
  imports: [Button, IonHeader, IonFooter, IonToolbar, ImageCropperComponent, IonRange]
})
export class ProfileImageConfirmModal {
  private modalService = inject(ModalService);

  @Input() imageDataUrl: string = '';

  croppedImage: string | null = null;

  zoom = 1;
  transform: ImageTransform = {};

  close(): void {
    this.modalService.close({ action: 'cancel' });
  }

  retake(): void {
    this.modalService.close({ action: 'retake' });
  }

  onZoomChange(event: any): void {
    const input = event.detail.value;
    this.zoom = input || 1;
    this.transform = {
      ...this.transform,
      scale: this.zoom
    };
  }

  imageCropped(event: ImageCroppedEvent): void {
    this.croppedImage = event.objectUrl ?? null;
  }

  confirm(): void {
    this.modalService.close({
      action: 'confirm',
      imageDataUrl: this.croppedImage ?? this.imageDataUrl
    });
  }
}