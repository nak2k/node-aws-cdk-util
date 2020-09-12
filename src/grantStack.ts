import { PolicyStatement, IGrantable } from '@aws-cdk/aws-iam';
import { Aws, Stack } from '@aws-cdk/core';

export function grantStack(identity: IGrantable, stack: Stack) {
  grantStacks(identity, stack);
}

export function grantStackByName(identity: IGrantable, stackName: string) {
  grantStacks(identity, stackName);
}

export function grantStackByArn(identity: IGrantable, stackArn: string) {
  grantStacks(identity, stackArn);
}

export function grantStacks(identity: IGrantable, ...stacks: (string | Stack)[]) {
  const resources = stacks.map(stack => {
    if (typeof stack === 'string') {
      if (stack.startsWith('arn:')) {
        return stack;
      } else {
        return `arn:${Aws.PARTITION}:cloudformation:${Aws.REGION}:${Aws.ACCOUNT_ID}:stack/${stack}/*`
      }
    } else {
      return stack.formatArn({
        service: 'cloudformation',
        resource: 'stack',
        resourceName: `${stack.stackName}/*`,
      });
    }
  });

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
    resources,
  }));
}

