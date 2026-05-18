"use client";

// Comentario para personas no técnicas: Muestra la lista de viajes para consulta rápida y seguimiento operativo.

import { useEffect, useState } from 'react';
import { getAllTrips, updateTripStatus } from '../../lib/api';
import TripCard from '../../components/TripCard';
import { Trip, TripStatus } from '../../lib/types';

/**
 * Lista de viajes en planta.
 *
 * Muestra todos los viajes activos que no están en etapa planeado.
 * Incluye también viajes finalizados en el registro.
 * Permite al guardia realizar las acciones de validación de entrada,
 * rechazo e indicar salida según el estado del viaje.
 */
export default function ViajesPage() {
  const [viajes, setViajes] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // Función para cargar viajes
  const fetchData = async () => {
    try {
      const data = await getAllTrips();
      setViajes(data);
    } catch (error) {
      console.error('Error al cargar viajes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar viajes al montar la página
  useEffect(() => {
    fetchData();
  }, []);

  // Polling automático cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000); // 30 segundos; ajusta según necesites (ej. 10000 para 10 segundos)

    return () => clearInterval(interval); // Limpiar intervalo al desmontar
  }, []);

  // Cambia el estado de un viaje desde la lista de seguimiento.
  async function handleAction(id: number, newState: TripStatus | string) {
    const viaje = viajes.find(v => v.id === id);
    if (!viaje) return;
    await updateTripStatus(viaje.folio, newState as TripStatus);
    // Actualizar lista inmediatamente después de la acción
    await fetchData();
  }

  return (
    <main className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-4">Viajes en planta</h1>
      {loading ? (
        <p>Cargando...</p>
      ) : viajes.length === 0 ? (
        <p>No hay viajes activos.</p>
      ) : (
        viajes.map((viaje) => (
          <TripCard
            key={viaje.id ?? viaje.folio}
            viaje={{
              ...viaje,
              id: viaje.id!,
              lineaFletera: (viaje as any).lineaFletera ?? '',
            }}
            onAction={handleAction}
          />
        ))
      )}
    </main>
  );
}