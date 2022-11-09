import { CfnResource, Fn } from "aws-cdk-lib";
import { LogGroup, LogGroupProps } from "aws-cdk-lib/aws-logs";

export function addLogGroup(resource: CfnResource, logGroupProps?: LogGroupProps) {
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
