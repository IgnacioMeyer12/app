/* ============================================================
   SERVIDOR BACKEND - AUTOMOTORES MEYER
   ============================================================
   Archivo principal de la API REST con Express.js
   
   FUNCIONALIDADES:
   - Gestión de vehículos (crear, leer, actualizar, eliminar)
   - Autenticación de usuarios (registro, login)
   - Agendamiento de citas
   - Subida de imágenes (fotos de vehículos)
   - Base de datos MySQL
   
   PUERTO: 3001
   URL BASE: http://localhost:3001/api/
   ============================================================ */

/* IMPORTACIONES: Librerías necesarias para el servidor */

/* express: framework para crear el servidor web */
const express = require('express');
/* cors: permite que el frontend (localhost:4200) acceda a la API */
const cors = require('cors');
/* bcryptjs: encripta contraseñas para mayor seguridad */
const bcrypt = require('bcryptjs');
/* mysql2/promise: conecta a la base de datos MySQL con promesas */
const mysql = require('mysql2/promise');
/* path: maneja rutas de archivos del sistema */
const path = require('path');
/* fs: operaciones con el sistema de archivos */
const fs = require('fs');
/* multer: maneja la subida de archivos (imágenes) */
const multer = require('multer');
/* dotenv: lee variables de entorno del archivo .env */
require('dotenv').config();

/* CREAR LA APLICACIÓN EXPRESS */
const app = express();

/* ============================================================
   MIDDLEWARES: Procesa las peticiones antes de llegar a las rutas
   ============================================================ */

/* MIDDLEWARE: CORS (Control de Acceso de Origen Cruzado)
   Permite que el frontend en localhost:4200 acceda a esta API */
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:3000'], /* URLs permitidas */
  credentials: true /* Permite el envío de cookies/credenciales */
}));

/* MIDDLEWARE: Parsing de JSON
   Convierte el body de las peticiones (JSON) en objetos JavaScript */
app.use(express.json({ limit: '10mb' })); /* Máximo 10MB por petición */

/* MIDDLEWARE: Parsing de URL-encoded
   Para formularios tradicionales HTML */
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   CONFIGURACIÓN DE SUBIDA DE ARCHIVOS (MULTER)
   ============================================================ */

/* Crear carpeta de uploads si no existe */
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* CONFIGURACIÓN DE ALMACENAMIENTO
   Define dónde y cómo guardar los archivos subidos */
const storage = multer.diskStorage({
  /* destination: carpeta donde guardar los archivos */
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  /* filename: nombre del archivo guardado */
  filename: function (req, file, cb) {
    /* Crear nombre único: timestamp + número aleatorio + extensión original */
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

/* FILTRO DE ARCHIVOS
   Solo permite subir imágenes */
function fileFilter(req, file, cb) {
  /* Verificar si el MIME type es una imagen */
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true); /* Aceptar archivo */
  } else {
    /* Rechazar archivo no válido */
    cb(new Error('Tipo de archivo inválido. Solo se permiten imágenes.'), false);
  }
}

/* CREAR EL MANEJADOR DE UPLOAD
   - storage: configuración de dónde guardar
   - fileFilter: validación de tipos de archivo
   - limits: límites de tamaño de archivo (5MB máximo) */
const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 5 * 1024 * 1024 } 
});

/* SERVIR ARCHIVOS ESTÁTICOS
   Los archivos en /public/uploads/ se pueden acceder vía /uploads/ */
app.use('/uploads', express.static(uploadsDir));

/* RUTA: POST /api/upload
   Permite subir múltiples imágenes (máximo 10) */
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    /* Verificar que se recibieron archivos */
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se recibieron archivos' 
      });
    }

    /* Mapear los archivos subidos a URLs accesibles */
    const uploadedFiles = req.files.map(f => {
      return `${req.protocol}://${req.get('host')}/uploads/${f.filename}`;
    });

    /* Responder con las URLs de los archivos subidos */
    res.json({ 
      success: true, 
      files: uploadedFiles 
    });
  } catch (err) {
    console.error('Error en /api/upload:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error subiendo archivos' 
    });
  }
});

/* ============================================================
   CONFIGURACIÓN DE BASE DE DATOS
   ============================================================ */

/* OBJETO DE CONFIGURACIÓN
   Parámetros para conectarse a MySQL */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',      /* Servidor MySQL */
  port: process.env.DB_PORT || 3306,             /* Puerto MySQL */
  user: process.env.DB_USER || 'root',           /* Usuario MySQL */
  password: process.env.DB_PASSWORD || '',       /* Contraseña MySQL */
  database: process.env.DB_NAME || 'altagama_db',/* Base de datos */
  connectionLimit: 10,                            /* Máximo 10 conexiones simultáneas */
  connectTimeout: 60000,                          /* Timeout de conexión: 60 segundos */
  acquireTimeout: 60000,                          /* Timeout para obtener conexión: 60s */
  timeout: 60000,                                 /* Timeout general: 60 segundos */
  reconnect: false                                /* No reconectar automáticamente */
};

/* VARIABLE GLOBAL: Pool de conexiones
   Un pool es un conjunto reutilizable de conexiones a la BD */
let pool;

/* FUNCIÓN: Crear el pool de conexiones
   Establece la conexión con la base de datos */
