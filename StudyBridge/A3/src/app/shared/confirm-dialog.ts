import { Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog #dialogEl (close)="open.set(false)">
      <h3>{{ title() }}</h3>
      <button type="button" (click)="cancel()">Cancel</button>
      <button type="button" (click)="confirm()">{{ confirmLabel() }}</button>
    </dialog>
  `,
})
export class ConfirmDialog {
  open = model.required<boolean>();
  title = input('Are you sure?');
  confirmLabel = input('Confirm');
  confirmed = output<void>();

  private dialogEl = viewChild.required<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const el = this.dialogEl().nativeElement;
      if (this.open()) {
        el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  cancel(): void {
    this.open.set(false);
  }

  confirm(): void {
    this.open.set(false);
    this.confirmed.emit();
  }
}
