import { CfnResource, IResource } from "aws-cdk-lib";

export function stringParameterNameForProp<T extends IResource | CfnResource>(resource: T, propName: keyof T) {
  return `/${resource.stack.stackName}/${resource.node.id}/${String(propName)}`;
}
