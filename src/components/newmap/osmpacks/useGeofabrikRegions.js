import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useGeofabrikRegions() {
  return useQuery({
    queryKey: ['geofabrik-regional-catalogue'], staleTime: 21600000, retry: false,
    queryFn: async () => {
      const { data } = await base44.functions.invoke('geofabrikRegions', { action: 'catalogue' });
      if (data.error) throw new Error(data.error);
      return data.regions;
    },
  });
}