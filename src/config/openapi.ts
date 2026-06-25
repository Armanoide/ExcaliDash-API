import swaggerJsDoc from 'swagger-jsdoc'

const swaggerDefinition = {
  openapi: '3.1.0',
  info: {
    title: 'ExcaliDash API',
    version: '2.0.0',
    description: 'Programmatic diagram creation API for Excalidash. Create, manage, and share diagrams using GraphJSON input with dagre auto-layout.',
    contact: {
      name: 'ExcaliDash API',
    },
  },
  servers: [
    {
      url: process.env.API_SERVER_URL || 'https://api.draw.armanoide.net',
      description: 'Production API',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from POST /auth/login',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' },
          email: { type: 'string', description: 'User email' },
          name: { type: 'string', nullable: true, description: 'Display name' },
        },
        required: ['id', 'email'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'User email address' },
          password: { type: 'string', description: 'User password' },
          expiresIn: {
            type: 'string',
            default: '1h',
            description: 'JWT token expiration duration (e.g. 1h, 30m, 1d)',
          },
        },
        required: ['email', 'password'],
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT access token (Bearer)' },
          refreshToken: { type: 'string', description: 'Refresh token for getting new JWT' },
          expiresIn: { type: 'integer', description: 'Token expiration in seconds' },
          user: { $ref: '#/components/schemas/User' },
        },
        required: ['token', 'refreshToken', 'expiresIn', 'user'],
      },
      RefreshRequest: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string', description: 'Refresh token from login response' },
        },
        required: ['refreshToken'],
      },
      GraphInput: {
        type: 'object',
        description: 'Graph structure for diagram creation',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique node ID' },
                label: { type: 'string', description: 'Node display text' },
                width: { type: 'number', default: 200, description: 'Node width in pixels' },
                height: { type: 'number', default: 60, description: 'Node height in pixels' },
                style: {
                  type: 'object',
                  description: 'Node border style (color, width, dash, roundness)',
                },
              },
              required: ['id', 'label'],
            },
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique edge ID' },
                from: { type: 'string', description: 'Source node ID' },
                to: { type: 'string', description: 'Target node ID' },
                label: { type: 'string', nullable: true, description: 'Edge label text' },
                style: {
                  type: 'object',
                  description: 'Edge style (color, width, dash, arrowhead)',
                },
              },
              required: ['from', 'to'],
            },
          },
          direction: {
            type: 'string',
            enum: ['TB', 'LR', 'BT', 'RL'],
            default: 'TB',
            description: 'Graph layout direction (Top-Bottom, Left-Right, Bottom-Top, Right-Left)',
          },
          spacing: {
            type: 'object',
            properties: {
              node: { type: 'number', default: 30, description: 'Spacing between nodes' },
              edge: { type: 'number', default: 10, description: 'Spacing between edges' },
            },
          },
        },
        required: ['nodes'],
      },
      CreateDrawingRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Drawing name (auto-generated if omitted)' },
          graph: { $ref: '#/components/schemas/GraphInput' },
          collectionId: { type: 'string', nullable: true, description: 'Collection ID for organizing drawings' },
        },
        required: ['graph'],
      },
      CreateDrawingResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Created drawing ID' },
          name: { type: 'string', description: 'Drawing name' },
          elements: { type: 'integer', description: 'Number of elements created' },
        },
        required: ['id', 'name', 'elements'],
      },
      Drawing: {
        type: 'object',
        description: 'Excalidash drawing object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          elements: { type: 'array', description: 'Excalidraw element data' },
          appState: { type: 'object', description: 'Excalidraw application state' },
          version: { type: 'integer' },
        },
      },
      UpdateDrawingRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'New drawing name' },
          elements: { type: 'array', description: 'Excalidraw elements to update' },
          appState: { type: 'object', description: 'Excalidraw application state' },
          collectionId: { type: 'string', nullable: true, description: 'New collection ID' },
        },
      },
      ShareUserRequest: {
        type: 'object',
        properties: {
          userEmail: { type: 'string', description: 'Target user email' },
          userName: { type: 'string', description: 'Target user name (alternative to email)' },
          permission: {
            type: 'string',
            enum: ['view', 'edit'],
            default: 'view',
            description: 'Permission level',
          },
        },
      },
      ShareLinkRequest: {
        type: 'object',
        properties: {
          permission: {
            type: 'string',
            enum: ['view', 'edit'],
            default: 'view',
            description: 'Permission level for the share link',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
        },
        required: ['error'],
      },
    },
  },
  security: [{ bearerAuth: [] }],
}

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/auth.ts',
    './src/routes/drawings.ts',
  ],
}

export const swaggerSpec = swaggerJsDoc(options)
