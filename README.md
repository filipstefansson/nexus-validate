# nexus-validate

[![npm](https://img.shields.io/npm/v/nexus-validate)](https://www.npmjs.com/package/nexus-validate)
[![npm bundle size](https://img.shields.io/bundlephobia/min/nexus-validate)](https://bundlephobia.com/result?p=nexus-validate)
![build-publish](https://github.com/filipstefansson/nexus-validate/workflows/build-publish/badge.svg)
[![codecov](https://codecov.io/gh/filipstefansson/nexus-validate/branch/alpha/graph/badge.svg?token=MR3OPGNYBU)](https://codecov.io/gh/filipstefansson/nexus-validate)

Add extra validation to [GraphQL Nexus](https://github.com/graphql-nexus/nexus) in an easy and expressive way.

```ts
const UserMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createUser', {
      type: 'User',

      // add arguments
      args: {
        email: stringArg(),
        age: intArg(),
      },

      // add the extra validation
      validate: ({ string, number }) => ({
        email: string().email(),
        age: number().moreThan(18).integer(),
      }),
    });
  },
});
```

## Documentation

- [Installation](#installation)
- [Usage](#usage)
  - [Custom validations](#custom-validations)
  - [Custom errors](#custom-errors)
  - [Custom error messages](#custom-error-messages)
- [API](#api)
- [Examples](#examples)

## Installation

```console
# npm
npm i nexus-validate yup

# yarn
yarn add nexus-validate yup
```

> `nexus-validate` uses [`yup`](https://github.com/jquense/yup) under the hood so you need to install that too. `nexus` and `graphql` are also required, but if you are using Nexus then both of those should already be installed.

### Add the plugin to Nexus:

Once installed you need to add the plugin to your nexus schema configuration:

```ts
import { makeSchema } from 'nexus';
import { validatePlugin } from 'nexus-validate';

const schema = makeSchema({
  ...
  plugins: [
    ...
    validatePlugin(),
  ],
});
```

## Usage

The `validate` method can be added to any field with `args`:

```ts
const UserMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createUser', {
      type: 'User',
      args: {
        email: stringArg(),
      },
      validate: ({ string }) => ({
        // validate that email is an actual email
        email: string().email(),
      }),
    });
  },
});
```

Trying to call the above with an invalid email will result in the following error:

```json
{
  "errors": [
    {
      "message": "email must be a valid email",
      "extensions": {
        "invalidArgs": ["email"],
        "code": "BAD_USER_INPUT"
      }
      ...
    }
  ]
}
```

### Custom validations

If you don't want to use the built-in validation rules, you can roll your own by **throwing an error if an argument is invalid**, and **returning void** if everything is OK.

```ts
import { UserInputError } from 'nexus-validate';
t.field('createUser', {
  type: 'User',
  args: {
    email: stringArg(),
  },
  // use args and context to check if email is valid
  validate(_, args, context) {
    if (args.email !== context.user.email) {
      throw new UserInputError('not your email', {
        invalidArgs: ['email'],
      });
    }
  },
});
```

### Custom errors

The plugin provides a `formatError` option where you can format the error however you'd like:

```ts
import { UserInputError } from 'apollo-server';
import { validatePlugin, ValidationError } from 'nexus-validate';

const schema = makeSchema({
  ...
  plugins: [
    ...
    validatePlugin({
      formatError: ({ error }) => {
        if (error instanceof ValidationError) {
          // convert error to UserInputError from apollo-server
          return new UserInputError(error.message, {
            invalidArgs: [error.path],
          });
        }

        return error;
      },
    }),
  ],
});
```

### Custom error messages

If you want to change the error message for the validation rules, that's usually possible by passing a message to the rule:

```ts
validate: ({ string }) => ({
  email: string()
    .email('must be a valid email address')
    .required('email is required'),
});
```

## API

##### `validate(rules: ValidationRules, args: Args, ctx: Context) => Promise<Schema | boolean>`

### ValidationRules

| Type    | Docs                                           | Example                                    |
| :------ | :--------------------------------------------- | :----------------------------------------- |
| string  | [docs](https://github.com/jquense/yup#string)  | `string().email().max(20).required()`      |
| number  | [docs](https://github.com/jquense/yup#number)  | `number().moreThan(18).number()`           |
| boolean | [docs](https://github.com/jquense/yup#boolean) | `boolean()`                                |
| date    | [docs](https://github.com/jquense/yup#date)    | `date().min('2000-01-01').max(new Date())` |
| object  | [docs](https://github.com/jquense/yup#object)  | `object({ name: string() })`               |
| array   | [docs](https://github.com/jquense/yup#array)   | `array.min(5).of(string())`                |

### Args

The `Args` argument will return whatever you passed in to `args` in your field definition:

```ts
t.field('createUser', {
  type: 'User',
  args: {
    email: stringArg(),
    age: numberArg(),
  },
  // email and age will be typed as a string and a number
  validate: (_, { email, age }) => {}
}
```

### Context

`Context` is your GraphQL context, which can give you access to things like the current user or your data sources. This will let you validation rules based on the context of your API.

```ts
t.field('createUser', {
  type: 'User',
  args: {
    email: stringArg(),
  },
  validate: async (_, { email }, { prisma }) => {
    const count = await prisma.user.count({ where: { email } });
    if (count > 1) {
      throw new Error('email already taken');
    }
  },
});
```

## Examples

- [Hello World Example](examples/hello-world)

## License

**nexus-validate** is provided under the MIT License. See LICENSE for details.
