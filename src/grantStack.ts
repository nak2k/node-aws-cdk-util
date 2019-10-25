import { PolicyStatement, IGrantable } from '@aws-cdk/aws-iam';
import { Stack } from '@aws-cdk/core';

export function grantStack(identity: IGrantable, stack: Stack) {
  identity.grantPrincipal.addToPolicy(new PolicyStatement({
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
      stack.formatArn({
        service: 'cloudformation',
        resource: 'stack',
        resourceName: `${stack.stackName}/*`,
      }),
    ],
  }));
}
