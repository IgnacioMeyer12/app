import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './catalogo.component.html',
  styleUrls: ['./catalogo.component.css']
})
export class CatalogoComponent implements OnInit {
  vehicles: any[] = [];
  loading = false;
  error = '';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.fetchVehicles();
  }

  fetchVehicles(): void {
    this.loading = true;
    this.error = '';

    this.http.get('http://localhost:3001/api/vehiculos').subscribe({
      next: (resp: any) => {
        this.loading = false;
        if (resp && resp.success) {
          this.vehicles = resp.vehiculos || [];
        } else {
          this.error = resp.message || 'Error cargando vehículos';
        }
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 0) {
          this.error = 'No se puede conectar al servidor. Verifica que el backend esté en http://localhost:3001';
        } else {
          this.error = err.error?.message || 'Error cargando vehículos';
        }
      }
    });
  }

  viewDetails(vehicle: any): void {
    // For now, navigate to a simple anchor or show a minimal details page later
    // We'll just alert for quick feedback
    alert(`${vehicle.marca} ${vehicle.modelo} (${vehicle.anio}) - Precio: ${this.formatCurrency(vehicle.precio)}`);
  }

  formatCurrency(amount: number): string {
    if (amount === null || amount === undefined || isNaN(amount)) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  schedule(vehicle: any): void {
    console.log('CatalogoComponent.schedule called with', vehicle);

    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      alert('Debes iniciar sesión como cliente para solicitar una cita. Te redirecciono a la pantalla de login.');
      this.router.navigate(['/']);
      return;
    }

    const user = JSON.parse(currentUser);
    if (user.rol !== 'cliente') {
      alert('Solo usuarios con rol de cliente pueden solicitar citas.');
      return;
    }

    if (!vehicle || !vehicle.idVehiculo) {
      alert('Vehículo inválido');
      return;
    }

    // First try standard navigation; fallback to navigateByUrl
    this.router.navigate(['/cita'], { queryParams: { id: vehicle.idVehiculo } }).catch(err => {
      console.warn('Router.navigate failed, falling back to navigateByUrl', err);
      try {
        this.router.navigateByUrl(`/cita?id=${encodeURIComponent(vehicle.idVehiculo)}`);
      } catch (e) {
        console.error('Fallback navigation also failed', e);
        alert('No fue posible navegar a la pantalla de citas. Refresca la página e intenta nuevamente.');
      }
    });
  }
}

