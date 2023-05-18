import { IResource } from "aws-cdk-lib";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { stringParameterNameForProp } from "./stringParameterNameForProp";

export function addStringParameterForProp<T extends IResource>(resource: T, propName: keyof T) {
  return new StringParameter(resource, `StringParameter.${String(propName)}`, {
    parameterName: stringParameterNameForProp<T>(resource, propName),
    stringValue: String(resource[propName]),
  });
}

export function addStringParametersForProps<T extends IResource>(resource: T, ...propNames: ReadonlyArray<keyof T>) {
  return propNames.map(propName => addStringParameterForProp(resource, propName));
}
