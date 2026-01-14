import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cita',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cita.component.html',
  styleUrls: ['./cita.component.css']
})
export class CitaComponent implements OnInit {
  vehicles: any[] = [];
  selectedVehicleId: string | null = null;
  fecha = '';
  hora = '';
  motivo = 'Consulta por vehículo';
  motivos = ['Consulta por vehículo', 'Prueba de vehículo', 'Asesoramiento', 'Otro'];

  loading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  // Slots state
  slots: Array<{ time: string, available: boolean }> = [];
  selectedSlot: string | null = null;

  constructor(private http: HttpClient, public router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['id']) this.selectedVehicleId = params['id'];
    });

    this.fetchVehicles();
  }

  fetchVehicles(): void {
    this.loading = true;
    this.http.get('http://localhost:3001/api/vehiculos').subscribe({
      next: (resp: any) => {
        this.loading = false;
        if (resp && resp.success) {
          this.vehicles = resp.vehiculos || [];
        } else {
          this.showError(resp.message || 'Error cargando vehículos');
        }
      },
      error: (err) => {
        this.loading = false;
        this.showError('Error conectando al servidor');
      }
    });
  }

  fetchAvailability(date: string): void {
    if (!date) return;
    const params: any = { date };
    if (this.selectedVehicleId) params.idVehiculo = this.selectedVehicleId;

    this.http.get('http://localhost:3001/api/citas/availability', { params }).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.slots = res.slots || [];
          // reset selectedSlot if it's no longer available
          if (this.selectedSlot && !this.slots.find(s => s.time === this.selectedSlot && s.available)) {
            this.selectedSlot = null;
          }
        } else {
          this.showError(res.message || 'Error obteniendo disponibilidad');
        }
      },
      error: (err) => {
        this.showError('Error conectando al servidor');
        console.error(err);
      }
    });
  }

  selectSlot(time: string, available: boolean): void {
    if (!available) return;
    this.selectedSlot = time;
    this.hora = time; // keep compatibility for submit
  }

  showError(msg: string) {
    this.message = msg;
    this.messageType = 'error';
  }

  showSuccess(msg: string) {
    this.message = msg;
    this.messageType = 'success';
  }

  submit(): void {
    this.message = '';

    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      this.showError('Debes iniciar sesión para solicitar una cita');
      return;
    }

    const user = JSON.parse(currentUser);
    if (user.rol !== 'cliente') {
      this.showError('Solo clientes pueden solicitar citas');
      return;
    }

    // Vehicle is optional now

    if (!this.fecha || !this.selectedSlot) {
      this.showError('Selecciona fecha y un horario disponible');
      return;
    }

    // Ensure selected slot is still available by re-checking availability for the date
    // (simple optimistic check)
    this.loading = true;
    this.http.get('http://localhost:3001/api/citas/availability', { params: { date: this.fecha, idVehiculo: this.selectedVehicleId || '' } }).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.success) {
          const slot = (res.slots || []).find((s: any) => s.time === this.selectedSlot);
          if (!slot || !slot.available) {
            this.showError('El horario seleccionado ya no está disponible. Elige otro.');
            return;
          }

          const currentUser = localStorage.getItem('currentUser');
          if (!currentUser) {
            this.showError('Debes iniciar sesión para solicitar una cita');
            return;
          }

          const user = JSON.parse(currentUser);
          if (user.rol !== 'cliente') {
            this.showError('Solo clientes pueden solicitar citas');
            return;
          }

          // Build payload and submit
          const payload = {
            dni: user.dni,
            idVehiculo: this.selectedVehicleId || null,
            fecha: this.fecha,
            hora: this.selectedSlot,
            motivo: this.motivo
          };

          this.loading = true;
          this.http.post('http://localhost:3001/api/citas', payload).subscribe({
            next: (postRes: any) => {
              this.loading = false;
              if (postRes && postRes.success) {
                this.showSuccess('Cita agendada correctamente');
                // Reset
                this.fecha = '';
                this.selectedSlot = null;
                this.hora = '';
                this.slots = [];
              } else {
                this.showError(postRes.message || 'Error agendando cita');
              }
            },
            error: (err) => {
              this.loading = false;
              this.showError(err.error?.message || 'Error del servidor al agendar cita');
            }
          });

        } else {
          this.loading = false;
          this.showError(res.message || 'Error al validar disponibilidad');
        }
      },
      error: (err) => {
        this.loading = false;
        this.showError('Error validando disponibilidad');
      }
    });

    return;

    // Validate date is weekday
    const dt = new Date(`${this.fecha}T${this.hora}:00`);
    if (isNaN(dt.getTime())) {
      this.showError('Fecha u hora inválida');
      return;
    }

    const day = dt.getDay(); // 0=Sun,1=Mon...6=Sat
    if (day === 0 || day === 6) {
      this.showError('Las citas solo se pueden agendar de lunes a viernes');
      return;
    }

    const hour = dt.getHours();
    const minute = dt.getMinutes();

    const inMorning = (hour > 8 || (hour === 9 && minute >= 0) || hour === 9) && (hour < 13 || (hour === 13 && minute === 0));
    const inAfternoon = (hour > 14 || (hour === 15 && minute >= 0) || hour === 15) && (hour < 18 || (hour === 18 && minute === 0));

    // Simplify: allow times between 09:00-13:00 inclusive and 15:00-18:00 inclusive
    const allowed = (hour >= 9 && (hour < 13 || (hour === 13 && minute === 0))) || (hour >= 15 && (hour < 18 || (hour === 18 && minute === 0)));

    if (!allowed) {
      this.showError('Las citas solo están disponibles de 09:00 a 13:00 y de 15:00 a 18:00');
      return;
    }

    const payload = {
      dni: user.dni,
      idVehiculo: this.selectedVehicleId,
      fecha: this.fecha,
      hora: this.hora,
      motivo: this.motivo
    };

    this.loading = true;
    this.http.post('http://localhost:3001/api/citas', payload).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.success) {
          this.showSuccess('Cita agendada correctamente');
          // Reset
          this.fecha = '';
          this.hora = '';
        } else {
          this.showError(res.message || 'Error agendando cita');
        }
      },
      error: (err) => {
        this.loading = false;
        this.showError(err.error?.message || 'Error del servidor al agendar cita');
      }
    });
  }
}
