export interface HealthStatus {
  service: string;
  status: 'ok' | 'error';
  port: number;
  timestamp: string;
}

export const getHealthCheck = (): HealthStatus => {
  return {
    service: 'Event Manager API',
    status: 'ok',
    port: 4001,
    timestamp: new Date().toISOString(),
  };
};