import { signal } from '@angular/core';
import { IAuthUser } from '@/interfaces/IAuth';
import { IUserForm } from '@/interfaces/IUserForm';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';
import { MediaService } from '@/services/media.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { UserPersonalInfo } from '@/components/common/user-personal-info';

@Injectable({ providedIn: 'root' })
export class ProfileFormService {
  // services
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private mediaService = inject(MediaService);
  private modalService = inject(ModalService);
  private toasterService = inject(ToasterService);

  // signals
  isLoading = signal(false);
  isSubmitted = signal(false);
  profileForm = signal<FormGroup<IUserForm>>(this.fb.group({ latitude: [''], longitude: [''] }) as FormGroup<IUserForm>);

  // original user data to compare changes
  private originalEmail: string | null = null;
  private originalMobile: string | null = null;

  // initialize the form with user data
  async initializeForm(): Promise<void> {
    try {
      this.isLoading.set(true);
      const currentUser = await this.userService.getCurrentUser();
      const formValue = this.userService.getUserFromApiResponse(currentUser);
      this.profileForm().patchValue(formValue, { emitEvent: false });
      // store original email and mobile for comparison
      this.originalEmail = currentUser.email || null;
      this.originalMobile = currentUser.mobile || null;
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to load user data.');
      this.toasterService.showError(message);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  // initialize fields in user personal info component
  initializeFields(userPersonalInfo: UserPersonalInfo | undefined, userData: any): void {
    userPersonalInfo?.initializeFields(userData);
  }

  // validate the form
  async validate(userPersonalInfo: UserPersonalInfo | undefined): Promise<boolean> {
    return (await userPersonalInfo?.validate()) ?? false;
  }

  // check if email or mobile changed and verify before submitting
  async checkAndVerifyChangedFields(userPersonalInfo: UserPersonalInfo | undefined): Promise<boolean> {
    const newEmail = this.profileForm().get('email')?.value;
    const newMobile = userPersonalInfo?.getPhoneNumber();

    const emailChanged = newEmail && newEmail !== this.originalEmail;
    const mobileChanged = newMobile && newMobile !== this.originalMobile;

    // if nothing changed, no need to verify
    if (!emailChanged && !mobileChanged) return true;

    try {
      // send verification code for email if changed
      if (emailChanged && newEmail) {
        await this.authService.sendOtp({ email: newEmail });
      }

      // send verification code for mobile if changed
      if (mobileChanged && newMobile) {
        await this.authService.sendOtp({ mobile: newMobile });
      }

      // open verification code modal (it verifies internally and returns true/false)
      const verified = await this.modalService.openOtpModal(emailChanged ? newEmail! : '', mobileChanged ? newMobile! : '');

      return verified;
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to send verification code.');
      this.toasterService.showError(message);
      return false;
    }
  }

  // handle form submission with image upload and user update
  async handleSubmit(userPersonalInfo: UserPersonalInfo | undefined): Promise<void> {
    const formValue = this.profileForm().getRawValue() as Partial<IAuthUser>;
    const mobile = userPersonalInfo?.getPhoneNumber();

    // check if image_url is a File and upload it
    if (formValue.image_url instanceof File) {
      try {
        const response = await this.mediaService.uploadMedia('Profile', [formValue.image_url]);
        // assume the API returns an array of URLs, use the first one
        if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
          formValue.image_url = response.data[0].url;
        }
      } catch (error) {
        const message = BaseApiService.getErrorMessage(error, 'Failed to upload image.');
        this.toasterService.showError(message);
        throw error;
      }
    }

    // convert to user payload and update
    const payload = this.userService.generateUserPayload({ ...formValue, mobile });
    await this.userService.updateCurrentUser(payload);
  }

  // save the form - validates, verifies changes, and submits
  async save(userPersonalInfo: UserPersonalInfo | undefined, socialInput?: { validateCustomLinks: () => boolean }): Promise<boolean> {
    try {
      this.isLoading.set(true);

      if (!this.validateSocialLinks(socialInput)) return false;

      // validate personal info fields
      if (!(await this.validate(userPersonalInfo))) {
        this.toasterService.showError('Please fill all required fields.');
        return false;
      }

      // check if email or mobile changed and verify before submitting
      const hasChanges = await this.checkAndVerifyChangedFields(userPersonalInfo);
      if (!hasChanges) {
        return false; // verification failed or was cancelled
      }

      await this.handleSubmit(userPersonalInfo);
      return true;
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to save profile. Please try again.');
      this.toasterService.showError(message);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  validateSocialLinks(socialInput?: { validateCustomLinks: () => boolean }): boolean {
    if (socialInput && !socialInput.validateCustomLinks()) {
      this.toasterService.showError('Please fill in all added custom links or remove them.');
      return false;
    }
    const socials = this.profileForm().get('socials') as FormGroup | null;
    if (!socials) return true;

    const hasMax = Object.values(socials.controls).some((c) => c.hasError('maxlength'));
    if (hasMax) {
      socials.markAllAsTouched();
      this.toasterService.showError('One or more social links exceed the maximum length.');
      return false;
    }
    return true;
  }
}
