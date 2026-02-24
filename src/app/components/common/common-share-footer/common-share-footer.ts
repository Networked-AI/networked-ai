import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  imports: [IonIcon],
  selector: 'common-share-footer',
  styleUrl: './common-share-footer.scss',
  templateUrl: './common-share-footer.html'
})
export class CommonShareFooter {
  image_url = input<string>();
  
  onContact = output<void>();
  onCopyLink = output<void>();
  onShareTo = output<void>();
  onChat = output<void>();
  onEmail = output<void>();
  onWhatsapp = output<void>();
  onX = output<void>();
  onThread = output<void>();
  onDownloadImage = output<void>();
}
