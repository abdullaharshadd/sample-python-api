import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';

export interface SwaggerMeta {
  version: string;
  title: string;
  description: string;
}

export interface RouteDef {
  method: string;
  path: string;
  summary: string;
}

function expressPathToSwagger(path: string): string {
  // Convert Express :param to {param}
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

export function mountSwagger(
  app: Application,
  swaggerUrl: string,
  routeDefs: RouteDef[],
  meta: SwaggerMeta
): void {
  const paths: Record<string, any> = {};

  const defs = Array.isArray(routeDefs) ? routeDefs : [];

  for (const def of defs) {
    const swaggerPath = expressPathToSwagger(def.path);
    if (!paths[swaggerPath]) {
      paths[swaggerPath] = {};
    }
    paths[swaggerPath][def.method.toLowerCase()] = {
      summary: def.summary,
      responses: {
        '200': { description: 'Success' },
      },
    };
  }

  const swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: meta.title,
      description: meta.description,
      version: meta.version,
    },
    paths,
  };

  app.use(swaggerUrl, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}