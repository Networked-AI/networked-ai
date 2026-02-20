import { ScanResultModal } from './scan-result-modal';
import { ComponentFixture, TestBed } from '@angular/core/testing';

describe('AccountTypeModal', () => {
  let component: ScanResultModal;
  let fixture: ComponentFixture<ScanResultModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanResultModal]
    }).compileComponents();

    fixture = TestBed.createComponent(ScanResultModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
