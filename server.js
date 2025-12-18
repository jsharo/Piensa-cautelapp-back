const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// Endpoint de prueba
app.get('/api/estado', (req, res) => {
    res.json({ status: 'Backend Online', time: new Date() });
});

// Endpoint que recibe datos del front
app.post('/api/saludar', (req, res) => {
    const nombre = req.body.nombre;
    console.log(`Recibido nombre: ${nombre}`);
    res.json({ 
        mensaje: `¡Hola ${nombre}! Saludos desde el servidor Node.js`,
        timestamp: Date.now()
    });
});

app.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
});
