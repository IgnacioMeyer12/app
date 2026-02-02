/* IMPORTACIONES DE ANGULAR
   ======================
   - Component: decorador para crear un componente Angular
   - OnInit: interfaz que se ejecuta cuando el componente se inicializa
   - CommonModule: módulo de Angular con *ngIf, *ngFor, etc.
   - Router: para navegar a otras páginas
   - RouterModule: módulo para usar routerLink en templates
   - ActivatedRoute: para obtener parámetros de la URL
   - HttpClient: para hacer peticiones HTTP (GET, POST, etc.)
   - FormsModule: para usar [(ngModel)] en inputs */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

/* DECORADOR DEL COMPONENTE
   ======================
   - selector: el nombre del componente en HTML (<app-cita></app-cita>)
   - standalone: true = componente independiente (no necesita módulo)
   - imports: módulos que este componente usa
   - templateUrl: archivo HTML del componente
   - styleUrls: archivos CSS del componente */
@Component({
  selector: 'app-cita',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cita.component.html',
  styleUrls: ['./cita.component.css']
})

/* CLASE DEL COMPONENTE
   ===================
   Implementa OnInit: ejecuta ngOnInit() cuando el componente se carga */
export class CitaComponent implements OnInit {
  /* PROPIEDADES: Variables que el HTML puede usar con {{}} */
  
  /* vehicles: lista de vehículos que obtiene del servidor */
  vehicles: any[] = [];
  /* selectedVehicleId: el vehículo que el usuario seleccionó (null si no selecciona) */
  selectedVehicleId: string | null = null;
  /* fecha: la fecha que el usuario selecciona (en formato YYYY-MM-DD) */
  fecha = '';
  /* hora: la hora que el usuario selecciona (en formato HH:MM) */
  hora = '';
  /* motivo: la razón de la cita (ej: consulta, prueba, asesoramiento) */
  motivo = 'Consulta por vehículo';
  /* motivos: lista de motivos disponibles para seleccionar */
  motivos = ['Consulta por vehículo', 'Prueba de vehículo', 'Asesoramiento', 'Otro'];
  /* minFecha: fecha mínima permitida (hoy) */
  minFecha = '';
  /* minHora: hora mínima permitida (hora actual si es hoy) */
  minHora = '';

  /* loading: true cuando está cargando datos del servidor */
  loading = false;
  /* message: el mensaje de éxito o error que muestra en la pantalla */
  message = '';
  /* messageType: tipo de mensaje ('success' = verde, 'error' = rojo) */
  messageType: 'success' | 'error' = 'success';

  /* slots: lista de horas disponibles para agendar
     Cada slot tiene: time (ej: "09:00") y available (true/false) */
  slots: Array<{ time: string, available: boolean }> = [];
  /* selectedSlot: la hora que el usuario seleccionó */
  selectedSlot: string | null = null;

  /* CONSTRUCTOR
     ===========
     Se ejecuta cuando se crea el componente
     - http: servicio para hacer peticiones HTTP
     - router: servicio para navegar
     - route: servicio para obtener parámetros de la URL */
  constructor(private http: HttpClient, public router: Router, private route: ActivatedRoute) {}


  /* MÉTODO: ngOnInit
     ================
     Se ejecuta automáticamente cuando el componente se carga
     Aquí inicializamos el componente con datos por defecto */
  ngOnInit(): void {
    /* Obtener la fecha de hoy */
    const today = new Date();
    /* Convertir a formato YYYY-MM-DD y guardar como fecha mínima */
    this.minFecha = today.toISOString().split('T')[0];
    
    /* Obtener la hora actual */
    const hours = String(today.getHours()).padStart(2, '0');   /* Ej: "09" */
    const minutes = String(today.getMinutes()).padStart(2, '0'); /* Ej: "30" */
    /* Guardar como hora mínima en formato HH:MM */
    this.minHora = `${hours}:${minutes}`;
    
    /* Escuchar los parámetros de la URL (ej: ?id=123) */
    this.route.queryParams.subscribe(params => {
      /* Si hay un parámetro 'id', guardarlo como vehículo seleccionado */
      if (params['id']) this.selectedVehicleId = params['id'];
    });

    /* Cargar los vehículos del servidor */
    this.fetchVehicles();
  }

  /* MÉTODO: fetchVehicles
     ====================
     Obtiene la lista de vehículos del servidor mediante HTTP GET */
  fetchVehicles(): void {
    /* Mostrar indicador de carga */
    this.loading = true;
    /* Hacer petición GET a http://localhost:3001/api/vehiculos */
    this.http.get('http://localhost:3001/api/vehiculos').subscribe({
      /* next: se ejecuta si la petición es exitosa */
      next: (resp: any) => {
        /* Ocultar indicador de carga */
        this.loading = false;
        /* Verificar si la respuesta tiene éxito */
        if (resp && resp.success) {
          /* Guardar los vehículos en la propiedad (o array vacío si no hay) */
          this.vehicles = resp.vehiculos || [];
        } else {
          /* Si no hay éxito, mostrar error */
          this.showError(resp.message || 'Error cargando vehículos');
        }
      },
      /* error: se ejecuta si hay un problema de conexión o servidor */
      error: (err) => {
        /* Ocultar indicador de carga */
        this.loading = false;
        /* Mostrar mensaje de error */
        this.showError('Error conectando al servidor');
      }
    });
  }


