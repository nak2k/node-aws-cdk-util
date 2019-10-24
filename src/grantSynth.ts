import { PolicyStatement, IGrantable } from "@aws-cdk/aws-iam";
import { Stack, IConstruct } from "@aws-cdk/core";
import { DEFAULT_TOOLKIT_STACK_NAME } from "aws-cdk/lib/api/deployment-target";

/**
 * Grant permissions for executing `cdk synth`.
 *
 * @param identity The principal.
 */
export function grantSynth(identity: IGrantable & IConstruct) {
  const toolkitStackArn = Stack.of(identity).formatArn({
    service: 'cloudformation',
    resource: 'stack',
    resourceName: `${DEFAULT_TOOLKIT_STACK_NAME}/*`,
  });

  identity.grantPrincipal.addToPolicy(new PolicyStatement({
    actions: [
      'cloudformation:DescribeStack*',
    ],
    resources: [
      toolkitStackArn,
    ],
  }));

  identity.grantPrincipal.addToPolicy(new PolicyStatement({
    actions: [
      's3:*Object',
      's3:ListBucket',
    ],
    resources: [
      'arn:aws:s3:::cdktoolkit-stagingbucket-*'
    ],
  }));
}
