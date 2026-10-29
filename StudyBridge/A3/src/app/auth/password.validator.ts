import { AbstractControl, ValidationErrors } from '@angular/forms';


export function passwordComplexity(control: AbstractControl): ValidationErrors | null {
  const password = control.value as string;
  if (!password) return null; 
  const valid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return valid ? null : { passwordComplexity: true };
}
