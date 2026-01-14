import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { RegisterComponent } from './auth/register/register.component';
import { AltaVehiculoComponent } from './alta-vehiculo/alta-vehiculo.component';
import { CatalogoComponent } from './catalogo/catalogo.component';
import { CitaComponent } from './cita/cita.component';
import { CitasAdminComponent } from './citas-admin/citas-admin.component';
import { MisCitasComponent } from './mis-citas/mis-citas.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'alta-vehiculo', component: AltaVehiculoComponent },
  { path: 'catalogo', component: CatalogoComponent },
  { path: 'cita', component: CitaComponent },
  { path: 'citas', component: CitasAdminComponent },
  { path: 'mis-citas', component: MisCitasComponent },
  { path: '**', redirectTo: '' }
];