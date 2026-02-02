/* IMPORTACIONES
   =============
   - Routes: tipo que define las rutas de la aplicación
   - Componentes: importamos cada componente que se usará en las rutas */
import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';                    /* Página inicial */
import { RegisterComponent } from './auth/register/register.component';   /* Registro de usuarios */
import { AltaVehiculoComponent } from './alta-vehiculo/alta-vehiculo.component'; /* Agregar vehículos */
import { CatalogoComponent } from './catalogo/catalogo.component';         /* Ver catálogo de vehículos */
import { CitaComponent } from './cita/cita.component';                    /* Agendar citas */
import { CitasAdminComponent } from './citas-admin/citas-admin.component'; /* Admin: ver todas las citas */
import { MisCitasComponent } from './mis-citas/mis-citas.component';       /* Usuario: ver sus citas */

/* DEFINICIÓN DE RUTAS
   ===================
   Cada ruta mapea una URL a un componente
   Cuando el usuario navega a una URL, Angular carga el componente correspondiente */
export const routes: Routes = [
  /* Ruta raíz: / → muestra HomeComponent */
  { path: '', component: HomeComponent },
  /* Ruta: /register → muestra RegisterComponent (formulario de registro) */
  { path: 'register', component: RegisterComponent },
  /* Ruta: /alta-vehiculo → muestra AltaVehiculoComponent (agregar vehículo) */
  { path: 'alta-vehiculo', component: AltaVehiculoComponent },
  /* Ruta: /catalogo → muestra CatalogoComponent (ver vehículos) */
  { path: 'catalogo', component: CatalogoComponent },
  /* Ruta: /cita → muestra CitaComponent (agendar cita) */
  { path: 'cita', component: CitaComponent },
  /* Ruta: /citas → muestra CitasAdminComponent (admin ve todas las citas) */
  { path: 'citas', component: CitasAdminComponent },
  /* Ruta: /mis-citas → muestra MisCitasComponent (usuario ve sus citas) */
  { path: 'mis-citas', component: MisCitasComponent },
  /* Ruta comodín: ** = cualquier otra URL que no coincida
     redirectTo: '' = redirige a la página principal (/) */
  { path: '**', redirectTo: '' }
];
