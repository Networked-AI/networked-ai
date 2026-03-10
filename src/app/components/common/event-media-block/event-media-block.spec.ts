import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventMediaBlockComponent } from './event-media-block';

describe('EventMediaBlockComponent', () => {
  let component: EventMediaBlockComponent;
  let fixture: ComponentFixture<EventMediaBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventMediaBlockComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EventMediaBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
