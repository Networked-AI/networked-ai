import { IonicModule } from '@ionic/angular';
import { CsvDataModal } from './csv-data-modal';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

describe('CsvDataModal', () => {
  let component: CsvDataModal;
  let fixture: ComponentFixture<CsvDataModal>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [CsvDataModal],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(CsvDataModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
