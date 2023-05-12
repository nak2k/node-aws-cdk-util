import { IResource } from "aws-cdk-lib";

export function stringParameterNameForProp<T extends IResource>(resource: T, propName: keyof T) {
  return `/${resource.stack.stackName}/${resource.node.id}/${String(propName)}`;
}
