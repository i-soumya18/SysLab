import { Express } from 'express';

export function setupRoutes(app: Express): void {
  // API version prefix
  const apiPrefix = '/api/v1';

  // Lazy-load routes to avoid database initialization issues
  const authRoutes = require('./auth').default;
  const userRoutes = require('./users').default;
  const subscriptionRoutes = require('./subscription').default;
  const workspaceRoutes = require('./workspaces').default;
  const componentRoutes = require('./components').default;
  const simulationRoutes = require('./simulation').default;
  const scenarioRoutes = require('./scenarios').default;
  const guidanceRoutes = require('./guidance').default;
  const progressRoutes = require('./progress').default;
  const versionRoutes = require('./versions').default;
  const reportRoutes = require('./reports').default;
  const failureInjectionRoutes = require('./failureInjection').default;
  const progressiveConstraintsRoutes = require('./progressiveConstraints').default;
  const hintsRoutes = require('./hints').default;
  const { scalabilityRoutes } = require('./scalabilityRoutes');

  // Authentication routes
  app.use(`${apiPrefix}/auth`, authRoutes);

  // User profile and preferences routes (SRS FR-1)
  app.use(`${apiPrefix}/users`, userRoutes);

  // Subscription routes (SRS FR-1.4)
  app.use(`${apiPrefix}/subscription`, subscriptionRoutes);

  // Mount route modules
  app.use(`${apiPrefix}/workspaces`, workspaceRoutes);
  app.use(`${apiPrefix}/components`, componentRoutes);
  app.use(`${apiPrefix}/simulation`, simulationRoutes);
  app.use(`${apiPrefix}/scenarios`, scenarioRoutes);
  app.use(`${apiPrefix}/guidance`, guidanceRoutes);
  app.use(`${apiPrefix}/progress`, progressRoutes);
  app.use(`${apiPrefix}/reports`, reportRoutes);
  app.use(`${apiPrefix}/failure-injection`, failureInjectionRoutes); // SRS FR-6
  app.use(`${apiPrefix}/progressive-constraints`, progressiveConstraintsRoutes); // SRS FR-9.2
  app.use(`${apiPrefix}/hints`, hintsRoutes); // SRS FR-9.3
  app.use(`${apiPrefix}/scalability`, scalabilityRoutes); // SRS NFR-4: Horizontal scaling and load balancing

  // Version routes - mounted last to avoid /:id catching everything
  app.use(`${apiPrefix}/versions`, versionRoutes);
  app.use(`${apiPrefix}`, versionRoutes); // For nested workspace version routes

  // API info endpoint
  app.get(`${apiPrefix}`, (req, res) => {
    res.json({
      name: 'System Design Simulator API',
      version: '1.0.0',
      endpoints: {
        auth: `${apiPrefix}/auth`,
        users: `${apiPrefix}/users`,
        subscription: `${apiPrefix}/subscription`,
        workspaces: `${apiPrefix}/workspaces`,
        versions: `${apiPrefix}/versions`,
        reports: `${apiPrefix}/reports`,
        components: `${apiPrefix}/components`,
        simulation: `${apiPrefix}/simulation`,
        scenarios: `${apiPrefix}/scenarios`,
        guidance: `${apiPrefix}/guidance`,
        progress: `${apiPrefix}/progress`,
        failureInjection: `${apiPrefix}/failure-injection`,
        progressiveConstraints: `${apiPrefix}/progressive-constraints`,
        hints: `${apiPrefix}/hints`,
        scalability: `${apiPrefix}/scalability`
      }
    });
  });
}