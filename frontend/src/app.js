import React from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, split, HttpLink, gql, useQuery } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import DeviceMonitor from './components/DeviceMonitor';

const isLocalDevelopment = window.location.hostname === 'localhost' && window.location.port === '3000';
const httpEndpoint = process.env.REACT_APP_GRAPHQL_HTTP_URL || (isLocalDevelopment ? 'http://localhost:5000/graphql' : '/graphql');
const wsEndpoint = process.env.REACT_APP_GRAPHQL_WS_URL || (isLocalDevelopment ? 'ws://localhost:5000/' : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/graphqlws`);

// Create an HTTP link for queries/mutations
const httpLink = new HttpLink({
  uri: httpEndpoint,
});

// Create a WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: wsEndpoint,
  }),
);

// Split links based on operation type
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

// Create Apollo Client
const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Model: {
        keyFields: [] // Singleton
      }
    }
  }),
});

const GET_MODEL_META = gql`
  query GetModelMeta {
    model {
      deviceCount
    }
  }
`;

function Dashboard() {
  const { data, loading, error } = useQuery(GET_MODEL_META);

  if (loading) {
    return <p>Loading devices...</p>;
  }

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  const deviceCount = data?.model?.deviceCount ?? 0;

  return (
    <div className="container">
      <div className="header">
        <div className="menu-icon">&#9776;</div>
        <h1>Soteria Room Monitoring Status</h1>
      </div>
      <div className="rooms">
        {[...Array.from({ length: deviceCount }).keys()].map(i => <DeviceMonitor deviceId={i} key={i} />)}
      </div>
    </div>
  );
}

function App() {
  return (
    <ApolloProvider client={client}>
      <Dashboard />
    </ApolloProvider>
  );
}

export default App;