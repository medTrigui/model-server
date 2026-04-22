import express from 'express';
import cors from 'cors';
import { createHandler } from 'graphql-http/lib/use/express';
import { WebSocketServer } from 'ws';
import { useServer } from "graphql-ws/use/ws";
import schema from './schema.js'
import { printSchema } from 'graphql';
import process from 'node:process';

if (process.env.NODE_ENV != 'production')
  var { ruruHTML } = await import('ruru/server');

const app = express();

app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/graphql', createHandler({schema}));

// Serve the GraphiQL IDE.
if (process.env.NODE_ENV != 'production')
  app.get('/', (_req, res) => {
    res.type('html');
    res.end(ruruHTML({ endpoint: '/graphql', subscriptionEndpoint: '/' }));
  });

const server = await app.listen(process.env.PORT || 5000, '0.0.0.0');
console.log(printSchema(schema));
console.log(server.address());

const wsServer = new WebSocketServer({server, path: '/'});

useServer({schema}, wsServer);