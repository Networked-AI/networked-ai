import { TestBed, ComponentFixture } from '@angular/core/testing';
import { PromoCodeSectionComponent } from './promo-code-section';

describe('PromoCodeSectionComponent', () => {
  let component: PromoCodeSectionComponent;
  let fixture: ComponentFixture<PromoCodeSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoCodeSectionComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PromoCodeSectionComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('type', 'menu');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
