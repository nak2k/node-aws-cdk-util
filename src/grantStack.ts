import { PolicyStatement, IGrantable } from '@aws-cdk/aws-iam';
import { Aws, Stack } from '@aws-cdk/core';

export function grantStack(identity: IGrantable, stack: Stack) {
  grantStackByArn(identity, stack.formatArn({
    service: 'cloudformation',
    resource: 'stack',
    resourceName: `${stack.stackName}/*`,
  }));
}

export function grantStackByName(identity: IGrantable, stackName: string) {
  grantStackByArn(identity, `arn:${Aws.PARTITION}:cloudformation:${Aws.REGION}:${Aws.ACCOUNT_ID}:stack/${stackName}/*`);
}

export function grantStackByArn(identity: IGrantable, stackArn: string) {
  identity.grantPrincipal.addToPrincipalPolicy(new PolicyStatement({
    actions: [
      'cloudformation:DescribeStack*',
      'cloudformation:CreateStack',
      'cloudformation:UpdateStack',
      'cloudformation:DeleteStack',

      'cloudformation:DescribeChangeSet',
      'cloudformation:ExecuteChangeSet',
      'cloudformation:CreateChangeSet',
      'cloudformation:DeleteChangeSet',

      'cloudformation:GetTemplate*',
      'cloudformation:ValidateTemplate',

      'cloudformation:GetStackPolicy',
      'cloudformation:SetStackPolicy',
    ],
    resources: [
      stackArn,
    ],
  }));
}

