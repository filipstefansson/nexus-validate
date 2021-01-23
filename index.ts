import { plugin } from 'nexus';
import {
  ArgsValue,
  GetGen,
  MaybePromise,
  printedGenTyping,
  printedGenTypingImport,
} from 'nexus/dist/core';
import {
  ValidationError,
  string,
  number,
  boolean,
  date,
  object,
  array,
} from 'yup';
import { ObjectShape } from 'yup/lib/object';

const rules = {
  string,
  number,
  boolean,
  date,
  object,
  array,
};

type ValidationRules = typeof rules;

const ValidateResolverImport = printedGenTypingImport({
  module: 'nexus-validate',
  bindings: ['ValidateResolver'],
});

const fieldDefTypes = printedGenTyping({
  optional: true,
  name: 'validate',
  description: 'Validate mutation arguments.',
  type: 'ValidateResolver<TypeName, FieldName>',
  imports: [ValidateResolverImport],
});

export type ValidateResolver<
  TypeName extends string,
  FieldName extends string
> = (
  rules: ValidationRules,
  args: ArgsValue<TypeName, FieldName>,
  ctx: GetGen<'context'>
) => MaybePromise<ObjectShape | void>;

export interface ValidatePluginErrorConfig {
  // can be of type `yup.ValidationError`
  error: Error | ValidationError;
  args: any;
  ctx: GetGen<'context'>;
}

export interface ValidatePluginConfig {
  formatError?: (config: ValidatePluginErrorConfig) => Error;
}

export const defaultFormatError = ({
  error,
}: ValidatePluginErrorConfig): Error => {
  if (error instanceof ValidationError) {
    return new UserInputError(error.message, {
      invalidArgs: error.path ? [error.path] : [],
    });
  }

  return error;
};

export const validatePlugin = (validateConfig: ValidatePluginConfig = {}) => {
  const { formatError = defaultFormatError } = validateConfig;

  return plugin({
    name: 'NexusValidate',
    description: 'The validate plugin provides validation for arguments.',
    fieldDefTypes: fieldDefTypes,
    onCreateFieldResolver(config) {
      const validate: ValidateResolver<any, any> =
        config.fieldConfig.extensions?.nexus?.config.validate;

      // if the field doesn't have an validate field,
      // don't worry about wrapping the resolver
      if (validate == null) {
        return;
      }

      // if it does have this field, but it's not a function,
      // it's wrong - let's provide a warning
      if (typeof validate !== 'function') {
        console.error(
          '\x1b[33m%s\x1b[0m',
          `The validate property provided to [${
            config.fieldConfig.name
          }] with type [${
            config.fieldConfig.type
          }]. Should be a function, saw [${typeof validate}]`
        );
        return;
      }

      if (['Mutation', 'Query'].indexOf(config.parentTypeConfig.name) === -1) {
        console.warn(
          '\x1b[33m%s\x1b[0m',
          `The validate property was provided to [${config.fieldConfig.name}] with parent [${config.parentTypeConfig.name}]. Should have parent [Query] or [Mutation].`
        );
      }

      return async (root, args, ctx, info, next) => {
        try {
          const schemaBase = await validate(rules, args, ctx);
          if (typeof schemaBase !== 'undefined') {
            const schema = object().shape(schemaBase);
            await schema.validate(args);
          }
          return next(root, args, ctx, info);
        } catch (error) {
          throw formatError({ error, args, ctx });
        }
      };
    },
  });
};

export class UserInputError extends Error {
  extensions: {
    invalidArgs: string[];
  };

  constructor(
    message: string,
    extensions: {
      invalidArgs: string[];
    }
  ) {
    super(message);
    this.extensions = extensions;
  }
}

export { ValidationError };
