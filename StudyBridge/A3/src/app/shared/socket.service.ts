import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

export interface SlotEvent {
  slotId: string;
  tutorId: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket = io(environment.socketOrigin);

  readonly slotBooked = signal<SlotEvent | null>(null);
  readonly slotFreed = signal<SlotEvent | null>(null);

  constructor() {
    this.socket.on('slot:booked', (payload: SlotEvent) => {
      this.slotBooked.set(payload);
    });

    this.socket.on('slot:freed', (payload: SlotEvent) => {
      this.slotFreed.set(payload);
    });
  }
}
