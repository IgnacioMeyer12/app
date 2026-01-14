const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuración para subida de archivos
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo inválido. Solo se permiten imágenes.'), false);
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Servir archivos estáticos subidos
app.use('/uploads', express.static(uploadsDir));

// Ruta para subir archivos
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No se recibieron archivos' });
    }

    const uploadedFiles = req.files.map(f => {
      return `${req.protocol}://${req.get('host')}/uploads/${f.filename}`;
    });

    res.json({ success: true, files: uploadedFiles });
  } catch (err) {
    console.error('Error en /api/upload:', err);
    res.status(500).json({ success: false, message: 'Error subiendo archivos' });
  }
});

// Configuración de base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'altagama_db',
  connectionLimit: 10,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: false
};

// Pool de conexiones
let pool;

async function createPool() {
  pool = mysql.createPool(dbConfig);
  
  pool.on('connection', (connection) => {
    console.log('Nueva conexión MySQL establecida');
  });
  
  pool.on('error', (err) => {
    console.error('Error en el pool de MySQL:', err);
  });
  
  return pool;
}

// Función para conectar a la base de datos
async function connectDB() {
  if (!pool) {
    pool = await createPool();
  }
  
  try {
    const connection = await pool.getConnection();
    console.log('Conexión a MySQL obtenida del pool');
    return connection;
  } catch (error) {
    console.error('Error obteniendo conexión de MySQL:', error);
    throw error;
  }
}

// Middleware para manejar solicitudes HTML
app.use((req, res, next) => {
  if (req.path.endsWith('.html') && !req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'html_file_not_found',
      message: 'El archivo HTML no está disponible en el servidor de API',
      solution: 'Esta es una API REST. El frontend Angular debe ejecutarse por separado en desarrollo.',
      frontend_url: 'http://localhost:4200',
      api_docs: `${req.protocol}://${req.get('host')}/api/health`
    });
  }
  next();
});

