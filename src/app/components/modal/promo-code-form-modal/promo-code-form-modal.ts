import { Chip } from '@/components/common/chip';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { TextInput } from '@/components/form/text-input';
import { PromoCodeFormModalData } from '@/interfaces/event';
import { NumberInput } from '@/components/form/number-input';
import { IonHeader, IonFooter, IonContent, IonToolbar } from '@ionic/angular/standalone';
import { FormGroup, Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Input, inject, signal, Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'promo-code-form-modal',
  styleUrl: './promo-code-form-modal.scss',
  templateUrl: './promo-code-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chip, Button, IonFooter, TextInput, IonHeader, IonToolbar, IonContent, NumberInput, ReactiveFormsModule]
})
export class PromoCodeFormModal {
  // services
  private fb = inject(FormBuilder);
  private modalService = inject(ModalService);

  // inputs
  @Input() initialData?: Partial<PromoCodeFormModalData> | null;

  // signals
  promoForm = signal<FormGroup>(
    this.fb.group({
      id: [''],
      type: ['Fixed', [Validators.required]],
      capped_amount: [null]
    })
  );
  promotionType = signal<'Percentage' | 'Fixed'>('Fixed');

  ionViewWillEnter(): void {
    if (this.initialData) {
      this.promotionType.set(this.initialData.type as 'Percentage' | 'Fixed');
      this.promoForm().patchValue({
        ...this.initialData
      });
    }

    // Convert promo_code to uppercase on input
    const promoCodeControl = this.promoForm().get('promo_code');
    if (promoCodeControl) {
      promoCodeControl.valueChanges.subscribe((value) => {
        if (value) {
          const upperValue = value.toUpperCase();
          if (value !== upperValue) {
            promoCodeControl.setValue(upperValue);
          }
        }
      });
    }

    // Watch promotion type changes
    const typeControl = this.promoForm().get('type');
    if (typeControl) {
      typeControl.valueChanges.subscribe((value) => {
        if (value === 'Percentage' || value === 'Fixed') {
          this.promotionType.set(value);
          // Reset value when type changes
          const valueControl = this.promoForm().get('value');
          if (valueControl) {
            valueControl.setValue('');
          }
        }
      });
    }
  }

  setPromotionType(type: 'Percentage' | 'Fixed'): void {
    this.promotionType.set(type);
    const form = this.promoForm();
    const typeControl = form.get('type');
    if (typeControl) {
      typeControl.setValue(type);
    }
  }

  savePromoCode(): void {
    const form = this.promoForm();

    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const formValue = form.value;

    const formattedValue: PromoCodeFormModalData = {
      ...formValue,
      value: formValue.value ? Number(formValue.value) : null
    };

    if (formValue.capped_amount) {
      formattedValue.capped_amount = Number(formValue.capped_amount);
    }

    this.modalService.close(formattedValue, 'save');
  }

  close(): void {
    this.modalService.close(null, 'cancel');
  }
}
