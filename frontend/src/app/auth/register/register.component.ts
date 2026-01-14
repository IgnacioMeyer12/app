import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  loading = false;
  currentYear = new Date().getFullYear();
  registerForm: FormGroup;
  showPassword = false;
  showConfirmPassword = false;

  adminMode = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.registerForm = this.fb.group({
      dni: ['', [Validators.required, Validators.minLength(7)]],
      nombre: ['', [Validators.required]],
      apellido: ['', [Validators.required]],
      telefono: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params: any) => {
      if (params['as'] === 'admin') {
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
          alert('Debes iniciar sesión como administrador');
          this.router.navigate(['/']);
          return;
        }
        const user = JSON.parse(currentUser);
        if (user.rol !== 'admin') {
          alert('Acceso denegado. Solo administradores pueden dar de alta otros admins.');
          this.router.navigate(['/']);
          return;
        }
        this.adminMode = true;
      }
    });
  }

  passwordMatchValidator(control: AbstractControl) {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { mismatch: true };
    }
    return null;
  }

  // Nuevos métodos agregados
  togglePasswordVisibility(field: string): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else if (field === 'confirmPassword') {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  getPasswordStrength(): string {
    const password = this.registerForm.get('password')?.value || '';
    if (password.length === 0) return 'empty';
    if (password.length < 6) return 'weak';
    if (password.length < 8) return 'medium';
    return 'strong';
  }

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    switch (strength) {
      case 'empty': return '';
      case 'weak': return 'Débil';
      case 'medium': return 'Media';
      case 'strong': return 'Fuerte';
      default: return '';
    }
  }

  onRegister(): void {
    if (!this.registerForm.valid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const payload: any = { ...this.registerForm.value };
    delete payload.confirmPassword;

    if (this.adminMode) {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (!currentUser || currentUser.rol !== 'admin') {
        alert('Acceso denegado. Solo administradores.');
        this.router.navigate(['/']);
        this.loading = false;
        return;
      }
      payload.creatorDni = currentUser.dni;
      payload.rol = 'admin';

      // Usar el mismo endpoint /api/register pero indicando creatorDni
      this.http.post('http://localhost:3001/api/register', payload).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res && res.success) {
            alert('Administrador creado correctamente');
            this.router.navigate(['/']);
          } else {
            alert(res.message || 'Error creando administrador');
          }
        },
        error: (err) => {
          this.loading = false;
          alert(err.error?.message || 'Error del servidor');
        }
      });

    } else {
      // Public registration (clientes)
      this.http.post('http://localhost:3001/api/register', payload).subscribe({
        next: (response: any) => {
          this.loading = false;
          if (response.success) {
            alert('Registro exitoso. Ahora puedes iniciar sesión.');
            this.router.navigate(['/']);
          } else {
            alert(response.message || 'Error en el registro');
          }
        },
        error: (error) => {
          this.loading = false;
          if (error.status === 400) {
            alert(error.error?.message || 'Error en el registro. Verifique los datos.');
          } else {
            alert('Error del servidor. Intente nuevamente.');
          }
        }
      });
    }
  }
}