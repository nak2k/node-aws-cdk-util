import { Stack } from "aws-cdk-lib";
import { Grant, IGrantable } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class SSMUtil {
  static grantReadStringParameter(grantee: IGrantable, scope: Construct, parameterName: string) {
    if (!parameterName.startsWith('/')) {
      parameterName = `/${parameterName}`;
    }

    const parameterArn = Stack.of(scope).formatArn({
      service: 'ssm',
      resource: `parameter${parameterName}`,
    });

    return Grant.addToPrincipal({
      grantee,
      actions: [
        'ssm:DescribeParameters',
        'ssm:GetParameters',
        'ssm:GetParameter',
        'ssm:GetParameterHistory',
      ],
      resourceArns: [parameterArn],
    });
  }
}



