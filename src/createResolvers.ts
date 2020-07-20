import type { BaseDataSource, BaseResolverProps } from '@aws-cdk/aws-appsync';

export interface FieldProps extends Omit<Omit<BaseResolverProps, 'typeName'>, 'fieldName'> {
  dataSource: BaseDataSource,
}

export interface ResolverMap {
  [typeName: string]: {
    [fieldName: string]: FieldProps;
  };
}

export function createResolvers(resolverMap: ResolverMap) {
  for (const [typeName, fieldMap] of Object.entries(resolverMap)) {
    for (const [fieldName, props] of Object.entries(fieldMap)) {
      props.dataSource.createResolver({
        ...props,
        typeName,
        fieldName,
      });
    }
  }
}
