import {
  ArgsValue,
  CreateFieldResolverInfo,
  GetGen,
  MaybePromise,
  MiddlewareFn,
} from 'nexus/dist/core';

import { ObjectShape, rules, ValidationRules } from './rules';
import { ValidatePluginConfig } from './index';
import { defaultFormatError } from './error';

export type ValidateResolver<
  TypeName extends string,
  FieldName extends string
> = (
  rules: ValidationRules,
  args: ArgsValue<TypeName, FieldName>,
  ctx: GetGen<'context'>
) => MaybePromise<ObjectShape | void>;

export type InputObjectValidateResolver = (
  rules: ValidationRules
) => ObjectShape;

export const resolver = (validateConfig: ValidatePluginConfig = {}) => (
  config: CreateFieldResolverInfo
): MiddlewareFn | undefined => {
  const { formatError = defaultFormatError } = validateConfig;

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

  const args = config?.fieldConfig?.args ?? {};
  if (Object.keys(args).length === 0) {
    console.error(
      '\x1b[33m%s\x1b[0m',
      `[${config.parentTypeConfig.name}.${config.fieldConfig.name}] does not have any arguments, but a validate function was passed`
    );
  }

  return async (root, args, ctx, info, next) => {
    try {
      const schemaBase = await validate(rules, args, ctx);
      if (typeof schemaBase !== 'undefined') {
        const schema = rules.object().shape(schemaBase);
        await schema.validate(args);
      }
      return next(root, args, ctx, info);
    } catch (error) {
      throw formatError({ error, args, ctx });
    }
  };
};
