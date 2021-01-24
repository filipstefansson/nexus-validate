import { graphql } from 'graphql';
import { makeSchema, objectType } from 'nexus';
import { intArg, mutationField, stringArg } from 'nexus/dist/core';
import { UserInputError, validatePlugin } from '../src/index';

describe('validatePlugin', () => {
  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => {});
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
  const testOperation = (mutation: string, schema = testSchema) => {
    return graphql(
      schema,
      `
        mutation {
          ${mutation} {
            id
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

  it('warns if validate is added in an invalid way', async () => {
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
          validate: {},
          resolve: () => ({ id: 1 }),
        }),
      ],
    });
    const { data } = await testOperation('shouldWarn', schema);
    expect(data?.shouldWarn).toEqual({ id: 1 });
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]).toMatchSnapshot();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]).toMatchSnapshot();
  });
});