  /* MÉTODO: fetchAvailability
     =======================
     Obtiene los horarios disponibles para una fecha específica
     Parámetro: date = fecha seleccionada por el usuario (YYYY-MM-DD) */
  fetchAvailability(date: string): void {
    /* Si no hay fecha, no hacer nada */
    if (!date) return;
    
    /* VALIDACIÓN: Verificar que la fecha no sea anterior a hoy */
    const selectedDate = new Date(date);    /* Fecha que seleccionó el usuario */
    const today = new Date();               /* Fecha de hoy */
    /* Poner ambas fechas a las 00:00:00 para compararlas sin horas */
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    /* Si la fecha seleccionada es anterior a hoy, es inválida */
    if (selectedDate < today) {
      /* Mostrar error */
      this.showError('No puedes seleccionar una fecha anterior a hoy');
      /* Limpiar los campos */
      this.fecha = '';
      this.slots = [];
      this.selectedSlot = null;
      return;
    }
    
    /* Preparar los parámetros para la petición HTTP */
    const params: any = { date };
    /* Si hay vehículo seleccionado, añadirlo a los parámetros */
    if (this.selectedVehicleId) params.idVehiculo = this.selectedVehicleId;

    /* Hacer petición GET para obtener los slots disponibles */
    this.http.get('http://localhost:3001/api/citas/availability', { params }).subscribe({
      /* Si la petición es exitosa */
      next: (res: any) => {
        /* Verificar si hay respuesta exitosa */
        if (res && res.success) {
          /* Guardar los slots (horarios) disponibles */
          this.slots = res.slots || [];
          
          /* FILTRADO: Si la fecha seleccionada es hoy, filtrar horas que ya pasaron */
          const selectedDate = new Date(date);
          const today = new Date();
          /* Comparar solo las fechas (sin horas) */
          today.setHours(0, 0, 0, 0);
          selectedDate.setHours(0, 0, 0, 0);
          
          /* Si la fecha seleccionada es hoy */
          if (selectedDate.getTime() === today.getTime()) {
            /* Obtener la hora actual */
            const now = new Date();
            /* Filtrar: solo mantener slots que son en el futuro */
            this.slots = this.slots.filter(slot => {
              /* Separar HH:MM */
              const [hours, minutes] = slot.time.split(':').map(Number);
              /* Crear un objeto Date con esa hora para hoy */
              const slotTime = new Date();
              slotTime.setHours(hours, minutes, 0, 0);
              
              /* Mantener solo si la hora del slot es mayor que la hora actual */
              return slotTime > now;
            });
          }
          
          /* Si había un slot seleccionado pero ya no está disponible, limpiarlo */
          if (this.selectedSlot && !this.slots.find(s => s.time === this.selectedSlot && s.available)) {
            this.selectedSlot = null;
          }
        } else {
          /* Si la respuesta no es exitosa, mostrar error del servidor */
          this.showError(res.message || 'Error obteniendo disponibilidad');
        }
      },
      /* Si hay error de conexión */
      error: (err) => {
        this.showError('Error conectando al servidor');
        console.error(err);
      }
    });
  }


  /* MÉTODO: selectSlot
     =================
     Se ejecuta cuando el usuario hace click en un horario disponible
     Parámetros:
     - time: la hora seleccionada (ej: "09:00")
     - available: si el horario está disponible (true) o ocupado (false) */
  selectSlot(time: string, available: boolean): void {
    /* Si el horario no está disponible, no hacer nada */
    if (!available) return;
    
    /* VALIDACIÓN: Si es hoy, verificar que la hora no haya pasado */
    if (this.fecha) {
      /* Fecha que seleccionó el usuario */
      const selectedDate = new Date(this.fecha);
      /* Fecha de hoy */
      const today = new Date();
      /* Comparar solo fechas (sin horas) */
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      /* Si la fecha seleccionada es hoy */
      if (selectedDate.getTime() === today.getTime()) {
        /* Hora actual del sistema */
        const now = new Date();
        /* Separar HH:MM del slot */
        const [hours, minutes] = time.split(':').map(Number);
        /* Crear un objeto Date con esa hora para hoy */
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        
        /* Si la hora del slot ya pasó, mostrar error */
        if (slotTime <= now) {
          this.showError('No puedes seleccionar una hora que ya pasó');
          return;
        }
      }
    }
    
    /* Guardar el slot seleccionado */
    this.selectedSlot = time;
    /* Mantener la propiedad 'hora' sincronizada para compatibilidad */
    this.hora = time;
  }

