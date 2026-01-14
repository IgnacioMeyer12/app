import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-mis-citas',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-citas.component.html',
  styleUrls: ['./mis-citas.component.css']
})
export class MisCitasComponent implements OnInit {
  citas: any[] = [];
  loading = false;
  message = '';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      alert('Debes iniciar sesión para ver tus citas');
      this.router.navigate(['/']);
      return;
    }
    const user = JSON.parse(currentUser);
    this.fetchCitas(user.dni);
  }

  fetchCitas(dni: string): void {
    this.loading = true;
    this.http.get(`http://localhost:3001/api/citas?dni=${dni}`).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.success) {
          this.citas = res.citas || [];
        } else {
          this.message = res.message || 'Error cargando citas';
        }
      },
      error: (err) => {
        this.loading = false;
        this.message = 'Error conectando al servidor';
      }
    });
  }

  mapEstado(e: string) {
    if (!e) return '';
    if (e === 'pendiente') return 'Pendiente de aceptación';
    if (e === 'aceptada') return 'Aceptada';
    if (e === 'rechazada') return 'Rechazada';
    return e;
  }
}