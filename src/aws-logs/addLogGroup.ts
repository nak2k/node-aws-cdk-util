import { CfnResource, Fn } from "aws-cdk-lib";
import { LogGroup, LogGroupProps } from "aws-cdk-lib/aws-logs";
import { IConstruct } from "constructs";

export function addLogGroup(scope: IConstruct, logGroupProps?: LogGroupProps) {
  const resource = scope.node.defaultChild;

  if (!(resource instanceof CfnResource)) {
    throw new Error(`The scope ${scope.node.path} has no resource`);
  }

  return new LogGroup(resource, "LogGroup", {
    ...logGroupProps,
    logGroupName: Fn.join('', [getLogGroupPrefix(resource), resource.ref]),
  });
}

function getLogGroupPrefix(resource: CfnResource) {
  const type = resource.cfnResourceType;

  if (type === 'AWS::Lambda::Function') {
    return '/aws/lambda/';
  } else if (type === 'AWS::CodeBuild::Project') {
    return '/aws/codebuild/';
  } else {
    throw new Error(`Not supported resource type ${resource}`);
  }
}
