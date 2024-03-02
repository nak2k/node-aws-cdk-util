import { CustomResource, Duration, SecretValue, Stack } from "aws-cdk-lib";
import { IGrantable, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from "constructs";
import { CloudFrontKeyPairProperties } from "./cloudfrontkeypair-handler";
import { IPublicKey, PublicKey } from "aws-cdk-lib/aws-cloudfront";
import { join } from "path";
import { SSMUtil } from "../aws-ssm/SSMUtil";

export interface CloudFrontKeyPairProps {
  /**
   * The private key configuration.
   */
  privateKey?: {
    /**
     * The name of the SSM parameter to store the private key.
     */
    ssmParameter?: string;
  };

  /**
   * The boolean value whether only the custom resource provider is deployed for debugging.
   */
  providerOnly?: boolean;
}

/**
 * A custom resource to create a CloudFront public key and store a private key in SSM Parameter Store.
 */
export class CloudFrontKeyPair extends Construct {
  public static readonly resourceType = 'Custom::CloudFrontKeyPair';

  privateKeySecretValue: SecretValue;
  privateKeySsmParameterName: string;
  publicKey: IPublicKey;
  publicKeyId: string;

  constructor(scope: Construct, id: string, props: CloudFrontKeyPairProps = {}) {
    super(scope, id);

    const { privateKey = {}, providerOnly } = props;

    const serviceToken = this.createProvider(scope);

    if (providerOnly) {
      return;
    }

    const stack = Stack.of(scope);

    this.privateKeySsmParameterName = privateKey.ssmParameter ?? `/${stack.stackName}/${id}/private-key`;

    const customResource = new CustomResource(this, 'CustomResource', {
      resourceType: CloudFrontKeyPair.resourceType,
      serviceToken,
      properties: {
        PrivateKey: {
          SsmParameter: this.privateKeySsmParameterName,
        },
      } satisfies CloudFrontKeyPairProperties,
    });

    this.publicKeyId = customResource.ref;
    this.publicKey = PublicKey.fromPublicKeyId(this, 'PublicKey', this.publicKeyId);
    this.privateKeySecretValue = SecretValue.ssmSecure(this.privateKeySsmParameterName);
  }

  grantReadPrivateKey(grantee: IGrantable) {
    SSMUtil.grantReadStringParameter(grantee, this, this.privateKeySsmParameterName);
  }

  private createProvider(scope: Construct) {
    const providerId = `${CloudFrontKeyPair.resourceType}Provider`;
    const stack = Stack.of(scope);

    const provider = stack.node.tryFindChild(providerId) as Function
      ?? new Function(stack, providerId, {
        code: Code.fromAsset(join(__dirname, 'cloudfrontkeypair-handler')),
        runtime: Runtime.NODEJS_20_X,
        handler: "index.handler",
        initialPolicy: [
          new PolicyStatement({
            actions: [
              'cloudfront:*PublicKey',
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
