import { plugin } from 'nexus';
import {
  ArgsValue,
  GetGen,
  MaybePromise,
  printedGenTyping,
  printedGenTypingImport,
} from 'nexus/dist/core';
import * as yup from 'yup';
import { ObjectShape } from 'yup/lib/object';

type Yup = typeof yup;

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
  yup: Yup,
  args: ArgsValue<TypeName, FieldName>,
  ctx: GetGen<'context'>
) => MaybePromise<ObjectShape | void>;

export interface ValidatePluginErrorConfig {
  // can be of type `yup.ValidationError`
  error: Error | yup.ValidationError;
  args: any;
  ctx: GetGen<'context'>;
}

export interface ValidatePluginConfig {
  formatError?: (config: ValidatePluginErrorConfig) => Error;
}

export const defaultFormatError = ({
  error,
}: ValidatePluginErrorConfig): Error => {
  if (error instanceof yup.ValidationError) {
    return new NexusValidateError(error.message, {
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
          const schemaBase = await validate(yup, args, ctx);
          if (typeof schemaBase !== 'undefined') {
            const schema = yup.object().shape(schemaBase);
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

export class NexusValidateError extends Error {
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

export { ValidationError as YupValidationError } from 'yup';
