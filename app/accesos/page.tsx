"use client";

// Pantalla para registrar entradas y salidas manuales de personas o vehículos no ligados a un viaje.

import { useEffect, useState } from 'react';
import { getAccessRecords, createAccessRecord, registerAccessExit, getFleetVehicles } from '../../lib/api';
import { AccessRecord, FleetVehicle, VehicleType } from '../../lib/types';

/**
 * Página para registrar entradas y salidas manuales de visitantes y empleados.
 * Muestra las entradas en curso (sin salida) y permite crear nuevas entradas
 * o registrar la salida para una entrada existente.
 */
export default function AccesosPage() {
  const [accesos, setAccesos] = useState<AccessRecord[]>([]);
  const [nombre, setNombre] = useState('');
  const [vehiculo, setVehiculo] = useState<VehicleType>('Otro vehículo');
  const [descripcionVehiculo, setDescripcionVehiculo] = useState('');
  const [unidad, setUnidad] = useState('');
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Función para cargar accesos
  const fetchData = async () => {
    try {
      const [data, vehicles] = await Promise.all([
        getAccessRecords(),
        getFleetVehicles().catch(() => [] as FleetVehicle[]),
      ]);
      setAccesos(data);
      setFleetVehicles(vehicles);
      if (!unidad && vehicles.length > 0) {
        setUnidad(String(vehicles[0].id));
      }
    } catch (error) {
      console.error('Error al cargar accesos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar accesos al montar la página
  useEffect(() => {
    fetchData();
  }, []);

  // Polling automático cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, []);

  // Crea un nuevo acceso y limpia el formulario para el siguiente registro.
  async function handleCrear() {
    await createAccessRecord({
      nombre,
      vehiculo,
      vehiculo_purp: vehiculo === 'Vehículo PURP' ? unidad : undefined,
      descripcion_vehiculo: vehiculo === 'Otro vehículo' ? descripcionVehiculo : undefined,
    });
    setNombre('');
    setVehiculo('Otro vehículo');
    setDescripcionVehiculo('');
    setUnidad('');
    await fetchData(); // Refrescar inmediatamente
  }

  // Registra que la persona o vehículo seleccionado ya salió de planta.
  async function handleSalida(id: string) {
    await registerAccessExit(id);
    await fetchData(); // Refrescar inmediatamente
  }

  return (
    <main className="p-4 space-y-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-4">Control de acceso</h1>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          <section className="bg-white rounded-lg p-4 shadow-md space-y-2">
            <h2 className="text-xl font-semibold">Nueva entrada</h2>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre visitante..."
                className="border rounded-md p-2 w-full"
              />
              <select
                value={vehiculo}
                onChange={(e) => setVehiculo(e.target.value as VehicleType)}
                className="border rounded-md p-2 w-full"
              >
                <option>Vehículo PURP</option>
                <option>Otro vehículo</option>
              </select>
              {vehiculo === 'Vehículo PURP' ? (
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  className="border rounded-md p-2 w-full"
                >
                  {fleetVehicles.length === 0 ? (
                    <option value="">No hay vehículos disponibles</option>
                  ) : (
                    fleetVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={String(vehicle.id)}>
                        {vehicle.name}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <input
                  type="text"
                  value={descripcionVehiculo}
                  onChange={(e) => setDescripcionVehiculo(e.target.value)}
                  placeholder="Descripción vehículo"
                  className="border rounded-md p-2 w-full"
                />
              )}
              <button
                onClick={handleCrear}
                className="py-2 px-4 bg-primary text-white rounded-md mt-2 hover:bg-blue-700"
              >
                Registrar entrada
              </button>
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Entradas en planta</h2>
            {accesos.length === 0 ? (
              <p>No hay entradas activas.</p>
            ) : (
              accesos.map((acceso) => (
                <div key={acceso.id} className="bg-white rounded-lg p-4 shadow-md flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{acceso.nombre}</p>
                    <p className="text-sm text-gray-600">{acceso.vehiculo === 'Vehículo PURP' ? acceso.vehiculo_purp : acceso.descripcion_vehiculo}</p>
                    <p className="text-xs text-gray-500">Entrada: {acceso.fecha_entrada ? new Date(acceso.fecha_entrada).toLocaleString() : 'N/A'}</p>
                  </div>
                    <button
                      onClick={() => handleSalida(acceso.id)}
                      className="py-2 px-3 bg-success text-white rounded-md hover:bg-success"
                    >
                      Registrar salida
                    </button>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
