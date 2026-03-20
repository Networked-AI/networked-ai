import { Button } from '../button';
import { Subscription } from 'rxjs';
import { TextInput } from '../text-input';
import { filter, take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ToasterService } from '@/services/toaster.service';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnInit, OnDestroy, input, signal } from '@angular/core';
import { FormBuilder, FormGroup, ControlContainer, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';

interface CustomLinkMeta {
  index: number;
  controlName: string;
  placeholder: string;
}

@Component({
  selector: 'social-input',
  styleUrl: './social-input.scss',
  templateUrl: './social-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, TextInput, Button],
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true })
    }
  ]
})
export class SocialInput implements OnInit, OnDestroy {
  @Input() controlName = 'socials';
  isSubmitted = input(true);
  isLinkValidating = signal(false);
  readonly maxCustomLinks = 3;
  readonly maxLinkLength = 150;
  private readonly linkValidators = [Validators.maxLength(this.maxLinkLength)];
  private toasterService = inject(ToasterService);

  visibleCustomLinks: CustomLinkMeta[] = [];

  private subscription = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private parentContainer: ControlContainer,
    private cdr: ChangeDetectorRef
  ) {}

  get socialsGroup(): FormGroup {
    return this.parentFormGroup.get(this.controlName) as FormGroup;
  }

  get parentFormGroup(): FormGroup {
    return this.parentContainer.control as FormGroup;
  }

  ngOnInit(): void {
    if (!this.socialsGroup) {
      this.parentFormGroup.addControl(
        this.controlName,
        this.formBuilder.group({
          website: ['', this.linkValidators],
          twitter: ['', this.linkValidators],
          facebook: ['', this.linkValidators],
          snapchat: ['', this.linkValidators],
          linkedin: ['', this.linkValidators],
          instagram: ['', this.linkValidators],
          custom_link_1: ['', this.linkValidators],
          custom_link_2: ['', this.linkValidators],
          custom_link_3: ['', this.linkValidators]
        })
      );
    } else {
      for (const key of ['website', 'twitter', 'facebook', 'snapchat', 'linkedin', 'instagram', 'custom_link_1', 'custom_link_2', 'custom_link_3']) {
        const ctrl = this.socialsGroup.get(key);
        if (!ctrl) continue;
        ctrl.addValidators(this.linkValidators);
        ctrl.updateValueAndValidity({ emitEvent: false });
      }
    }

    this.syncVisibleLinksFromValues();

    const sub = this.socialsGroup.valueChanges
      .pipe(
        filter((val) => [1, 2, 3].some((i) => !!val[`custom_link_${i}`])),
        take(1)
      )
      .subscribe(() => {
        this.syncVisibleLinksFromValues();
        this.cdr.markForCheck();
      });

    this.subscription.add(sub);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  addCustomLink(): void {
    if (this.visibleCustomLinks.length >= this.maxCustomLinks) return;
    this.isLinkValidating.set(false);

    if (!this.canAddNewLink) {
      this.isLinkValidating.set(true);
      this.validateCustomLinks();
      this.toasterService.showError(
        this.lastLinkHasMaxLengthError
          ? 'Link exceeds maximum length. Please shorten it before adding a new one.'
          : 'Please fill the current link before adding a new one.'
      );
      return;
    }

    const nextIndex = this.nextAvailableIndex();
    if (nextIndex === -1) return;

    const controlName = `custom_link_${nextIndex}`;
    const ctrl = this.socialsGroup?.get(controlName);
    if (ctrl) {
      ctrl.addValidators(Validators.required);
      ctrl.updateValueAndValidity({ emitEvent: false });
    }

    this.visibleCustomLinks = [...this.visibleCustomLinks, this.buildMeta(nextIndex)];
  }

  private get lastLinkHasMaxLengthError(): boolean {
    if (this.visibleCustomLinks.length === 0) return false;
    const last = this.visibleCustomLinks[this.visibleCustomLinks.length - 1];
    return !!this.socialsGroup?.get(last.controlName)?.hasError('maxlength');
  }

  get canAddNewLink(): boolean {
    if (this.visibleCustomLinks.length === 0) return true;
    const last = this.visibleCustomLinks[this.visibleCustomLinks.length - 1];
    const ctrl = this.socialsGroup?.get(last.controlName);
    const val = ctrl?.value;
    // Block if empty OR if maxlength error exists
    return !!val?.trim() && !ctrl?.hasError('maxlength');
  }

  removeCustomLink(index: number): void {
    const ctrl = this.socialsGroup?.get(`custom_link_${index}`);
    if (ctrl) {
      ctrl.removeValidators(Validators.required);
      ctrl.setValue('');
      ctrl.markAsUntouched();
      ctrl.updateValueAndValidity();
    }

    this.visibleCustomLinks = this.visibleCustomLinks.filter((l) => l.index !== index);
  }

  validateCustomLinks(): boolean {
    if (this.visibleCustomLinks.length === 0) return true;

    let allValid = true;
    for (const link of this.visibleCustomLinks) {
      const ctrl = this.socialsGroup?.get(link.controlName);
      if (ctrl && !ctrl.value?.trim()) {
        ctrl.markAsTouched();
        ctrl.markAsDirty();
        ctrl.updateValueAndValidity();
        allValid = false;
      }
    }

    this.cdr.markForCheck();
    return allValid;
  }

  private buildMeta(index: number): CustomLinkMeta {
    return {
      index,
      controlName: `custom_link_${index}`,
      placeholder: `Custom Link`
    };
  }

  private nextAvailableIndex(): number {
    const used = new Set(this.visibleCustomLinks.map((l) => l.index));
    for (let i = 1; i <= this.maxCustomLinks; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  syncVisibleLinksFromValues(): void {
    const group = this.socialsGroup;
    if (!group) return;

    const alreadyVisible = new Set(this.visibleCustomLinks.map((l) => l.index));

    for (let i = 1; i <= this.maxCustomLinks; i++) {
      const controlName = `custom_link_${i}`;
      const ctrl = group.get(controlName);
      const val = ctrl?.value;

      if (val && !alreadyVisible.has(i)) {
        if (ctrl) {
          ctrl.addValidators(Validators.required);
          ctrl.updateValueAndValidity({ emitEvent: false });
        }

        this.visibleCustomLinks = [...this.visibleCustomLinks, this.buildMeta(i)];

        alreadyVisible.add(i);
      }
    }
  }
}
