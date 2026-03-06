import { IUserForm } from '@/interfaces/IUserForm';
import { IonSpinner } from '@ionic/angular/standalone';
import { ModalService } from '@/services/modal.service';
import { TextInput } from '@/components/form/text-input';
import { ToasterService } from '@/services/toaster.service';
import { SocialInput } from '@/components/form/social-input';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TextAreaInput } from '@/components/form/text-area-input';
import { input, Component, signal, computed, inject } from '@angular/core';
import { DescriptionGeneratorService } from '@/services/description-generator.service';
import { BaseApiService } from '@/services/base-api.service';

@Component({
  selector: 'user-additional-info',
  styleUrl: './user-additional-info.scss',
  templateUrl: './user-additional-info.html',
  imports: [IonSpinner, TextInput, SocialInput, TextAreaInput, ReactiveFormsModule]
})
export class UserAdditionalInfo {
  // inputs
  formGroup = input.required<FormGroup<IUserForm>>();

  conversation = signal<any[]>([]);
  isGeneratingDescription = signal<boolean>(false);
  showDescriptionEditor = signal<boolean>(false);

  isCustomize = computed(() => this.showDescriptionEditor());

  private modalService = inject(ModalService);
  private toasterService = inject(ToasterService);
  private descriptionGenerator = inject(DescriptionGeneratorService);

  handleGenerateClick(): void {
    if (this.showDescriptionEditor()) {
      this.openAIPromptModal();
    } else {
      this.generateDescription();
    }
  }

  async openAIPromptModal(): Promise<void> {
    const data = await this.modalService.openAIPromptModal(this.conversation());

    if (data) {
      if (data.type === 'value' && data.data) {
        const form = this.formGroup();
        const descriptionControl = form.get('description');
        if (descriptionControl) {
          descriptionControl.setValue(data.data);
          descriptionControl.markAsTouched();
        }
      } else if (data.type === 'data' && data.data) {
        this.conversation.set(data.data);
      }
    }
  }

  async generateDescription(): Promise<void> {
    const form = this.formGroup();
    const descriptionControl = form.get('description');

    if (!descriptionControl) return;

    this.isGeneratingDescription.set(true);
    try {
      // Collect only user-related data
      const data = {
        firstName: form.get('first_name')?.value,
        lastName: form.get('last_name')?.value,
        accountType: form.get('account_type')?.value,
        companyName: form.get('company_name')?.value,
        collegeUniversity: form.get('college_university_name')?.value,
        address: form.get('address')?.value
      };

      const generatedDescription = await this.descriptionGenerator.generateUserProfileDescription(data);

      descriptionControl.setValue(generatedDescription);
      descriptionControl.markAsTouched();
      this.showDescriptionEditor.set(true);
    } catch (error: any) {
      console.error('Error generating profile description:', error);

      const msg = BaseApiService.getErrorMessage(error, 'Failed to generate profile description. Please try again.');
      this.toasterService.showError(msg);

      // Safe fallback
      const fallbackDescription = 'This is a short profile description. You can customize it to better reflect who you are.';
      descriptionControl.setValue(fallbackDescription);
      descriptionControl.markAsTouched();
      this.showDescriptionEditor.set(true);
    } finally {
      this.isGeneratingDescription.set(false);
    }
  }
}