  /* MÉTODO: showError
     ================
     Muestra un mensaje de error (fondo rojo)
     Parámetro: msg = el mensaje a mostrar */
  showError(msg: string) {
    /* Guardar el mensaje */
    this.message = msg;
    /* Cambiar el tipo a 'error' (fondo rojo) */
    this.messageType = 'error';
  }

  /* MÉTODO: showSuccess
     ===================
     Muestra un mensaje de éxito (fondo verde)
     Parámetro: msg = el mensaje a mostrar */
  showSuccess(msg: string) {
    /* Guardar el mensaje */
    this.message = msg;
    /* Cambiar el tipo a 'success' (fondo verde) */
    this.messageType = 'success';
  }


  /* MÉTODO: submit
     ==============
     Se ejecuta cuando el usuario hace click en "Agendar cita"
     Valida los datos, verifica disponibilidad y envía la cita al servidor */
  submit(): void {
    /* Limpiar cualquier mensaje anterior */
    this.message = '';

    /* PASO 1: VERIFICAR QUE EL USUARIO ESTÉ LOGUEADO */
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      /* Si no hay usuario, mostrar error */
      this.showError('Debes iniciar sesión para solicitar una cita');
      return;
    }

    /* Obtener los datos del usuario del localStorage y convertir de JSON */
    const user = JSON.parse(currentUser);
    /* Verificar que el usuario sea cliente (no admin o vendedor) */
    if (user.rol !== 'cliente') {
      this.showError('Solo clientes pueden solicitar citas');
      return;
    }

    /* PASO 2: VALIDAR QUE LA FECHA Y HORA ESTÉN SELECCIONADAS */
    if (!this.fecha || !this.selectedSlot) {
      this.showError('Selecciona fecha y un horario disponible');
      return;
    }

    /* PASO 3: VALIDAR QUE EL HORARIO SIGA DISPONIBLE
       Hacer una petición final para verificar que nadie más agendera ese horario
       mientras el usuario rellenaba el formulario */
    this.loading = true;
    /* Hacer petición GET para verificar disponibilidad */
    this.http.get('http://localhost:3001/api/citas/availability', { 
      params: { 
        date: this.fecha, 
        idVehiculo: this.selectedVehicleId || '' 
      } 
    }).subscribe({
      /* Si la validación es exitosa */
      next: (res: any) => {
        this.loading = false;
        if (res && res.success) {
          /* Buscar el slot que seleccionó en los horarios disponibles */
          const slot = (res.slots || []).find((s: any) => s.time === this.selectedSlot);
          /* Verificar que el slot exista y esté disponible */
          if (!slot || !slot.available) {
            /* Si ya no está disponible, mostrar error */
            this.showError('El horario seleccionado ya no está disponible. Elige otro.');
            return;
          }

          /* PASO 4: CREAR EL OBJETO CON LOS DATOS DE LA CITA */
          const payload = {
            dni: user.dni,                    /* DNI del usuario (obtenido del localStorage) */
            idVehiculo: this.selectedVehicleId || null, /* ID del vehículo (puede ser null) */
            fecha: this.fecha,                /* Fecha en formato YYYY-MM-DD */
            hora: this.selectedSlot,          /* Hora en formato HH:MM */
            motivo: this.motivo               /* Motivo de la cita (ej: consulta) */
          };

          /* PASO 5: ENVIAR LA CITA AL SERVIDOR */
          this.loading = true;
          /* Hacer petición POST a http://localhost:3001/api/citas */
          this.http.post('http://localhost:3001/api/citas', payload).subscribe({
            /* Si la cita se agendó correctamente */
            next: (postRes: any) => {
              this.loading = false;
              if (postRes && postRes.success) {
                /* Mostrar mensaje de éxito */
                this.showSuccess('Cita agendada correctamente');
                /* Limpiar el formulario */
                this.fecha = '';
                this.selectedSlot = null;
                this.hora = '';
                this.slots = [];
              } else {
                /* Si hay error del servidor, mostrar mensaje */
                this.showError(postRes.message || 'Error agendando cita');
              }
            },
            /* Si hay error de conexión o servidor */
            error: (err) => {
              this.loading = false;
              /* Mostrar el mensaje de error del servidor si existe */
              this.showError(err.error?.message || 'Error del servidor al agendar cita');
            }
          });

        } else {
          /* Si la validación de disponibilidad falla */
          this.loading = false;
          this.showError(res.message || 'Error al validar disponibilidad');
        }
      },
      /* Si hay error de conexión al validar */
      error: (err) => {
        this.loading = false;
        this.showError('Error validando disponibilidad');
      }
    });
  }
}
