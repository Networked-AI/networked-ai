import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationSubscriptionPopover } from './notification-subscription-popover';

describe('NotificationSubscriptionPopover', () => {
  let component: NotificationSubscriptionPopover;
  let fixture: ComponentFixture<NotificationSubscriptionPopover>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationSubscriptionPopover]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSubscriptionPopover);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
