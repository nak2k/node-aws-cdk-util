import { CustomResource, Duration, SecretValue, Stack } from "aws-cdk-lib";
import { IGrantable, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from "constructs";
import { KeyPairProperties } from "./keypair-handler";
import { IStringParameter, StringParameter } from "aws-cdk-lib/aws-ssm";
import { join } from "path";
import { SSMUtil } from "../aws-ssm/SSMUtil";

export interface KeyPairProps {
  type?: "rsa";
  modulusLength: number;
  privateKey?: {
    ssmParameter?: string;
  };

  publicKey?: {
    ssmParameter?: string;
  };

  /**
   * The boolean value whether only the custom resource provider is deployed for debugging.
   */
  providerOnly?: boolean;
}

export class KeyPair extends Construct {
  public static readonly resourceType = 'Custom::KeyPair';

  privateKeySecretValue: SecretValue;
  publicKeySsmParameter: IStringParameter;
  privateKeySsmParameterName: string;
  publicKeySsmParameterName: string;

  constructor(scope: Construct, id: string, props: KeyPairProps) {
    super(scope, id);

    const { privateKey = {}, publicKey = {}, providerOnly } = props;

    const serviceToken = this.createProvider(scope);

    if (providerOnly) {
      return;
    }

    const stack = Stack.of(scope);

    this.privateKeySsmParameterName = privateKey.ssmParameter ?? `/${stack.stackName}/${id}/private-key`;
    this.publicKeySsmParameterName = publicKey.ssmParameter ?? `/${stack.stackName}/${id}/public-key`;

    new CustomResource(this, 'CustomResource', {
      resourceType: KeyPair.resourceType,
      serviceToken,
      properties: {
        Type: props.type ?? "rsa",
        ModulusLength: props.modulusLength,
        PrivateKey: {
          SsmParameter: this.privateKeySsmParameterName,
        },
        PublicKey: {
          SsmParameter: this.publicKeySsmParameterName,
        }
      } satisfies KeyPairProperties,
    });

    this.privateKeySecretValue = SecretValue.ssmSecure(this.privateKeySsmParameterName);
    this.publicKeySsmParameter = StringParameter.fromStringParameterName(this, 'PublicKeySsmParameter', this.publicKeySsmParameterName);
  }

  grantReadPrivateKey(grantee: IGrantable) {
    SSMUtil.grantReadStringParameter(grantee, this, this.privateKeySsmParameterName);
  }

  grantReadPublicKey(grantee: IGrantable) {
    SSMUtil.grantReadStringParameter(grantee, this, this.publicKeySsmParameterName);
  }

  private createProvider(scope: Construct) {
    const providerId = `${KeyPair.resourceType}Provider`;
    const stack = Stack.of(scope);

    const provider = stack.node.tryFindChild(providerId) as Function
      ?? new Function(stack, providerId, {
        code: Code.fromAsset(join(__dirname, 'keypair-handler')),
        runtime: Runtime.NODEJS_20_X,
        handler: "index.handler",
        initialPolicy: [
          new PolicyStatement({
            actions: [
              'ssm:DeleteParameter*',
              'ssm:GetParameter*',
              'ssm:PutParameter',
              's3:GetObject*',
              's3:PutObject*',
            ],
            resources: ['*'],
          }),
        ],
        timeout: Duration.minutes(15),
        retryAttempts: 1,
      });

    return provider.functionArn;
  }
}
