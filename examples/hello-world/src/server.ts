import { ApolloServer } from 'apollo-server';
import { createContext } from './context';
import { schema } from './schema';

const server = new ApolloServer({
  context: createContext(),
  schema,
});

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
