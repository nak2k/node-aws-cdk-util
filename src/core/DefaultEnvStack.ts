import { StringParameter, StringParameterProps } from 'aws-cdk-lib/aws-ssm';
import { Stack, StackProps, CfnOutput, CfnOutputProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DefaultEnvStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, {
      ...props,
      env: props.env || {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
      },
    });
  }

  createOutputs(outputs: {
    [id: string]: CfnOutputProps;
  }) {
    for (const [id, props] of Object.entries(outputs)) {
      new CfnOutput(this, id, props);
    }
  }

  createStringParameters(parameters: {
    [id: string]: StringParameterProps;
  }) {
    for (const [id, props] of Object.entries(parameters)) {
      new StringParameter(this, id, props);
    }
  }

  valueFromLookup(parameterName: string) {
    return StringParameter.valueFromLookup(this, parameterName);
  }
}
