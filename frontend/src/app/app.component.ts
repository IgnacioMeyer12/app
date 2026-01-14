
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-container">
      <header class="header">
        <div class="header-overlay"></div>
        <div class="header-content">
          <div class="logo-container">
            <img src="/img/Logo.png" alt="Automotores Meyer" class="logo" />
          </div>
          <div class="header-titles">
            <h1 class="header-title">Automotores Meyer</h1>
            <p class="header-subtitle">Amenabar 2469 · Tel: 341 383 8911 · ignacioarielmeyer@gmail.com</p>
          </div>
        </div>
      </header>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      <footer class="footer">
        <div class="footer-content">
          <div class="footer-section">
            <h4>Contacto</h4>
            <p>ignacioarielmeyer@gmail.com · Tel: 341 383 8911</p>
          </div>
          <div class="footer-section">
            <h4>Dirección</h4>
            <p>Amenabar 2469</p>
          </div>
        </div>
        <div class="footer-bottom">© Automotores Meyer</div>
      </footer>
    </div>
  `
})
export class AppComponent {
  title = 'Automotores Meyer';
}