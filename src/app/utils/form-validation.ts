import { firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
import { FormGroup, AbstractControl } from '@angular/forms';

/**
 * Validates form fields and marks invalid fields as touched.
 * Waits for async validators to complete before validating.
 *
 * @param form - The FormGroup to validate
 * @param fieldNames - Array of form control names to validate
 * @param optionalFields - Fields that are optional: skip if empty, validate format if filled
 * @returns Promise that resolves to true if all fields are valid, false otherwise
 */
export async function validateFields(
  form: FormGroup,
  fieldNames: string[],
  optionalFields: string[] = []
): Promise<boolean> {
  // Separate fields into required and optional-but-filled
  const optionalSet = new Set(optionalFields);
  const fieldsToProcess = fieldNames.filter((field) => {
    if (!optionalSet.has(field)) return true; // always process required fields

    const control = form.get(field);
    const value = control?.value;
    return !!value?.trim?.() || (!!value && typeof value !== 'string'); // skip if empty
  });

  // Mark fields as touched and trigger async validators
  fieldsToProcess.forEach((field) => {
    const control = form.get(field);
    if (control && !control.disabled) {
      if (control instanceof FormGroup) {
        Object.keys(control.controls).forEach((key) => {
          const nestedControl = control.get(key);
          if (nestedControl && !nestedControl.disabled) {
            nestedControl.markAsTouched();
            nestedControl.updateValueAndValidity();
          }
        });
      } else {
        control.markAsTouched();
        control.updateValueAndValidity();
      }
    }
  });

  // Wait for async validators to complete
  await waitForAsyncValidators(form, fieldsToProcess);

  // Check if all processed fields are valid
  return fieldsToProcess.every((field) => {
    const control = form.get(field);
    if (!control) return false;

    if (control.disabled && control.value) return true;

    if (control instanceof FormGroup) {
      return Object.keys(control.controls).every((key) => {
        const nestedControl = control.get(key);
        if (!nestedControl) return false;
        if (nestedControl.disabled && nestedControl.value) return true;
        return nestedControl.status === 'VALID';
      });
    }

    return control.status === 'VALID';
  });
}

/**
 * Waits for all async validators to complete for the specified fields.
 * Handles both regular controls and nested FormGroups.
 *
 * @param form - The FormGroup containing the controls
 * @param fieldNames - Array of field names to wait for
 */
async function waitForAsyncValidators(form: FormGroup, fieldNames: string[]): Promise<void> {
  const promises = fieldNames.map((fieldName) => {
    const control = form.get(fieldName);
    if (!control) return Promise.resolve();

    if (control instanceof FormGroup) {
      const nestedPromises = Object.keys(control.controls).map((key) => {
        return waitForControlAsyncValidation(control.get(key));
      });
      return Promise.all(nestedPromises);
    }

    return waitForControlAsyncValidation(control);
  });

  await Promise.all(promises);
}

/**
 * Waits for a single control's async validators to complete.
 * Returns immediately if control is not in PENDING state.
 * Has a 5-second timeout to prevent infinite waiting.
 *
 * @param control - The control to wait for (can be null)
 */
async function waitForControlAsyncValidation(control: AbstractControl | null): Promise<void> {
  if (!control || control.status !== 'PENDING') return Promise.resolve();

  if (!control.statusChanges) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return Promise.resolve();
  }

  try {
    await firstValueFrom(
      control.statusChanges.pipe(
        filter((status) => status !== 'PENDING'),
        timeout(5000)
      )
    );
  } catch (error) {
    if (control.status !== 'PENDING') return Promise.resolve();
  }
}