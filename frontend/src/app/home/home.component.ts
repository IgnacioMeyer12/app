import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  loading = false;
  currentYear = new Date().getFullYear();
  loginForm: FormGroup;
  errorMessage = '';
  isLoggedIn = false;
  currentUser: any = null;

  private _onScroll: any;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      dni: ['', [Validators.required, Validators.minLength(7)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Verificar si el usuario ya está logueado
    this.checkLoginStatus();
  }

  ngAfterViewInit(): void {
    this._onScroll = () => {
      const header = document.querySelector('.header-content') as HTMLElement;
      const scrollPosition = window.scrollY;
      if (header && scrollPosition < 600) {
        header.style.transform = `translateY(${scrollPosition * 0.3}px)`;
      }
    };
    window.addEventListener('scroll', this._onScroll);
  }

  ngOnDestroy(): void {
    if (this._onScroll) {
      window.removeEventListener('scroll', this._onScroll);
    }
  }

  checkLoginStatus(): void {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      this.currentUser = JSON.parse(userData);
      this.isLoggedIn = true;
    }
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.errorMessage = '';
      
      const loginData = this.loginForm.value;
      
      this.http.post('http://localhost:3001/api/login', loginData).subscribe({
        next: (response: any) => {
          this.loading = false;
          
          if (response.success) {
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            this.currentUser = response.user;
            this.isLoggedIn = true;
          } else {
            this.errorMessage = response.message || 'Error en el login';
            alert(this.errorMessage);
          }
        },
        error: (error) => {
          this.loading = false;
          
          if (error.status === 0) {
            this.errorMessage = 'No se puede conectar al servidor. Verifica que el backend esté ejecutándose en http://localhost:3001';
          } else if (error.status === 401) {
            this.errorMessage = 'Credenciales incorrectas. Verifica tu DNI y contraseña.';
          } else if (error.status === 400) {
            this.errorMessage = error.error?.message || 'Error en los datos enviados';
          } else {
            this.errorMessage = 'Error del servidor. Intente nuevamente.';
          }
          
          alert(this.errorMessage);
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  onLogout(): void {
    localStorage.removeItem('currentUser');
    this.isLoggedIn = false;
    this.currentUser = null;
    this.loginForm.reset();
  }

  fillDemoCredentials(type: 'admin' | 'client'): void {
    if (type === 'admin') {
      this.loginForm.patchValue({
        dni: '12345678',
        password: 'admin123'
      });
    } else {
      this.loginForm.patchValue({
        dni: '87654321',
        password: 'cliente123'
      });
    }
    this.errorMessage = '';
  }

  // Navegación para Cliente
  verVehiculos(): void {
    this.router.navigate(['/catalogo']);
  }

  realizarCita(): void {
    this.router.navigate(['/cita']);
  }

  verMisCitas(): void {
    this.router.navigate(['/mis-citas']);
  }

  // Navegación para Administrador
  darAltaAdmin(): void {
    // Navigate to the public register route but signal admin-create mode via query param
    this.router.navigate(['/register'], { queryParams: { as: 'admin' } });
  }

  verCitas(): void {
    this.router.navigate(['/citas']);
  }

  darAltaVehiculo(): void {
    this.router.navigate(['/alta-vehiculo']);
  }
}