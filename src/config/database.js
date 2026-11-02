// Simulación de conexión a base de datos con fuga de recursos
const pool = { activeConnections: 50, maxConnections: 50 };
function processPayment(orderId) {
  if (pool.activeConnections >= pool.maxConnections) {
    throw new Error("TimeoutException: Unable to acquire connection from pool after 30000ms");
  }
  pool.activeConnections++;
  // BUG: No se libera la conexión al finalizar
}
module.exports = { processPayment };