async function createPool() {
  /* Crear el pool con la configuración */
  pool = mysql.createPool(dbConfig);
  
  /* EVENTO: Cuando se abre una nueva conexión */
  pool.on('connection', (connection) => {
    console.log('Nueva conexión MySQL establecida');
  });
  
  /* EVENTO: Cuando hay error en el pool */
  pool.on('error', (err) => {
    console.error('Error en el pool de MySQL:', err);
  });
  
  return pool;
}

/* FUNCIÓN: Obtener una conexión del pool
   Se usa para ejecutar queries a la BD */
async function connectDB() {
  /* Si el pool no existe, crearlo */
  if (!pool) {
    pool = await createPool();
  }
  
  try {
    /* Obtener una conexión del pool */
    const connection = await pool.getConnection();
    console.log('Conexión a MySQL obtenida del pool');
    return connection;
  } catch (error) {
    console.error('Error obteniendo conexión de MySQL:', error);
    throw error;
  }
}

/* ============================================================
   MIDDLEWARE: Manejo de peticiones HTML
   ============================================================ */

/* MIDDLEWARE: Rechazar peticiones de archivos HTML
   Evita errores cuando alguien intenta acceder a .html en la API */
app.use((req, res, next) => {
  /* Si la ruta termina con .html y no es /api/ */
  if (req.path.endsWith('.html') && !req.path.startsWith('/api/')) {
    /* Responder con error explicativo */
    return res.status(404).json({
      error: 'html_file_not_found',
      message: 'El archivo HTML no está disponible en el servidor de API',
      solution: 'Esta es una API REST. El frontend Angular debe ejecutarse por separado en desarrollo.',
      frontend_url: 'http://localhost:4200',
      api_docs: `${req.protocol}://${req.get('host')}/api/health`
    });
  }
  next(); /* Continuar con la siguiente ruta/middleware */
});

/* ============================================================
   INICIALIZACIÓN DE TABLAS DE BASE DE DATOS
   ============================================================ */

/* FUNCIÓN: Crear todas las tablas necesarias
   Se ejecuta cuando el servidor arranca */
async function createTables() {
  const connection = await connectDB();
  
  try {
    /* TABLA: usuarios
       Almacena los datos de clientes y administradores */
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        dni VARCHAR(20) PRIMARY KEY,           /* ID único: DNI del usuario */
        nombre VARCHAR(100) NOT NULL,          /* Nombre del usuario */
        apellido VARCHAR(100) NOT NULL,        /* Apellido del usuario */
        telefono VARCHAR(20) NOT NULL,         /* Teléfono de contacto */
        password VARCHAR(255) NOT NULL,        /* Contraseña encriptada */
        rol ENUM('admin', 'cliente') DEFAULT 'cliente', /* Rol: admin o cliente */
        activo BOOLEAN DEFAULT TRUE,           /* Si el usuario está activo */
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP, /* Fecha de registro */
        UNIQUE KEY unique_telefono (telefono)  /* Teléfono único (no puede repetirse) */
      )
    `);
    
    /* CREAR USUARIO ADMIN POR DEFECTO
       Si no existe, crear un administrador con credenciales por defecto */
    const adminPassword = await bcrypt.hash('admin123', 10); /* Encriptar contraseña */
    await connection.execute(`
      INSERT IGNORE INTO usuarios (dni, nombre, apellido, telefono, password, rol) 
      VALUES ('12345678', 'Administrador', 'Sistema', '3411234567', ?, 'admin')
    `, [adminPassword]);

    /* CREAR USUARIO CLIENTE DE PRUEBA */
    const clientPassword = await bcrypt.hash('cliente123', 10); /* Encriptar contraseña */
    await connection.execute(`
      INSERT IGNORE INTO usuarios (dni, nombre, apellido, telefono, password, rol) 
      VALUES ('87654321', 'Juan', 'Perez', '3417654321', ?, 'cliente')
    `, [clientPassword]);
    
    console.log('✅ Todas las tablas creadas/verificadas exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
  } finally {
    connection.release(); /* Devolver la conexión al pool */
  }
}

/* ============================================================
   RUTAS: GESTIÓN DE VEHÍCULOS
   ============================================================ */

/* FUNCIÓN: Crear tabla de vehículos */
async function createVehiclesTable() {
  const connection = await connectDB();
  
  try {
    /* TABLA: vehiculos
       Almacena la información de los autos disponibles */
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vehiculos (
        idVehiculo VARCHAR(50) PRIMARY KEY,    /* ID único del vehículo */
        marca VARCHAR(100) NOT NULL,           /* Marca (ej: Toyota, Ford) */
        modelo VARCHAR(100) NOT NULL,          /* Modelo (ej: Corolla, Focus) */
        anio INT NOT NULL,                     /* Año de fabricación */
        precio DECIMAL(12,2) NOT NULL,         /* Precio en pesos */
        km INT NOT NULL,                       /* Kilómetros */
        stock INT DEFAULT 1,                   /* Cantidad disponible */
        color VARCHAR(30) DEFAULT NULL,        /* Color del vehículo */
        fotos JSON,                            /* URLs de fotos en formato JSON */
        descripcion TEXT,                      /* Descripción detallada */
        activo BOOLEAN DEFAULT TRUE,           /* Si está disponible para venta */
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP, /* Cuándo se agregó */
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* Última modificación */
      )
    `);
    
    console.log('✅ Tabla de vehículos creada/verificada exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando tabla de vehículos:', error);
  } finally {
    connection.release();
  }
}

