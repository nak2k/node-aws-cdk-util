import { StringParameter, StringParameterProps } from 'aws-cdk-lib/aws-ssm';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Stack, StackProps, CfnOutput, CfnOutputProps, IResource, CfnResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { stringParameterNameForProp } from "../aws-ssm/stringParameterNameForProp";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";

export class DefaultEnvStack extends Stack {
  private _defaultVpc: IVpc;

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
   * Batch create CfnOutput resources.
   *
   * @param outputs Map of output IDs to their props
   */
  createOutputs(outputs: {
    [id: string]: CfnOutputProps;
  }) {
    for (const [id, props] of Object.entries(outputs)) {
      new CfnOutput(this, id, props);
    }
  }

  /**
   * Batch create StringParameter resources.
   *
   * @param parameters Map of parameter IDs to their props
   */
  createStringParameters(parameters: {
    [id: string]: StringParameterProps;
  }) {
    for (const [id, props] of Object.entries(parameters)) {
      new StringParameter(this, id, props);
    }
  }

  /**
   * Shorthand for StringParameter.valueFromLookup().
   *
   * @param parameterName SSM parameter name
   * @returns Parameter value
   */
  valueFromLookup(parameterName: string) {
    return StringParameter.valueFromLookup(this, parameterName);
  }

  /**
   * Shorthand for StringParameter.valueForStringParameter().
   *
   * @param parameterName SSM parameter name
   * @returns Parameter value token
   * @deprecated Use valueForStringParameter() instead.
   */
  valueFromStringParameter(parameterName: string) {
    return StringParameter.valueForStringParameter(this, parameterName);
  }

  /**
   * Shorthand for StringParameter.valueForStringParameter().
   *
   * @param parameterName SSM parameter name
   * @returns Parameter value token
   */
  valueForStringParameter(parameterName: string) {
    return StringParameter.valueForStringParameter(this, parameterName);
  }

  /**
   * Get the value token of a StringParameter for a resource property.
   *
   * @param resource Target resource
   * @param propName Property name of the resource
   * @returns Parameter value token
   */
  valueForStringParameterOfProp<T extends IResource | CfnResource>(resource: T, propName: keyof T) {
    return StringParameter.valueForStringParameter(this, stringParameterNameForProp(resource, propName));
  }

  /**
   * Get a StringParameter reference for a resource property.
   *
   * @param id Construct ID
   * @param resource Target resource
   * @param propName Property name of the resource
   * @returns StringParameter construct
   */
  stringParameterForResource<T extends IResource | CfnResource>(id: string, resource: T, propName: keyof T) {
    return StringParameter.fromStringParameterName(this, id, stringParameterNameForProp(resource, propName));
  }

  /**
   * Create a Bucket construct with the name specified by an SSM Parameter.
   *
   * @param id Construct ID
   * @param parameterName SSM parameter name containing the bucket name
   * @returns S3 Bucket construct
   */
  s3BucketFromStringParameter(id: string, parameterName: string) {
    return Bucket.fromBucketName(this, id, this.valueForStringParameter(parameterName));
  }

  /**
   * Import the default VPC by calling Vpc.fromLookup().
   *
   * @param id Construct ID (defaults to "Vpc")
   * @returns VPC construct
   */
  defaultVpc(id: string = "Vpc") {
    if (!this._defaultVpc) {
      this._defaultVpc = Vpc.fromLookup(this, id, { isDefault: true });
    }

    return this._defaultVpc;
  }
}
