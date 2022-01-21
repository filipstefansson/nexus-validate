import { graphql } from 'graphql';
import { makeSchema, objectType } from 'nexus';
import { floatArg, intArg, mutationField, stringArg } from 'nexus/dist/core';

import { UserInputError, validatePlugin } from '../src/index';

describe('validatePlugin', () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  afterEach(() => {
    jest.resetAllMocks();
  });

  const schemaTypes = [
    objectType({
      name: 'User',
      definition(t) {
        t.int('id');
      },
    }),
    mutationField('validate', {
      type: 'User',
      args: {
        email: stringArg(),
        id: intArg(),
      },
      // @ts-ignore
      validate: ({ string }, args, ctx) => {
        if (args.id !== ctx.user.id) {
          throw new UserInputError('invalid id', {
            invalidArgs: ['id'],
          });
        }
        return {
          email: string().email(),
        };
      },
      resolve: () => ({ id: 1 }),
    }),
  ];
  const testSchema = makeSchema({
    outputs: false,
    types: schemaTypes,
    nonNullDefaults: {
      output: true,
    },
    plugins: [validatePlugin()],
  });
  const mockCtx = { user: { id: 1 } };
  const testOperation = (
    mutation: string,
    schema = testSchema,
    fields?: string
  ) => {
    return graphql(
      schema,
      `
        mutation {
          ${mutation} {
            ${fields ? fields : 'id'}
          }
        }
      `,
      {},
      mockCtx
    );
  };

  it('returns error of validation error', async () => {
    const { data, errors = [] } = await testOperation(
      'validate(email: "bad@email", id: 1)'
    );
    expect(data).toBeNull();
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('email must be a valid email');
    expect(errors[0].extensions).toEqual({
      code: 'BAD_USER_INPUT',
      invalidArgs: ['email'],
    });
  });

  it('can returns data if validation passed', async () => {
    const { data, errors = [] } = await testOperation(
      'validate(email: "god@email.com", id: 1)'
    );
    expect(errors).toEqual([]);
    expect(data?.validate).toEqual({ id: 1 });
  });

  it('can check args agains context', async () => {
    const { data, errors = [] } = await testOperation(
      'validate(email: "good@email.com", id: 2)'
    );
    expect(data).toBeNull();
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual('invalid id');
    expect(errors[0].extensions).toEqual({
      code: 'BAD_USER_INPUT',
      invalidArgs: ['id'],
    });
  });

  it('warns if field are missing arguments', async () => {
    const schema = makeSchema({
      outputs: false,
      nonNullDefaults: {
        output: true,
      },
      plugins: [validatePlugin()],
      types: [
        objectType({
          name: 'ShouldWarn',
          definition(t) {
            t.int('id', {
              // @ts-ignore
              validate: () => {},
            });
          },
        }),
        mutationField('shouldWarn', {
          type: 'ShouldWarn',
          // @ts-ignore
          resolve: () => ({ id: 1 }),
        }),
      ],
    });
    const { data } = await testOperation('shouldWarn', schema);
    expect(data?.shouldWarn).toEqual({ id: 1 });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]).toMatchSnapshot();
  });

  it('warns if validate is not a function', async () => {
    const schema = makeSchema({
      outputs: false,
      nonNullDefaults: {
        output: true,
      },
      plugins: [validatePlugin()],
      types: [
        objectType({
          name: 'ShouldWarn',
          definition(t) {
            t.int('id');
          },
        }),
        mutationField('shouldWarn', {
          type: 'ShouldWarn',
          // @ts-ignore
          validate: {},
          resolve: () => ({ id: 1 }),
        }),
      ],
    });
    const { data } = await testOperation('shouldWarn', schema);
    expect(data?.shouldWarn).toEqual({ id: 1 });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]).toMatchSnapshot();
  });

  it('it transforms data if validation passed', async () => {
    const schema = makeSchema({
      outputs: false,
      nonNullDefaults: {
        output: true,
      },
      plugins: [validatePlugin()],
      types: [
        objectType({
          name: 'ShouldTransform',
          definition(t) {
            t.int('round');
            t.int('truncate');
            t.string('trim');
            t.string('lowercase');
          },
        }),
        mutationField('shouldTransform', {
          type: 'ShouldTransform',
          args: {
            round: floatArg(),
            truncate: floatArg(),
            trim: stringArg(),
            lowercase: stringArg(),
          },

          // @ts-ignore
          validate: ({ string, number }) => {
            return {
              round: number().round(),
              truncate: number().truncate(),
              trim: string().trim(),
              lowercase: string().lowercase(),
            };
          },
          resolve: (_, args) => args,
        }),
      ],
    });

    const { data } = await testOperation(
      `
      shouldTransform(round:5.9, trim: " trim me", lowercase: "LOWERCASE", truncate: 5.888)
    `,
      schema,
      `
      round
      trim 
      lowercase
      truncate
      `
    );
    expect(data?.shouldTransform).toEqual({
      round: 6,
      trim: 'trim me',
      lowercase: 'lowercase',
      truncate: 5,
    });
  });
});
