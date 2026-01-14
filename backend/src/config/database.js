const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración de la conexión a MySQL
const sequelize = new Sequelize(
  process.env.DB_NAME,      // nombre de la base de datos
  process.env.DB_USER,      // usuario (root para XAMPP)
  process.env.DB_PASSWORD,  // contraseña (vacía por defecto en XAMPP)
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Función para probar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida correctamente');
    
    // Sincronizar modelos con la base de datos
    await sequelize.sync({ force: false });
    console.log('✅ Modelos sincronizados con la base de datos');
    
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    console.log('💡 Verifica que:');
    console.log('   1. XAMPP esté ejecutándose');
    console.log('   2. MySQL esté iniciado en XAMPP');
    console.log('   3. La base de datos exista (o créala en phpMyAdmin)');
  }
};

module.exports = {
  sequelize,
  testConnection
};