import { StringParameter, StringParameterProps } from 'aws-cdk-lib/aws-ssm';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Stack, StackProps, CfnOutput, CfnOutputProps, IResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { stringParameterNameForProp } from "../aws-ssm/stringParameterNameForProp";

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

  /**
   * Batch create CfnOutput.
   * 
   * @param outputs 
   */
  createOutputs(outputs: {
    [id: string]: CfnOutputProps;
  }) {
    for (const [id, props] of Object.entries(outputs)) {
      new CfnOutput(this, id, props);
    }
  }

  /**
   * Batch create StringParameter.
   * 
   * @param parameters 
   */
  createStringParameters(parameters: {
    [id: string]: StringParameterProps;
  }) {
    for (const [id, props] of Object.entries(parameters)) {
      new StringParameter(this, id, props);
    }
  }

  /**
   * Shorthand of StringParameter.valueFromLookup().
   * 
   * @param parameterName 
   * @returns 
   */
  valueFromLookup(parameterName: string) {
    return StringParameter.valueFromLookup(this, parameterName);
  }

  /**
   * Shorthand of StringParameter.valueForStringParameter().
   * 
   * @param parameterName 
   * @returns 
   * @deprecated Use valueForStringParameter() instead.
   */
  valueFromStringParameter(parameterName: string) {
    return StringParameter.valueForStringParameter(this, parameterName);
  }

  /**
   * Shorthand of StringParameter.valueForStringParameter().
   * 
   * @param parameterName 
   * @returns 
   */
  valueForStringParameter(parameterName: string) {
    return StringParameter.valueForStringParameter(this, parameterName);
  }

  valueForStringParameterOfProp<T extends IResource>(resource: T, propName: keyof T) {
    return StringParameter.valueForStringParameter(this, stringParameterNameForProp(resource, propName));
  }

  /**
   * Create a Bucket construct that has the name specified by SSM Parameter.
   * 
   * @param id 
   * @param parameterName 
   * @returns 
   */
  s3BucketFromStringParameter(id: string, parameterName: string) {
    return Bucket.fromBucketName(this, id, this.valueForStringParameter(parameterName));
  }
}
