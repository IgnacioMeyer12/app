/* IMPORTACIONES
   =============
   - ApplicationConfig: tipo que configura la aplicación
   - provideRouter: proveedor que añade el enrutador
   - provideHttpClient: proveedor que añade el cliente HTTP
   - routes: la lista de rutas de la aplicación */
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

/* CONFIGURACIÓN DE LA APLICACIÓN
   =============================
   Define los "proveedores" globales que Angular inyecta en toda la aplicación */
export const appConfig: ApplicationConfig = {
  /* providers: array de proveedores globales */
  providers: [
    /* provideRouter(routes): activa el enrutador y proporciona las rutas
       Esto permite que Angular maneje la navegación entre páginas */
    provideRouter(routes),
    /* provideHttpClient(): activa el cliente HTTP
       Permite que los componentes hagan peticiones GET, POST, etc. a servidores */
    provideHttpClient()
  ]
};
