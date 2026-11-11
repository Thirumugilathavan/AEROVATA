/**
 * Coimbatore UTM Location Registry & Simulation Geographic Bounds
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 */

export interface NamedLocation {
  id: string;
  name: string;
  shortName: string;
  category: 'hub' | 'hospital' | 'depot' | 'tech_park' | 'logistics';
  coordinates: [number, number]; // [lng, lat]
  altitudeMeters: number;
  description: string;
}

export const COIMBATORE_LOCATIONS: NamedLocation[] = [
  {
    id: 'loc-cmch-hub',
    name: 'CMCH Trauma Hub Alpha (Base Station)',
    shortName: 'CMCH Trauma Hub',
    category: 'hospital',
    coordinates: [76.9665, 11.0025],
    altitudeMeters: 55,
    description: 'Coimbatore Medical College Hospital central rooftop drone landing pad. Equipped with cold-chain storage and medical trauma dispatch.',
  },
  {
    id: 'loc-peelamedu-depot',
    name: 'Peelamedu Logistics Depot',
    shortName: 'Peelamedu Depot',
    category: 'depot',
    coordinates: [77.0120, 11.0260],
    altitudeMeters: 65,
    description: 'BVLOS transit hub along Avinashi arterial corridor. Automated battery swap docking station.',
  },
  {
    id: 'loc-gandhipuram-hub',
    name: 'Gandhipuram Central Transit Hub',
    shortName: 'Gandhipuram Hub',
    category: 'hub',
    coordinates: [76.9660, 11.0180],
    altitudeMeters: 60,
    description: 'Central urban transit terminal pad serving central business district and retail deliveries.',
  },
  {
    id: 'loc-tidel-park',
    name: 'TIDEL Park IT SEZ Pad',
    shortName: 'TIDEL Park IT SEZ',
    category: 'tech_park',
    coordinates: [77.0250, 11.0150],
    altitudeMeters: 65,
    description: 'IT SEZ high-tech cargo delivery node located on Avinashi Road.',
  },
  {
    id: 'loc-psg-tech',
    name: 'PSG College of Tech Research Pad',
    shortName: 'PSG Tech Pad',
    category: 'tech_park',
    coordinates: [77.0030, 11.0240],
    altitudeMeters: 60,
    description: 'Advanced robotics research facility and university medical laboratory landing site.',
  },
  {
    id: 'loc-kmch-speciality',
    name: 'KMCH Speciality Hospital (Avinashi Rd)',
    shortName: 'KMCH Hospital',
    category: 'hospital',
    coordinates: [77.0380, 11.0420],
    altitudeMeters: 65,
    description: 'Multi-speciality medical trauma hub and organ transport pad on Avinashi corridor.',
  },
  {
    id: 'loc-singanallur-hub',
    name: 'Singanallur Health Centre Pad',
    shortName: 'Singanallur Hub',
    category: 'depot',
    coordinates: [77.0200, 10.9980],
    altitudeMeters: 55,
    description: 'South-east urban dispatch depot serving Trichy Road industrial sector.',
  },
  {
    id: 'loc-rs-puram',
    name: 'RS Puram West Dispatch Pad',
    shortName: 'RS Puram Hub',
    category: 'hub',
    coordinates: [76.9450, 11.0080],
    altitudeMeters: 60,
    description: 'Western residential and commercial supply drop depot.',
  },
  {
    id: 'loc-ganapathy-clinic',
    name: 'Ganapathy Specialized Clinic & ICU',
    shortName: 'Ganapathy Clinic',
    category: 'hospital',
    coordinates: [76.9830, 11.0360],
    altitudeMeters: 60,
    description: 'Northern emergency clinic on Sathy Road corridor.',
  },
  {
    id: 'loc-saravanampatti',
    name: 'Saravanampatti IT Corridor Depot',
    shortName: 'Saravanampatti IT',
    category: 'tech_park',
    coordinates: [76.9980, 11.0800],
    altitudeMeters: 65,
    description: 'Northern IT corridor hub serving tech parks and SEZs.',
  },
  {
    id: 'loc-cbe-north-junction',
    name: 'Coimbatore North Junction Hub',
    shortName: 'CBE North Junction',
    category: 'logistics',
    coordinates: [76.9530, 11.0280],
    altitudeMeters: 60,
    description: 'Railway cargo integration terminal and dispatch node.',
  },
  {
    id: 'loc-ramanathapuram',
    name: 'Ramanathapuram Transit Pad',
    shortName: 'Ramanathapuram Hub',
    category: 'hub',
    coordinates: [76.9850, 10.9950],
    altitudeMeters: 55,
    description: 'South-central cross-corridor node linking Trichy Road and Sungam bypass.',
  },
];

export const DEFAULT_STARTING_LOCATION = COIMBATORE_LOCATIONS[0];

export const SIMULATION_BOUNDS = {
  minLng: 76.9000,
  maxLng: 77.0900,
  minLat: 10.9300,
  maxLat: 11.1100,
};

export function isCoordinateWithinBounds(lng: number, lat: number): boolean {
  return (
    lng >= SIMULATION_BOUNDS.minLng &&
    lng <= SIMULATION_BOUNDS.maxLng &&
    lat >= SIMULATION_BOUNDS.minLat &&
    lat <= SIMULATION_BOUNDS.maxLat
  );
}