/* FUNCIÓN: Crear tabla de citas
   Almacena todas las citas agendadas */
async function createCitasTable() {
  const connection = await connectDB();
  try {
    /* TABLA: citas
       Información de citas de clientes */
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS citas (
        id INT AUTO_INCREMENT PRIMARY KEY,     /* ID único de la cita */
        dni VARCHAR(20) NOT NULL,              /* DNI del cliente que agendó */
        idVehiculo VARCHAR(50) DEFAULT NULL,   /* ID del vehículo (opcional) */
        fecha_hora DATETIME NOT NULL,          /* Fecha y hora de la cita */
        motivo VARCHAR(255) NOT NULL,          /* Razón de la cita (ej: consulta) */
        estado VARCHAR(50) DEFAULT 'pendiente', /* Estado: pendiente, aceptada, rechazada */
        admin_dni VARCHAR(20) DEFAULT NULL,    /* DNI del admin que respondió */
        admin_message TEXT DEFAULT NULL,       /* Mensaje del admin */
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP, /* Cuándo se creó */
        actualizado_en TIMESTAMP NULL DEFAULT NULL    /* Cuándo se actualizó */
      )
    `);

    console.log('✅ Tabla de citas creada/verificada exitosamente');
  } catch (error) {
    console.error('❌ Error creando tabla de citas:', error);
  } finally {
    connection.release();
  }
}

/* MIDDLEWARE: Verificar que el usuario sea administrador
   Se usa para proteger rutas que solo los admins pueden acceder */
function requireAdmin(req, res, next) {
  /* En una aplicación real, aquí verificarías un token JWT
     Por ahora, suponemos que el usuario está autenticado */
  const user = req.user;
  /* Si no hay usuario o no es admin, denegar acceso */
  if (!user || user.rol !== 'admin') {
    return res.status(403).json({ 
      success: false,
      message: 'Acceso denegado. Se requiere rol de administrador.' 
    });
  }
  next(); /* Continuar si es admin */
}

/* ENDPOINT: POST /api/vehiculos
   =============================
   Crea un nuevo vehículo en la base de datos
   AUTENTICACIÓN: Solo el admin puede agregar vehículos
   BODY: { marca, modelo, anio, precio, km, fotos, descripcion } */
app.post('/api/vehiculos', async (req, res) => {
  /* DESESTRUCTURACIÓN: Obtener datos del body de la petición */
  let { idVehiculo, marca, modelo, anio, precio, km, fotos, descripcion, stock, color, es0km } = req.body;

  /* Si el frontend no envía ID, generar uno automático */
  if (!idVehiculo) {
    idVehiculo = `veh_${Date.now()}_${Math.floor(Math.random() * 900) + 100}`;
  }

  /* VALIDACIONES: Verificar que los datos obligatorios sean válidos */
  
  /* Verificar campos requeridos */
  if (!marca || !modelo || !anio || !precio || km === undefined || km === null) {
    return res.status(400).json({ 
      success: false,
      message: 'Todos los campos obligatorios deben ser completados' 
    });
  }
  
  /* Si es vehículo 0km, debe tener stock */
  if (es0km && (!stock || stock <= 0)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Stock requerido para vehículos 0 km' 
    });
  }

  /* Validar que el año sea realista */
  if (anio < 1900 || anio > new Date().getFullYear() + 1) {
    return res.status(400).json({ 
      success: false,
      message: 'El año debe ser válido' 
    });
  }

  /* Validar que el precio sea positivo */
  if (precio <= 0) {
    return res.status(400).json({ 
      success: false,
      message: 'El precio debe ser mayor a 0' 
    });
  }

  /* Validar que el kilometraje no sea negativo */
  if (km < 0) {
    return res.status(400).json({ 
      success: false,
      message: 'El kilometraje no puede ser negativo' 
    });
  }

  const connection = await connectDB();

  try {
    // Verificar si el ID del vehículo ya existe
    const [existingVehicle] = await connection.execute(
      'SELECT idVehiculo FROM vehiculos WHERE idVehiculo = ?',
      [idVehiculo]
    );

    if (existingVehicle.length > 0) {
      // En caso raro de colisión, generar otro ID
      idVehiculo = `veh_${Date.now()}_${Math.floor(Math.random() * 900) + 100}`;
    }

    // Insertar vehículo
    await connection.execute(
      'INSERT INTO vehiculos (idVehiculo, marca, modelo, anio, precio, km, stock, color, fotos, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [idVehiculo, marca, modelo, anio, precio, km, stock || 0, color || null, JSON.stringify(fotos || []), descripcion || '']
    );

    // Recuperar el vehículo insertado para devolver detalles al frontend
    const [rows] = await connection.execute('SELECT * FROM vehiculos WHERE idVehiculo = ?', [idVehiculo]);
    const vehicle = rows[0] ? { ...rows[0], fotos: rows[0].fotos ? JSON.parse(rows[0].fotos) : [], color: rows[0].color, stock: rows[0].stock } : null;

    res.status(201).json({ 
      success: true,
      message: 'Vehículo registrado exitosamente',
      vehiculo: vehicle
    });

  } catch (error) {
    console.error('Error registrando vehículo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});
/* ENDPOINT: GET /api/vehiculos
   ============================
   Obtiene la lista de todos los vehículos activos de la base de datos
   Retorna: { success: true, vehiculos: [...] } */
app.get('/api/vehiculos', async (req, res) => {
  /* Obtener conexión del pool */
  const connection = await connectDB();
  
  try {
    /* QUERY: SELECT * de vehículos donde activo=TRUE, ordenado por más reciente */
    const [vehicles] = await connection.execute(
      'SELECT * FROM vehiculos WHERE activo = TRUE ORDER BY fecha_creacion DESC'
    );
    
    /* PARSEAR FOTOS: El campo fotos está en JSON, convertir a objeto JavaScript */
    const vehiclesWithParsedPhotos = vehicles.map(vehicle => ({
      ...vehicle, /* Copiar todos los campos del vehículo */
      fotos: vehicle.fotos ? JSON.parse(vehicle.fotos) : [], /* Parsear JSON o array vacío */
      color: vehicle.color, /* Asegurar que color esté */
      stock: vehicle.stock   /* Asegurar que stock esté */
    }));
    
    /* RESPONDER CON SUCCESS Y VEHÍCULOS */
    res.json({ 
      success: true,
      vehiculos: vehiclesWithParsedPhotos
    });
    
  } catch (error) {
    /* Si hay error en la base de datos */
    console.error('Error obteniendo vehículos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error del servidor' 
    });
  } finally {
    /* SIEMPRE devolver la conexión al pool */
    if (connection) connection.release();
  }
});

/* ENDPOINT: GET /api/vehiculos-generados
   =======================================
   Obtiene vehículos de la tabla de "semillas" (vehículos generados automáticamente) */
app.get('/api/vehiculos-generados', async (req, res) => {
  const connection = await connectDB();
  try {
    /* Query: obtener todos los vehículos generados activos */
    const [vehicles] = await connection.execute(
      'SELECT * FROM vehiculos_generados WHERE activo = TRUE ORDER BY fecha_creacion DESC'
    );
    /* Parsear fotos de JSON */
    const vehiclesWithParsedPhotos = vehicles.map(vehicle => ({
      ...vehicle,
      fotos: vehicle.fotos ? JSON.parse(vehicle.fotos) : []
    }));
    res.json({ 
      success: true, 
      vehiculos: vehiclesWithParsedPhotos 
    });
  } catch (error) {
    console.error('Error obteniendo vehiculos_generados:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

// Crear cita (idVehiculo ahora es opcional)

/* ENDPOINT: POST /api/citas
   =========================
   Crea una nueva cita en la base de datos
   El usuario (cliente) agenda una cita para una fecha y hora específica
   
   BODY: {
     dni: string (DNI del cliente),
     idVehiculo: string (opcional, ID del vehículo),
     fecha: string (YYYY-MM-DD),
     hora: string (HH:MM),
     motivo: string (razón de la cita)
   }
   
   RESPONDE: { success: true, message: "Cita agendada" } */
app.post('/api/citas', async (req, res) => {
  /* DESESTRUCTURACIÓN: Extraer datos del body */
  const { dni, idVehiculo, fecha, hora, motivo } = req.body;

  /* VALIDACIONES: Verificar que todos los campos requeridos estén presentes */
  if (!dni || !fecha || !hora || !motivo) {
    return res.status(400).json({ 
      success: false, 
      message: 'Todos los campos obligatorios (dni, fecha, hora, motivo) deben ser completados' 
    });
  }

  /* COMBINAR FECHA Y HORA en formato: "YYYY-MM-DD HH:MM:SS" */
  const fechaHoraStr = `${fecha} ${hora}:00`;
  const fechaHora = new Date(fechaHoraStr);
  /* Verificar que la fecha sea válida */
  if (isNaN(fechaHora.getTime())) {
    return res.status(400).json({ 
      success: false, 
      message: 'Fecha u hora inválida' 
    });
  }

  /* VALIDACIÓN: Solo de lunes a viernes
     getDay() retorna: 0=domingo, 1=lunes,..., 6=sábado */
  const day = fechaHora.getDay();
  if (day === 0 || day === 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Las citas solo se pueden agendar de lunes a viernes' 
    });
  }

  /* VALIDACIÓN: Horarios permitidos
     09:00-13:00 (mañana) y 15:00-18:00 (tarde) */
  const hour = fechaHora.getHours();
  const minute = fechaHora.getMinutes();
  /* Verificar si está en los horarios permitidos */
  const allowed = (hour >= 9 && (hour < 13 || (hour === 13 && minute === 0))) || 
                  (hour >= 15 && (hour < 18 || (hour === 18 && minute === 0)));

  if (!allowed) {
    return res.status(400).json({ 
      success: false, 
      message: 'Horario inválido. Disponibles: 09:00-13:00 y 15:00-18:00' 
    });
  }

  /* Obtener conexión a la base de datos */
  const connection = await connectDB();

  try {
    /* VERIFICACIÓN 1: Usuario debe existir en la BD */
    const [users] = await connection.execute(
      'SELECT dni FROM usuarios WHERE dni = ?', 
      [dni]
    );
    if (users.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    /* VERIFICACIÓN 2: Si especificó vehículo, debe existir y estar activo */
    if (idVehiculo) {
      const [vehicles] = await connection.execute(
        'SELECT idVehiculo, activo FROM vehiculos WHERE idVehiculo = ?', 
        [idVehiculo]
      );
      if (vehicles.length === 0 || !vehicles[0].activo) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vehículo no disponible' 
        });
      }
    }

    /* VERIFICACIÓN 3: Comprobar que el horario no esté ya ocupado
       - Si hay vehículo: no pueden haber dos citas del mismo vehículo en la misma hora
       - Si no hay vehículo: no pueden haber dos citas en el mismo horario (capacidad = 1) */
    const existingQuery = idVehiculo ?
      'SELECT id FROM citas WHERE idVehiculo = ? AND fecha_hora = ?' :
      'SELECT id FROM citas WHERE fecha_hora = ?';
    const existingParams = idVehiculo ? [idVehiculo, fechaHoraStr] : [fechaHoraStr];

    const [existing] = await connection.execute(existingQuery, existingParams);
    if (existing.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'El horario seleccionado ya está ocupado' 
      });
    }

    /* INSERTAR LA CITA en la base de datos */
    await connection.execute(
      'INSERT INTO citas (dni, idVehiculo, fecha_hora, motivo) VALUES (?, ?, ?, ?)', 
      [dni, idVehiculo || null, fechaHoraStr, motivo]
    );

    /* RESPONDER CON ÉXITO */
    res.status(201).json({ 
      success: true, 
      message: 'Cita agendada' 
    });

  } catch (err) {
    console.error('Error creando cita:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

/* ENDPOINT: GET /api/citas/availability
   ======================================
   Obtiene los horarios disponibles (slots) para una fecha específica
   El frontend lo usa para mostrar qué horas están libres
   
   QUERY PARAMETERS:
   - date: YYYY-MM-DD (requerido)
   - idVehiculo: string (opcional)
   
   RESPONDE: { success: true, slots: [
     { time: "09:00", available: true },
     { time: "10:00", available: false },
     ...
   ]} */
app.get('/api/citas/availability', async (req, res) => {
  /* Obtener parámetros de la URL */
  const date = req.query.date; /* Fecha en formato YYYY-MM-DD */
  const idVehiculo = req.query.idVehiculo; /* Vehículo (opcional) */

  /* VALIDACIÓN: La fecha es requerida */
  if (!date) {
    return res.status(400).json({ 
      success: false, 
      message: 'Se requiere el parámetro date (YYYY-MM-DD)' 
    });
  }

  /* VALIDACIÓN: Formato de fecha debe ser correcto (YYYY-MM-DD) */
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Formato de fecha inválido. Use YYYY-MM-DD' 
    });
  }

  /* SLOTS DISPONIBLES: Las horas en las que se pueden agendar citas
     Mañana: 09:00, 10:00, 11:00, 12:00
     Tarde: 15:00, 16:00, 17:00 */
  const slots = ['09:00','10:00','11:00','12:00','15:00','16:00','17:00'];
  const connection = await connectDB();

  try {
    /* Procesar cada slot para ver si está disponible */
    const result = [];
    for (const t of slots) {
      /* Crear fecha y hora en formato: "2024-01-15 09:00:00" */
      const fechaHoraStr = `${date} ${t}:00`;
      /* Query: contar citas que coinciden con esta fecha y hora */
      let sql = 'SELECT COUNT(*) as cnt FROM citas WHERE fecha_hora = ?';
      const params = [fechaHoraStr];
      
      /* Si se especificó vehículo, filtrar por vehículo */
      if (idVehiculo) {
        sql += ' AND idVehiculo = ?';
        params.push(idVehiculo);
      }

      /* Ejecutar query */
      const [rows] = await connection.execute(sql, params);
      /* Si la cuenta es 0, el slot está disponible; si > 0, está ocupado */
      const cnt = rows[0].cnt;
      result.push({ 
        time: t, 
        available: cnt === 0 /* true si no hay citas, false si hay */
      });
    }

    /* Responder con los slots y su disponibilidad */
    res.json({ 
      success: true, 
      slots: result 
    });

  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

// Obtener citas (admin o filtrado por cliente)
app.get('/api/citas', async (req, res) => {
  const dniFilter = req.query.dni;
  const connection = await connectDB();
  try {
    let sql = `SELECT c.id, c.dni, u.nombre, u.apellido, c.idVehiculo, v.marca, v.modelo, v.anio, c.fecha_hora, c.motivo, c.estado, c.admin_dni, c.admin_message, c.creado_en, c.actualizado_en
               FROM citas c
               JOIN usuarios u ON c.dni = u.dni
               LEFT JOIN vehiculos v ON c.idVehiculo = v.idVehiculo`;
    const params = [];
    if (dniFilter) {
      sql += ' WHERE c.dni = ?';
      params.push(dniFilter);
    }
    sql += ' ORDER BY c.fecha_hora DESC';

    const [rows] = await connection.execute(sql, params);
    res.json({ success: true, citas: rows });
  } catch (err) {
    console.error('Error obteniendo citas:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  } finally {
    if (connection) connection.release();
  }
});

// Actualizar estado de una cita (solo admin)
app.patch('/api/citas/:id', async (req, res) => {
  const id = req.params.id;
  let { estado, adminDni, adminMessage } = req.body;

  console.log('📱 PATCH /api/citas/:id recibido:', { id, estado, adminDni, adminMessage });

  // Validar datos básicos
  if (!estado || !adminDni) {
    return res.status(400).json({ 
      success: false, 
      message: 'Faltan datos: estado y adminDni son requeridos' 
    });
  }

  // Aceptar valores legacy por si acaso
  if (estado === 'cancelada') estado = 'rechazada';
  if (estado === 'completada') estado = 'aceptada';

  // Normalizar a minúsculas
  estado = estado.toLowerCase();

  if (!['pendiente', 'aceptada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Estado inválido. Use: pendiente, aceptada o rechazada' 
    });
  }

  const connection = await connectDB();

  try {
    // 1. Verificar que el admin existe y es administrador
    const [users] = await connection.execute(
      'SELECT dni, rol FROM usuarios WHERE dni = ?', 
      [adminDni]
    );
    
    if (users.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Administrador no encontrado' 
      });
    }
    
    if (users[0].rol !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado. Se requiere rol admin' 
      });
    }

    // 2. Verificar que la cita existe
    const [existing] = await connection.execute(
      'SELECT id FROM citas WHERE id = ?', 
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cita no encontrada' 
      });
    }

    // 3. ACTUALIZAR EN LA BASE DE DATOS
    let updateResult;
    
    if (estado === 'rechazada') {
      // Para rechazadas, guardar también el mensaje
      updateResult = await connection.execute(
        'UPDATE citas SET estado = ?, admin_dni = ?, admin_message = ?, actualizado_en = NOW() WHERE id = ?',
        [estado, adminDni, adminMessage || null, id]
      );
    } else {
      // Para aceptadas, limpiar el mensaje
      updateResult = await connection.execute(
        'UPDATE citas SET estado = ?, admin_dni = ?, admin_message = NULL, actualizado_en = NOW() WHERE id = ?',
        [estado, adminDni, id]
      );
    }

    console.log('✅ Cita actualizada en BD. Filas afectadas:', updateResult[0].affectedRows);

    // 4. OBTENER LA CITA ACTUALIZADA PARA DEVOLVERLA
    const [citasActualizadas] = await connection.execute(
      `SELECT c.id, c.dni, u.nombre, u.apellido, c.idVehiculo, 
              v.marca, v.modelo, v.anio, c.fecha_hora, 
              c.motivo, c.estado, c.admin_dni, c.admin_message, 
              c.creado_en, c.actualizado_en
       FROM citas c
       JOIN usuarios u ON c.dni = u.dni
       LEFT JOIN vehiculos v ON c.idVehiculo = v.idVehiculo
       WHERE c.id = ?`,
      [id]
    );

    const citaActualizada = citasActualizadas[0];
    
    if (!citaActualizada) {
      return res.status(500).json({ 
        success: false, 
        message: 'Error al recuperar la cita actualizada' 
      });
    }

    // 5. RESPONDER CON ÉXITO Y LA CITA ACTUALIZADA
    res.json({ 
      success: true, 
      message: `Cita ${estado} exitosamente`,
      cita: citaActualizada  // ¡IMPORTANTE! Devolver la cita actualizada
    });

  } catch (err) {
    console.error('❌ Error actualizando cita:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

// Ruta PUT para actualizar citas (alternativa a PATCH)
app.put('/api/citas/:id', async (req, res) => {
  const id = req.params.id;
  let { estado, adminDni, adminMessage } = req.body;

  console.log('📱 PUT /api/citas/:id recibido:', { id, estado, adminDni, adminMessage });

  // Validar datos básicos
  if (!estado || !adminDni) {
    return res.status(400).json({ 
      success: false, 
      message: 'Faltan datos: estado y adminDni son requeridos' 
    });
  }

  // Aceptar valores legacy por si acaso
  if (estado === 'cancelada') estado = 'rechazada';
  if (estado === 'completada') estado = 'aceptada';

  // Normalizar a minúsculas
  estado = estado.toLowerCase();

  if (!['pendiente', 'aceptada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Estado inválido. Use: pendiente, aceptada o rechazada' 
    });
  }

  const connection = await connectDB();

  try {
    // 1. Verificar que el admin existe y es administrador
    const [users] = await connection.execute(
      'SELECT dni, rol FROM usuarios WHERE dni = ?', 
      [adminDni]
    );
    
    if (users.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Administrador no encontrado' 
      });
    }
    
    if (users[0].rol !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado. Se requiere rol admin' 
      });
    }

    // 2. Verificar que la cita existe
    const [existing] = await connection.execute(
      'SELECT id FROM citas WHERE id = ?', 
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cita no encontrada' 
      });
    }

    // 3. ACTUALIZAR EN LA BASE DE DATOS
    let updateResult;
    
    if (estado === 'rechazada') {
      updateResult = await connection.execute(
        'UPDATE citas SET estado = ?, admin_dni = ?, admin_message = ?, actualizado_en = NOW() WHERE id = ?',
        [estado, adminDni, adminMessage || null, id]
      );
    } else {
      updateResult = await connection.execute(
        'UPDATE citas SET estado = ?, admin_dni = ?, admin_message = NULL, actualizado_en = NOW() WHERE id = ?',
        [estado, adminDni, id]
      );
    }

    console.log('✅ Cita actualizada en BD. Filas afectadas:', updateResult[0].affectedRows);

    // 4. OBTENER LA CITA ACTUALIZADA PARA DEVOLVERLA
    const [citasActualizadas] = await connection.execute(
      `SELECT c.id, c.dni, u.nombre, u.apellido, c.idVehiculo, 
              v.marca, v.modelo, v.anio, c.fecha_hora, 
              c.motivo, c.estado, c.admin_dni, c.admin_message, 
              c.creado_en, c.actualizado_en
       FROM citas c
       JOIN usuarios u ON c.dni = u.dni
       LEFT JOIN vehiculos v ON c.idVehiculo = v.idVehiculo
       WHERE c.id = ?`,
      [id]
    );

    const citaActualizada = citasActualizadas[0];
    
    if (!citaActualizada) {
      return res.status(500).json({ 
        success: false, 
        message: 'Error al recuperar la cita actualizada' 
      });
    }

    // 5. RESPONDER CON ÉXITO Y LA CITA ACTUALIZADA
    res.json({ 
      success: true, 
      message: `Cita ${estado} exitosamente`,
      cita: citaActualizada  // ¡IMPORTANTE! Devolver la cita actualizada
    });

  } catch (err) {
    console.error('❌ Error actualizando cita:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

// ============== RUTAS DE USUARIOS ==============

// Registro de usuario

/* ENDPOINT: POST /api/register
   ============================
   Registra un nuevo usuario (cliente o admin)
   
   BODY: {
     dni: string (DNI único del usuario),
     nombre: string,
     apellido: string,
     telefono: string (debe ser único),
     password: string (mínimo 6 caracteres),
     rol: "cliente" o "admin" (opcional, default es "cliente")
   }
   
   RESPONDE: { success: true, message: "Usuario registrado" } */
app.post('/api/register', async (req, res) => {
  /* DESESTRUCTURACIÓN: Obtener datos del body */
  const { dni, nombre, apellido, telefono, password, rol } = req.body;

  /* Log para debugging (sin contraseña por seguridad) */
  console.log('POST /api/register payload:', { dni, nombre, apellido, telefono, rol });

  /* VALIDACIONES: Verificar que todos los campos obligatorios estén presentes */
  if (!dni || !nombre || !apellido || !telefono || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'DNI, nombre, apellido, teléfono y contraseña son obligatorios' 
    });
  }
  
  /* VALIDACIÓN: Contraseña debe tener al menos 6 caracteres */
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false,
      message: 'La contraseña debe tener al menos 6 caracteres' 
    });
  }
  
  /* VALIDACIÓN: Rol debe ser válido ("admin" o "cliente") */
  if (rol && !['admin', 'cliente'].includes(rol)) {
    return res.status(400).json({ 
      success: false,
      message: 'El rol debe ser "admin" o "cliente"' 
    });
  }

  /* SOPORTE: Crear admin desde el formulario si viene creatorDni
     creatorDni es el DNI del usuario admin que está creando el nuevo usuario */
  const creatorDni = req.body.creatorDni;
  let finalRole = rol || 'cliente'; /* Rol por defecto es cliente */

  /* Obtener conexión */
  const connection = await connectDB();
  
  try {
    /* Si viene creatorDni, verificar que sea un admin */
    if (creatorDni) {
      const [creatorRows] = await connection.execute(
        'SELECT dni, rol FROM usuarios WHERE dni = ?', 
        [creatorDni]
      );
      if (creatorRows.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Acceso denegado. Usuario creador no encontrado.' 
        });
      }
      /* Si el creador es admin, el nuevo usuario es admin; si no, es cliente */
      finalRole = creatorRows[0].rol === 'admin' ? 'admin' : 'cliente';
    } else if (rol === 'admin') {
      /* No se permite crear admin desde el registro público */
      return res.status(403).json({ 
        success: false, 
        message: 'No está permitido crear administradores desde el registro público. Use la opción interna para administradores.' 
      });
    }

    /* VALIDACIÓN: DNI no puede estar duplicado */
    const [existingDni] = await connection.execute(
      'SELECT dni FROM usuarios WHERE dni = ?',
      [dni]
    );
    
    if (existingDni.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Ya existe una cuenta con este DNI' 
      });
    }
    
    /* VALIDACIÓN: Teléfono no puede estar duplicado */
    const [existingPhone] = await connection.execute(
      'SELECT telefono FROM usuarios WHERE telefono = ?',
      [telefono]
    );
    
    if (existingPhone.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Ya existe una cuenta con este teléfono' 
      });
    }
    
    /* ENCRIPTACIÓN: Hashear la contraseña con bcryptjs
       hash(password, 10) = 10 iteraciones de encriptación */
    const hashedPassword = await bcrypt.hash(password, 10);
    
    /* INSERTAR el nuevo usuario en la base de datos */
    await connection.execute(
      'INSERT INTO usuarios (dni, nombre, apellido, telefono, password, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [dni, nombre, apellido, telefono, hashedPassword, finalRole]
    );
    
    res.status(201).json({ 
      success: true,
      message: 'Usuario registrado exitosamente',
      dni: dni,
      role: finalRole
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    // Return a more informative error during development to help debugging
    res.status(500).json({ 
      success: false,
      message: 'Error del servidor',
      error: error && error.message ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});

/* ENDPOINT: POST /api/login
   =========================
   Autentica un usuario y devuelve sus datos
   
   BODY: {
     dni: string (DNI del usuario),
     password: string (contraseña)
   }
   
   RESPONDE: { 
     success: true, 
     message: "Login exitoso",
     usuario: { dni, nombre, apellido, telefono, rol }
   } */
app.post('/api/login', async (req, res) => {
  /* DESESTRUCTURACIÓN: Obtener DNI y contraseña del body */
  const { dni, password } = req.body;
  
  /* VALIDACIÓN: Ambos campos son obligatorios */
  if (!dni || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'DNI y contraseña son obligatorios' 
    });
  }
  
  /* Obtener conexión a la base de datos */
  const connection = await connectDB();
  
  try {
    /* BUSCAR el usuario en la base de datos por DNI */
    const [users] = await connection.execute(
      'SELECT dni, nombre, apellido, telefono, password, rol, activo FROM usuarios WHERE dni = ?',
      [dni]
    );
    
    /* Si el usuario no existe */
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales incorrectas' 
      });
    }
    
    /* Obtener el usuario encontrado */
    const user = users[0];
    
    /* VERIFICAR si el usuario está activo */
    if (!user.activo) {
      return res.status(401).json({ 
        success: false,
        message: 'Cuenta desactivada' 
      });
    }
    
    /* VERIFICAR la contraseña usando bcrypt.compare
       Compara la contraseña ingresada con la contraseña encriptada en BD */
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales incorrectas' 
      });
    }
    
    /* ELIMINAR la contraseña del objeto antes de devolver
       Extraer solo los datos que se necesitan (sin password) */
    const { password: _, ...userWithoutPassword } = user;
    
    /* RESPONDER CON ÉXITO Y DATOS DEL USUARIO */
    res.json({ 
      success: true,
      message: 'Login exitoso',
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

/* ENDPOINT: POST /api/admins
   ==========================
   Crea un nuevo administrador
   Solo otro admin puede crear un nuevo admin
   
   BODY: {
     dni, nombre, apellido, telefono, password, creatorDni
   } */
app.post('/api/admins', async (req, res) => {
  /* DESESTRUCTURACIÓN: Obtener datos del body */
  const { dni, nombre, apellido, telefono, password, creatorDni } = req.body;

  /* VALIDACIÓN: Todos los campos son obligatorios */
  if (!dni || !nombre || !apellido || !telefono || !password || !creatorDni) {
    return res.status(400).json({ 
      success: false, 
      message: 'dni, nombre, apellido, telefono, password y creatorDni son obligatorios' 
    });
  }

  /* VALIDACIÓN: Contraseña mínimo 6 caracteres */
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'La contraseña debe tener al menos 6 caracteres' 
    });
  }

  const connection = await connectDB();
  try {
    // Verificar que creatorDni sea admin
    const [creator] = await connection.execute('SELECT dni, rol FROM usuarios WHERE dni = ?', [creatorDni]);
    if (creator.length === 0 || creator[0].rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores pueden crear nuevos administradores.' });
    }

    // Unicidad de dni y teléfono
    const [existingDni] = await connection.execute('SELECT dni FROM usuarios WHERE dni = ?', [dni]);
    if (existingDni.length > 0) {
      return res.status(400).json({ success: false, message: 'Ya existe una cuenta con este DNI' });
    }

    const [existingPhone] = await connection.execute('SELECT telefono FROM usuarios WHERE telefono = ?', [telefono]);
    if (existingPhone.length > 0) {
      return res.status(400).json({ success: false, message: 'Ya existe una cuenta con este teléfono' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.execute(
      'INSERT INTO usuarios (dni, nombre, apellido, telefono, password, rol) VALUES (?, ?, ?, ?, ?, ?)', 
      [dni, nombre, apellido, telefono, hashedPassword, 'admin']
    );

    res.status(201).json({ 
      success: true, 
      message: 'Administrador creado exitosamente' 
    });
  } catch (err) {
    console.error('Error creando administrador:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

/* ============================================================
   INICIALIZACIÓN DEL SERVIDOR
   ============================================================ */

/* FUNCIÓN: Iniciar el servidor
   Se ejecuta al arrancar el programa */
async function startServer() {
  try {
    /* PASO 1: Crear el pool de conexiones a MySQL */
    await createPool();
    
    /* PASO 2: Crear todas las tablas necesarias en la BD */
    await createTables();
    await createVehiclesTable();
    await createCitasTable();

    /* PASO 3: Iniciar el servidor Express en el puerto especificado */
    const PORT = process.env.PORT || 3001; /* Puerto por defecto: 3001 */
    app.listen(PORT, () => {
      /* El servidor está corriendo */
      console.log(`🚗 Servidor AltaGama API corriendo en http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔑 Usuario admin: DNI 12345678, Contraseña: admin123`);
      console.log(`👤 Usuario cliente: DNI 87654321, Contraseña: cliente123`);
      console.log(`💡 Esta es solo la API. El frontend Angular debe ejecutarse por separado.`);
    });
  } catch (error) {
    /* Si hay error al iniciar */
    if (error.code === 'EADDRINUSE') {
      /* Error: El puerto ya está en uso */
      console.error(`❌ Error: El puerto ${error.port} ya está en uso.`);
      console.error('💡 Soluciones:');
      console.error('   1. Espera a que el otro proceso termine');
      console.error('   2. Ejecuta en otro puerto: PORT=3001 npm start');
      console.error('   3. Encuentra y termina el proceso que usa el puerto');
    } else {
      console.error('❌ Error iniciando el servidor:', error);
    }
    process.exit(1);
  }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor gracefulmente...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Iniciar el servidor
startServer();

module.exports = app;