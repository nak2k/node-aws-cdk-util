import { IResource } from "aws-cdk-lib";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { stringParameterNameForProp } from "./stringParameterNameForProp";

export function addStringParameterForProp<T extends IResource>(resource: T, propName: keyof T) {
  return new StringParameter(resource, "StringParameter", {
    parameterName: stringParameterNameForProp<T>(resource, propName),
    stringValue: String(resource[propName]),
  });
}
