import {
  stringArg,
  makeSchema,
  mutationType,
  objectType,
  intArg,
  queryType,
} from 'nexus';
import { validatePlugin, ValidationError } from 'nexus-validate';
import { UserInputError } from 'apollo-server';

let USERS = [
  {
    name: 'Test',
    email: 'test@test.com',
    age: 30,
    website: 'https://website.com',
  },
];

export const User = objectType({
  name: 'User',
  definition(t) {
    t.string('name');
    t.string('email');
    t.int('age');
    t.string('website');
    t.string('secret');
    t.list.field('friends', {
      type: User,
      args: {
        email: stringArg(),
      },
      validate: ({ string }) => ({
        email: string().email(),
      }),
      resolve: (_, args) => {
        return USERS;
      },
    });
  },
});

const Mutation = mutationType({
  definition(t) {
    t.field('createUser', {
      type: 'User',
      args: {
        name: stringArg(),
        email: stringArg(),
        age: intArg(),
        website: stringArg(),
        secret: stringArg(),
      },
      // this will get called before the resolver and we can use
      // the rules from the first argument together with args and context
      // to figure out if the provided arguments are valid or not
      validate: ({ string, number }, args, ctx) => ({
        name: string().trim(),
        email: string().email().trim(),
        age: number().min(18),
        website: string().url(),
        // create a custom rule for secret that uses a custom test,
        // the provided argument and the graphql context
        secret: string().test(
          'valid-secret',
          `${args.secret} is not the correct secret`,
          (value) => value === ctx.secret
        ),
      }),
      resolve: (_, args) => {
        return {
          ...USERS[0],
          ...args,
        };
      },
    });
  },
});

const Query = queryType({
  definition(t) {
    t.field('user', {
      type: 'User',
      args: {
        email: stringArg(),
      },
      validate: ({ string }, args, ctx) => ({
        email: string().email(),
      }),
      resolve: (_, args) => {
        return {
          ...USERS[0],
          ...args,
        };
      },
    });
  },
});

export const schema = makeSchema({
  types: [User, Mutation, Query],
  contextType: {
    module: require.resolve('./context'),
    export: 'Context',
  },
  outputs: {
    schema: __dirname + '/../schema.graphql',
    typegen: __dirname + '/generated/nexus.ts',
  },
  // add the plugin with a custom `formatError` function
  // that passed the error to apollos UserInputError
  plugins: [
    validatePlugin({
      formatError: ({ error }) => {
        if (error instanceof ValidationError) {
          return new UserInputError(error.message, {
            invalidArgs: [error.path],
          });
        }

        return error;
      },
    }),
  ],
});
