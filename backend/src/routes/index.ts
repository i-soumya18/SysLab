import { Express } from 'express';
import authRoutes from './auth';
import subscriptionRoutes from './subscription';
import workspaceRoutes from './workspaces';
import componentRoutes from './components';
import simulationRoutes from './simulation';
import scenarioRoutes from './scenarios';
import guidanceRoutes from './guidance';
import progressRoutes from './progress';
import versionRoutes from './versions';
import reportRoutes from './reports';

export function setupRoutes(app: Express): void {
  // API version prefix
  const apiPrefix = '/api/v1';

  // Authentication routes
  app.use(`${apiPrefix}/auth`, authRoutes);

  // Subscription routes (SRS FR-1.4)
  app.use(`${apiPrefix}/subscription`, subscriptionRoutes);

  // Mount route modules
  app.use(`${apiPrefix}/workspaces`, workspaceRoutes);
  app.use(`${apiPrefix}/workspaces`, versionRoutes); // Version routes are nested under workspaces
  app.use(`${apiPrefix}`, versionRoutes); // Direct version routes
  app.use(`${apiPrefix}/components`, componentRoutes);
  app.use(`${apiPrefix}/simulation`, simulationRoutes);
  app.use(`${apiPrefix}/scenarios`, scenarioRoutes);
  app.use(`${apiPrefix}/guidance`, guidanceRoutes);
  app.use(`${apiPrefix}/progress`, progressRoutes);
  app.use(`${apiPrefix}/reports`, reportRoutes);
  app.use(`${apiPrefix}`, reportRoutes); // For workspace-specific and shared routes

  // API info endpoint
  app.get(`${apiPrefix}`, (req, res) => {
    res.json({
      name: 'System Design Simulator API',
      version: '1.0.0',
      endpoints: {
        auth: `${apiPrefix}/auth`,
        subscription: `${apiPrefix}/subscription`,
        workspaces: `${apiPrefix}/workspaces`,
        versions: `${apiPrefix}/versions`,
        reports: `${apiPrefix}/reports`,
        components: `${apiPrefix}/components`,
        simulation: `${apiPrefix}/simulation`,
        scenarios: `${apiPrefix}/scenarios`,
        guidance: `${apiPrefix}/guidance`,
        progress: `${apiPrefix}/progress`
      }
    });
  });
}