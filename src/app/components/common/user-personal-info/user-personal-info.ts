import { IUser } from '@/interfaces/IUser';
import { IUserForm } from '@/interfaces/IUserForm';
import { ModalService } from '@/services/modal.service';
import { validateFields } from '@/utils/form-validation';
import { TextInput } from '@/components/form/text-input';
import { EmailInput } from '@/components/form/email-input';
import { MobileInput } from '@/components/form/mobile-input';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UsernameInput } from '@/components/form/username-input';
import { input, inject, Component, ViewChild } from '@angular/core';
import { UserSettingToggle } from '@/components/form/user-setting-toggle';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'user-personal-info',
  styleUrl: './user-personal-info.scss',
  templateUrl: './user-personal-info.html',
  imports: [TextInput, EmailInput, MobileInput, UsernameInput, UserSettingToggle, ReactiveFormsModule]
})
export class UserPersonalInfo {
  // inputs
  isSubmitted = input.required<boolean>();
  formGroup = input.required<FormGroup<IUserForm>>();

  // services
  private modalService = inject(ModalService);
  private datePipe = new DatePipe('en-US');

  // view child
  @ViewChild(MobileInput) mobileInput?: MobileInput;
  @ViewChild(EmailInput) emailInput?: EmailInput;
  @ViewChild(UsernameInput) usernameInput?: UsernameInput;

  // constants
  private readonly validationFields = ['title', 'first_name', 'last_name', 'email', 'mobile', 'username', 'dob', 'account_type', 'address'];

  getPhoneNumber(): string | undefined {
    return this.mobileInput?.getPhoneNumber();
  }

  // validate all personal info fields
  async validate(): Promise<boolean> {
    // Enable async validation on inputs before validation
    this.emailInput?.shouldValidate.set(true);
    this.mobileInput?.shouldValidate.set(true);
    this.usernameInput?.shouldValidate.set(true);

    const isValid = await validateFields(this.formGroup(), this.validationFields);

    // Disable async validation after validation
    this.emailInput?.shouldValidate.set(false);
    this.mobileInput?.shouldValidate.set(false);
    this.usernameInput?.shouldValidate.set(false);

    return isValid;
  }

  // initialize fields based on user data (disable email/mobile if already set)
  initializeFields(userData: IUser | null): void {
    if (!userData) return;

    // disable email if already set
    if (userData.email) {
      this.formGroup().get('email')?.disable({ emitEvent: false });
    }

    // disable mobile if already set
    if (userData.mobile) {
      this.formGroup().get('mobile')?.disable({ emitEvent: false });
    }
  }

  async openTitleModal(): Promise<void> {
    const value = this.formGroup().get('title')?.value || 'Mr.';
    const title = await this.modalService.openTitleModal(value);
    this.formGroup().patchValue({ title });
  }

  async openAccountTypeModal(): Promise<void> {
    const value = this.formGroup().get('account_type')?.value || 'Individual';
    const account_type = await this.modalService.openAccountTypeModal(value as 'Individual' | 'Business');
    this.formGroup().patchValue({ account_type });
  }

  async openLocationModal(): Promise<void> {
    const currentAddress = this.formGroup().get('address')?.value || '';
    const { address, latitude, longitude } = await this.modalService.openLocationModal(currentAddress);
    this.formGroup().patchValue({ address, latitude, longitude });
  }

  getMaxDate() {
    return this.datePipe.transform(new Date(), 'yyyy-MM-dd');
  }

  async openDateModal(): Promise<void> {
    const currentDate = this.formGroup().get('dob')?.value || '';
    const date = this.datePipe.transform(currentDate, 'yyyy-MM-dd') ?? undefined;
    const maxDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd') ?? undefined;
    const dob = await this.modalService.openDateTimeModal('date', date, undefined , maxDate);
    if (dob) {
      this.formGroup().patchValue({ dob });
    }
  }
}
