"use client";

// Versión de tarjeta de viaje usada para mostrar datos y acciones principales al usuario.

import { useState } from 'react';

interface Trip {
  id: number;
  folio: string;
  orden: string;
  chofer: string;
  placas: string;
  lineaFletera: string;
  estado: string;
  entrada?: string;
  salida?: string;
}

interface Props {
  viaje: Trip;
  onAction: (id: number, newState: string) => void;
}

/**
 * Tarjeta de viaje con acciones según su estado.
 */
export default function TripCard({ viaje, onAction }: Props) {
  const [loading, setLoading] = useState(false);

  // Determinar botones según el estado actual
  const getActions = () => {
    switch (viaje.estado) {
      case 'en_camino':
        return (
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setLoading(true);
                await onAction(viaje.id, 'en_espera');
                setLoading(false);
              }}
              className="py-1 px-3 bg-success text-white rounded-md hover:bg-green-600"
              disabled={loading}
            >
              Validar entrada
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                await onAction(viaje.id, 'en_revision');
                setLoading(false);
              }}
              className="py-1 px-3 bg-danger text-white rounded-md hover:bg-red-600"
              disabled={loading}
            >
              Inválido
            </button>
          </div>
        );
      case 'en_revision':
        return (
          <button
            onClick={async () => {
              setLoading(true);
              await onAction(viaje.id, 'en_espera');
              setLoading(false);
            }}
            className="py-1 px-3 bg-success text-white rounded-md hover:bg-green-600"
            disabled={loading}
          >
            Validar corrección
          </button>
        );
      case 'en_proceso':
        return (
          <button
            onClick={async () => {
              setLoading(true);
              await onAction(viaje.id, 'finalizado');
              setLoading(false);
            }}
            className="py-1 px-3 bg-success text-white rounded-md hover:bg-green-600"
            disabled={loading}
          >
            Confirmar salida
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-md space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">Folio: {viaje.folio}</p>
          <p className="text-sm text-gray-600">Orden: {viaje.orden}</p>
          <p className="text-sm text-gray-600">Chofer: {viaje.chofer}</p>
          <p className="text-sm text-gray-600">Placas: {viaje.placas}</p>
          <p className="text-sm text-gray-600">Línea fletera: {viaje.lineaFletera}</p>
        </div>
        <span className="px-2 py-1 text-xs rounded-md bg-gray-200">
          {viaje.estado.replace(/_/g, ' ')}
        </span>
      </div>
      {getActions()}
    </div>
  );
}