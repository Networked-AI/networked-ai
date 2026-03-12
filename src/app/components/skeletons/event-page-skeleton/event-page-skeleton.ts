import { Component } from '@angular/core';
import { IonSkeletonText } from '@ionic/angular/standalone';

@Component({
  selector: 'event-page-skeleton',
  imports: [IonSkeletonText],
  templateUrl: './event-page-skeleton.html',
  styleUrl: './event-page-skeleton.scss'
})
export class EventPageSkeleton {}