// Crear todas las tablas necesarias
async function createTables() {
  const connection = await connectDB();
  
  try {
    // Tabla usuarios
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        dni VARCHAR(20) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        telefono VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol ENUM('admin', 'cliente') DEFAULT 'cliente',
        activo BOOLEAN DEFAULT TRUE,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_telefono (telefono)
      )
    `);
    
    // Crear usuario admin por defecto si no existe
    const adminPassword = await bcrypt.hash('admin123', 10);
    await connection.execute(`
      INSERT IGNORE INTO usuarios (dni, nombre, apellido, telefono, password, rol) 
      VALUES ('12345678', 'Administrador', 'Sistema', '3411234567', ?, 'admin')
    `, [adminPassword]);

    // Crear usuario cliente de prueba si no existe
    const clientPassword = await bcrypt.hash('cliente123', 10);
    await connection.execute(`
      INSERT IGNORE INTO usuarios (dni, nombre, apellido, telefono, password, rol) 
      VALUES ('87654321', 'Juan', 'Perez', '3417654321', ?, 'cliente')
    `, [clientPassword]);
    
    console.log('✅ Todas las tablas creadas/verificadas exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
  } finally {
    connection.release();
  }
}

// ============== RUTAS DE VEHÍCULOS ==============

// Crear tabla de vehículos
async function createVehiclesTable() {
  const connection = await connectDB();
  
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vehiculos (
        idVehiculo VARCHAR(50) PRIMARY KEY,
        marca VARCHAR(100) NOT NULL,
        modelo VARCHAR(100) NOT NULL,
        anio INT NOT NULL,
        precio DECIMAL(12,2) NOT NULL,
        km INT NOT NULL,
        stock INT DEFAULT 1,
        color VARCHAR(30) DEFAULT NULL,
        fotos JSON,
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Tabla de vehículos creada/verificada exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando tabla de vehículos:', error);
  } finally {
    connection.release();
  }
}

// Crear tabla de citas
async function createCitasTable() {
  const connection = await connectDB();
  try {
    await connection.execute(`
 CREATE TABLE IF NOT EXISTS citas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dni VARCHAR(20) NOT NULL,
        idVehiculo VARCHAR(50) DEFAULT NULL,
        fecha_hora DATETIME NOT NULL,
        motivo VARCHAR(255) NOT NULL,
        estado ENUM('pendiente', 'aceptada', 'rechazada') DEFAULT 'pendiente',
        admin_dni VARCHAR(20) DEFAULT NULL,
        admin_message TEXT DEFAULT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP NULL DEFAULT NULL
      )
    `);

    // Asegurar compatibilidad: si la tabla existía con estados previos, migrar valores conocidos
    try {
      // Mapear valores antiguos a nuevos (si existen)
      await connection.execute("UPDATE citas SET estado = 'rechazada' WHERE estado = 'cancelada'");
      await connection.execute("UPDATE citas SET estado = 'aceptada' WHERE estado = 'completada'");
    } catch (merr) {
      // si falla, no bloqueamos la aplicación; registrar y continuar
      console.warn('Aviso migración estados citas:', merr.message || merr);
    }

    // Agregar columnas si no existen (para instalaciones previas)
    try {
      await connection.execute("ALTER TABLE citas ADD COLUMN IF NOT EXISTS admin_dni VARCHAR(20) DEFAULT NULL");
      await connection.execute("ALTER TABLE citas ADD COLUMN IF NOT EXISTS admin_message TEXT DEFAULT NULL");
      await connection.execute("ALTER TABLE citas ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP NULL DEFAULT NULL");
    } catch (aerr) {
      // MySQL antiguas versiones no soportan IF NOT EXISTS en ADD COLUMN; ignorar errores si ya existen
      // En caso de error, solo registrar
      console.warn('Aviso alter table citas (posible columna existente):', aerr.message || aerr);
    }

    console.log('✅ Tabla de citas creada/verificada exitosamente');
  } catch (error) {
    console.error('❌ Error creando tabla de citas:', error);
  } finally {
    connection.release();
  }
}

// Crear tabla de vehículos generados (semillas separadas de la tabla principal)
async function createGeneratedVehiclesTable() {
  const connection = await connectDB();

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vehiculos_generados (
        idVehiculo VARCHAR(50) PRIMARY KEY,
        marca VARCHAR(100) NOT NULL,
        modelo VARCHAR(100) NOT NULL,
        anio INT NOT NULL,
        precio DECIMAL(12,2) NOT NULL,
        km INT NOT NULL,
        fotos JSON,
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // No insertar semillas: la tabla se crea vacía por petición del cliente
    console.log('✅ Tabla vehiculos_generados creada (vacía)');
  } catch (error) {
    console.error('❌ Error creando tabla vehiculos_generados:', error);
  } finally {
    connection.release();
  }
}

// Middleware para verificar admin
function requireAdmin(req, res, next) {
  // En una app real, aquí verificarías el token JWT
  // Por ahora, asumimos que el usuario está en la sesión
  const user = req.user; // Deberías implementar autenticación JWT
  if (!user || user.rol !== 'admin') {
    return res.status(403).json({ 
      success: false,
      message: 'Acceso denegado. Se requiere rol de administrador.' 
    });
  }
  next();
}

// Alta de vehículo
app.post('/api/vehiculos', async (req, res) => {
  let { idVehiculo, marca, modelo, anio, precio, km, fotos, descripcion, stock, color, es0km } = req.body;

  // Generar un idVehiculo automático si el frontend no lo envía
  if (!idVehiculo) {
    idVehiculo = `veh_${Date.now()}_${Math.floor(Math.random() * 900) + 100}`;
  }

  if (!marca || !modelo || !anio || !precio || km === undefined || km === null) {
    return res.status(400).json({ 
      success: false,
      message: 'Todos los campos obligatorios deben ser completados' 
    });
  }
  
  // Si es 0km, stock debe ser mayor a 0
  if (es0km && (!stock || stock <= 0)) {
    return res.status(400).json({ success: false, message: 'Stock requerido para vehículos 0 km' });
  }

  if (anio < 1900 || anio > new Date().getFullYear() + 1) {
    return res.status(400).json({ 
      success: false,
      message: 'El año debe ser válido' 
    });
  }

  if (precio <= 0) {
    return res.status(400).json({ 
      success: false,
      message: 'El precio debe ser mayor a 0' 
    });
  }

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

// Obtener todos los vehículos
app.get('/api/vehiculos', async (req, res) => {
  const connection = await connectDB();
  
  try {
    const [vehicles] = await connection.execute(
      'SELECT * FROM vehiculos WHERE activo = TRUE ORDER BY fecha_creacion DESC'
    );
    
    // Parsear las fotos de JSON
    const vehiclesWithParsedPhotos = vehicles.map(vehicle => ({
      ...vehicle,
      fotos: vehicle.fotos ? JSON.parse(vehicle.fotos) : [],
      color: vehicle.color,
      stock: vehicle.stock
    }));
    
    res.json({ 
      success: true,
      vehiculos: vehiclesWithParsedPhotos
    });
    
  } catch (error) {
    console.error('Error obteniendo vehículos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error del servidor' 
    });
  } finally {
    if (connection) connection.release();
  }
});

// Obtener vehículos generados (semillas)
app.get('/api/vehiculos-generados', async (req, res) => {
  const connection = await connectDB();
  try {
    const [vehicles] = await connection.execute('SELECT * FROM vehiculos_generados WHERE activo = TRUE ORDER BY fecha_creacion DESC');
    const vehiclesWithParsedPhotos = vehicles.map(vehicle => ({
      ...vehicle,
      fotos: vehicle.fotos ? JSON.parse(vehicle.fotos) : []
    }));
    res.json({ success: true, vehiculos: vehiclesWithParsedPhotos });
  } catch (error) {
    console.error('Error obteniendo vehiculos_generados:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  } finally {
    if (connection) connection.release();
  }
});

// Crear cita (idVehiculo ahora es opcional)
app.post('/api/citas', async (req, res) => {
  const { dni, idVehiculo, fecha, hora, motivo } = req.body;

  if (!dni || !fecha || !hora || !motivo) {
    return res.status(400).json({ success: false, message: 'Todos los campos obligatorios (dni, fecha, hora, motivo) deben ser completados' });
  }

  // Combinar fecha y hora
  const fechaHoraStr = `${fecha} ${hora}:00`;
  const fechaHora = new Date(fechaHoraStr);
  if (isNaN(fechaHora.getTime())) {
    return res.status(400).json({ success: false, message: 'Fecha u hora inválida' });
  }

  const day = fechaHora.getDay(); // 0=Sun,6=Sat
  if (day === 0 || day === 6) {
    return res.status(400).json({ success: false, message: 'Las citas solo se pueden agendar de lunes a viernes' });
  }

  const hour = fechaHora.getHours();
  const minute = fechaHora.getMinutes();

  const allowed = (hour >= 9 && (hour < 13 || (hour === 13 && minute === 0))) || (hour >= 15 && (hour < 18 || (hour === 18 && minute === 0)));

  if (!allowed) {
    return res.status(400).json({ success: false, message: 'Horario inválido. Disponibles: 09:00-13:00 y 15:00-18:00' });
  }

  const connection = await connectDB();

  try {
    // Verificar usuario
    const [users] = await connection.execute('SELECT dni FROM usuarios WHERE dni = ?', [dni]);
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Si se envió idVehiculo, verificar que exista y esté activo
    if (idVehiculo) {
      const [vehicles] = await connection.execute('SELECT idVehiculo, activo FROM vehiculos WHERE idVehiculo = ?', [idVehiculo]);
      if (vehicles.length === 0 || !vehicles[0].activo) {
        return res.status(400).json({ success: false, message: 'Vehículo no disponible' });
      }
    }

    // Evitar colisiones:
    // - Si se indicó vehículo: bloquear solo si el mismo vehículo ya tiene cita en ese horario
    // - Si NO se indicó vehículo: bloquear si ya existe cualquier cita en ese horario (capacidad por slot = 1)
    const existingQuery = idVehiculo ?
      'SELECT id FROM citas WHERE idVehiculo = ? AND fecha_hora = ?' :
      'SELECT id FROM citas WHERE fecha_hora = ?';
    const existingParams = idVehiculo ? [idVehiculo, fechaHoraStr] : [fechaHoraStr];

    const [existing] = await connection.execute(existingQuery, existingParams);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'El horario seleccionado ya está ocupado' });
    }

    // Insertar cita
    await connection.execute('INSERT INTO citas (dni, idVehiculo, fecha_hora, motivo) VALUES (?, ?, ?, ?)', [dni, idVehiculo || null, fechaHoraStr, motivo]);

    res.status(201).json({ success: true, message: 'Cita agendada' });

  } catch (err) {
    console.error('Error creando cita:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  } finally {
    if (connection) connection.release();
  }
});

// Obtener disponibilidad por fecha (slots horarios)
app.get('/api/citas/availability', async (req, res) => {
  const date = req.query.date; // expected YYYY-MM-DD
  const idVehiculo = req.query.idVehiculo;

  if (!date) {
    return res.status(400).json({ success: false, message: 'Se requiere el parámetro date (YYYY-MM-DD)' });
  }

  // Validate basic date format
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Use YYYY-MM-DD' });
  }

  // Allowed slots: hourly slots 09:00,10:00,11:00,12:00 and 15:00,16:00,17:00
  const slots = ['09:00','10:00','11:00','12:00','15:00','16:00','17:00'];
  const connection = await connectDB();

  try {
    const result = [];
    for (const t of slots) {
      const fechaHoraStr = `${date} ${t}:00`;
      let sql = 'SELECT COUNT(*) as cnt FROM citas WHERE fecha_hora = ?';
      const params = [fechaHoraStr];
      if (idVehiculo) {
        sql = 'SELECT COUNT(*) as cnt FROM citas WHERE idVehiculo = ? AND fecha_hora = ?';
        params.unshift(idVehiculo);
      }
      const [rows] = await connection.execute(sql, params);
      const cnt = rows[0] ? rows[0].cnt : 0;
      result.push({ time: t, available: cnt === 0 });
    }

    res.json({ success: true, date, slots: result });
  } catch (err) {
    console.error('Error obteniendo disponibilidad:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
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
app.post('/api/register', async (req, res) => {
  const { dni, nombre, apellido, telefono, password, rol } = req.body;

  // Log minimal payload for debugging (no password)
  console.log('POST /api/register payload:', { dni, nombre, apellido, telefono, rol, creatorDni });

  if (!dni || !nombre || !apellido || !telefono || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'DNI, nombre, apellido, teléfono y contraseña son obligatorios' 
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false,
      message: 'La contraseña debe tener al menos 6 caracteres' 
    });
  }
  
  if (rol && !['admin', 'cliente'].includes(rol)) {
    return res.status(400).json({ 
      success: false,
      message: 'El rol debe ser "admin" o "cliente"' 
    });
  }

  // Soporte creación de admins desde el formulario cuando viene creatorDni
  const creatorDni = req.body.creatorDni;
  let finalRole = rol || 'cliente';

  const connection = await connectDB();
  
  try {
    if (creatorDni) {
      const [creatorRows] = await connection.execute('SELECT dni, rol FROM usuarios WHERE dni = ?', [creatorDni]);
      if (creatorRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario creador no encontrado.' });
      }
      finalRole = creatorRows[0].rol === 'admin' ? 'admin' : 'cliente';
    } else if (rol === 'admin') {
      // No se permite crear admin sin creatorDni
      return res.status(403).json({ success: false, message: 'No está permitido crear administradores desde el registro público. Use la opción interna para administradores.' });
    }

    // Verificar si el DNI ya existe
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
    
    // Verificar si el teléfono ya existe
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
    
    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar usuario con rol final
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

// Login de usuario
app.post('/api/login', async (req, res) => {
  const { dni, password } = req.body;
  
  if (!dni || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'DNI y contraseña son obligatorios' 
    });
  }
  
  const connection = await connectDB();
  
  try {
    const [users] = await connection.execute(
      'SELECT dni, nombre, apellido, telefono, password, rol, activo FROM usuarios WHERE dni = ?',
      [dni]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales incorrectas' 
      });
    }
    
    const user = users[0];
    
    if (!user.activo) {
      return res.status(401).json({ 
        success: false,
        message: 'Cuenta desactivada' 
      });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales incorrectas' 
      });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    
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

// Crear un nuevo administrador (solo por otro admin)
app.post('/api/admins', async (req, res) => {
  const { dni, nombre, apellido, telefono, password, creatorDni } = req.body;

  if (!dni || !nombre || !apellido || !telefono || !password || !creatorDni) {
    return res.status(400).json({ success: false, message: 'dni, nombre, apellido, telefono, password y creatorDni son obligatorios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
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
    await connection.execute('INSERT INTO usuarios (dni, nombre, apellido, telefono, password, rol) VALUES (?, ?, ?, ?, ?, ?)', [dni, nombre, apellido, telefono, hashedPassword, 'admin']);

    res.status(201).json({ success: true, message: 'Administrador creado exitosamente' });
  } catch (err) {
    console.error('Error creando administrador:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  } finally {
    if (connection) connection.release();
  }
});

// Inicializar base de datos y servidor
async function startServer() {
  try {
    await createPool();
    await createTables();
    await createVehiclesTable();
    await createCitasTable();

    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚗 Servidor AltaGama API corriendo en http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔑 Usuario admin: DNI 12345678, Contraseña: admin123`);
      console.log(`👤 Usuario cliente: DNI 87654321, Contraseña: cliente123`);
      console.log(`💡 Esta es solo la API. El frontend Angular debe ejecutarse por separado.`);
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
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