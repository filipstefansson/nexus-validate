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

const FieldValidateResolverImport = printedGenTypingImport({
  module: 'nexus-validate',
  bindings: ['FieldValidateResolver'],
});

const fieldDefTypes = printedGenTyping({
  optional: true,
  name: 'validate',
  description: 'Validate mutation arguments.',
  type: 'FieldValidateResolver<TypeName, FieldName>',
  imports: [FieldValidateResolverImport],
});

export type FieldValidateResolver<
  TypeName extends string,
  FieldName extends string
> = (
  yup: Yup,
  args: ArgsValue<TypeName, FieldName>,
  ctx: GetGen<'context'>
) => MaybePromise<ObjectShape>;

export interface FieldValidatePluginErrorConfig {
  // can be of type `yup.ValidationError`
  error: Error | yup.ValidationError;
  args: any;
  ctx: GetGen<'context'>;
}

export interface FieldValidatePluginConfig {
  formatError?: (config: FieldValidatePluginErrorConfig) => Error;
}

export const defaultFormatError = ({
  error,
}: FieldValidatePluginErrorConfig): Error => {
  if (error instanceof yup.ValidationError) {
    return new NexusValidateError(error.message, {
      invalidArgs: error.path ? [error.path] : [],
    });
  }

  return error;
};

export const fieldValidatePlugin = (
  validateConfig: FieldValidatePluginConfig = {}
) => {
  const { formatError = defaultFormatError } = validateConfig;

  return plugin({
    name: 'NexusValidate',
    description: 'The validate plugin provides validation for arguments.',
    fieldDefTypes: fieldDefTypes,
    onCreateFieldResolver(config) {
      const validate: FieldValidateResolver<any, any> =
        config.fieldConfig.extensions?.nexus?.config.validate;

      // if the field doesn't have an validate field, don't worry about wrapping the resolver
      if (validate == null) {
        return;
      }

      // if it does have this field, but it's not a function, it's wrong - let's provide a warning
      if (typeof validate !== 'function') {
        console.error(
          new Error(
            `The validate property provided to ${
              config.fieldConfig.name
            } with type ${
              config.fieldConfig.type
            } should be a function, saw ${typeof validate}`
          )
        );
        return;
      }

      return async (root, args, ctx, info, next) => {
        try {
          const schemaBase = await validate(yup, args, ctx);
          const schema = yup.object().shape(schemaBase);
          await schema.validate(args);
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
