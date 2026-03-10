import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventPageSkeleton } from './event-page-skeleton';

describe('EventPageSkeleton', () => {
  let component: EventPageSkeleton;
  let fixture: ComponentFixture<EventPageSkeleton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventPageSkeleton]
    }).compileComponents();

    fixture = TestBed.createComponent(EventPageSkeleton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
