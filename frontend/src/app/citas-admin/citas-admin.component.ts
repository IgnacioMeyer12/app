import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-citas-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './citas-admin.component.html',
  styleUrls: ['./citas-admin.component.css']
})
export class CitasAdminComponent implements OnInit {
  citas: any[] = [];
  pendientes: any[] = [];
  contestadas: any[] = [];
  selectedTab: 'pendientes'|'contestadas' = 'pendientes';
  loading = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    // Verificar que es admin
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser || currentUser.rol !== 'admin') {
      alert('Acceso denegado: Solo administradores');
      this.router.navigate(['/']);
      return;
    }

    this.cargarCitas();
  }

  cargarCitas(): void {
    this.loading = true;
    this.http.get('http://localhost:3001/api/citas').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.success) {
          this.citas = res.citas || [];
          // Filtrar citas
          this.pendientes = this.citas.filter(c => 
            c.estado && c.estado.toLowerCase() === 'pendiente'
          );
          this.contestadas = this.citas.filter(c => 
            c.estado && c.estado.toLowerCase() !== 'pendiente'
          );
        }
      },
      error: () => {
        this.loading = false;
        alert('Error al cargar citas');
      }
    });
  }

  selectTab(tab: 'pendientes'|'contestadas') {
    this.selectedTab = tab;
  }

  mapEstado(e: string) {
    if (!e) return 'Desconocido';
    const estado = e.toLowerCase();
    if (estado === 'pendiente') return 'Pendiente';
    if (estado === 'aceptada') return 'Aceptada';
    if (estado === 'rechazada') return 'Rechazada';
    return e;
  }

  // MÉTODO SIMPLE - ACTUALIZAR CITA
  setEstado(cita: any, estado: 'aceptada' | 'rechazada') {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    let adminMessage = null;
    if (estado === 'rechazada') {
      adminMessage = prompt('Motivo del rechazo (opcional):');
      if (adminMessage !== null) {
        adminMessage = adminMessage.trim() || null;
      }
    }

    const body = { 
      estado: estado,
      adminDni: currentUser.dni,
      adminMessage: adminMessage
    };

    // Intentar con PATCH (que ya tienes)
    this.http.patch(`http://localhost:3001/api/citas/${cita.id}`, body)
      .subscribe({
        next: (res: any) => {
          if (res && res.success) {
            alert(`✅ Cita ${estado} correctamente`);
            // Si el servidor devuelve la cita actualizada, actualizarla localmente
            if (res.cita) {
              this.actualizarCitaEnLista(res.cita);
            } else {
              // Si no, recargar todo
              this.cargarCitas();
            }
          } else {
            alert(res?.message || 'Error');
          }
        },
        error: () => {
          alert('Error al actualizar la cita');
          this.cargarCitas();
        }
      });
  }

  // Actualizar una cita específica en las listas
  private actualizarCitaEnLista(citaActualizada: any) {
    const index = this.citas.findIndex(c => c.id === citaActualizada.id);
    if (index !== -1) {
      this.citas[index] = citaActualizada;
    }
    
    // Recalcular las listas
    this.pendientes = this.citas.filter(c => 
      c.estado && c.estado.toLowerCase() === 'pendiente'
    );
    this.contestadas = this.citas.filter(c => 
      c.estado && c.estado.toLowerCase() !== 'pendiente'
    );
  }
}