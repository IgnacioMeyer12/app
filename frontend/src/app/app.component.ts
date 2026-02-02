/* IMPORTACIONES DE ANGULAR
   ======================
   - Component: decorador para crear un componente
   - RouterModule: módulo que proporciona <router-outlet>
   - CommonModule: módulo con *ngIf, *ngFor, etc.
   - OnInit: interfaz para lógica de inicialización */
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

/* DECORADOR DEL COMPONENTE RAÍZ
   ===========================
   - selector: 'app-root' = el componente raíz se usa en index.html como <app-root></app-root>
   - standalone: true = componente independiente
   - imports: módulos que usa
   - template: el HTML del componente (en inline aquí, no en archivo separado) */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <router-outlet></router-outlet>
  `
})

/* CLASE DEL COMPONENTE RAÍZ
   ========================
   Componente simple que solo contiene el layout general (header, router-outlet, footer)
   Incluye manejo del tema (light/dark mode) */
export class AppComponent implements OnInit {
  /* title: el título de la aplicación */
  title = 'Automotores Meyer';
  
  /* Constructor: inyectar el ThemeService */
  constructor() {}

  /* ngOnInit: inicializar el componente */
  ngOnInit(): void {}
}
